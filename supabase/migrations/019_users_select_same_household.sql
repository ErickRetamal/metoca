-- ============================================================
-- MeToca - Allow reading user profiles within same household
-- ============================================================

-- Keep profile privacy, but let household members resolve each other's names.
drop policy if exists "users_own" on users;
drop policy if exists "users_select_own" on users;
drop policy if exists "users_select_same_household" on users;

create policy "users_select_same_household" on users
  for select using (
    auth.uid() = id
    or exists (
      select 1
      from public.household_members hm
      where hm.user_id = users.id
        and hm.status = 'active'
        and hm.household_id in (select public.current_user_household_ids())
    )
  );
