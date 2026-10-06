-- ProBee V2 STEP 15 corrective hardening.
-- Fixes source-id idempotency, concurrent-send duplication, and no-provider
-- stuck states without rewriting the earlier STEP 15 migration.

alter table public.transactional_email_logs
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create index if not exists transactional_email_logs_sending_idx
  on public.transactional_email_logs(delivery_status, updated_at);

create or replace function public.claim_transactional_email(
  p_event_type text,
  p_idempotency_key text,
  p_order_id uuid default null,
  p_payment_id uuid default null,
  p_entitlement_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $email$
declare
  v_user_id uuid := (select auth.uid());
  v_recipient text;
  v_log public.transactional_email_logs%rowtype;
  v_owner_id uuid;
  v_order_id uuid;
  v_source_id uuid;
  v_expected_key text;
begin
  if v_user_id is null then
    raise exception 'email:auth_required';
  end if;

  if p_event_type not in (
    'order_created',
    'payment_submitted',
    'payment_paid',
    'payment_rejected',
    'digital_entitlement_ready'
  ) then
    raise exception 'email:event_not_app_triggered';
  end if;

  if p_event_type = 'order_created' then
    v_source_id := p_order_id;
  elsif p_event_type in ('payment_submitted','payment_paid','payment_rejected') then
    v_source_id := p_payment_id;
  else
    v_source_id := p_entitlement_id;
  end if;

  if v_source_id is null then
    raise exception 'email:source_missing';
  end if;

  v_expected_key := p_event_type || ':' || v_source_id::text;

  if p_idempotency_key is null
     or p_idempotency_key <> v_expected_key
     or char_length(p_idempotency_key) > 180 then
    raise exception 'email:idempotency_invalid';
  end if;

  if p_event_type = 'order_created' then
    select o.user_id, u.email into v_owner_id, v_recipient
    from public.orders o
    join auth.users u on u.id = o.user_id
    where o.id = p_order_id;

    if v_owner_id is null or v_owner_id <> v_user_id then
      raise exception 'email:not_authorized';
    end if;
  elsif p_event_type = 'payment_submitted' then
    select o.user_id, o.id, u.email into v_owner_id, v_order_id, v_recipient
    from public.payments p
    join public.orders o on o.id = p.order_id
    join auth.users u on u.id = o.user_id
    where p.id = p_payment_id;

    if v_owner_id is null or v_owner_id <> v_user_id then
      raise exception 'email:not_authorized';
    end if;
  elsif p_event_type in ('payment_paid','payment_rejected') then
    if not private.is_staff() then
      raise exception 'email:not_authorized';
    end if;

    select o.user_id, o.id, u.email into v_owner_id, v_order_id, v_recipient
    from public.payments p
    join public.orders o on o.id = p.order_id
    join auth.users u on u.id = o.user_id
    where p.id = p_payment_id;
  else
    if not private.is_staff() then
      raise exception 'email:not_authorized';
    end if;

    select e.user_id, e.order_id, u.email into v_owner_id, v_order_id, v_recipient
    from public.digital_entitlements e
    join auth.users u on u.id = e.user_id
    where e.id = p_entitlement_id;
  end if;

  if v_recipient is null or char_length(v_recipient) < 3 then
    raise exception 'email:recipient_unavailable';
  end if;

  select * into v_log
  from public.transactional_email_logs
  where idempotency_key = p_idempotency_key
  for update;

  if v_log.id is null then
    insert into public.transactional_email_logs (
      event_type,idempotency_key,recipient,order_id,payment_id,entitlement_id,
      delivery_status,attempt_count,updated_at
    )
    values (
      p_event_type,p_idempotency_key,v_recipient,
      case when p_event_type = 'order_created' then p_order_id else v_order_id end,
      case when p_event_type like 'payment_%' then p_payment_id else null end,
      case when p_event_type = 'digital_entitlement_ready' then p_entitlement_id else null end,
      'sending',1,timezone('utc', now())
    )
    returning * into v_log;
  elsif v_log.delivery_status = 'sent' then
    return jsonb_build_object('emailId',v_log.id,'recipient',v_log.recipient,'alreadySent',true);
  elsif v_log.delivery_status = 'sending'
        and v_log.updated_at > timezone('utc', now()) - interval '10 minutes' then
    return jsonb_build_object('emailId',v_log.id,'recipient',v_log.recipient,'inProgress',true);
  elsif v_log.attempt_count >= 10 then
    return jsonb_build_object('emailId',v_log.id,'recipient',v_log.recipient,'blocked',true);
  else
    update public.transactional_email_logs
    set delivery_status='sending',
        attempt_count=attempt_count+1,
        last_error=null,
        updated_at=timezone('utc', now())
    where id=v_log.id
    returning * into v_log;
  end if;

  return jsonb_build_object(
    'emailId',v_log.id,'recipient',v_log.recipient,
    'alreadySent',false,'blocked',false,'attemptCount',v_log.attempt_count
  );
end;
$email$;

create or replace function public.complete_transactional_email(
  p_email_id uuid,
  p_status text,
  p_provider text default null,
  p_provider_message_id text default null,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $email$
declare
  v_log public.transactional_email_logs%rowtype;
  v_authorized boolean := false;
begin
  select * into v_log
  from public.transactional_email_logs
  where id=p_email_id
  for update;

  if v_log.id is null then
    return false;
  end if;

  if private.is_staff() then
    v_authorized := true;
  elsif v_log.order_id is not null and exists (
    select 1 from public.orders o
    where o.id=v_log.order_id
      and o.user_id=(select auth.uid())
  ) then
    v_authorized := true;
  end if;

  if not v_authorized then
    raise exception 'email:not_authorized';
  end if;

  if p_status not in ('sent','failed') then
    raise exception 'email:status_invalid';
  end if;

  update public.transactional_email_logs
  set delivery_status=p_status,
      provider=left(nullif(btrim(p_provider),''),80),
      provider_message_id=left(nullif(btrim(p_provider_message_id),''),200),
      last_error=left(nullif(btrim(p_error),''),500),
      sent_at=case when p_status='sent' then timezone('utc',now()) else sent_at end,
      updated_at=timezone('utc',now())
  where id=p_email_id;

  return true;
end;
$email$;
