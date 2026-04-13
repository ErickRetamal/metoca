-- ============================================================
-- MeToca - Fix RLS recursion on household_members
-- ============================================================

-- Helper con SECURITY DEFINER para evitar recursión RLS al resolver hogares del usuario actual.
create or replace function public.current_user_household_ids()
returns setof uuid
language sql
security definer
set search_path = public
as $$
  select household_id
  from public.household_members
  where user_id = auth.uid()
    and status = 'active';
$$;

revoke all on function public.current_user_household_ids() from public;
grant execute on function public.current_user_household_ids() to authenticated;

-- Reemplazar política recursiva por una basada en helper function.
drop policy if exists "household_members_same_household" on household_members;

create policy "household_members_same_household" on household_members
  for select using (
    household_id in (select public.current_user_household_ids())
  );
