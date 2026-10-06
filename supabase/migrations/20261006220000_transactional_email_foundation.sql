-- ProBee V2 STEP 15: transactional email idempotency + delivery log.
-- No passwords, auth tokens, email bodies, or provider secrets are stored.

create table if not exists public.transactional_email_logs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (
    event_type in (
      'account_activation',
      'password_reset',
      'order_created',
      'payment_submitted',
      'payment_paid',
      'payment_rejected',
      'digital_entitlement_ready'
    )
  ),
  idempotency_key text not null unique,
  recipient text not null check (char_length(recipient) between 3 and 320),
  order_id uuid references public.orders(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  entitlement_id uuid references public.digital_entitlements(id) on delete set null,
  provider text,
  provider_message_id text,
  delivery_status text not null default 'queued' check (
    delivery_status in ('queued','sending','sent','failed')
  ),
  attempt_count integer not null default 0 check (attempt_count >= 0 and attempt_count <= 10),
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  sent_at timestamptz
);

create index if not exists transactional_email_logs_created_idx
  on public.transactional_email_logs(created_at desc);

create index if not exists transactional_email_logs_status_idx
  on public.transactional_email_logs(delivery_status, created_at desc);

alter table public.transactional_email_logs enable row level security;

revoke all on public.transactional_email_logs from anon, authenticated;
grant select on public.transactional_email_logs to authenticated;

drop policy if exists "transactional_email_logs_staff_read" on public.transactional_email_logs;
create policy "transactional_email_logs_staff_read"
on public.transactional_email_logs
for select
to authenticated
using ((select private.is_staff()));

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

  if p_idempotency_key is null
     or char_length(p_idempotency_key) < 5
     or char_length(p_idempotency_key) > 180 then
    raise exception 'email:idempotency_invalid';
  end if;

  if p_event_type = 'order_created' then
    select o.user_id, u.email
    into v_owner_id, v_recipient
    from public.orders o
    join auth.users u on u.id = o.user_id
    where o.id = p_order_id;

    if v_owner_id is null or v_owner_id <> v_user_id then
      raise exception 'email:not_authorized';
    end if;
  elsif p_event_type = 'payment_submitted' then
    select o.user_id, o.id, u.email
    into v_owner_id, v_order_id, v_recipient
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

    select o.user_id, o.id, u.email
    into v_owner_id, v_order_id, v_recipient
    from public.payments p
    join public.orders o on o.id = p.order_id
    join auth.users u on u.id = o.user_id
    where p.id = p_payment_id;
  else
    if not private.is_staff() then
      raise exception 'email:not_authorized';
    end if;

    select e.user_id, e.order_id, u.email
    into v_owner_id, v_order_id, v_recipient
    from public.digital_entitlements e
    join auth.users u on u.id = e.user_id
    where e.id = p_entitlement_id;
  end if;

  if v_recipient is null or char_length(v_recipient) < 3 then
    raise exception 'email:recipient_unavailable';
  end if;

  select *
  into v_log
  from public.transactional_email_logs
  where idempotency_key = p_idempotency_key
  for update;

  if v_log.id is null then
    insert into public.transactional_email_logs (
      event_type,
      idempotency_key,
      recipient,
      order_id,
      payment_id,
      entitlement_id,
      delivery_status,
      attempt_count
    )
    values (
      p_event_type,
      p_idempotency_key,
      v_recipient,
      case when p_event_type = 'order_created' then p_order_id else v_order_id end,
      case when p_event_type like 'payment_%' then p_payment_id else null end,
      case when p_event_type = 'digital_entitlement_ready' then p_entitlement_id else null end,
      'sending',
      1
    )
    returning * into v_log;
  elsif v_log.delivery_status = 'sent' then
    return jsonb_build_object(
      'emailId', v_log.id,
      'recipient', v_log.recipient,
      'alreadySent', true
    );
  elsif v_log.attempt_count >= 10 then
    return jsonb_build_object(
      'emailId', v_log.id,
      'recipient', v_log.recipient,
      'blocked', true
    );
  else
    update public.transactional_email_logs
    set delivery_status = 'sending',
        attempt_count = attempt_count + 1,
        last_error = null
    where id = v_log.id
    returning * into v_log;
  end if;

  return jsonb_build_object(
    'emailId', v_log.id,
    'recipient', v_log.recipient,
    'alreadySent', false,
    'blocked', false,
    'attemptCount', v_log.attempt_count
  );
end;
$email$;

revoke all on function public.claim_transactional_email(text,text,uuid,uuid,uuid)
from public, anon, authenticated;
grant execute on function public.claim_transactional_email(text,text,uuid,uuid,uuid)
to authenticated;

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
  select *
  into v_log
  from public.transactional_email_logs
  where id = p_email_id
  for update;

  if v_log.id is null then
    return false;
  end if;

  if private.is_staff() then
    v_authorized := true;
  elsif v_log.order_id is not null and exists (
    select 1 from public.orders o
    where o.id = v_log.order_id
      and o.user_id = (select auth.uid())
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
  set delivery_status = p_status,
      provider = left(nullif(btrim(p_provider), ''), 80),
      provider_message_id = left(nullif(btrim(p_provider_message_id), ''), 200),
      last_error = left(nullif(btrim(p_error), ''), 500),
      sent_at = case when p_status = 'sent' then timezone('utc', now()) else sent_at end
  where id = p_email_id;

  return true;
end;
$email$;

revoke all on function public.complete_transactional_email(uuid,text,text,text,text)
from public, anon, authenticated;
grant execute on function public.complete_transactional_email(uuid,text,text,text,text)
to authenticated;
