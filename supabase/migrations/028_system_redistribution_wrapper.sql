-- ============================================================
-- MeToca - System wrapper for redistribution jobs
-- ============================================================

create or replace function public.redistribute_household_tasks_system(
  p_household_id uuid,
  p_month char(7) default to_char(current_date, 'YYYY-MM')
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_user_id uuid;
  v_month text;
begin
  if p_household_id is null then
    raise exception 'household_required';
  end if;

  v_month := trim(p_month);
  if v_month !~ '^\d{4}-\d{2}$' then
    raise exception 'invalid_month';
  end if;

  select h.admin_user_id
    into v_admin_user_id
  from public.households h
  where h.id = p_household_id;

  if v_admin_user_id is null then
    raise exception 'household_not_found';
  end if;

  perform set_config('request.jwt.claim.sub', v_admin_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  return public.redistribute_household_tasks(p_household_id, v_month::char(7));
end;
$$;

revoke all on function public.redistribute_household_tasks_system(uuid, char) from public;
grant execute on function public.redistribute_household_tasks_system(uuid, char) to service_role;