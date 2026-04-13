-- ============================================================
-- MeToca - Multiple schedule blocks per task
-- ============================================================

create table if not exists public.task_schedules (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  frequency task_frequency not null,
  notification_time time not null,
  day_of_week smallint check (day_of_week between 0 and 6),
  weekly_days jsonb,
  day_of_month smallint check (day_of_month between 1 and 28),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_task_schedules_task_id on public.task_schedules(task_id);
create index if not exists idx_task_schedules_household_id on public.task_schedules(household_id);
create index if not exists idx_task_schedules_weekly_days on public.task_schedules using gin (weekly_days);

alter table public.task_schedules
  drop constraint if exists task_schedules_weekly_days_array_check;

alter table public.task_schedules
  add constraint task_schedules_weekly_days_array_check
  check (
    weekly_days is null
    or jsonb_typeof(weekly_days) = 'array'
  );

alter table public.task_schedules enable row level security;

-- Members can read schedules from their household
create policy "task_schedules_members_select" on public.task_schedules
  for select using (
    household_id in (
      select household_id
      from public.household_members
      where user_id = auth.uid() and status = 'active'
    )
  );

-- Household admin can manage schedules
create policy "task_schedules_admin_insert" on public.task_schedules
  for insert with check (
    household_id in (
      select id
      from public.households
      where admin_user_id = auth.uid()
    )
  );

create policy "task_schedules_admin_update" on public.task_schedules
  for update using (
    household_id in (
      select id
      from public.households
      where admin_user_id = auth.uid()
    )
  )
  with check (
    household_id in (
      select id
      from public.households
      where admin_user_id = auth.uid()
    )
  );

create policy "task_schedules_admin_delete" on public.task_schedules
  for delete using (
    household_id in (
      select id
      from public.households
      where admin_user_id = auth.uid()
    )
  );

create trigger trg_task_schedules_updated_at
  before update on public.task_schedules
  for each row execute function public.update_updated_at();
