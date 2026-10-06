-- ProBee V2 STEP 8: secure product media storage
-- Product media only. No payment/customer document storage is affected.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'product-media',
  'product-media',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on column public.product_media.media_url is
  'Canonical product-media storage object path in the product-media bucket. Public URLs are derived when needed.';

create unique index if not exists product_media_storage_path_uniq
  on public.product_media(media_url);

create or replace function public.set_product_media_primary(
  p_product_id uuid,
  p_media_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.product_media pm
    where pm.id = p_media_id
      and pm.product_id = p_product_id
      and pm.is_active = true
  ) then
    raise exception 'media item not found' using errcode = 'P0002';
  end if;

  update public.product_media
  set is_primary = false
  where product_id = p_product_id
    and is_primary = true;

  update public.product_media
  set is_primary = true
  where id = p_media_id
    and product_id = p_product_id
    and is_active = true;

  return true;
end;
$$;

create or replace function public.set_product_media_active(
  p_product_id uuid,
  p_media_id uuid,
  p_is_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  was_primary boolean;
  replacement_id uuid;
begin
  if not private.is_staff() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select pm.is_primary
  into was_primary
  from public.product_media pm
  where pm.id = p_media_id
    and pm.product_id = p_product_id
  for update;

  if was_primary is null then
    raise exception 'media item not found' using errcode = 'P0002';
  end if;

  if p_is_active then
    update public.product_media
    set is_active = true
    where id = p_media_id
      and product_id = p_product_id;

    return true;
  end if;

  update public.product_media
  set
    is_primary = false,
    is_active = false
  where id = p_media_id
    and product_id = p_product_id;

  if was_primary then
    select pm.id
    into replacement_id
    from public.product_media pm
    where pm.product_id = p_product_id
      and pm.is_active = true
    order by pm.sort_order asc, pm.created_at asc, pm.id asc
    limit 1;

    if replacement_id is not null then
      update public.product_media
      set is_primary = true
      where id = replacement_id;
    end if;
  end if;

  return true;
end;
$$;

create or replace function public.reorder_product_media(
  p_product_id uuid,
  p_media_ids uuid[]
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  supplied_count integer;
  existing_count integer;
begin
  if not private.is_staff() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select count(distinct value)
  into supplied_count
  from unnest(coalesce(p_media_ids, '{}'::uuid[])) as value;

  select count(*)
  into existing_count
  from public.product_media pm
  where pm.product_id = p_product_id;

  if supplied_count <> existing_count then
    raise exception 'media ordering does not match product media' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_media_ids, '{}'::uuid[])) as supplied(id)
    left join public.product_media pm
      on pm.id = supplied.id
     and pm.product_id = p_product_id
    where pm.id is null
  ) then
    raise exception 'media ordering contains an invalid item' using errcode = '22023';
  end if;

  update public.product_media pm
  set sort_order = ordered.ord::integer - 1
  from unnest(p_media_ids) with ordinality as ordered(id, ord)
  where pm.id = ordered.id
    and pm.product_id = p_product_id;

  return true;
end;
$$;

revoke all on function public.set_product_media_primary(uuid, uuid) from public, anon;
revoke all on function public.set_product_media_active(uuid, uuid, boolean) from public, anon;
revoke all on function public.reorder_product_media(uuid, uuid[]) from public, anon;

grant execute on function public.set_product_media_primary(uuid, uuid) to authenticated;
grant execute on function public.set_product_media_active(uuid, uuid, boolean) to authenticated;
grant execute on function public.reorder_product_media(uuid, uuid[]) to authenticated;

-- Storage.objects ownership is managed by Supabase. Storage policies are provisioned separately.
