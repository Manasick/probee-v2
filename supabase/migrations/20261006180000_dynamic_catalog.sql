-- ProBee V2 STEP 6: dynamic catalog data architecture
-- Additive migration. Preserves STEP 4 tables and historical order snapshots.

create table public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  media_url text not null,
  media_type text not null default 'image'
    check (media_type in ('image', 'video', 'other')),
  alt_text text,
  title text,
  caption text,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index product_media_one_primary_idx
  on public.product_media(product_id)
  where is_primary and is_active;

create index product_media_product_sort_idx
  on public.product_media(product_id, is_active, sort_order);

create table public.product_features (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  feature_text text not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (length(btrim(feature_text)) > 0)
);

create index product_features_product_sort_idx
  on public.product_features(product_id, is_active, sort_order);

create table public.product_package_inclusions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  inclusion_text text not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (length(btrim(inclusion_text)) > 0)
);

create index product_package_inclusions_product_sort_idx
  on public.product_package_inclusions(product_id, is_active, sort_order);

alter table public.products
  add column warranty_duration integer,
  add column warranty_unit text,
  add column delivery_type text,
  add column delivery_details text,
  add column customer_requirements jsonb not null default '[]'::jsonb,
  add column custom_attributes jsonb not null default '{}'::jsonb,
  add column seo_title text,
  add column seo_description text,
  add column seo_keywords text[];

alter table public.products
  add constraint products_warranty_duration_check
    check (warranty_duration is null or warranty_duration > 0),
  add constraint products_warranty_unit_check
    check (
      warranty_duration is null
      or warranty_unit in ('day', 'week', 'month', 'year', 'lifetime')
    ),
  add constraint products_customer_requirements_array_check
    check (jsonb_typeof(customer_requirements) = 'array'),
  add constraint products_custom_attributes_object_check
    check (jsonb_typeof(custom_attributes) = 'object');

alter table public.product_plans
  add column duration integer,
  add column duration_unit text,
  add column renewal_available boolean not null default false,
  add column warranty_duration integer,
  add column warranty_unit text,
  add column seats integer,
  add column invites integer,
  add column participants integer,
  add column features jsonb not null default '[]'::jsonb,
  add column delivery_type text,
  add column delivery_details text,
  add column customer_requirements jsonb not null default '[]'::jsonb,
  add column custom_attributes jsonb not null default '{}'::jsonb;

alter table public.product_plans
  add constraint product_plans_duration_check
    check (duration is null or duration > 0),
  add constraint product_plans_duration_unit_check
    check (
      duration is null
      or duration_unit in ('day', 'week', 'month', 'year', 'lifetime')
    ),
  add constraint product_plans_billing_duration_consistency_check
    check (
      billing_type = 'subscription'
      or (duration is not null or duration_unit is null)
    ),
  add constraint product_plans_warranty_duration_check
    check (warranty_duration is null or warranty_duration > 0),
  add constraint product_plans_warranty_unit_check
    check (
      warranty_duration is null
      or warranty_unit in ('day', 'week', 'month', 'year', 'lifetime')
    ),
  add constraint product_plans_seats_check
    check (seats is null or seats > 0),
  add constraint product_plans_invites_check
    check (invites is null or invites > 0),
  add constraint product_plans_participants_check
    check (participants is null or participants > 0),
  add constraint product_plans_features_array_check
    check (jsonb_typeof(features) = 'array'),
  add constraint product_plans_customer_requirements_array_check
    check (jsonb_typeof(customer_requirements) = 'array'),
  add constraint product_plans_custom_attributes_object_check
    check (jsonb_typeof(custom_attributes) = 'object');

create index products_delivery_active_idx
  on public.products(delivery_type, is_active, is_published);

create index product_plans_catalog_idx
  on public.product_plans(product_id, is_active, sort_order, price);

create trigger set_product_media_updated_at
before update on public.product_media
for each row
execute function private.set_updated_at();

create trigger set_product_features_updated_at
before update on public.product_features
for each row
execute function private.set_updated_at();

create trigger set_product_package_inclusions_updated_at
before update on public.product_package_inclusions
for each row
execute function private.set_updated_at();

alter table public.product_media enable row level security;
alter table public.product_features enable row level security;
alter table public.product_package_inclusions enable row level security;

revoke all on table
  public.product_media,
  public.product_features,
  public.product_package_inclusions
from anon, authenticated;

grant select on
  public.product_media,
  public.product_features,
  public.product_package_inclusions
to anon, authenticated;

grant select, insert, update, delete on
  public.product_media,
  public.product_features,
  public.product_package_inclusions
to authenticated;

create policy "product_media_public_read"
on public.product_media
for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.products p
    where p.id = product_media.product_id
      and p.is_active = true
      and p.is_published = true
  )
);

create policy "product_media_manage_staff"
on public.product_media
for all
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

create policy "product_features_public_read"
on public.product_features
for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.products p
    where p.id = product_features.product_id
      and p.is_active = true
      and p.is_published = true
  )
);

create policy "product_features_manage_staff"
on public.product_features
for all
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

create policy "product_package_inclusions_public_read"
on public.product_package_inclusions
for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.products p
    where p.id = product_package_inclusions.product_id
      and p.is_active = true
      and p.is_published = true
  )
);

create policy "product_package_inclusions_manage_staff"
on public.product_package_inclusions
for all
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

