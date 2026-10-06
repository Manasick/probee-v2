-- STEP 27: restore the admin digital fulfillment RPC contract used by the V2 server actions.
-- These functions are staff-only, run with an empty search_path, and re-check
-- order/payment/product eligibility inside the database.

create or replace function public.fulfill_digital_order_item(
  p_order_item_id uuid,
  p_customer_access_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_item record;
  v_entitlement public.digital_entitlements%rowtype;
  v_delivery_type text;
  v_delivery_details text;
  v_duration integer;
  v_duration_unit text;
  v_expires_at timestamptz;
begin
  if not private.is_staff() then
    raise exception 'digital:not_authorized';
  end if;

  if p_order_item_id is null then
    raise exception 'digital:order_item_not_found';
  end if;

  select
    oi.id as order_item_id,
    oi.order_id,
    oi.product_id,
    oi.plan_id,
    o.user_id,
    o.order_status,
    o.payment_status,
    p.product_type,
    p.delivery_type as product_delivery_type,
    p.delivery_details as product_delivery_details,
    pp.delivery_type as plan_delivery_type,
    pp.delivery_details as plan_delivery_details,
    pp.duration as plan_duration,
    pp.duration_unit as plan_duration_unit,
    p.duration as product_duration,
    p.duration_unit as product_duration_unit
  into v_item
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  left join public.products p on p.id = oi.product_id
  left join public.product_plans pp on pp.id = oi.plan_id
  where oi.id = p_order_item_id;

  if not found then
    raise exception 'digital:order_item_not_found';
  end if;

  if v_item.order_id is null then
    raise exception 'digital:order_not_found';
  end if;

  if v_item.user_id is null then
    raise exception 'digital:customer_missing';
  end if;

  if v_item.payment_status <> 'paid' then
    raise exception 'digital:payment_not_paid';
  end if;

  if v_item.order_status in ('cancelled','failed','refunded') then
    raise exception 'digital:order_ineligible';
  end if;

  if v_item.product_id is null then
    raise exception 'digital:product_missing';
  end if;

  if v_item.product_type not in ('digital','license','subscription') then
    raise exception 'digital:not_a_digital_product';
  end if;

  v_delivery_type := coalesce(nullif(btrim(v_item.plan_delivery_type), ''), nullif(btrim(v_item.product_delivery_type), ''));
  v_delivery_details := coalesce(nullif(btrim(v_item.plan_delivery_details), ''), nullif(btrim(v_item.product_delivery_details), ''));

  if v_delivery_type is null then
    raise exception 'digital:delivery_not_configured';
  end if;

  if p_customer_access_url is not null
     and (char_length(btrim(p_customer_access_url)) > 2048
       or btrim(p_customer_access_url) !~* '^https://') then
    raise exception 'digital:access_url_invalid';
  end if;

  v_duration := coalesce(v_item.plan_duration, v_item.product_duration);
  v_duration_unit := lower(coalesce(nullif(btrim(v_item.plan_duration_unit), ''), nullif(btrim(v_item.product_duration_unit), '')));

  if v_duration is not null and v_duration > 0 then
    if v_duration_unit in ('day','days') then
      v_expires_at := now() + make_interval(days => v_duration);
    elsif v_duration_unit in ('week','weeks') then
      v_expires_at := now() + make_interval(days => v_duration * 7);
    elsif v_duration_unit in ('month','months') then
      v_expires_at := now() + make_interval(months => v_duration);
    elsif v_duration_unit in ('year','years') then
      v_expires_at := now() + make_interval(years => v_duration);
    else
      v_expires_at := null;
    end if;
  end if;

  select *
  into v_entitlement
  from public.digital_entitlements
  where user_id = v_item.user_id
    and order_item_id = v_item.order_item_id
  for update;

  if found then
    if v_entitlement.access_status = 'active'
       and v_entitlement.expires_at is not null
       and v_entitlement.expires_at <= now() then
      update public.digital_entitlements
      set access_status = 'expired', updated_at = now()
      where id = v_entitlement.id
      returning * into v_entitlement;
    end if;

    update public.digital_entitlements
    set
      access_status = case
        when v_entitlement.expires_at is not null and v_entitlement.expires_at <= now() then 'expired'
        else 'active'
      end,
      delivery_type = v_delivery_type,
      delivery_instructions = v_delivery_details,
      customer_access_url = case
        when p_customer_access_url is null then customer_access_url
        else btrim(p_customer_access_url)
      end,
      fulfilled_at = coalesce(fulfilled_at, now()),
      expires_at = coalesce(v_entitlement.expires_at, v_expires_at),
      updated_at = now()
    where id = v_entitlement.id
    returning * into v_entitlement;
  else
    insert into public.digital_entitlements (
      user_id, order_id, order_item_id, product_id,
      access_status, granted_at, expires_at,
      delivery_type, delivery_instructions,
      customer_access_url, fulfilled_at
    )
    values (
      v_item.user_id, v_item.order_id, v_item.order_item_id, v_item.product_id,
      case when v_expires_at is not null and v_expires_at <= now() then 'expired' else 'active' end,
      now(), v_expires_at,
      v_delivery_type, v_delivery_details,
      nullif(btrim(p_customer_access_url), ''), now()
    )
    returning * into v_entitlement;
  end if;

  insert into public.digital_entitlement_assets (entitlement_id, asset_id)
  select v_entitlement.id, a.id
  from public.digital_delivery_assets a
  where a.product_id = v_item.product_id
    and a.is_active = true
    and (a.plan_id is null or a.plan_id = v_item.plan_id)
  on conflict (entitlement_id, asset_id) do nothing;

  return jsonb_build_object(
    'entitlementId', v_entitlement.id,
    'accessStatus', v_entitlement.access_status,
    'fulfilledAt', v_entitlement.fulfilled_at,
    'expiresAt', v_entitlement.expires_at
  );
end;
$function$;

revoke all on function public.fulfill_digital_order_item(uuid, text) from public;
grant execute on function public.fulfill_digital_order_item(uuid, text) to authenticated;


create or replace function public.set_digital_entitlement_status(
  p_entitlement_id uuid,
  p_access_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_entitlement public.digital_entitlements%rowtype;
  v_order public.orders%rowtype;
begin
  if not private.is_staff() then
    raise exception 'digital:not_authorized';
  end if;

  if p_entitlement_id is null then
    raise exception 'digital:entitlement_not_found';
  end if;

  if p_access_status not in ('active','suspended','expired','revoked') then
    raise exception 'digital:status_invalid';
  end if;

  select *
  into v_entitlement
  from public.digital_entitlements
  where id = p_entitlement_id
  for update;

  if not found then
    raise exception 'digital:entitlement_not_found';
  end if;

  select *
  into v_order
  from public.orders
  where id = v_entitlement.order_id;

  if p_access_status = 'active' then
    if v_order.payment_status <> 'paid'
       or v_order.order_status in ('cancelled','failed','refunded')
       or (v_entitlement.expires_at is not null and v_entitlement.expires_at <= now()) then
      raise exception 'digital:access_not_eligible';
    end if;
  end if;

  update public.digital_entitlements
  set access_status = p_access_status, updated_at = now()
  where id = p_entitlement_id
  returning * into v_entitlement;

  return jsonb_build_object(
    'entitlementId', v_entitlement.id,
    'accessStatus', v_entitlement.access_status,
    'expiresAt', v_entitlement.expires_at
  );
end;
$function$;

revoke all on function public.set_digital_entitlement_status(uuid, text) from public;
grant execute on function public.set_digital_entitlement_status(uuid, text) to authenticated;
