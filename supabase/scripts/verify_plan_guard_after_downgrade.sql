-- ============================================================
-- MeToca - Quick verification for over-capacity guard behavior
-- ============================================================
-- Usage:
-- 1) Replace the household_id in the insert into pg_temp.verify_cfg.
-- 2) Run this script in Supabase SQL Editor.
-- 3) Review each result set.

-- ------------------------------------------------------------
-- 0) Config
-- ------------------------------------------------------------
drop table if exists pg_temp.verify_cfg;
create temp table verify_cfg (
  household_id uuid not null
);

insert into pg_temp.verify_cfg (household_id)
values ('00000000-0000-0000-0000-000000000000'::uuid);

do $$
declare
  v_household_id uuid;
begin
  select household_id into v_household_id from pg_temp.verify_cfg limit 1;

  if v_household_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'replace_household_id_in_pg_temp_verify_cfg';
  end if;
end;
$$;

select household_id from pg_temp.verify_cfg;

-- ------------------------------------------------------------
-- 1) Baseline: guard + active members ordered from newest to oldest
-- ------------------------------------------------------------
select
  g.household_id,
  g.status,
  g.effective_plan,
  g.max_members,
  g.active_members,
  g.members_to_remove,
  g.grace_started_at,
  g.grace_ends_at,
  g.notified_at,
  g.last_checked_at
from public.household_plan_guards g
join pg_temp.verify_cfg cfg on cfg.household_id = g.household_id;

select
  hm.user_id,
  coalesce(u.name, u.email, 'Miembro') as member_name,
  hm.status,
  hm.joined_at,
  hm.created_at
from public.household_members hm
left join public.users u on u.id = hm.user_id
join pg_temp.verify_cfg cfg on cfg.household_id = hm.household_id
order by coalesce(hm.joined_at, hm.created_at) desc, hm.created_at desc, hm.user_id::text desc;

-- ------------------------------------------------------------
-- 1.5) Why it may say "not_over_capacity"
-- ------------------------------------------------------------
with metrics as (
  select
    cfg.household_id,
    public.get_effective_household_plan(cfg.household_id) as effective_plan,
    public.plan_member_limit(public.get_effective_household_plan(cfg.household_id)) as max_members,
    (
      select count(*)
      from public.household_members hm
      where hm.household_id = cfg.household_id
        and hm.status = 'active'
    ) as active_members
  from pg_temp.verify_cfg cfg
)
select
  m.household_id,
  m.effective_plan,
  m.max_members,
  m.active_members,
  greatest(m.active_members - m.max_members, 0) as members_to_remove,
  (m.active_members > m.max_members) as is_over_capacity
from metrics m;

select
  s.id,
  s.owner_user_id,
  coalesce(u.name, u.email, 'Owner') as owner_name,
  hm.status as owner_membership_status,
  s.plan,
  s.status,
  s.max_members,
  s.expires_at,
  s.updated_at,
  s.created_at
from public.subscriptions s
left join public.users u on u.id = s.owner_user_id
left join public.household_members hm
  on hm.household_id = s.household_id
 and hm.user_id = s.owner_user_id
join pg_temp.verify_cfg cfg on cfg.household_id = s.household_id
where s.status = 'active'
  and (s.expires_at is null or s.expires_at > now())
order by
  case s.plan when 'familia' then 3 when 'hogar' then 2 else 1 end desc,
  coalesce(s.expires_at, 'infinity'::timestamptz) desc,
  s.updated_at desc,
  s.created_at desc;

select
  g.household_id,
  g.status,
  g.effective_plan,
  g.max_members,
  g.active_members,
  g.members_to_remove,
  g.reason,
  g.grace_started_at,
  g.grace_ends_at,
  g.last_checked_at
from public.household_plan_guards g
join pg_temp.verify_cfg cfg on cfg.household_id = g.household_id;

-- ------------------------------------------------------------
-- 2) Refresh twice and verify deadline is NOT reset while pending
-- ------------------------------------------------------------
drop table if exists pg_temp.tmp_guard_before;
create temp table tmp_guard_before as
select g.*
from public.household_plan_guards g
where g.household_id = (select household_id from pg_temp.verify_cfg);

select public.refresh_household_plan_guard(cfg.household_id, 'manual_check_1') as refresh_1
from pg_temp.verify_cfg cfg;

select public.refresh_household_plan_guard(cfg.household_id, 'manual_check_2') as refresh_2
from pg_temp.verify_cfg cfg;

drop table if exists pg_temp.tmp_guard_after_refresh;
create temp table tmp_guard_after_refresh as
select g.*
from public.household_plan_guards g
where g.household_id = (select household_id from pg_temp.verify_cfg);

select
  b.household_id,
  b.status as status_before,
  a.status as status_after,
  b.grace_ends_at as grace_ends_before,
  a.grace_ends_at as grace_ends_after,
  case
    when b.status = 'pending' and b.grace_ends_at is not null
      then (a.grace_ends_at = b.grace_ends_at)
    else null
  end as keeps_same_deadline_while_pending
from tmp_guard_before b
join tmp_guard_after_refresh a on a.household_id = b.household_id;

-- ------------------------------------------------------------
-- 3) Run enforcement and inspect who was removed
-- ------------------------------------------------------------
select public.enforce_household_plan_guard(cfg.household_id) as enforcement_result
from pg_temp.verify_cfg cfg;

select
  hm.user_id,
  coalesce(u.name, u.email, 'Miembro') as member_name,
  hm.status,
  hm.joined_at,
  hm.created_at
from public.household_members hm
left join public.users u on u.id = hm.user_id
join pg_temp.verify_cfg cfg on cfg.household_id = hm.household_id
order by hm.status asc, coalesce(hm.joined_at, hm.created_at) desc, hm.created_at desc, hm.user_id::text desc;

select
  g.household_id,
  g.status,
  g.effective_plan,
  g.max_members,
  g.active_members,
  g.members_to_remove,
  g.grace_started_at,
  g.grace_ends_at,
  g.last_checked_at
from public.household_plan_guards g
join pg_temp.verify_cfg cfg on cfg.household_id = g.household_id;

-- ------------------------------------------------------------
-- Optional: if you need to test immediate enforcement manually,
-- uncomment the following block (use only in non-production).
-- ------------------------------------------------------------
-- update public.household_plan_guards g
-- set grace_ends_at = now() - interval '1 minute',
--     status = 'pending',
--     last_checked_at = now()
-- from pg_temp.verify_cfg cfg
-- where g.household_id = cfg.household_id;
