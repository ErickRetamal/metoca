-- ============================================================
-- MeToca - Allow household admin to manage household tasks
-- ============================================================

drop policy if exists "tasks_admin_insert" on tasks;
create policy "tasks_admin_insert" on tasks
  for insert with check (
    household_id in (
      select id
      from households
      where admin_user_id = auth.uid()
    )
  );

drop policy if exists "tasks_admin_update" on tasks;
create policy "tasks_admin_update" on tasks
  for update using (
    household_id in (
      select id
      from households
      where admin_user_id = auth.uid()
    )
  )
  with check (
    household_id in (
      select id
      from households
      where admin_user_id = auth.uid()
    )
  );
