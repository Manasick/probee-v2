-- ProBee V2 STEP 7: admin product management authorization helper
-- Preserves private.is_staff() as the authoritative authorization rule.

create or replace function public.current_user_is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_staff();
$$;

revoke all on function public.current_user_is_staff() from public, anon;
grant execute on function public.current_user_is_staff() to authenticated;
