-- ProBee V2 STEP 11: secure server-side checkout and atomic order creation.
-- The browser submits only product/plan identities and quantities.
-- This function reconstructs authoritative catalog data inside PostgreSQL.

alter table public.orders
  add column checkout_idempotency_key uuid;

create unique index orders_user_checkout_idempotency_idx
  on public.orders(user_id, checkout_idempotency_key)
  where checkout_idempotency_key is not null;

create or replace function public.create_checkout_order(
  p_items jsonb,
  p_customer_name text,
  p_customer_phone text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_customer_email text;
  v_customer_name text;
  v_customer_phone text;
  v_item jsonb;
  v_quantity_numeric numeric;
  v_quantity integer;
  v_order_id uuid;
  v_existing_order jsonb;
  v_line_count integer;
  v_currency_count integer;
  v_currency text;
  v_subtotal numeric(14,2);
begin
  if v_user_id is null then
    raise exception 'checkout:auth_required';
  end if;

  if p_idempotency_key is null then
    raise exception 'checkout:idempotency_invalid';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'checkout:items_invalid';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'checkout:cart_empty';
  end if;

  if jsonb_array_length(p_items) > 50 then
    raise exception 'checkout:too_many_lines';
  end if;

  if p_customer_name is not null
     and char_length(btrim(p_customer_name)) > 200 then
    raise exception 'checkout:customer_invalid';
  end if;

  if p_customer_phone is not null
     and char_length(btrim(p_customer_phone)) > 50 then
    raise exception 'checkout:customer_invalid';
  end if;

  -- Idempotent replay: the same authenticated customer and request key
  -- always resolves to the same previously-created order.
  select jsonb_build_object(
    'orderId', o.id,
    'orderReference', o.order_reference,
    'orderStatus', o.order_status,
    'paymentStatus', o.payment_status,
    'subtotal', o.subtotal,
    'total', o.total,
    'currency', o.currency,
    'customerEmail', o.customer_email,
    'customerName', o.customer_name,
    'customerPhone', o.customer_phone,
    'createdAt', o.created_at,
    'items', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'productId', oi.product_id,
            'planId', oi.plan_id,
            'productName', oi.product_name_snapshot,
            'planName', oi.plan_name_snapshot,
            'quantity', oi.quantity,
            'unitPrice', oi.unit_price,
            'lineTotal', oi.line_total
          )
          order by oi.created_at
        ),
        '[]'::jsonb
      )
      from public.order_items oi
      where oi.order_id = o.id
    )
  )
  into v_existing_order
  from public.orders o
  where o.user_id = v_user_id
    and o.checkout_idempotency_key = p_idempotency_key;

  if v_existing_order is not null then
    return v_existing_order;
  end if;

  create temp table pg_temp.checkout_requested (
    product_id uuid not null,
    plan_id uuid not null,
    quantity integer not null
  ) on commit drop;

  for v_item in
    select value
    from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'checkout:item_invalid';
    end if;

    if coalesce(jsonb_typeof(v_item->'productId'), '') <> 'string'
       or coalesce(v_item->>'productId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'checkout:item_invalid';
    end if;

    if coalesce(jsonb_typeof(v_item->'planId'), '') <> 'string'
       or coalesce(v_item->>'planId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'checkout:item_invalid';
    end if;

    if coalesce(jsonb_typeof(v_item->'quantity'), '') <> 'number' then
      raise exception 'checkout:quantity_invalid';
    end if;

    v_quantity_numeric := (v_item->>'quantity')::numeric;

    if v_quantity_numeric <> trunc(v_quantity_numeric)
       or v_quantity_numeric < 1
       or v_quantity_numeric > 99 then
      raise exception 'checkout:quantity_invalid';
    end if;

    v_quantity := v_quantity_numeric::integer;

    insert into pg_temp.checkout_requested(product_id, plan_id, quantity)
    values (
      (v_item->>'productId')::uuid,
      (v_item->>'planId')::uuid,
      v_quantity
    );
  end loop;

  if exists (
    select 1
    from (
      select product_id, plan_id, sum(quantity)::integer as quantity
      from pg_temp.checkout_requested
      group by product_id, plan_id
    ) grouped
    where grouped.quantity > 99
  ) then
    raise exception 'checkout:quantity_invalid';
  end if;

  -- Lock every product and plan involved before taking purchase-time snapshots.
  -- This prevents a catalog edit from racing the authoritative checkout read.
  perform p.id
  from public.products p
  join (
    select distinct product_id
    from pg_temp.checkout_requested
  ) requested on requested.product_id = p.id
  order by p.id
  for update;

  perform pp.id
  from public.product_plans pp
  join (
    select distinct plan_id
    from pg_temp.checkout_requested
  ) requested on requested.plan_id = pp.id
  order by pp.id
  for update;

  if exists (
    select 1
    from (
      select distinct product_id
      from pg_temp.checkout_requested
    ) requested
    left join public.products p
      on p.id = requested.product_id
    where p.id is null
       or p.is_active = false
       or p.is_published = false
  ) then
    raise exception 'checkout:catalog_unavailable';
  end if;

  if exists (
    select 1
    from (
      select product_id, plan_id
      from pg_temp.checkout_requested
      group by product_id, plan_id
    ) requested
    left join public.product_plans pp
      on pp.id = requested.plan_id
     and pp.product_id = requested.product_id
    where pp.id is null
       or pp.is_active = false
  ) then
    raise exception 'checkout:catalog_unavailable';
  end if;

  create temp table pg_temp.checkout_lines (
    product_id uuid not null,
    plan_id uuid not null,
    quantity integer not null,
    product_name text not null,
    plan_name text not null,
    unit_price numeric(14,2) not null,
    currency text not null,
    line_total numeric(14,2) not null
  ) on commit drop;

  insert into pg_temp.checkout_lines(
    product_id,
    plan_id,
    quantity,
    product_name,
    plan_name,
    unit_price,
    currency,
    line_total
  )
  select
    grouped.product_id,
    grouped.plan_id,
    grouped.quantity,
    p.name,
    pp.name,
    pp.price,
    pp.currency,
    round(pp.price * grouped.quantity, 2)
  from (
    select product_id, plan_id, sum(quantity)::integer as quantity
    from pg_temp.checkout_requested
    group by product_id, plan_id
  ) grouped
  join public.products p
    on p.id = grouped.product_id
  join public.product_plans pp
    on pp.id = grouped.plan_id
   and pp.product_id = grouped.product_id
  where p.is_active = true
    and p.is_published = true
    and pp.is_active = true;

  select
    count(*)::integer,
    count(distinct currency)::integer,
    min(currency),
    coalesce(sum(line_total), 0)::numeric(14,2)
  into
    v_line_count,
    v_currency_count,
    v_currency,
    v_subtotal
  from pg_temp.checkout_lines;

  if v_line_count = 0 then
    raise exception 'checkout:catalog_unavailable';
  end if;

  if v_line_count <> (
    select count(*)
    from (
      select product_id, plan_id
      from pg_temp.checkout_requested
      group by product_id, plan_id
    ) grouped
  ) then
    raise exception 'checkout:catalog_unavailable';
  end if;

  if v_currency_count <> 1 then
    raise exception 'checkout:currency_mismatch';
  end if;

  if v_subtotal > 999999999999.99 then
    raise exception 'checkout:total_too_large';
  end if;

  select u.email
  into v_customer_email
  from auth.users u
  where u.id = v_user_id;

  if v_customer_email is null or btrim(v_customer_email) = '' then
    raise exception 'checkout:email_unavailable';
  end if;

  select
    coalesce(nullif(btrim(p_customer_name), ''), p.display_name),
    coalesce(nullif(btrim(p_customer_phone), ''), p.phone)
  into
    v_customer_name,
    v_customer_phone
  from public.profiles p
  where p.id = v_user_id;

  insert into public.orders(
    user_id,
    checkout_idempotency_key,
    order_status,
    payment_status,
    payment_method,
    subtotal,
    discount,
    total,
    currency,
    customer_email,
    customer_phone,
    customer_name
  )
  values (
    v_user_id,
    p_idempotency_key,
    'pending',
    'pending',
    null,
    v_subtotal,
    0,
    v_subtotal,
    v_currency,
    v_customer_email,
    v_customer_phone,
    v_customer_name
  )
  on conflict (user_id, checkout_idempotency_key)
    where checkout_idempotency_key is not null
    do nothing
  returning id into v_order_id;

  if v_order_id is null then
    select jsonb_build_object(
      'orderId', o.id,
      'orderReference', o.order_reference,
      'orderStatus', o.order_status,
      'paymentStatus', o.payment_status,
      'subtotal', o.subtotal,
      'total', o.total,
      'currency', o.currency,
      'customerEmail', o.customer_email,
      'customerName', o.customer_name,
      'customerPhone', o.customer_phone,
      'createdAt', o.created_at,
      'items', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'productId', oi.product_id,
              'planId', oi.plan_id,
              'productName', oi.product_name_snapshot,
              'planName', oi.plan_name_snapshot,
              'quantity', oi.quantity,
              'unitPrice', oi.unit_price,
              'lineTotal', oi.line_total
            )
            order by oi.created_at
          ),
          '[]'::jsonb
        )
        from public.order_items oi
        where oi.order_id = o.id
      )
    )
    into v_existing_order
    from public.orders o
    where o.user_id = v_user_id
      and o.checkout_idempotency_key = p_idempotency_key;

    if v_existing_order is null then
      raise exception 'checkout:idempotency_conflict';
    end if;

    return v_existing_order;
  end if;

  insert into public.order_items(
    order_id,
    product_id,
    plan_id,
    product_name_snapshot,
    plan_name_snapshot,
    quantity,
    unit_price,
    line_total
  )
  select
    v_order_id,
    line.product_id,
    line.plan_id,
    line.product_name,
    line.plan_name,
    line.quantity,
    line.unit_price,
    line.line_total
  from pg_temp.checkout_lines line;

  return (
    select jsonb_build_object(
      'orderId', o.id,
      'orderReference', o.order_reference,
      'orderStatus', o.order_status,
      'paymentStatus', o.payment_status,
      'subtotal', o.subtotal,
      'total', o.total,
      'currency', o.currency,
      'customerEmail', o.customer_email,
      'customerName', o.customer_name,
      'customerPhone', o.customer_phone,
      'createdAt', o.created_at,
      'items', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'productId', oi.product_id,
              'planId', oi.plan_id,
              'productName', oi.product_name_snapshot,
              'planName', oi.plan_name_snapshot,
              'quantity', oi.quantity,
              'unitPrice', oi.unit_price,
              'lineTotal', oi.line_total
            )
            order by oi.created_at
          ),
          '[]'::jsonb
        )
        from public.order_items oi
        where oi.order_id = o.id
      )
    )
    from public.orders o
    where o.id = v_order_id
  );
end;
$$;

revoke execute on function public.create_checkout_order(jsonb, text, text, uuid)
from public, anon, authenticated;

grant execute on function public.create_checkout_order(jsonb, text, text, uuid)
to authenticated;
