-- ============================================================
-- MeToca - Politicas RLS faltantes para lectura real
-- ============================================================

drop policy if exists "users_select_own" on users;
create policy "users_select_own" on users
  for select using (auth.uid() = id);

drop policy if exists "users_update_own" on users;
create policy "users_update_own" on users
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "subscriptions_household_members" on subscriptions;
create policy "subscriptions_household_members" on subscriptions
  for select using (
    household_id in (
      select household_id from household_members
      where user_id = auth.uid() and status = 'active'
    )
  );

drop policy if exists "task_assignments_household_members" on task_assignments;
create policy "task_assignments_household_members" on task_assignments
  for select using (
    household_id in (
      select household_id from household_members
      where user_id = auth.uid() and status = 'active'
    )
  );

drop policy if exists "monthly_reports_household_members" on monthly_reports;
create policy "monthly_reports_household_members" on monthly_reports
  for select using (
    household_id in (
      select household_id from household_members
      where user_id = auth.uid() and status = 'active'
    )
  );

drop policy if exists "notification_log_own" on notification_log;
create policy "notification_log_own" on notification_log
  for select using (user_id = auth.uid());