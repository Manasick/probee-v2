-- ProBee V2 STEP 18: security and RLS hardening.
-- Fixes only verified authorization/integrity gaps found during the STEP 1-17 audit.

-- 1) Deactivated digital assets must never remain downloadable through either
-- the storage policy or the customer download-path RPC.
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
      and a.is_active = true
      and e.user_id = (select auth.uid())
      and e.access_status = 'active'
      and (e.expires_at is null or e.expires_at > timezone('utc', now()))
      and o.payment_status = 'paid'
      and o.order_status not in ('cancelled', 'failed', 'refunded')
  );
$digital$;

revoke all on function private.can_read_digital_asset_storage(text)
from public;
grant execute on function private.can_read_digital_asset_storage(text)
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
    and ea.asset_id = p_asset_id
    and a.is_active = true;

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

-- 2) A customer must not be able to register a database payment proof that
-- points at a nonexistent storage object. This closes the direct-RPC bypass
-- of the payment-proof upload flow.
create or replace function public.submit_manual_bank_payment(
  p_order_reference text,
  p_external_reference text,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_file_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_order public.orders%rowtype;
  v_payment_id uuid;
  v_payment_status text;
  v_existing_proof public.payment_proofs%rowtype;
  v_reference text;
  v_filename text;
begin
  if v_user_id is null then
    raise exception 'payment:auth_required';
  end if;

  if p_order_reference is null
     or char_length(btrim(p_order_reference)) = 0
     or char_length(btrim(p_order_reference)) > 64 then
    raise exception 'payment:order_invalid';
  end if;

  if p_external_reference is null then
    raise exception 'payment:reference_invalid';
  end if;

  v_reference := btrim(p_external_reference);

  if char_length(v_reference) < 2 or char_length(v_reference) > 100 then
    raise exception 'payment:reference_invalid';
  end if;

  if p_mime_type not in (
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ) then
    raise exception 'payment:file_invalid';
  end if;

  if p_file_size_bytes is null
     or p_file_size_bytes <= 0
     or p_file_size_bytes > 10485760 then
    raise exception 'payment:file_invalid';
  end if;

  if p_file_sha256 is null
     or p_file_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'payment:file_invalid';
  end if;

  if p_storage_path is null
     or p_storage_path !~* '^payment-proofs/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|pdf)$' then
    raise exception 'payment:file_invalid';
  end if;

  if split_part(p_storage_path, '/', 2) <> (
    select o.id::text
    from public.orders o
    where o.order_reference = btrim(p_order_reference)
  ) then
    raise exception 'payment:file_invalid';
  end if;

  select *
  into v_order
  from public.orders o
  where o.order_reference = btrim(p_order_reference)
    and o.user_id = v_user_id
  for update;

  if v_order.id is null then
    raise exception 'payment:order_not_found';
  end if;

  if not exists (
    select 1
    from storage.objects so
    where so.bucket_id = 'payment-proofs'
      and so.name = p_storage_path
      and coalesce(so.metadata ->> 'mimetype', '') = p_mime_type
      and case
        when coalesce(so.metadata ->> 'size', '') ~ '^[0-9]+
    raise exception 'payment:file_invalid';
  end if;

  if v_order.order_status in ('cancelled', 'completed', 'refunded') then
    raise exception 'payment:order_ineligible';
  end if;

  if v_order.payment_status = 'paid' then
    raise exception 'payment:already_paid';
  end if;

  if v_order.total <= 0 then
    raise exception 'payment:not_required';
  end if;

  if not exists (
    select 1
    from public.payment_settings ps
    where ps.payment_method = 'manual_bank_transfer'
      and ps.enabled = true
  ) then
    raise exception 'payment:method_unavailable';
  end if;

  select pay.id, pay.payment_status
  into v_payment_id, v_payment_status
  from public.payments pay
  where pay.order_id = v_order.id
    and pay.payment_method = 'manual_bank_transfer'
    and pay.payment_status = 'pending'
  order by pay.created_at desc
  limit 1
  for update;

  if v_payment_id is null then
    insert into public.payments (
      order_id,
      payment_method,
      payment_status,
      amount,
      currency
    )
    values (
      v_order.id,
      'manual_bank_transfer',
      'pending',
      v_order.total,
      v_order.currency
    )
    returning id, payment_status into v_payment_id, v_payment_status;
  else
    update public.payments
    set
      external_reference = v_reference,
      amount = v_order.total,
      currency = v_order.currency,
      updated_at = timezone('utc', now())
    where id = v_payment_id;
  end if;

  if p_original_filename is not null then
    v_filename := left(btrim(p_original_filename), 255);
  end if;

  update public.payments
  set
    external_reference = v_reference,
    updated_at = timezone('utc', now())
  where id = v_payment_id;

  update public.orders
  set
    payment_method = 'manual_bank_transfer',
    updated_at = timezone('utc', now())
  where id = v_order.id;

  begin
    insert into public.payment_proofs (
      payment_id,
      storage_path,
      original_filename,
      mime_type,
      file_size_bytes,
      uploaded_by,
      verification_status,
      file_sha256
    )
    values (
      v_payment_id,
      p_storage_path,
      v_filename,
      p_mime_type,
      p_file_size_bytes,
      v_user_id,
      'pending',
      p_file_sha256
    );
  exception
    when unique_violation then
      select *
      into v_existing_proof
      from public.payment_proofs pp
      where pp.payment_id = v_payment_id
        and pp.file_sha256 = p_file_sha256
      limit 1;

      if v_existing_proof.id is null then
        raise;
      end if;

      return jsonb_build_object(
        'paymentId', v_payment_id,
        'proofId', v_existing_proof.id,
        'paymentStatus', 'pending',
        'amount', v_order.total,
        'currency', v_order.currency,
        'verificationStatus', v_existing_proof.verification_status,
        'createdProof', false
      );
  end;

  return jsonb_build_object(
    'paymentId', v_payment_id,
    'proofId', (
      select id
      from public.payment_proofs
      where storage_path = p_storage_path
    ),
    'paymentStatus', 'pending',
    'amount', v_order.total,
    'currency', v_order.currency,
    'verificationStatus', 'pending',
    'createdProof', true
  );
end;
$$;

revoke all on function public.submit_manual_bank_payment(text, text, text, text, text, bigint, text)
from public, anon, authenticated;
grant execute on function public.submit_manual_bank_payment(text, text, text, text, text, bigint, text)
to authenticated;

-- 3) Payment verification must re-check the authoritative order amount/currency
-- and confirm that every pending proof points to a real private storage object.
create or replace function public.verify_manual_bank_payment(
  p_payment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_user_id uuid := (select auth.uid());
  v_next_order_status text;
begin
  if not private.is_staff() then
    raise exception 'payment:not_authorized';
  end if;

  select *
  into v_payment
  from public.payments pay
  where pay.id = p_payment_id
    and pay.payment_method = 'manual_bank_transfer'
  for update;

  if v_payment.id is null then
    raise exception 'payment:not_found';
  end if;

  select *
  into v_order
  from public.orders o
  where o.id = v_payment.order_id
  for update;

  if v_order.id is null then
    raise exception 'payment:not_found';
  end if;

  if v_payment.amount <> v_order.total
     or v_payment.currency <> v_order.currency then
    raise exception 'payment:amount_mismatch';
  end if;

  if v_payment.payment_status = 'paid' then
    return jsonb_build_object(
      'paymentId', v_payment.id,
      'paymentStatus', 'paid',
      'orderStatus', v_order.order_status
    );
  end if;

  if v_payment.payment_status <> 'pending' then
    raise exception 'payment:not_verifiable';
  end if;

  if not exists (
    select 1
    from public.payment_proofs pp
    join storage.objects so
      on so.bucket_id = 'payment-proofs'
     and so.name = pp.storage_path
    where pp.payment_id = v_payment.id
      and pp.verification_status = 'pending'
  ) then
    raise exception 'payment:proof_missing';
  end if;

  if v_order.order_status in ('cancelled', 'completed', 'refunded') then
    raise exception 'payment:order_ineligible';
  end if;

  v_next_order_status :=
    case
      when v_order.order_status = 'pending' then 'processing'
      else v_order.order_status
    end;

  update public.payments
  set
    payment_status = 'paid',
    verified_by = v_user_id,
    verified_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  where id = v_payment.id;

  update public.payment_proofs
  set
    verification_status = 'approved',
    verified_by = v_user_id,
    verified_at = timezone('utc', now())
  where payment_id = v_payment.id
    and verification_status = 'pending';

  update public.orders
  set
    payment_status = 'paid',
    order_status = v_next_order_status,
    payment_method = 'manual_bank_transfer',
    updated_at = timezone('utc', now())
  where id = v_payment.order_id;

  return jsonb_build_object(
    'paymentId', v_payment.id,
    'paymentStatus', 'paid',
    'orderStatus', v_next_order_status
  );
end;
$$;

revoke all on function public.verify_manual_bank_payment(uuid)
from public, anon, authenticated;
grant execute on function public.verify_manual_bank_payment(uuid)
to authenticated;

-- 4) Customer-visible entitlement metadata should not advertise deactivated
-- assets as downloadable inventory.
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
                and a.is_active = true
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

          then (so.metadata ->> 'size')::bigint = p_file_size_bytes
        else false
      end
  ) then
    raise exception 'payment:file_invalid';
  end if;

  if v_order.order_status in ('cancelled', 'completed', 'refunded') then
    raise exception 'payment:order_ineligible';
  end if;

  if v_order.payment_status = 'paid' then
    raise exception 'payment:already_paid';
  end if;

  if v_order.total <= 0 then
    raise exception 'payment:not_required';
  end if;

  if not exists (
    select 1
    from public.payment_settings ps
    where ps.payment_method = 'manual_bank_transfer'
      and ps.enabled = true
  ) then
    raise exception 'payment:method_unavailable';
  end if;

  select pay.id, pay.payment_status
  into v_payment_id, v_payment_status
  from public.payments pay
  where pay.order_id = v_order.id
    and pay.payment_method = 'manual_bank_transfer'
    and pay.payment_status = 'pending'
  order by pay.created_at desc
  limit 1
  for update;

  if v_payment_id is null then
    insert into public.payments (
      order_id,
      payment_method,
      payment_status,
      amount,
      currency
    )
    values (
      v_order.id,
      'manual_bank_transfer',
      'pending',
      v_order.total,
      v_order.currency
    )
    returning id, payment_status into v_payment_id, v_payment_status;
  else
    update public.payments
    set
      external_reference = v_reference,
      amount = v_order.total,
      currency = v_order.currency,
      updated_at = timezone('utc', now())
    where id = v_payment_id;
  end if;

  if p_original_filename is not null then
    v_filename := left(btrim(p_original_filename), 255);
  end if;

  update public.payments
  set
    external_reference = v_reference,
    updated_at = timezone('utc', now())
  where id = v_payment_id;

  update public.orders
  set
    payment_method = 'manual_bank_transfer',
    updated_at = timezone('utc', now())
  where id = v_order.id;

  begin
    insert into public.payment_proofs (
      payment_id,
      storage_path,
      original_filename,
      mime_type,
      file_size_bytes,
      uploaded_by,
      verification_status,
      file_sha256
    )
    values (
      v_payment_id,
      p_storage_path,
      v_filename,
      p_mime_type,
      p_file_size_bytes,
      v_user_id,
      'pending',
      p_file_sha256
    );
  exception
    when unique_violation then
      select *
      into v_existing_proof
      from public.payment_proofs pp
      where pp.payment_id = v_payment_id
        and pp.file_sha256 = p_file_sha256
      limit 1;

      if v_existing_proof.id is null then
        raise;
      end if;

      return jsonb_build_object(
        'paymentId', v_payment_id,
        'proofId', v_existing_proof.id,
        'paymentStatus', 'pending',
        'amount', v_order.total,
        'currency', v_order.currency,
        'verificationStatus', v_existing_proof.verification_status,
        'createdProof', false
      );
  end;

  return jsonb_build_object(
    'paymentId', v_payment_id,
    'proofId', (
      select id
      from public.payment_proofs
      where storage_path = p_storage_path
    ),
    'paymentStatus', 'pending',
    'amount', v_order.total,
    'currency', v_order.currency,
    'verificationStatus', 'pending',
    'createdProof', true
  );
end;
$$;

revoke all on function public.submit_manual_bank_payment(text, text, text, text, text, bigint, text)
from public, anon, authenticated;
grant execute on function public.submit_manual_bank_payment(text, text, text, text, text, bigint, text)
to authenticated;

-- 3) Payment verification must re-check the authoritative order amount/currency
-- and confirm that every pending proof points to a real private storage object.
create or replace function public.verify_manual_bank_payment(
  p_payment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_user_id uuid := (select auth.uid());
  v_next_order_status text;
begin
  if not private.is_staff() then
    raise exception 'payment:not_authorized';
  end if;

  select *
  into v_payment
  from public.payments pay
  where pay.id = p_payment_id
    and pay.payment_method = 'manual_bank_transfer'
  for update;

  if v_payment.id is null then
    raise exception 'payment:not_found';
  end if;

  select *
  into v_order
  from public.orders o
  where o.id = v_payment.order_id
  for update;

  if v_order.id is null then
    raise exception 'payment:not_found';
  end if;

  if v_payment.amount <> v_order.total
     or v_payment.currency <> v_order.currency then
    raise exception 'payment:amount_mismatch';
  end if;

  if v_payment.payment_status = 'paid' then
    return jsonb_build_object(
      'paymentId', v_payment.id,
      'paymentStatus', 'paid',
      'orderStatus', v_order.order_status
    );
  end if;

  if v_payment.payment_status <> 'pending' then
    raise exception 'payment:not_verifiable';
  end if;

  if not exists (
    select 1
    from public.payment_proofs pp
    join storage.objects so
      on so.bucket_id = 'payment-proofs'
     and so.name = pp.storage_path
    where pp.payment_id = v_payment.id
      and pp.verification_status = 'pending'
  ) then
    raise exception 'payment:proof_missing';
  end if;

  if v_order.order_status in ('cancelled', 'completed', 'refunded') then
    raise exception 'payment:order_ineligible';
  end if;

  v_next_order_status :=
    case
      when v_order.order_status = 'pending' then 'processing'
      else v_order.order_status
    end;

  update public.payments
  set
    payment_status = 'paid',
    verified_by = v_user_id,
    verified_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  where id = v_payment.id;

  update public.payment_proofs
  set
    verification_status = 'approved',
    verified_by = v_user_id,
    verified_at = timezone('utc', now())
  where payment_id = v_payment.id
    and verification_status = 'pending';

  update public.orders
  set
    payment_status = 'paid',
    order_status = v_next_order_status,
    payment_method = 'manual_bank_transfer',
    updated_at = timezone('utc', now())
  where id = v_payment.order_id;

  return jsonb_build_object(
    'paymentId', v_payment.id,
    'paymentStatus', 'paid',
    'orderStatus', v_next_order_status
  );
end;
$$;

revoke all on function public.verify_manual_bank_payment(uuid)
from public, anon, authenticated;
grant execute on function public.verify_manual_bank_payment(uuid)
to authenticated;

-- 4) Customer-visible entitlement metadata should not advertise deactivated
-- assets as downloadable inventory.
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
                and a.is_active = true
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
