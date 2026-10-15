-- STEP 41: only the trusted server may complete transactional email log entries.
-- Customers can still claim an eligible email event through the existing owner/staff
-- authorization function, but cannot mark their own event as sent/failed.

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
begin
  if (select auth.jwt() ->> 'role') is distinct from 'service_role' then
    raise exception 'email:service_role_required';
  end if;

  if p_status is null or p_status not in ('sent','failed') then
    raise exception 'email:status_invalid';
  end if;

  select * into v_log
  from public.transactional_email_logs
  where id = p_email_id
  for update;

  if v_log.id is null then
    return false;
  end if;

  update public.transactional_email_logs
  set delivery_status = p_status,
      provider = left(nullif(btrim(p_provider), ''), 80),
      provider_message_id = left(nullif(btrim(p_provider_message_id), ''), 200),
      last_error = left(nullif(btrim(p_error), ''), 500),
      sent_at = case when p_status = 'sent' then timezone('utc', now()) else sent_at end,
      updated_at = timezone('utc', now())
  where id = p_email_id;

  return true;
end;
$email$;

revoke all on function public.complete_transactional_email(uuid,text,text,text,text)
from public, anon, authenticated;
grant execute on function public.complete_transactional_email(uuid,text,text,text,text)
to service_role;
