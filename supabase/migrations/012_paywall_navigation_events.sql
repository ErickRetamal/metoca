-- ============================================================
-- MeToca - Track paywall navigation sources
-- ============================================================

create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  event_name varchar(100) not null,
  source varchar(120),
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_analytics_events_user_id on analytics_events(user_id);
create index if not exists idx_analytics_events_event_name on analytics_events(event_name);
create index if not exists idx_analytics_events_created_at on analytics_events(created_at desc);

alter table analytics_events enable row level security;

drop policy if exists "analytics_events_insert_own" on analytics_events;
create policy "analytics_events_insert_own" on analytics_events
  for insert with check (
    user_id is null or user_id = auth.uid()
  );
