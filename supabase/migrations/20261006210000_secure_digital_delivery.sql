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


-- storage.objects policies are managed separately because Supabase owns that table.
