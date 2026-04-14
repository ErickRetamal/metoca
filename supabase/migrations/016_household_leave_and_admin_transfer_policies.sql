-- ============================================================
-- MeToca - Policies for leaving household and admin transfer
-- ============================================================

-- Allow current admin to update household metadata, including transferring
-- admin role to another active member of the same household.
drop policy if exists "households_admin_update" on households;
create policy "households_admin_update" on households
  for update using (
    admin_user_id = auth.uid()
  )
  with check (
    admin_user_id in (
      select hm.user_id
      from public.household_members hm
      where hm.household_id = households.id
        and hm.status = 'active'
    )
  );

-- Allow each user to update their own membership row (e.g., leave household),
-- and allow current household admin to manage membership rows in their household.
drop policy if exists "household_members_update_self_or_admin" on household_members;
create policy "household_members_update_self_or_admin" on household_members
  for update using (
    user_id = auth.uid()
    or household_id in (
      select h.id
      from public.households h
      where h.admin_user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    or household_id in (
      select h.id
      from public.households h
      where h.admin_user_id = auth.uid()
    )
  );
