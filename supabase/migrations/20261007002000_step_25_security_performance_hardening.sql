-- STEP 25: security/performance hardening
-- Public review read helpers must honor the reviews RLS policies directly.
-- They only return approved rows for anon/authenticated users, so SECURITY INVOKER
-- is the correct least-privilege mode.
create or replace function public.get_product_review_summary(p_product_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path to ''
as $function$
  select jsonb_build_object(
    'averageRating', coalesce(round(avg(r.rating)::numeric, 2), 0),
    'reviewCount', count(*)::integer,
    'distribution', jsonb_build_object(
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
$function$;

create or replace function public.get_product_reviews(
  p_product_id uuid,
  p_limit integer default 5,
  p_offset integer default 0,
  p_sort text default 'newest'
)
returns jsonb
language plpgsql
stable
security invoker
set search_path to ''
as $function$
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

  select count(*)::integer into v_total
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
  ) into v_items
  from (
    select r.id, r.rating, r.title, r.body, r.display_name_snapshot,
           r.is_verified_purchase, r.created_at
    from public.reviews r
    where r.product_id = p_product_id
      and r.moderation_status = 'approved'
    order by
      case when v_sort = 'highest' then r.rating end desc nulls last,
      case when v_sort = 'lowest' then r.rating end asc nulls last,
      r.created_at desc
    limit v_limit offset v_offset
  ) x;

  return jsonb_build_object(
    'items', v_items,
    'totalCount', v_total,
    'limit', v_limit,
    'offset', v_offset,
    'sort', v_sort
  );
end;
$function$;

create index if not exists digital_delivery_assets_updated_by_idx
  on public.digital_delivery_assets(updated_by);

create index if not exists order_items_plan_id_idx
  on public.order_items(plan_id);
