-- ============================================================
-- MeToca - Allow household admin to update household metadata
-- ============================================================

drop policy if exists "households_admin_update" on households;
create policy "households_admin_update" on households
  for update using (
    admin_user_id = auth.uid()
  )
  with check (
    admin_user_id = auth.uid()
  );
