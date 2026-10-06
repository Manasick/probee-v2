-- ProBee V2 STEP 14: secure digital delivery and entitlement fulfillment.
-- Reuses public.digital_entitlements and adds a private digital-file asset catalog.
-- No payment, email, review, or order-status architecture is duplicated.

alter table public.digital_entitlements
  add column delivery_type text,
  add column delivery_instructions text,
  add column customer_access_url text,
  add column fulfilled_at timestamptz;

alter table public.digital_entitlements
  add constraint digital_entitlements_delivery_type_length_check
    check (delivery_type is null or char_length(delivery_type) <= 120),
  add constraint digital_entitlements_delivery_instructions_length_check
    check (delivery_instructions is null or char_length(delivery_instructions) <= 10000),
  add constraint digital_entitlements_customer_access_url_check
    check (
      customer_access_url is null
      or (
        char_length(customer_access_url) <= 2048
        and customer_access_url ~* '^https://'
      )
    );

create unique index digital_entitlements_order_item_unique_idx
  on public.digital_entitlements(order_item_id);

create index digital_entitlements_order_status_idx
  on public.digital_entitlements(order_id, access_status, expires_at);

create table public.digital_delivery_assets (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  plan_id uuid references public.product_plans(id) on delete set null,
  title text not null,
  description text,
  storage_path text not null unique,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 52428800),
  customer_instructions text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (char_length(btrim(title)) between 1 and 180),
  check (description is null or char_length(description) <= 1000),
  check (customer_instructions is null or char_length(customer_instructions) <= 5000),
  check (
    mime_type in (
      'application/pdf',
      'application/zip',
      'text/plain',
      'text/csv',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    )
  ),
  check (
    storage_path ~* '^digital-products/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|zip|txt|csv|jpg|jpeg|png|webp|docx|xlsx|pptx)$'
  )
);

create index digital_delivery_assets_product_idx
  on public.digital_delivery_assets(product_id, is_active, created_at desc);

create index digital_delivery_assets_plan_idx
  on public.digital_delivery_assets(plan_id, is_active, created_at desc);

create table public.digital_entitlement_assets (
  entitlement_id uuid not null references public.digital_entitlements(id) on delete cascade,
  asset_id uuid not null references public.digital_delivery_assets(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (entitlement_id, asset_id)
);

create index digital_entitlement_assets_asset_idx
  on public.digital_entitlement_assets(asset_id, entitlement_id);

create trigger set_digital_delivery_assets_updated_at
before update on public.digital_delivery_assets
for each row
execute function private.set_updated_at();

alter table public.digital_delivery_assets enable row level security;
alter table public.digital_entitlement_assets enable row level security;

revoke all on table
  public.digital_delivery_assets,
  public.digital_entitlement_assets
from anon, authenticated;

grant select on
  public.digital_delivery_assets,
  public.digital_entitlement_assets
to authenticated;

grant insert, update, delete on
  public.digital_delivery_assets,
  public.digital_entitlement_assets
to authenticated;

drop policy if exists "digital_delivery_assets_manage_staff" on public.digital_delivery_assets;
create policy "digital_delivery_assets_manage_staff"
on public.digital_delivery_assets
for all
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

drop policy if exists "digital_entitlement_assets_select_own" on public.digital_entitlement_assets;
create policy "digital_entitlement_assets_select_own"
on public.digital_entitlement_assets
for select
to authenticated
using (
  (select private.is_staff())
  or exists (
    select 1
    from public.digital_entitlements e
    where e.id = digital_entitlement_assets.entitlement_id
      and e.user_id = (select auth.uid())
  )
);

drop policy if exists "digital_entitlement_assets_manage_staff" on public.digital_entitlement_assets;
create policy "digital_entitlement_assets_manage_staff"
on public.digital_entitlement_assets
for all
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

create or replace function private.validate_digital_entitlement_relationship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_user_id uuid;
  v_order_id uuid;
  v_product_id uuid;
begin
  select
    o.user_id,
    o.id,
    oi.product_id
  into
    v_order_user_id,
    v_order_id,
    v_product_id
  from public.order_items oi
  join public.orders o
    on o.id = oi.order_id
  where oi.id = new.order_item_id;

  if v_order_id is null then
    raise exception 'digital:order_item_not_found' using errcode = 'P0002';
  end if;

  if new.order_id <> v_order_id then
    raise exception 'digital:order_relationship_invalid' using errcode = '23514';
  end if;

  if new.user_id <> v_order_user_id then
    raise exception 'digital:owner_relationship_invalid' using errcode = '23514';
  end if;

  if new.product_id is distinct from v_product_id then
    raise exception 'digital:product_relationship_invalid' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if old.user_id is distinct from new.user_id
       or old.order_id is distinct from new.order_id
       or old.order_item_id is distinct from new.order_item_id
       or old.product_id is distinct from new.product_id then
      raise exception 'digital:ownership_fields_immutable' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_digital_entitlement_relationship
on public.digital_entitlements;

create trigger validate_digital_entitlement_relationship
before insert or update on public.digital_entitlements
for each row
execute function private.validate_digital_entitlement_relationship();

create or replace function private.validate_digital_entitlement_asset_relationship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entitlement_product_id uuid;
  v_order_item_product_id uuid;
  v_order_item_plan_id uuid;
  v_asset_product_id uuid;
  v_asset_plan_id uuid;
begin
  select
    e.product_id,
    oi.product_id,
    oi.plan_id
  into
    v_entitlement_product_id,
    v_order_item_product_id,
    v_order_item_plan_id
  from public.digital_entitlements e
  join public.order_items oi
    on oi.id = e.order_item_id
  where e.id = new.entitlement_id;

  if v_order_item_product_id is null then
    raise exception 'digital:order_item_product_missing' using errcode = '23514';
  end if;

  if v_entitlement_product_id is null then
    raise exception 'digital:entitlement_product_invalid' using errcode = '23514';
  end if;

  if v_entitlement_product_id is distinct from v_order_item_product_id then
    raise exception 'digital:entitlement_product_invalid' using errcode = '23514';
  end if;

  select
    a.product_id,
    a.plan_id
  into
    v_asset_product_id,
    v_asset_plan_id
  from public.digital_delivery_assets a
  where a.id = new.asset_id;

  if v_asset_product_id is null then
    raise exception 'digital:asset_not_found' using errcode = 'P0002';
  end if;

  if v_asset_product_id <> v_order_item_product_id then
    raise exception 'digital:asset_product_mismatch' using errcode = '23514';
  end if;

  if v_asset_plan_id is not null
     and v_asset_plan_id is distinct from v_order_item_plan_id then
    raise exception 'digital:asset_plan_mismatch' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_digital_entitlement_asset_relationship
on public.digital_entitlement_assets;

create trigger validate_digital_entitlement_asset_relationship
before insert or update on public.digital_entitlement_assets
for each row
execute function private.validate_digital_entitlement_asset_relationship();

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'digital-products',
  'digital-products',
  false,
  52428800,
  array[
    'application/pdf',
    'application/zip',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = excluded.allowed_mime_types;

create index if not exists storage_objects_digital_products_path_idx
  on storage.objects(bucket_id, name)
  where bucket_id = 'digital-products';

create or replace function private.can_read_digital_asset_storage(
  p_storage_path text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $digital$
  select exists (
    select 1
    from public.digital_delivery_assets a
    join public.digital_entitlement_assets ea
      on ea.asset_id = a.id
    join public.digital_entitlements e
      on e.id = ea.entitlement_id
    join public.orders o
      on o.id = e.order_id
    where a.storage_path = p_storage_path
      and e.user_id = (select auth.uid())
      and e.access_status = 'active'
      and (e.expires_at is null or e.expires_at > timezone('utc', now()))
      and o.payment_status = 'paid'
      and o.order_status not in ('cancelled', 'failed', 'refunded')
  );
$digital$;

revoke execute on function private.can_read_digital_asset_storage(text) from public;
grant execute on function private.can_read_digital_asset_storage(text) to authenticated;


drop policy if exists "digital_products_storage_select_customer" on storage.objects;
create policy "digital_products_storage_select_customer"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'digital-products'
  and (select private.can_read_digital_asset_storage(storage.objects.name))
);

drop policy if exists "digital_products_storage_select_staff" on storage.objects;
create policy "digital_products_storage_select_staff"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'digital-products'
  and (select private.is_staff())
);

drop policy if exists "digital_products_storage_insert_staff" on storage.objects;
create policy "digital_products_storage_insert_staff"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'digital-products'
  and (select private.is_staff())
  and name ~* '^digital-products/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|zip|txt|csv|jpg|jpeg|png|webp|docx|xlsx|pptx)$'
);

drop policy if exists "digital_products_storage_update_staff" on storage.objects;
create policy "digital_products_storage_update_staff"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'digital-products'
  and (select private.is_staff())
  and name ~* '^digital-products/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|zip|txt|csv|jpg|jpeg|png|webp|docx|xlsx|pptx)$'
)
with check (
  bucket_id = 'digital-products'
  and (select private.is_staff())
  and name ~* '^digital-products/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|zip|txt|csv|jpg|jpeg|png|webp|docx|xlsx|pptx)$'
);

drop policy if exists "digital_products_storage_delete_staff" on storage.objects;
create policy "digital_products_storage_delete_staff"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'digital-products'
  and (select private.is_staff())
  and name ~* '^digital-products/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|zip|txt|csv|jpg|jpeg|png|webp|docx|xlsx|pptx)$'
);

create or replace function public.fulfill_digital_order_item(
  p_order_item_id uuid,
  p_customer_access_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_item public.order_items%rowtype;
  v_order public.orders%rowtype;
  v_product public.products%rowtype;
  v_plan public.product_plans%rowtype;
  v_entitlement public.digital_entitlements%rowtype;
  v_delivery_type text;
  v_delivery_instructions text;
  v_customer_access_url text;
  v_asset_count integer := 0;
  v_user_id uuid := (select auth.uid());
begin
  if not private.is_staff() then
    raise exception 'digital:not_authorized';
  end if;

  select oi.*
  into v_order_item
  from public.order_items oi
  where oi.id = p_order_item_id
  for update;

  if v_order_item.id is null then
    raise exception 'digital:order_item_not_found';
  end if;

  select o.*
  into v_order
  from public.orders o
  where o.id = v_order_item.order_id
  for update;

  if v_order.id is null then
    raise exception 'digital:order_not_found';
  end if;

  if v_order.user_id is null then
    raise exception 'digital:customer_missing';
  end if;

  if v_order.payment_status <> 'paid' then
    raise exception 'digital:payment_not_paid';
  end if;

  if v_order.order_status in ('cancelled', 'failed', 'refunded') then
    raise exception 'digital:order_ineligible';
  end if;

  if v_order_item.product_id is null then
    raise exception 'digital:product_missing';
  end if;

  select p.*
  into v_product
  from public.products p
  where p.id = v_order_item.product_id
  for update;

  if v_product.id is null then
    raise exception 'digital:product_missing';
  end if;

  if v_product.product_type not in ('digital', 'license', 'subscription') then
    raise exception 'digital:not_a_digital_product';
  end if;

  if v_order_item.plan_id is not null then
    select pp.*
    into v_plan
    from public.product_plans pp
    where pp.id = v_order_item.plan_id
      and pp.product_id = v_order_item.product_id;
  end if;

  v_delivery_type :=
    coalesce(
      nullif(btrim(v_plan.delivery_type), ''),
      nullif(btrim(v_product.delivery_type), '')
    );

  if v_delivery_type is null then
    raise exception 'digital:delivery_not_configured';
  end if;

  v_delivery_instructions :=
    coalesce(
      nullif(btrim(v_plan.delivery_details), ''),
      nullif(btrim(v_product.delivery_details), '')
    );

  if p_customer_access_url is not null then
    v_customer_access_url := btrim(p_customer_access_url);

    if char_length(v_customer_access_url) > 2048
       or v_customer_access_url !~* '^https://' then
      raise exception 'digital:access_url_invalid';
    end if;
  end if;

  select *
  into v_entitlement
  from public.digital_entitlements e
  where e.order_item_id = v_order_item.id
  limit 1
  for update;

  if v_entitlement.id is not null then
    return jsonb_build_object(
      'entitlementId', v_entitlement.id,
      'accessStatus', v_entitlement.access_status,
      'alreadyExists', true,
      'assetCount', (
        select count(*)
        from public.digital_entitlement_assets ea
        where ea.entitlement_id = v_entitlement.id
      )
    );
  end if;

  insert into public.digital_entitlements (
    user_id,
    order_id,
    order_item_id,
    product_id,
    access_status,
    delivery_type,
    delivery_instructions,
    customer_access_url,
    fulfilled_at
  )
  values (
    v_order.user_id,
    v_order.id,
    v_order_item.id,
    v_order_item.product_id,
    'active',
    v_delivery_type,
    v_delivery_instructions,
    v_customer_access_url,
    timezone('utc', now())
  )
  returning * into v_entitlement;

  insert into public.digital_entitlement_assets (
    entitlement_id,
    asset_id
  )
  select
    v_entitlement.id,
    a.id
  from public.digital_delivery_assets a
  where a.product_id = v_order_item.product_id
    and a.is_active = true
    and (
      a.plan_id is null
      or a.plan_id = v_order_item.plan_id
    )
  on conflict (entitlement_id, asset_id) do nothing;

  select count(*)
  into v_asset_count
  from public.digital_entitlement_assets ea
  where ea.entitlement_id = v_entitlement.id;

  return jsonb_build_object(
    'entitlementId', v_entitlement.id,
    'accessStatus', 'active',
    'alreadyExists', false,
    'assetCount', v_asset_count
  );
end;
$$;

revoke all on function public.fulfill_digital_order_item(uuid, text)
from public, anon, authenticated;

grant execute on function public.fulfill_digital_order_item(uuid, text)
to authenticated;

create or replace function public.set_digital_entitlement_status(
  p_entitlement_id uuid,
  p_access_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entitlement public.digital_entitlements%rowtype;
  v_order public.orders%rowtype;
begin
  if not private.is_staff() then
    raise exception 'digital:not_authorized';
  end if;

  if p_access_status not in ('active', 'suspended', 'expired', 'revoked') then
    raise exception 'digital:status_invalid';
  end if;

  select *
  into v_entitlement
  from public.digital_entitlements e
  where e.id = p_entitlement_id
  for update;

  if v_entitlement.id is null then
    raise exception 'digital:entitlement_not_found';
  end if;

  select *
  into v_order
  from public.orders o
  where o.id = v_entitlement.order_id
  for update;

  if v_order.id is null then
    raise exception 'digital:order_not_found';
  end if;

  if p_access_status = 'active' then
    if v_order.payment_status <> 'paid'
       or v_order.order_status in ('cancelled', 'failed', 'refunded')
       or (
         v_entitlement.expires_at is not null
         and v_entitlement.expires_at <= timezone('utc', now())
       ) then
      raise exception 'digital:access_not_eligible';
    end if;
  end if;

  update public.digital_entitlements
  set access_status = p_access_status,
      updated_at = timezone('utc', now())
  where id = v_entitlement.id;

  return jsonb_build_object(
    'entitlementId', v_entitlement.id,
    'accessStatus', p_access_status
  );
end;
$$;

revoke all on function public.set_digital_entitlement_status(uuid, text)
from public, anon, authenticated;

grant execute on function public.set_digital_entitlement_status(uuid, text)
to authenticated;

create or replace function public.get_my_digital_entitlements()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'orderReference', o.order_reference,
        'orderItemId', oi.id,
        'productName', oi.product_name_snapshot,
        'planName', oi.plan_name_snapshot,
        'accessStatus', e.access_status,
        'deliveryType', e.delivery_type,
        'deliveryInstructions', e.delivery_instructions,
        'customerAccessUrl', e.customer_access_url,
        'grantedAt', e.granted_at,
        'fulfilledAt', e.fulfilled_at,
        'expiresAt', e.expires_at,
        'orderStatus', o.order_status,
        'paymentStatus', o.payment_status,
        'accessAllowed',
          e.access_status = 'active'
          and (e.expires_at is null or e.expires_at > timezone('utc', now()))
          and o.payment_status = 'paid'
          and o.order_status not in ('cancelled', 'failed', 'refunded'),
        'assets',
          coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'id', a.id,
                  'title', a.title,
                  'description', a.description,
                  'mimeType', a.mime_type,
                  'fileSizeBytes', a.file_size_bytes,
                  'customerInstructions', a.customer_instructions
                )
                order by a.created_at asc
              )
              from public.digital_entitlement_assets ea
              join public.digital_delivery_assets a
                on a.id = ea.asset_id
              where ea.entitlement_id = e.id
            ),
            '[]'::jsonb
          )
      )
      order by e.granted_at desc
    ),
    '[]'::jsonb
  )
  from public.digital_entitlements e
  join public.orders o
    on o.id = e.order_id
  join public.order_items oi
    on oi.id = e.order_item_id
  where e.user_id = (select auth.uid());
$$;

revoke all on function public.get_my_digital_entitlements()
from public, anon, authenticated;

grant execute on function public.get_my_digital_entitlements()
to authenticated;

create or replace function public.get_my_digital_asset_path(
  p_entitlement_id uuid,
  p_asset_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_storage_path text;
begin
  if not exists (
    select 1
    from public.digital_entitlements e
    join public.orders o
      on o.id = e.order_id
    where e.id = p_entitlement_id
      and e.user_id = (select auth.uid())
      and e.access_status = 'active'
      and (e.expires_at is null or e.expires_at > timezone('utc', now()))
      and o.payment_status = 'paid'
      and o.order_status not in ('cancelled', 'failed', 'refunded')
  ) then
    raise exception 'digital:access_denied';
  end if;

  select a.storage_path
  into v_storage_path
  from public.digital_entitlement_assets ea
  join public.digital_delivery_assets a
    on a.id = ea.asset_id
  where ea.entitlement_id = p_entitlement_id
    and ea.asset_id = p_asset_id;

  if v_storage_path is null then
    raise exception 'digital:asset_not_found';
  end if;

  return v_storage_path;
end;
$$;

revoke all on function public.get_my_digital_asset_path(uuid, uuid)
from public, anon, authenticated;

grant execute on function public.get_my_digital_asset_path(uuid, uuid)
to authenticated;
