-- ============================================================
-- MeToca - Fix recursion in household_members update policy
-- ============================================================

-- The previous policy queried households from household_members policy,
-- which can recurse because households SELECT policy references household_members.
-- For leave flow we only need users to update their own membership row.

drop policy if exists "household_members_update_self_or_admin" on household_members;
drop policy if exists "household_members_update_self" on household_members;

create policy "household_members_update_self" on household_members
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
