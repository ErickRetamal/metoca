-- ============================================================
-- MeToca — Migración inicial
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Habilitar extensiones necesarias
create extension if not exists "pgcrypto";
create extension if not exists "pg_cron";

-- ============================================================
-- ENUMS
-- ============================================================

create type platform_type as enum ('android', 'ios');
create type member_status as enum ('invited', 'active', 'removed');
create type task_frequency as enum ('daily', 'weekly', 'monthly');
create type execution_status as enum ('pending', 'completed', 'missed');
create type subscription_plan as enum ('free', 'hogar', 'familia');
create type subscription_status as enum ('active', 'cancelled', 'expired');
create type subscription_platform as enum ('apple', 'google');
create type notification_type as enum ('task_reminder', 'second_reminder', 'assignment_published', 'monthly_report');
create type notification_status as enum ('sent', 'delivered', 'failed');
create type swap_scope as enum ('daily', 'weekly', 'monthly');
create type swap_status as enum ('pending', 'accepted', 'rejected', 'cancelled');

-- ============================================================
-- TABLA: users
-- ============================================================

create table users (
  id          uuid primary key default gen_random_uuid(),
  name        varchar(100) not null,
  email       varchar(255) not null unique,
  phone       varchar(20),
  push_token_fcm  text,
  push_token_apns text,
  platform    platform_type,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- ============================================================
-- TABLA: households
-- ============================================================

create table households (
  id              uuid primary key default gen_random_uuid(),
  name            varchar(100) not null,
  admin_user_id   uuid not null references users(id),
  invite_code     varchar(12) not null unique default upper(substr(md5(random()::text), 1, 8)),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

-- ============================================================
-- TABLA: household_members
-- ============================================================

create table household_members (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references households(id),
  user_id         uuid not null references users(id),
  status          member_status not null default 'invited',
  joined_at       timestamptz,
  created_at      timestamptz not null default now(),
  unique(household_id, user_id)
);

-- ============================================================
-- TABLA: subscriptions
-- ============================================================

create table subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  household_id              uuid not null references households(id),
  plan                      subscription_plan not null default 'free',
  max_members               smallint not null default 2,
  status                    subscription_status not null default 'active',
  platform                  subscription_platform,
  platform_subscription_id  text,
  started_at                timestamptz not null default now(),
  expires_at                timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- ============================================================
-- TABLA: tasks
-- ============================================================

create table tasks (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references households(id),
  name              varchar(150) not null,
  frequency         task_frequency not null,
  notification_time time not null,
  day_of_week       smallint check (day_of_week between 0 and 6),
  day_of_month      smallint check (day_of_month between 1 and 28),
  is_active         boolean not null default true,
  created_by        uuid not null references users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

-- ============================================================
-- TABLA: task_assignments
-- ============================================================

create table task_assignments (
  id              uuid primary key default gen_random_uuid(),
  task_id         uuid not null references tasks(id),
  household_id    uuid not null references households(id),
  user_id         uuid not null references users(id),
  month           char(7) not null, -- YYYY-MM
  created_at      timestamptz not null default now(),
  unique(task_id, month)
);

-- ============================================================
-- TABLA: task_executions
-- ============================================================

create table task_executions (
  id                    uuid primary key default gen_random_uuid(),
  task_assignment_id    uuid not null references task_assignments(id),
  task_id               uuid not null references tasks(id),
  assigned_to           uuid not null references users(id),
  scheduled_date        date not null,
  scheduled_time        time not null,
  status                execution_status not null default 'pending',
  completed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_task_executions_assigned_to on task_executions(assigned_to);
create index idx_task_executions_scheduled_date on task_executions(scheduled_date);
create index idx_task_executions_status on task_executions(status);

-- ============================================================
-- TABLA: task_swaps
-- ============================================================

create table task_swaps (
  id                        uuid primary key default gen_random_uuid(),
  requester_id              uuid not null references users(id),
  target_id                 uuid not null references users(id),
  requester_execution_id    uuid references task_executions(id),
  target_execution_id       uuid not null references task_executions(id),
  scope                     swap_scope not null,
  status                    swap_status not null default 'pending',
  requested_at              timestamptz not null default now(),
  resolved_at               timestamptz
);

-- ============================================================
-- TABLA: monthly_reports
-- ============================================================

create table monthly_reports (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references households(id),
  month           char(7) not null, -- YYYY-MM
  total_tasks     integer not null default 0,
  completed_tasks integer not null default 0,
  completion_rate decimal(5,2) not null default 0,
  detail          jsonb not null default '{}',
  generated_at    timestamptz not null default now(),
  unique(household_id, month)
);

-- ============================================================
-- TABLA: notification_log
-- ============================================================

create table notification_log (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references users(id),
  task_execution_id     uuid references task_executions(id),
  type                  notification_type not null,
  status                notification_status not null default 'sent',
  sent_at               timestamptz not null default now()
);

create index idx_notification_log_user_id on notification_log(user_id);
create index idx_notification_log_task_execution_id on notification_log(task_execution_id);

-- ============================================================
-- FUNCIÓN: actualizar updated_at automáticamente
-- ============================================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_users_updated_at
  before update on users
  for each row execute function update_updated_at();

create trigger trg_households_updated_at
  before update on households
  for each row execute function update_updated_at();

create trigger trg_tasks_updated_at
  before update on tasks
  for each row execute function update_updated_at();

create trigger trg_task_executions_updated_at
  before update on task_executions
  for each row execute function update_updated_at();

create trigger trg_subscriptions_updated_at
  before update on subscriptions
  for each row execute function update_updated_at();

-- ============================================================
-- Row Level Security (RLS)
-- Los usuarios solo pueden ver datos de sus propios hogares
-- ============================================================

alter table users enable row level security;
alter table households enable row level security;
alter table household_members enable row level security;
alter table tasks enable row level security;
alter table task_assignments enable row level security;
alter table task_executions enable row level security;
alter table task_swaps enable row level security;
alter table subscriptions enable row level security;
alter table monthly_reports enable row level security;
alter table notification_log enable row level security;

-- Usuarios: cada uno ve solo su propio perfil
create policy "users_own" on users
  for all using (auth.uid() = id);

-- Hogares: solo miembros activos del hogar
create policy "households_members" on households
  for select using (
    id in (
      select household_id from household_members
      where user_id = auth.uid() and status = 'active'
    )
  );

-- Miembros: visibles para otros miembros del mismo hogar
create policy "household_members_same_household" on household_members
  for select using (
    household_id in (
      select household_id from household_members
      where user_id = auth.uid() and status = 'active'
    )
  );

-- Tareas: visibles para miembros del hogar
create policy "tasks_household_members" on tasks
  for select using (
    household_id in (
      select household_id from household_members
      where user_id = auth.uid() and status = 'active'
    )
  );

-- Ejecuciones: visibles para miembros del hogar
create policy "executions_household_members" on task_executions
  for select using (
    task_id in (
      select t.id from tasks t
      join household_members hm on hm.household_id = t.household_id
      where hm.user_id = auth.uid() and hm.status = 'active'
    )
  );

-- Ejecuciones: solo el asignado puede marcarla como completada
create policy "executions_update_own" on task_executions
  for update using (assigned_to = auth.uid());
