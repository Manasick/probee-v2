-- ProBee V2 STEP 16: verified product reviews, ratings, moderation, and RLS.
-- Additive migration only. Existing reviews table, foreign keys, trigger, and
-- unique(product_id,user_id) relationship are preserved.

alter table public.reviews
  add column if not exists display_name_snapshot text,
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid references auth.users(id) on delete set null,
  add column if not exists moderation_reason text;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.reviews'::regclass
      and conname = 'reviews_moderation_status_check'
  ) then
    alter table public.reviews
      drop constraint reviews_moderation_status_check;
  end if;
end;
$$;

alter table public.reviews
  add constraint reviews_moderation_status_check_step16
  check (moderation_status in ('pending', 'approved', 'rejected', 'hidden'));

alter table public.reviews
  drop constraint if exists reviews_title_length_check;

alter table public.reviews
  add constraint reviews_title_length_check
  check (title is null or char_length(btrim(title)) between 1 and 120);

alter table public.reviews
  drop constraint if exists reviews_body_length_check;

alter table public.reviews
  add constraint reviews_body_length_check
  check (char_length(btrim(body)) between 1 and 2000);

alter table public.reviews
  drop constraint if exists reviews_display_name_snapshot_length_check;

alter table public.reviews
  add constraint reviews_display_name_snapshot_length_check
  check (display_name_snapshot is null or char_length(display_name_snapshot) between 1 and 120);

alter table public.reviews
  drop constraint if exists reviews_moderation_reason_length_check;

alter table public.reviews
  add constraint reviews_moderation_reason_length_check
  check (moderation_reason is null or char_length(btrim(moderation_reason)) between 1 and 500);

create index if not exists reviews_product_approved_created_idx
  on public.reviews(product_id, created_at desc)
  where moderation_status = 'approved';

create index if not exists reviews_user_status_created_idx
  on public.reviews(user_id, moderation_status, created_at desc);

revoke insert, update, delete on public.reviews from anon, authenticated;
revoke select on public.reviews from anon, authenticated;

grant select (
  id,
  product_id,
  rating,
  title,
  body,
  moderation_status,
  is_verified_purchase,
  display_name_snapshot,
  created_at,
  updated_at
)
on public.reviews to anon, authenticated;

drop policy if exists "reviews_insert_own" on public.reviews;
drop policy if exists "reviews_update_own_pending" on public.reviews;
drop policy if exists "reviews_manage_staff" on public.reviews;

drop policy if exists "reviews_public_read" on public.reviews;
create policy "reviews_public_read"
on public.reviews
for select
to anon
using (moderation_status = 'approved');

drop policy if exists "reviews_authenticated_read" on public.reviews;
create policy "reviews_authenticated_read"
on public.reviews
for select
to authenticated
using (
  moderation_status = 'approved'
  or (select auth.uid()) = user_id
  or (select private.is_staff())
);

create or replace function private.has_eligible_product_purchase(
  p_user_id uuid,
  p_product_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.orders o
    join public.order_items oi
      on oi.order_id = o.id
    where o.user_id = p_user_id
      and oi.product_id = p_product_id
      and o.payment_status = 'paid'
      and o.order_status not in ('cancelled', 'failed', 'refunded')
  );
$$;

revoke all on function private.has_eligible_product_purchase(uuid, uuid)
from public, anon, authenticated;

create or replace function private.safe_review_display_name(
  p_user_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select left(
    coalesce(
      nullif(btrim(p.display_name), ''),
      'ProBee customer'
    ),
    120
  )
  from public.profiles p
  where p.id = p_user_id;
$$;

revoke all on function private.safe_review_display_name(uuid)
from public, anon, authenticated;

create or replace function public.create_product_review(
  p_product_id uuid,
  p_rating smallint,
  p_title text default null,
  p_body text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_title text := nullif(btrim(p_title), '');
  v_body text := btrim(coalesce(p_body, ''));
  v_display_name text;
  v_review public.reviews%rowtype;
begin
  if v_user_id is null then
    raise exception 'review:auth_required';
  end if;

  if p_product_id is null then
    raise exception 'review:product_invalid';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'review:rating_invalid';
  end if;

  if v_title is not null and char_length(v_title) > 120 then
    raise exception 'review:title_too_long';
  end if;

  if char_length(v_body) < 1 or char_length(v_body) > 2000 then
    raise exception 'review:body_invalid';
  end if;

  if not exists (
    select 1
    from public.products p
    where p.id = p_product_id
  ) then
    raise exception 'review:product_not_found';
  end if;

  if not private.has_eligible_product_purchase(v_user_id, p_product_id) then
    raise exception 'review:purchase_required';
  end if;

  v_display_name := private.safe_review_display_name(v_user_id);

  begin
    insert into public.reviews (
      product_id,
      user_id,
      rating,
      title,
      body,
      moderation_status,
      is_verified_purchase,
      display_name_snapshot
    )
    values (
      p_product_id,
      v_user_id,
      p_rating,
      v_title,
      v_body,
      'pending',
      true,
      coalesce(v_display_name, 'ProBee customer')
    )
    returning * into v_review;
  exception
    when unique_violation then
      raise exception 'review:already_exists';
  end;

  return jsonb_build_object(
    'reviewId', v_review.id,
    'status', v_review.moderation_status,
    'isVerifiedPurchase', v_review.is_verified_purchase
  );
end;
$$;

revoke all on function public.create_product_review(uuid, smallint, text, text)
from public, anon, authenticated;

grant execute on function public.create_product_review(uuid, smallint, text, text)
to authenticated;

create or replace function public.update_my_product_review(
  p_review_id uuid,
  p_rating smallint,
  p_title text default null,
  p_body text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_review public.reviews%rowtype;
  v_title text := nullif(btrim(p_title), '');
  v_body text := btrim(coalesce(p_body, ''));
  v_display_name text;
begin
  if v_user_id is null then
    raise exception 'review:auth_required';
  end if;

  if p_review_id is null then
    raise exception 'review:not_found';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'review:rating_invalid';
  end if;

  if v_title is not null and char_length(v_title) > 120 then
    raise exception 'review:title_too_long';
  end if;

  if char_length(v_body) < 1 or char_length(v_body) > 2000 then
    raise exception 'review:body_invalid';
  end if;

  select *
  into v_review
  from public.reviews r
  where r.id = p_review_id
    and r.user_id = v_user_id
  for update;

  if v_review.id is null then
    raise exception 'review:not_found';
  end if;

  if not private.has_eligible_product_purchase(v_user_id, v_review.product_id) then
    raise exception 'review:purchase_required';
  end if;

  v_display_name := private.safe_review_display_name(v_user_id);

  update public.reviews
  set rating = p_rating,
      title = v_title,
      body = v_body,
      moderation_status = 'pending',
      is_verified_purchase = true,
      display_name_snapshot = coalesce(v_display_name, 'ProBee customer'),
      moderated_at = null,
      moderated_by = null,
      moderation_reason = null,
      updated_at = timezone('utc', now())
  where id = v_review.id
    and user_id = v_user_id;

  return jsonb_build_object(
    'reviewId', v_review.id,
    'status', 'pending',
    'isVerifiedPurchase', true
  );
end;
$$;

revoke all on function public.update_my_product_review(uuid, smallint, text, text)
from public, anon, authenticated;

grant execute on function public.update_my_product_review(uuid, smallint, text, text)
to authenticated;

create or replace function public.get_product_review_summary(
  p_product_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'averageRating',
    coalesce(round(avg(r.rating)::numeric, 2), 0),
    'reviewCount',
    count(*)::integer,
    'distribution',
    jsonb_build_object(
      '1', count(*) filter (where r.rating = 1)::integer,
      '2', count(*) filter (where r.rating = 2)::integer,
      '3', count(*) filter (where r.rating = 3)::integer,
      '4', count(*) filter (where r.rating = 4)::integer,
      '5', count(*) filter (where r.rating = 5)::integer
    )
  )
  from public.reviews r
  where r.product_id = p_product_id
    and r.moderation_status = 'approved';
$$;

revoke all on function public.get_product_review_summary(uuid)
from public;

grant execute on function public.get_product_review_summary(uuid)
to anon, authenticated;

create or replace function public.get_product_reviews(
  p_product_id uuid,
  p_limit integer default 5,
  p_offset integer default 0,
  p_sort text default 'newest'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 5), 20));
  v_offset integer := greatest(0, least(coalesce(p_offset, 0), 10000));
  v_sort text := lower(coalesce(p_sort, 'newest'));
  v_total integer := 0;
  v_items jsonb := '[]'::jsonb;
begin
  if v_sort not in ('newest', 'highest', 'lowest') then
    v_sort := 'newest';
  end if;

  select count(*)::integer
  into v_total
  from public.reviews r
  where r.product_id = p_product_id
    and r.moderation_status = 'approved';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', x.id,
        'rating', x.rating,
        'title', x.title,
        'body', x.body,
        'displayName', coalesce(nullif(x.display_name_snapshot, ''), 'ProBee customer'),
        'isVerifiedPurchase', x.is_verified_purchase,
        'createdAt', x.created_at
      )
      order by
        case when v_sort = 'highest' then x.rating end desc nulls last,
        case when v_sort = 'lowest' then x.rating end asc nulls last,
        x.created_at desc
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select
      r.id,
      r.rating,
      r.title,
      r.body,
      r.display_name_snapshot,
      r.is_verified_purchase,
      r.created_at
    from public.reviews r
    where r.product_id = p_product_id
      and r.moderation_status = 'approved'
    order by
      case when v_sort = 'highest' then r.rating end desc nulls last,
      case when v_sort = 'lowest' then r.rating end asc nulls last,
      r.created_at desc
    limit v_limit
    offset v_offset
  ) x;

  return jsonb_build_object(
    'items', v_items,
    'totalCount', v_total,
    'limit', v_limit,
    'offset', v_offset,
    'sort', v_sort
  );
end;
$$;

revoke all on function public.get_product_reviews(uuid, integer, integer, text)
from public;

grant execute on function public.get_product_reviews(uuid, integer, integer, text)
to anon, authenticated;

create or replace function public.get_my_review_dashboard(
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 100));
  v_reviews jsonb := '[]'::jsonb;
  v_eligible jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'review:auth_required';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'productId', r.product_id,
        'productName', coalesce(p.name, 'Purchased product'),
        'productSlug', p.slug,
        'rating', r.rating,
        'title', r.title,
        'body', r.body,
        'status', r.moderation_status,
        'isVerifiedPurchase', r.is_verified_purchase,
        'createdAt', r.created_at,
        'updatedAt', r.updated_at
      )
      order by r.updated_at desc
    ),
    '[]'::jsonb
  )
  into v_reviews
  from (
    select r.*
    from public.reviews r
    where r.user_id = v_user_id
    order by r.updated_at desc
    limit v_limit
  ) r
  left join public.products p
    on p.id = r.product_id;

  with eligible as (
    select
      p.id as product_id,
      p.name as product_name,
      p.slug as product_slug,
      max(o.created_at) as latest_order_created_at,
      (array_agg(o.order_reference order by o.created_at desc))[1] as latest_order_reference
    from public.orders o
    join public.order_items oi
      on oi.order_id = o.id
    join public.products p
      on p.id = oi.product_id
    where o.user_id = v_user_id
      and o.payment_status = 'paid'
      and o.order_status not in ('cancelled', 'failed', 'refunded')
      and not exists (
        select 1
        from public.reviews r
        where r.user_id = v_user_id
          and r.product_id = oi.product_id
      )
    group by p.id, p.name, p.slug
    order by max(o.created_at) desc
    limit v_limit
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'productId', e.product_id,
        'productName', e.product_name,
        'productSlug', e.product_slug,
        'orderReference', e.latest_order_reference
      )
      order by e.latest_order_created_at desc
    ),
    '[]'::jsonb
  )
  into v_eligible
  from eligible e;

  return jsonb_build_object(
    'reviews', v_reviews,
    'eligibleProducts', v_eligible
  );
end;
$$;

revoke all on function public.get_my_review_dashboard(integer)
from public, anon;

grant execute on function public.get_my_review_dashboard(integer)
to authenticated;

create or replace function public.set_review_moderation(
  p_review_id uuid,
  p_status text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_review public.reviews%rowtype;
  v_staff_id uuid := (select auth.uid());
  v_reason text := nullif(btrim(p_reason), '');
  v_verified boolean := false;
begin
  if v_staff_id is null or not private.is_staff() then
    raise exception 'review:not_authorized';
  end if;

  if p_status not in ('pending', 'approved', 'rejected', 'hidden') then
    raise exception 'review:moderation_status_invalid';
  end if;

  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'review:moderation_reason_too_long';
  end if;

  select *
  into v_review
  from public.reviews r
  where r.id = p_review_id
  for update;

  if v_review.id is null then
    raise exception 'review:not_found';
  end if;

  if p_status = 'approved' then
    v_verified := private.has_eligible_product_purchase(
      v_review.user_id,
      v_review.product_id
    );

    if not v_verified then
      raise exception 'review:purchase_required';
    end if;
  end if;

  update public.reviews
  set moderation_status = p_status,
      is_verified_purchase = v_verified,
      moderated_at = timezone('utc', now()),
      moderated_by = v_staff_id,
      moderation_reason = v_reason,
      updated_at = timezone('utc', now())
  where id = v_review.id;

  return jsonb_build_object(
    'reviewId', v_review.id,
    'status', p_status,
    'isVerifiedPurchase', v_verified
  );
end;
$$;

revoke all on function public.set_review_moderation(uuid, text, text)
from public, anon;

grant execute on function public.set_review_moderation(uuid, text, text)
to authenticated;

create or replace function public.get_admin_reviews(
  p_status text default 'pending',
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 100));
  v_offset integer := greatest(0, least(coalesce(p_offset, 0), 10000));
  v_status text := lower(coalesce(p_status, 'pending'));
  v_total integer := 0;
  v_items jsonb := '[]'::jsonb;
begin
  if not private.is_staff() then
    raise exception 'review:not_authorized';
  end if;

  if v_status not in ('all', 'pending', 'approved', 'rejected', 'hidden') then
    v_status := 'pending';
  end if;

  select count(*)::integer
  into v_total
  from public.reviews r
  where v_status = 'all' or r.moderation_status = v_status;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'productId', r.product_id,
        'productName', coalesce(p.name, 'Purchased product'),
        'productSlug', p.slug,
        'reviewerName', coalesce(nullif(r.display_name_snapshot, ''), 'ProBee customer'),
        'rating', r.rating,
        'title', r.title,
        'body', r.body,
        'status', r.moderation_status,
        'isVerifiedPurchase', r.is_verified_purchase,
        'createdAt', r.created_at,
        'updatedAt', r.updated_at,
        'moderatedAt', r.moderated_at,
        'moderationReason', r.moderation_reason
      )
      order by r.created_at desc
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select r.*
    from public.reviews r
    where v_status = 'all' or r.moderation_status = v_status
    order by r.created_at desc
    limit v_limit
    offset v_offset
  ) r
  left join public.products p
    on p.id = r.product_id;

  return jsonb_build_object(
    'items', v_items,
    'totalCount', v_total,
    'limit', v_limit,
    'offset', v_offset,
    'status', v_status
  );
end;
$$;

revoke all on function public.get_admin_reviews(text, integer, integer)
from public, anon;

grant execute on function public.get_admin_reviews(text, integer, integer)
to authenticated;
