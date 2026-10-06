-- ProBee V2 STEP 17: consolidated admin dashboard data and guarded operations.
-- Additive only. Existing product, payment, digital-delivery, review, and email
-- systems remain the source of truth.

create or replace function public.get_admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_paid_sales jsonb;
  v_total_customers bigint;
begin
  if not private.is_staff() then
    raise exception 'admin:not_authorized';
  end if;

  select coalesce(
    jsonb_object_agg(currency, total_sales order by currency),
    '{}'::jsonb
  )
  into v_paid_sales
  from (
    select o.currency, sum(o.total)::numeric(20,2) as total_sales
    from public.orders o
    where o.payment_status = 'paid'
    group by o.currency
  ) sales;

  select count(*)
  into v_total_customers
  from auth.users u
  where not exists (
    select 1
    from public.admin_users au
    where au.id = u.id
  );

  return jsonb_build_object(
    'totalOrders', (select count(*) from public.orders),
    'pendingOrders', (select count(*) from public.orders where order_status = 'pending'),
    'processingOrders', (select count(*) from public.orders where order_status = 'processing'),
    'completedOrders', (select count(*) from public.orders where order_status = 'completed'),
    'cancelledOrders', (select count(*) from public.orders where order_status = 'cancelled'),
    'failedOrders', (select count(*) from public.orders where order_status = 'failed'),
    'totalPaidSalesByCurrency', coalesce(v_paid_sales, '{}'::jsonb),
    'pendingPayments', (select count(*) from public.payments where payment_status = 'pending'),
    'paidPayments', (select count(*) from public.payments where payment_status = 'paid'),
    'rejectedPayments', (select count(*) from public.payments where payment_status = 'rejected'),
    'totalCustomers', v_total_customers,
    'activeProducts', (select count(*) from public.products where is_active = true),
    'publishedProducts', (select count(*) from public.products where is_published = true),
    'pendingReviews', (select count(*) from public.reviews where moderation_status = 'pending'),
    'activeDigitalEntitlements', (
      select count(*)
      from public.digital_entitlements
      where access_status = 'active'
        and (expires_at is null or expires_at > timezone('utc', now()))
    )
  );
end;
$$;

revoke all on function public.get_admin_dashboard_stats() from public, anon;
grant execute on function public.get_admin_dashboard_stats() to authenticated;

create or replace function public.set_admin_order_status(
  p_order_id uuid,
  p_order_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  if not private.is_staff() then
    raise exception 'admin:not_authorized';
  end if;

  if p_order_status not in ('pending', 'processing', 'completed', 'cancelled', 'failed', 'refunded') then
    raise exception 'admin:order_status_invalid';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if v_order.id is null then
    raise exception 'admin:order_not_found';
  end if;

  if p_order_status = v_order.order_status then
    return jsonb_build_object(
      'orderId', v_order.id,
      'orderStatus', v_order.order_status,
      'paymentStatus', v_order.payment_status
    );
  end if;

  if v_order.order_status = 'pending'
     and p_order_status not in ('processing', 'cancelled', 'failed') then
    raise exception 'admin:order_transition_invalid';
  end if;

  if v_order.order_status = 'processing'
     and p_order_status not in ('completed', 'cancelled', 'failed') then
    raise exception 'admin:order_transition_invalid';
  end if;

  if v_order.order_status in ('completed', 'cancelled', 'failed', 'refunded') then
    raise exception 'admin:order_transition_invalid';
  end if;

  if p_order_status = 'refunded' and v_order.payment_status <> 'refunded' then
    raise exception 'admin:refund_payment_required';
  end if;

  -- Intentionally update only order_status. Payment state is controlled by
  -- the payment verification workflow and can never be changed here.
  update public.orders
  set order_status = p_order_status,
      updated_at = timezone('utc', now())
  where id = v_order.id;

  return jsonb_build_object(
    'orderId', v_order.id,
    'orderStatus', p_order_status,
    'paymentStatus', v_order.payment_status
  );
end;
$$;

revoke all on function public.set_admin_order_status(uuid, text) from public, anon;
grant execute on function public.set_admin_order_status(uuid, text) to authenticated;

create or replace function public.get_admin_customers(
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := left(btrim(coalesce(p_search, '')), 80);
  v_page integer := greatest(1, least(coalesce(p_page, 1), 100000));
  v_page_size integer := greatest(10, least(coalesce(p_page_size, 20), 50));
  v_offset integer := (v_page - 1) * v_page_size;
  v_total bigint;
  v_items jsonb;
begin
  if not private.is_staff() then
    raise exception 'admin:not_authorized';
  end if;

  select count(*)
  into v_total
  from auth.users u
  left join public.profiles p on p.id = u.id
  where not exists (
    select 1 from public.admin_users au where au.id = u.id
  )
  and (
    v_search = ''
    or position(lower(v_search) in lower(coalesce(u.email, ''))) > 0
    or position(lower(v_search) in lower(coalesce(p.display_name, ''))) > 0
    or position(lower(v_search) in lower(coalesce(p.phone, ''))) > 0
    or position(lower(v_search) in lower(coalesce(u.phone, ''))) > 0
  );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'displayName', coalesce(p.display_name, ''),
        'phone', coalesce(p.phone, u.phone),
        'createdAt', u.created_at,
        'emailVerifiedAt', u.email_confirmed_at,
        'orderCount', (
          select count(*) from public.orders o where o.user_id = u.id
        ),
        'paidSpendByCurrency', coalesce((
          select jsonb_object_agg(currency, paid_total order by currency)
          from (
            select o.currency, sum(o.total)::numeric(20,2) as paid_total
            from public.orders o
            where o.user_id = u.id and o.payment_status = 'paid'
            group by o.currency
          ) spend
        ), '{}'::jsonb),
        'latestOrder', (
          select jsonb_build_object(
            'orderReference', o.order_reference,
            'orderStatus', o.order_status,
            'paymentStatus', o.payment_status,
            'total', o.total,
            'currency', o.currency,
            'createdAt', o.created_at
          )
          from public.orders o
          where o.user_id = u.id
          order by o.created_at desc
          limit 1
        ),
        'reviewCount', (
          select count(*) from public.reviews r where r.user_id = u.id
        ),
        'entitlementCount', (
          select count(*) from public.digital_entitlements e where e.user_id = u.id
        )
      )
      order by u.created_at desc
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select u.id
    from auth.users u
    left join public.profiles p on p.id = u.id
    where not exists (
      select 1 from public.admin_users au where au.id = u.id
    )
    and (
      v_search = ''
      or position(lower(v_search) in lower(coalesce(u.email, ''))) > 0
      or position(lower(v_search) in lower(coalesce(p.display_name, ''))) > 0
      or position(lower(v_search) in lower(coalesce(p.phone, ''))) > 0
      or position(lower(v_search) in lower(coalesce(u.phone, ''))) > 0
    )
    order by u.created_at desc
    limit v_page_size offset v_offset
  ) picked
  join auth.users u on u.id = picked.id
  left join public.profiles p on p.id = u.id;

  return jsonb_build_object(
    'items', v_items,
    'totalCount', v_total,
    'page', v_page,
    'pageSize', v_page_size,
    'pageCount', greatest(1, ceil(v_total::numeric / v_page_size)::integer)
  );
end;
$$;

revoke all on function public.get_admin_customers(text, integer, integer) from public, anon;
grant execute on function public.get_admin_customers(text, integer, integer) to authenticated;

create or replace function public.get_admin_customer_detail(
  p_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not private.is_staff() then
    raise exception 'admin:not_authorized';
  end if;

  if p_user_id is null then
    raise exception 'admin:customer_not_found';
  end if;

  select jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'displayName', coalesce(p.display_name, ''),
    'phone', coalesce(p.phone, u.phone),
    'createdAt', u.created_at,
    'emailVerifiedAt', u.email_confirmed_at,
    'orderCount', (select count(*) from public.orders o where o.user_id = u.id),
    'paidSpendByCurrency', coalesce((
      select jsonb_object_agg(currency, paid_total order by currency)
      from (
        select o.currency, sum(o.total)::numeric(20,2) as paid_total
        from public.orders o
        where o.user_id = u.id and o.payment_status = 'paid'
        group by o.currency
      ) spend
    ), '{}'::jsonb),
    'latestOrder', (
      select jsonb_build_object(
        'orderReference', o.order_reference,
        'orderStatus', o.order_status,
        'paymentStatus', o.payment_status,
        'total', o.total,
        'currency', o.currency,
        'createdAt', o.created_at
      )
      from public.orders o
      where o.user_id = u.id
      order by o.created_at desc
      limit 1
    ),
    'reviewCount', (select count(*) from public.reviews r where r.user_id = u.id),
    'entitlementCount', (select count(*) from public.digital_entitlements e where e.user_id = u.id)
  )
  into v_result
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = p_user_id
    and not exists (select 1 from public.admin_users au where au.id = u.id);

  if v_result is null then
    raise exception 'admin:customer_not_found';
  end if;

  return v_result;
end;
$$;

revoke all on function public.get_admin_customer_detail(uuid) from public, anon;
grant execute on function public.get_admin_customer_detail(uuid) to authenticated;

create or replace function public.get_admin_payments(
  p_search text default null,
  p_status text default 'all',
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := left(btrim(coalesce(p_search, '')), 80);
  v_status text := lower(coalesce(p_status, 'all'));
  v_page integer := greatest(1, least(coalesce(p_page, 1), 100000));
  v_page_size integer := greatest(10, least(coalesce(p_page_size, 20), 50));
  v_offset integer := (v_page - 1) * v_page_size;
  v_total bigint;
  v_items jsonb;
begin
  if not private.is_staff() then
    raise exception 'admin:not_authorized';
  end if;

  if v_status not in ('all','pending','paid','failed','rejected','refunded') then
    v_status := 'all';
  end if;

  select count(*)
  into v_total
  from public.payments pay
  join public.orders o on o.id = pay.order_id
  where pay.payment_method = 'manual_bank_transfer'
    and (v_status = 'all' or pay.payment_status = v_status)
    and (
      v_search = ''
      or position(lower(v_search) in lower(coalesce(o.order_reference, ''))) > 0
      or position(lower(v_search) in lower(coalesce(o.customer_name, ''))) > 0
      or position(lower(v_search) in lower(coalesce(o.customer_email, ''))) > 0
      or position(lower(v_search) in lower(coalesce(pay.external_reference, ''))) > 0
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', pay.id,
        'orderId', o.id,
        'orderReference', o.order_reference,
        'customerName', o.customer_name,
        'customerEmail', o.customer_email,
        'orderStatus', o.order_status,
        'amount', pay.amount,
        'currency', pay.currency,
        'paymentStatus', pay.payment_status,
        'paymentReference', pay.external_reference,
        'createdAt', pay.created_at,
        'verifiedBy', pay.verified_by,
        'verifiedAt', pay.verified_at,
        'proof', case when proof.id is null then null else jsonb_build_object(
          'id', proof.id,
          'originalFilename', proof.original_filename,
          'mimeType', proof.mime_type,
          'fileSizeBytes', proof.file_size_bytes,
          'verificationStatus', proof.verification_status,
          'verifiedAt', proof.verified_at,
          'createdAt', proof.created_at
        ) end
      )
      order by pay.created_at desc
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select pay.id
    from public.payments pay
    join public.orders o on o.id = pay.order_id
    where pay.payment_method = 'manual_bank_transfer'
      and (v_status = 'all' or pay.payment_status = v_status)
      and (
        v_search = ''
        or position(lower(v_search) in lower(coalesce(o.order_reference, ''))) > 0
        or position(lower(v_search) in lower(coalesce(o.customer_name, ''))) > 0
        or position(lower(v_search) in lower(coalesce(o.customer_email, ''))) > 0
        or position(lower(v_search) in lower(coalesce(pay.external_reference, ''))) > 0
      )
    order by pay.created_at desc
    limit v_page_size offset v_offset
  ) picked
  join public.payments pay on pay.id = picked.id
  join public.orders o on o.id = pay.order_id
  left join lateral (
    select pp.id, pp.original_filename, pp.mime_type, pp.file_size_bytes,
           pp.verification_status, pp.verified_at, pp.created_at
    from public.payment_proofs pp
    where pp.payment_id = pay.id
    order by pp.created_at desc
    limit 1
  ) proof on true;

  return jsonb_build_object(
    'items', v_items,
    'totalCount', v_total,
    'page', v_page,
    'pageSize', v_page_size,
    'pageCount', greatest(1, ceil(v_total::numeric / v_page_size)::integer)
  );
end;
$$;

revoke all on function public.get_admin_payments(text, text, integer, integer) from public, anon;
grant execute on function public.get_admin_payments(text, text, integer, integer) to authenticated;

create or replace function public.get_admin_email_activity(
  p_search text default null,
  p_status text default 'all',
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := left(btrim(coalesce(p_search, '')), 80);
  v_status text := lower(coalesce(p_status, 'all'));
  v_page integer := greatest(1, least(coalesce(p_page, 1), 100000));
  v_page_size integer := greatest(10, least(coalesce(p_page_size, 25), 50));
  v_offset integer := (v_page - 1) * v_page_size;
  v_total bigint;
  v_items jsonb;
begin
  if not private.is_staff() then
    raise exception 'admin:not_authorized';
  end if;

  if v_status not in ('all','queued','sending','sent','failed') then
    v_status := 'all';
  end if;

  select count(*)
  into v_total
  from public.transactional_email_logs e
  where (v_status = 'all' or e.delivery_status = v_status)
    and (
      v_search = ''
      or position(lower(v_search) in lower(coalesce(e.event_type, ''))) > 0
      or position(lower(v_search) in lower(coalesce(e.recipient, ''))) > 0
      or position(lower(v_search) in lower(coalesce(e.provider, ''))) > 0
      or position(lower(v_search) in lower(coalesce(e.order_id::text, ''))) > 0
      or position(lower(v_search) in lower(coalesce(e.payment_id::text, ''))) > 0
      or position(lower(v_search) in lower(coalesce(e.entitlement_id::text, ''))) > 0
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'eventType', e.event_type,
        'recipient', e.recipient,
        'orderId', e.order_id,
        'paymentId', e.payment_id,
        'entitlementId', e.entitlement_id,
        'provider', e.provider,
        'providerMessageId', e.provider_message_id,
        'status', e.delivery_status,
        'attemptCount', e.attempt_count,
        'failureState', e.last_error,
        'createdAt', e.created_at,
        'sentAt', e.sent_at
      )
      order by e.created_at desc
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select e.id, e.event_type, e.recipient, e.order_id, e.payment_id,
           e.entitlement_id, e.provider, e.provider_message_id,
           e.delivery_status, e.attempt_count, e.last_error,
           e.created_at, e.sent_at
    from public.transactional_email_logs e
    where (v_status = 'all' or e.delivery_status = v_status)
      and (
        v_search = ''
        or position(lower(v_search) in lower(coalesce(e.event_type, ''))) > 0
        or position(lower(v_search) in lower(coalesce(e.recipient, ''))) > 0
        or position(lower(v_search) in lower(coalesce(e.provider, ''))) > 0
        or position(lower(v_search) in lower(coalesce(e.order_id::text, ''))) > 0
        or position(lower(v_search) in lower(coalesce(e.payment_id::text, ''))) > 0
        or position(lower(v_search) in lower(coalesce(e.entitlement_id::text, ''))) > 0
      )
    order by e.created_at desc
    limit v_page_size offset v_offset
  ) e;

  return jsonb_build_object(
    'items', v_items,
    'totalCount', v_total,
    'page', v_page,
    'pageSize', v_page_size,
    'pageCount', greatest(1, ceil(v_total::numeric / v_page_size)::integer)
  );
end;
$$;

revoke all on function public.get_admin_email_activity(text, text, integer, integer) from public, anon;
grant execute on function public.get_admin_email_activity(text, text, integer, integer) to authenticated;

create or replace function public.get_admin_digital_queue(
  p_search text default null,
  p_status text default 'all',
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := left(btrim(coalesce(p_search, '')), 80);
  v_status text := lower(coalesce(p_status, 'all'));
  v_page integer := greatest(1, least(coalesce(p_page, 1), 100000));
  v_page_size integer := greatest(10, least(coalesce(p_page_size, 20), 50));
  v_offset integer := (v_page - 1) * v_page_size;
  v_total bigint;
  v_items jsonb;
begin
  if not private.is_staff() then
    raise exception 'admin:not_authorized';
  end if;

  if v_status not in ('all','pending','active','suspended','expired','revoked') then
    v_status := 'all';
  end if;

  with queue as (
    select
      oi.id as order_item_id,
      o.order_reference,
      o.customer_name,
      o.customer_email,
      o.order_status,
      o.payment_status,
      oi.product_name_snapshot,
      oi.plan_name_snapshot,
      oi.quantity,
      oi.created_at,
      p.product_type,
      p.delivery_type as product_delivery_type,
      pp.delivery_type as plan_delivery_type,
      e.id as entitlement_id,
      e.access_status,
      e.customer_access_url,
      e.fulfilled_at,
      e.expires_at,
      (
        select count(*)
        from public.digital_entitlement_assets ea
        where ea.entitlement_id = e.id
      ) as asset_count
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    left join public.products p on p.id = oi.product_id
    left join public.product_plans pp on pp.id = oi.plan_id
    left join lateral (
      select e.*
      from public.digital_entitlements e
      where e.order_item_id = oi.id
      order by e.created_at desc
      limit 1
    ) e on true
    where o.payment_status = 'paid'
      and o.order_status not in ('cancelled','failed','refunded')
      and p.product_type in ('digital','license','subscription')
      and (
        v_search = ''
        or position(lower(v_search) in lower(coalesce(o.order_reference, ''))) > 0
        or position(lower(v_search) in lower(coalesce(o.customer_name, ''))) > 0
        or position(lower(v_search) in lower(coalesce(o.customer_email, ''))) > 0
        or position(lower(v_search) in lower(coalesce(oi.product_name_snapshot, ''))) > 0
        or position(lower(v_search) in lower(coalesce(oi.plan_name_snapshot, ''))) > 0
      )
      and (
        v_status = 'all'
        or (v_status = 'pending' and e.id is null)
        or (v_status <> 'pending' and e.access_status = v_status)
      )
  )
  select count(*) into v_total from queue;

  with queue as (
    select
      oi.id as order_item_id,
      o.order_reference,
      o.customer_name,
      o.customer_email,
      o.order_status,
      o.payment_status,
      oi.product_name_snapshot,
      oi.plan_name_snapshot,
      oi.quantity,
      oi.created_at,
      p.product_type,
      p.delivery_type as product_delivery_type,
      pp.delivery_type as plan_delivery_type,
      e.id as entitlement_id,
      e.access_status,
      e.customer_access_url,
      e.fulfilled_at,
      e.expires_at,
      (
        select count(*)
        from public.digital_entitlement_assets ea
        where ea.entitlement_id = e.id
      ) as asset_count
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    left join public.products p on p.id = oi.product_id
    left join public.product_plans pp on pp.id = oi.plan_id
    left join lateral (
      select e.*
      from public.digital_entitlements e
      where e.order_item_id = oi.id
      order by e.created_at desc
      limit 1
    ) e on true
    where o.payment_status = 'paid'
      and o.order_status not in ('cancelled','failed','refunded')
      and p.product_type in ('digital','license','subscription')
      and (
        v_search = ''
        or position(lower(v_search) in lower(coalesce(o.order_reference, ''))) > 0
        or position(lower(v_search) in lower(coalesce(o.customer_name, ''))) > 0
        or position(lower(v_search) in lower(coalesce(o.customer_email, ''))) > 0
        or position(lower(v_search) in lower(coalesce(oi.product_name_snapshot, ''))) > 0
        or position(lower(v_search) in lower(coalesce(oi.plan_name_snapshot, ''))) > 0
      )
      and (
        v_status = 'all'
        or (v_status = 'pending' and e.id is null)
        or (v_status <> 'pending' and e.access_status = v_status)
      )
    order by oi.created_at desc
    limit v_page_size offset v_offset
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'orderItemId', q.order_item_id,
        'orderReference', q.order_reference,
        'customerName', q.customer_name,
        'customerEmail', q.customer_email,
        'orderStatus', q.order_status,
        'paymentStatus', q.payment_status,
        'productName', q.product_name_snapshot,
        'planName', q.plan_name_snapshot,
        'quantity', q.quantity,
        'createdAt', q.created_at,
        'productType', q.product_type,
        'deliveryType', coalesce(nullif(btrim(q.plan_delivery_type), ''), nullif(btrim(q.product_delivery_type), '')),
        'entitlementId', q.entitlement_id,
        'accessStatus', q.access_status,
        'customerAccessUrlConfigured', q.customer_access_url is not null,
        'fulfilledAt', q.fulfilled_at,
        'expiresAt', q.expires_at,
        'assetCount', q.asset_count,
        'eligible', (
          coalesce(nullif(btrim(q.plan_delivery_type), ''), nullif(btrim(q.product_delivery_type), '')) is not null
        ),
        'eligibilityReason', case
          when coalesce(nullif(btrim(q.plan_delivery_type), ''), nullif(btrim(q.product_delivery_type), '')) is null
          then 'Delivery type not configured'
          else ''
        end
      )
      order by q.created_at desc
    ),
    '[]'::jsonb
  )
  into v_items
  from queue q;

  return jsonb_build_object(
    'items', v_items,
    'totalCount', v_total,
    'page', v_page,
    'pageSize', v_page_size,
    'pageCount', greatest(1, ceil(v_total::numeric / v_page_size)::integer)
  );
end;
$$;

revoke all on function public.get_admin_digital_queue(text, text, integer, integer) from public, anon;
grant execute on function public.get_admin_digital_queue(text, text, integer, integer) to authenticated;

create index if not exists orders_admin_created_idx
  on public.orders(created_at desc, id);

create index if not exists payments_admin_created_idx
  on public.payments(created_at desc, payment_status, payment_method);

create index if not exists profiles_admin_display_name_idx
  on public.profiles(display_name);

create index if not exists transactional_email_logs_event_recipient_idx
  on public.transactional_email_logs(event_type, recipient);

create index if not exists digital_entitlements_admin_status_idx
  on public.digital_entitlements(access_status, created_at desc);

-- Search/pagination overload for the existing staff review moderation RPC.
create or replace function public.get_admin_reviews(
  p_status text default 'pending',
  p_search text default null,
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
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 50));
  v_offset integer := greatest(0, least(coalesce(p_offset, 0), 10000));
  v_status text := lower(coalesce(p_status, 'pending'));
  v_search text := left(btrim(coalesce(p_search, '')), 80);
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
  left join public.products p on p.id = r.product_id
  where (v_status = 'all' or r.moderation_status = v_status)
    and (
      v_search = ''
      or position(lower(v_search) in lower(coalesce(p.name, ''))) > 0
      or position(lower(v_search) in lower(coalesce(r.display_name_snapshot, ''))) > 0
      or position(lower(v_search) in lower(coalesce(r.title, ''))) > 0
      or position(lower(v_search) in lower(coalesce(r.body, ''))) > 0
    );

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
    left join public.products p on p.id = r.product_id
    where (v_status = 'all' or r.moderation_status = v_status)
      and (
        v_search = ''
        or position(lower(v_search) in lower(coalesce(p.name, ''))) > 0
        or position(lower(v_search) in lower(coalesce(r.display_name_snapshot, ''))) > 0
        or position(lower(v_search) in lower(coalesce(r.title, ''))) > 0
        or position(lower(v_search) in lower(coalesce(r.body, ''))) > 0
      )
    order by r.created_at desc
    limit v_limit offset v_offset
  ) r
  left join public.products p on p.id = r.product_id;

  return jsonb_build_object(
    'items', v_items,
    'totalCount', v_total,
    'limit', v_limit,
    'offset', v_offset,
    'page', floor(v_offset / v_limit)::integer + 1,
    'pageCount', greatest(1, ceil(v_total::numeric / v_limit)::integer),
    'status', v_status
  );
end;
$$;

revoke all on function public.get_admin_reviews(text, text, integer, integer)
from public, anon;
grant execute on function public.get_admin_reviews(text, text, integer, integer)
to authenticated;

-- STEP 17 privilege hardening: operational financial/order/delivery state is
-- mutated only through the established secure checkout/payment/digital RPCs.
revoke insert, update, delete on
  public.orders,
  public.order_items,
  public.payments,
  public.payment_proofs,
  public.digital_entitlements
from authenticated;
