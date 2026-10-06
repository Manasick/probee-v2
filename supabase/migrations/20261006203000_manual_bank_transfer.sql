-- ProBee V2 STEP 12: manual bank transfer + private payment proofs.
-- Extends the existing payments/payment_proofs/payment_settings architecture.
-- No online payment gateway is introduced.

alter table public.payment_proofs
  add column file_sha256 text;

alter table public.payment_proofs
  add constraint payment_proofs_mime_type_check
    check (
      mime_type is null
      or mime_type in (
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf'
      )
    ),
  add constraint payment_proofs_file_size_limit_check
    check (
      file_size_bytes is null
      or (
        file_size_bytes > 0
        and file_size_bytes <= 10485760
      )
    ),
  add constraint payment_proofs_sha256_check
    check (
      file_sha256 is null
      or file_sha256 ~ '^[0-9a-f]{64}$'
    ),
  add constraint payment_proofs_storage_path_check
    check (
      storage_path ~* '^payment-proofs/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|pdf)$'
    );

create unique index payment_proofs_payment_sha256_idx
  on public.payment_proofs(payment_id, file_sha256)
  where file_sha256 is not null;

create unique index payments_one_active_manual_transfer_idx
  on public.payments(order_id)
  where payment_method = 'manual_bank_transfer'
    and payment_status in ('pending', 'paid');

create index payments_manual_transfer_created_idx
  on public.payments(payment_method, created_at desc);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = excluded.allowed_mime_types;

grant select on public.payment_settings to authenticated;
grant select (
  payment_method,
  enabled,
  bank_name,
  account_name,
  account_number,
  branch,
  bank_code_swift,
  payment_instructions
) on public.payment_settings to authenticated;

drop policy if exists "payment_settings_customer_read_active" on public.payment_settings;
create policy "payment_settings_customer_read_active"
on public.payment_settings
for select
to authenticated
using (
  payment_method = 'manual_bank_transfer'
  and enabled = true
);


create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin();
$$;

revoke all on function public.current_user_is_admin() from public, anon;
grant execute on function public.current_user_is_admin() to authenticated;

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

  if v_payment.payment_status = 'paid' then
    return jsonb_build_object(
      'paymentId', v_payment.id,
      'paymentStatus', 'paid',
      'orderStatus', (
        select order_status
        from public.orders
        where id = v_payment.order_id
      )
    );
  end if;

  if v_payment.payment_status <> 'pending' then
    raise exception 'payment:not_verifiable';
  end if;

  if not exists (
    select 1
    from public.payment_proofs pp
    where pp.payment_id = v_payment.id
      and pp.verification_status = 'pending'
  ) then
    raise exception 'payment:proof_missing';
  end if;

  if exists (
    select 1
    from public.orders o
    where o.id = v_payment.order_id
      and o.order_status in ('cancelled', 'completed', 'refunded')
  ) then
    raise exception 'payment:order_ineligible';
  end if;

  select case
    when o.order_status = 'pending' then 'processing'
    else o.order_status
  end
  into v_next_order_status
  from public.orders o
  where o.id = v_payment.order_id
  for update;

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

create or replace function public.reject_manual_bank_payment(
  p_payment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_user_id uuid := (select auth.uid());
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

  if v_payment.payment_status = 'rejected' then
    return jsonb_build_object(
      'paymentId', v_payment.id,
      'paymentStatus', 'rejected'
    );
  end if;

  if v_payment.payment_status <> 'pending' then
    raise exception 'payment:not_rejectable';
  end if;

  update public.payments
  set
    payment_status = 'rejected',
    verified_by = v_user_id,
    verified_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  where id = v_payment.id;

  update public.payment_proofs
  set
    verification_status = 'rejected',
    verified_by = v_user_id,
    verified_at = timezone('utc', now())
  where payment_id = v_payment.id
    and verification_status = 'pending';

  update public.orders
  set
    payment_status = 'pending',
    updated_at = timezone('utc', now())
  where id = v_payment.order_id;

  return jsonb_build_object(
    'paymentId', v_payment.id,
    'paymentStatus', 'rejected'
  );
end;
$$;

revoke all on function public.reject_manual_bank_payment(uuid)
from public, anon, authenticated;

grant execute on function public.reject_manual_bank_payment(uuid)
to authenticated;


-- Storage.objects policies are managed separately because Supabase owns that table.
