create extension if not exists pgcrypto;

create schema if not exists private;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  cover_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  short_description text,
  full_description text,
  cover_url text,
  product_type text not null default 'digital'
    check (product_type in ('digital', 'license', 'subscription')),
  is_active boolean not null default true,
  is_published boolean not null default false,
  is_featured boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.product_categories (
  product_id uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (product_id, category_id)
);

create table public.product_plans (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  billing_type text not null default 'one_time'
    check (billing_type in ('one_time', 'subscription')),
  billing_interval text,
  billing_interval_count integer,
  price numeric(14,2) not null check (price >= 0),
  currency text not null default 'USD'
    check (currency ~ '^[A-Z]{3}$'),
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (product_id, slug),
  check (
    (billing_type = 'one_time' and billing_interval is null and billing_interval_count is null)
    or
    (billing_type = 'subscription'
      and billing_interval in ('day', 'week', 'month', 'year')
      and billing_interval_count is not null
      and billing_interval_count > 0)
  )
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  order_reference text not null unique default (
    'PBE-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
  ),
  order_status text not null default 'pending'
    check (order_status in ('pending', 'processing', 'completed', 'cancelled', 'failed', 'refunded')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'rejected', 'refunded')),
  payment_method text
    check (payment_method is null or payment_method in ('manual_bank_transfer', 'card', 'mobile_wallet', 'crypto', 'other')),
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  discount numeric(14,2) not null default 0 check (discount >= 0 and discount <= subtotal),
  total numeric(14,2) not null default 0 check (total >= 0),
  currency text not null default 'USD'
    check (currency ~ '^[A-Z]{3}$'),
  customer_email text,
  customer_phone text,
  customer_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (total = subtotal - discount)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null,
  plan_id uuid references public.product_plans(id) on delete set null,
  product_name_snapshot text not null,
  plan_name_snapshot text,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  line_total numeric(14,2) not null check (line_total >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  check (line_total = round(unit_price * quantity, 2))
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  payment_method text not null
    check (payment_method in ('manual_bank_transfer', 'card', 'mobile_wallet', 'crypto', 'other')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'rejected', 'refunded')),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null
    check (currency ~ '^[A-Z]{3}$'),
  external_reference text,
  provider text,
  provider_metadata jsonb not null default '{}'::jsonb,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check ((verified_at is null) = (verified_by is null))
);

create table public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  storage_path text not null unique,
  original_filename text,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  uploaded_by uuid references auth.users(id) on delete set null,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'approved', 'rejected')),
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  check ((verified_at is null) = (verified_by is null))
);

create table public.digital_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete restrict,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null,
  access_status text not null default 'active'
    check (access_status in ('active', 'suspended', 'expired', 'revoked')),
  granted_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, order_item_id),
  check (expires_at is null or expires_at > granted_at)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  title text,
  body text,
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'approved', 'rejected')),
  is_verified_purchase boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (product_id, user_id)
);

create table public.admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'manager'
    check (role in ('admin', 'manager')),
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create table public.payment_settings (
  id uuid primary key default gen_random_uuid(),
  payment_method text not null unique
    check (payment_method = 'manual_bank_transfer'),
  enabled boolean not null default false,
  bank_name text,
  account_name text,
  account_number text,
  branch text,
  bank_code_swift text,
  payment_instructions text,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references auth.users(id) on delete set null
);

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.id = (select auth.uid())
      and au.status = 'active'
      and au.role in ('admin', 'manager')
  );
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.id = (select auth.uid())
      and au.status = 'active'
      and au.role = 'admin'
  );
$$;

revoke execute on function private.is_staff() from public;
revoke execute on function private.is_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_admin() to authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function private.handle_new_user();

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function private.set_updated_at();

create trigger set_categories_updated_at
before update on public.categories
for each row
execute function private.set_updated_at();

create trigger set_products_updated_at
before update on public.products
for each row
execute function private.set_updated_at();

create trigger set_product_plans_updated_at
before update on public.product_plans
for each row
execute function private.set_updated_at();

create trigger set_orders_updated_at
before update on public.orders
for each row
execute function private.set_updated_at();

create trigger set_payments_updated_at
before update on public.payments
for each row
execute function private.set_updated_at();

create trigger set_digital_entitlements_updated_at
before update on public.digital_entitlements
for each row
execute function private.set_updated_at();

create trigger set_reviews_updated_at
before update on public.reviews
for each row
execute function private.set_updated_at();

create trigger set_admin_users_updated_at
before update on public.admin_users
for each row
execute function private.set_updated_at();

create index product_categories_category_id_idx
  on public.product_categories(category_id);

create index product_plans_product_id_idx
  on public.product_plans(product_id);

create index product_plans_active_sort_idx
  on public.product_plans(product_id, is_active, sort_order);

create index products_catalog_idx
  on public.products(is_published, is_active, sort_order);

create index categories_catalog_idx
  on public.categories(is_active, sort_order);

create index orders_user_created_idx
  on public.orders(user_id, created_at desc);

create index orders_status_created_idx
  on public.orders(order_status, created_at desc);

create index order_items_order_id_idx
  on public.order_items(order_id);

create index order_items_product_id_idx
  on public.order_items(product_id);

create index payments_order_id_idx
  on public.payments(order_id);

create index payments_status_created_idx
  on public.payments(payment_status, created_at desc);

create index payment_proofs_payment_id_idx
  on public.payment_proofs(payment_id);

create index payment_proofs_uploaded_by_idx
  on public.payment_proofs(uploaded_by);

create index payment_proofs_status_idx
  on public.payment_proofs(verification_status);

create index digital_entitlements_user_status_idx
  on public.digital_entitlements(user_id, access_status, expires_at);

create index digital_entitlements_product_id_idx
  on public.digital_entitlements(product_id);

create index reviews_product_status_created_idx
  on public.reviews(product_id, moderation_status, created_at desc);

create index reviews_user_id_idx
  on public.reviews(user_id);

create index admin_users_role_status_idx
  on public.admin_users(role, status);

create index payment_settings_enabled_idx
  on public.payment_settings(enabled);

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_categories enable row level security;
alter table public.product_plans enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.payment_proofs enable row level security;
alter table public.digital_entitlements enable row level security;
alter table public.reviews enable row level security;
alter table public.admin_users enable row level security;
alter table public.payment_settings enable row level security;

revoke all on table
  public.profiles,
  public.categories,
  public.products,
  public.product_categories,
  public.product_plans,
  public.orders,
  public.order_items,
  public.payments,
  public.payment_proofs,
  public.digital_entitlements,
  public.reviews,
  public.admin_users,
  public.payment_settings
from anon, authenticated;

grant select on public.categories, public.products, public.product_categories, public.product_plans, public.reviews to anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select on public.orders, public.order_items, public.payments, public.payment_proofs, public.digital_entitlements to authenticated;
grant select, insert, update, delete on public.reviews to authenticated;

grant select, insert, update, delete on
  public.categories,
  public.products,
  public.product_categories,
  public.product_plans,
  public.orders,
  public.order_items,
  public.payments,
  public.payment_proofs,
  public.digital_entitlements,
  public.reviews
to authenticated;

grant select, insert, update, delete on public.admin_users, public.payment_settings to authenticated;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "categories_public_read"
on public.categories
for select
to anon, authenticated
using (is_active = true);

create policy "products_public_read"
on public.products
for select
to anon, authenticated
using (is_active = true and is_published = true);

create policy "product_categories_public_read"
on public.product_categories
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products p
    join public.categories c on c.id = product_categories.category_id
    where p.id = product_categories.product_id
      and p.is_active = true
      and p.is_published = true
      and c.is_active = true
  )
);

create policy "product_plans_public_read"
on public.product_plans
for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.products p
    where p.id = product_plans.product_id
      and p.is_active = true
      and p.is_published = true
  )
);

create policy "orders_select_own"
on public.orders
for select
to authenticated
using ((select auth.uid()) = user_id or (select private.is_staff()));

create policy "order_items_select_own"
on public.order_items
for select
to authenticated
using (
  (select private.is_staff())
  or exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and o.user_id = (select auth.uid())
  )
);

create policy "payments_select_own"
on public.payments
for select
to authenticated
using (
  (select private.is_staff())
  or exists (
    select 1
    from public.orders o
    where o.id = payments.order_id
      and o.user_id = (select auth.uid())
  )
);

create policy "payment_proofs_select_own"
on public.payment_proofs
for select
to authenticated
using (
  (select private.is_staff())
  or exists (
    select 1
    from public.payments p
    join public.orders o on o.id = p.order_id
    where p.id = payment_proofs.payment_id
      and o.user_id = (select auth.uid())
  )
);

create policy "digital_entitlements_select_own"
on public.digital_entitlements
for select
to authenticated
using ((select auth.uid()) = user_id or (select private.is_staff()));

create policy "reviews_public_read"
on public.reviews
for select
to anon
using (moderation_status = 'approved');

create policy "reviews_authenticated_read"
on public.reviews
for select
to authenticated
using (moderation_status = 'approved' or (select auth.uid()) = user_id or (select private.is_staff()));

create policy "reviews_insert_own"
on public.reviews
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and moderation_status = 'pending'
  and is_verified_purchase = false
);

create policy "reviews_update_own_pending"
on public.reviews
for update
to authenticated
using (
  (select auth.uid()) = user_id
  and moderation_status = 'pending'
)
with check (
  (select auth.uid()) = user_id
  and moderation_status = 'pending'
  and is_verified_purchase = false
);

create policy "categories_manage_staff"
on public.categories
for all
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

create policy "products_manage_staff"
on public.products
for all
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

create policy "product_categories_manage_staff"
on public.product_categories
for all
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

create policy "product_plans_manage_staff"
on public.product_plans
for all
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

create policy "orders_manage_staff"
on public.orders
for all
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

create policy "order_items_manage_staff"
on public.order_items
for all
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

create policy "payments_manage_staff"
on public.payments
for all
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

create policy "payment_proofs_manage_staff"
on public.payment_proofs
for all
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

create policy "digital_entitlements_manage_staff"
on public.digital_entitlements
for all
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

create policy "reviews_manage_staff"
on public.reviews
for all
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

create policy "admin_users_manage_admin"
on public.admin_users
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "payment_settings_manage_admin"
on public.payment_settings
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

revoke all on all functions in schema private from public;
