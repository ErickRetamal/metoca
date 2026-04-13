-- ============================================================
-- MeToca - Weekly tasks with multiple weekdays
-- ============================================================

alter table if exists public.tasks
  add column if not exists weekly_days jsonb;

-- Backfill existing weekly tasks to keep compatibility.
update public.tasks
set weekly_days = jsonb_build_array(day_of_week)
where frequency = 'weekly'
  and day_of_week is not null
  and (weekly_days is null or weekly_days = 'null'::jsonb);

-- Keep data shape controlled (array or null).
alter table public.tasks
  drop constraint if exists tasks_weekly_days_array_check;

alter table public.tasks
  add constraint tasks_weekly_days_array_check
  check (
    weekly_days is null
    or jsonb_typeof(weekly_days) = 'array'
  );

create index if not exists idx_tasks_weekly_days on public.tasks using gin (weekly_days);
