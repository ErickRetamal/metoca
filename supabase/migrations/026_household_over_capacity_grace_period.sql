-- ============================================================
-- MeToca - Over-capacity grace period on plan downgrade
-- ============================================================

create table if not exists public.household_plan_guards (
  household_id uuid primary key references public.households(id) on delete cascade,
  effective_plan subscription_plan not null,
  max_members smallint not null,
  active_members integer not null,
  members_to_remove integer not null,
  reason text not null default 'plan_downgrade',
  grace_started_at timestamptz not null default now(),
  grace_ends_at timestamptz not null,
  notified_at timestamptz,
  last_checked_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'resolved', 'enforced')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.household_plan_guard_outbox (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  channel text not null check (channel in ('push', 'email')),
  event_type text not null check (event_type in ('grace_started', 'enforced')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.household_plan_guards enable row level security;
alter table public.household_plan_guard_outbox enable row level security;

drop policy if exists "household_plan_guards_members_select" on public.household_plan_guards;
create policy "household_plan_guards_members_select" on public.household_plan_guards
  for select using (
    household_id in (
      select hm.household_id
      from public.household_members hm
      where hm.user_id = auth.uid()
        and hm.status = 'active'
    )
  );

create index if not exists idx_household_plan_guards_status_end
  on public.household_plan_guards(status, grace_ends_at);

create index if not exists idx_household_plan_guard_outbox_status_created
  on public.household_plan_guard_outbox(status, created_at);

drop trigger if exists trg_household_plan_guards_updated_at on public.household_plan_guards;
create trigger trg_household_plan_guards_updated_at
  before update on public.household_plan_guards
  for each row execute function public.update_updated_at();

create or replace function public.plan_member_limit(p_plan subscription_plan)
returns integer
language sql
immutable
as $$
  select case p_plan
    when 'familia' then 10
    when 'hogar' then 5
    else 2
  end;
$$;

create or replace function public.enqueue_household_plan_guard_notifications(
  p_household_id uuid,
  p_event_type text,
  p_effective_plan subscription_plan,
  p_max_members integer,
  p_active_members integer,
  p_members_to_remove integer,
  p_grace_ends_at timestamptz,
  p_removed_user_ids uuid[] default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
  v_rows integer := 0;
  v_rows_email integer := 0;
begin
  if p_household_id is null then
    return 0;
  end if;

  v_payload := jsonb_build_object(
    'household_id', p_household_id,
    'event_type', p_event_type,
    'effective_plan', p_effective_plan,
    'max_members', p_max_members,
    'active_members', p_active_members,
    'members_to_remove', p_members_to_remove,
    'grace_ends_at', p_grace_ends_at,
    'removed_user_ids', coalesce(to_jsonb(p_removed_user_ids), '[]'::jsonb)
  );

  insert into public.household_plan_guard_outbox (household_id, user_id, channel, event_type, payload)
  select p_household_id, hm.user_id, 'push', p_event_type, v_payload
  from public.household_members hm
  where hm.household_id = p_household_id
    and hm.status = 'active';

  get diagnostics v_rows = row_count;

  insert into public.household_plan_guard_outbox (household_id, user_id, channel, event_type, payload)
  select p_household_id, hm.user_id, 'email', p_event_type, v_payload
  from public.household_members hm
  join public.users u on u.id = hm.user_id
  where hm.household_id = p_household_id
    and hm.status = 'active'
    and coalesce(nullif(trim(u.email), ''), '') <> '';

  get diagnostics v_rows_email = row_count;
  v_rows := v_rows + v_rows_email;

  return v_rows;
end;
$$;

create or replace function public.refresh_household_plan_guard(
  p_household_id uuid,
  p_reason text default 'plan_changed'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan subscription_plan;
  v_limit integer;
  v_active integer;
  v_to_remove integer;
  v_guard record;
  v_should_notify_start boolean := false;
begin
  if p_household_id is null then
    return jsonb_build_object('ok', false, 'reason', 'household_required');
  end if;

  if not exists (
    select 1
    from public.households h
    where h.id = p_household_id
      and h.deleted_at is null
  ) then
    delete from public.household_plan_guards g
    where g.household_id = p_household_id;

    return jsonb_build_object('ok', false, 'reason', 'household_not_found');
  end if;

  v_plan := public.get_effective_household_plan(p_household_id);
  v_limit := public.plan_member_limit(v_plan);

  select count(*)
    into v_active
  from public.household_members hm
  where hm.household_id = p_household_id
    and hm.status = 'active';

  v_to_remove := greatest(v_active - v_limit, 0);

  if v_to_remove > 0 then
    insert into public.household_plan_guards (
      household_id,
      effective_plan,
      max_members,
      active_members,
      members_to_remove,
      reason,
      grace_started_at,
      grace_ends_at,
      last_checked_at,
      status
    ) values (
      p_household_id,
      v_plan,
      v_limit,
      v_active,
      v_to_remove,
      coalesce(nullif(trim(p_reason), ''), 'plan_changed'),
      now(),
      now() + interval '5 days',
      now(),
      'pending'
    )
    on conflict (household_id) do update
      set effective_plan = excluded.effective_plan,
          max_members = excluded.max_members,
          active_members = excluded.active_members,
          members_to_remove = excluded.members_to_remove,
          reason = excluded.reason,
          grace_started_at = case
            when household_plan_guards.status = 'pending' then household_plan_guards.grace_started_at
            else now()
          end,
          grace_ends_at = case
            when household_plan_guards.status = 'pending' and household_plan_guards.grace_ends_at > now()
              then household_plan_guards.grace_ends_at
            else now() + interval '5 days'
          end,
          notified_at = case
            when household_plan_guards.status = 'pending' and household_plan_guards.grace_ends_at > now()
              then household_plan_guards.notified_at
            else null
          end,
          last_checked_at = now(),
          status = 'pending';
  else
    update public.household_plan_guards g
      set effective_plan = v_plan,
          max_members = v_limit,
          active_members = v_active,
          members_to_remove = 0,
          last_checked_at = now(),
          status = 'resolved'
    where g.household_id = p_household_id
      and g.status = 'pending';
  end if;

  select g.*
    into v_guard
  from public.household_plan_guards g
  where g.household_id = p_household_id
    and g.status = 'pending'
  limit 1;

  if coalesce(v_guard.household_id is not null, false)
     and v_guard.status = 'pending'
     and v_guard.notified_at is null then
    v_should_notify_start := true;
    perform public.enqueue_household_plan_guard_notifications(
      p_household_id,
      'grace_started',
      v_guard.effective_plan,
      v_guard.max_members,
      v_guard.active_members,
      v_guard.members_to_remove,
      v_guard.grace_ends_at,
      null
    );

    update public.household_plan_guards
      set notified_at = now(),
          last_checked_at = now()
    where household_id = p_household_id
      and status = 'pending'
      and notified_at is null;
  end if;

  return jsonb_build_object(
    'ok', true,
    'over_capacity', coalesce(v_guard.household_id is not null, false),
    'effective_plan', v_plan,
    'max_members', v_limit,
    'active_members', v_active,
    'members_to_remove', v_to_remove,
    'grace_ends_at', v_guard.grace_ends_at,
    'notified_grace_start', v_should_notify_start
  );
end;
$$;

create or replace function public.enforce_household_plan_guard(p_household_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guard public.household_plan_guards%rowtype;
  v_admin_user_id uuid;
  v_removed_count integer := 0;
  v_removed_user_ids uuid[];
begin
  perform public.refresh_household_plan_guard(p_household_id, 'enforce_check');

  select *
    into v_guard
  from public.household_plan_guards g
  where g.household_id = p_household_id
    and g.status = 'pending'
  limit 1;

  if v_guard.household_id is null then
    return jsonb_build_object('ok', true, 'enforced', false, 'reason', 'not_over_capacity');
  end if;

  if v_guard.grace_ends_at > now() then
    return jsonb_build_object('ok', true, 'enforced', false, 'reason', 'grace_active', 'grace_ends_at', v_guard.grace_ends_at);
  end if;

  select h.admin_user_id
    into v_admin_user_id
  from public.households h
  where h.id = p_household_id
    and h.deleted_at is null
  limit 1;

  with removable as (
    select hm.user_id
    from public.household_members hm
    where hm.household_id = p_household_id
      and hm.status = 'active'
      and hm.user_id <> v_admin_user_id
    order by coalesce(hm.joined_at, hm.created_at) desc, hm.created_at desc, hm.user_id::text desc
    limit v_guard.members_to_remove
  ), updated as (
    update public.household_members hm
    set status = 'removed'
    from removable r
    where hm.household_id = p_household_id
      and hm.user_id = r.user_id
      and hm.status = 'active'
    returning hm.user_id
  )
  select count(*), array_agg(u.user_id)
    into v_removed_count, v_removed_user_ids
  from updated u;

  update public.household_plan_guards g
    set status = 'enforced',
        active_members = greatest(g.active_members - coalesce(v_removed_count, 0), 0),
        members_to_remove = greatest(g.members_to_remove - coalesce(v_removed_count, 0), 0),
        last_checked_at = now()
  where g.household_id = p_household_id;

  perform public.enqueue_household_plan_guard_notifications(
    p_household_id,
    'enforced',
    v_guard.effective_plan,
    v_guard.max_members,
    v_guard.active_members,
    greatest(v_guard.members_to_remove - coalesce(v_removed_count, 0), 0),
    v_guard.grace_ends_at,
    v_removed_user_ids
  );

  perform public.refresh_household_plan_guard(p_household_id, 'post_enforce_refresh');

  return jsonb_build_object(
    'ok', true,
    'enforced', true,
    'removed_count', coalesce(v_removed_count, 0),
    'removed_user_ids', coalesce(to_jsonb(v_removed_user_ids), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_household_plan_guard_status(p_household_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_guard public.household_plan_guards%rowtype;
  v_plan subscription_plan;
  v_limit integer;
  v_active integer;
  v_members_preview jsonb;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_household_id is null then
    raise exception 'household_required';
  end if;

  if not exists (
    select 1
    from public.household_members hm
    where hm.household_id = p_household_id
      and hm.user_id = v_actor_id
      and hm.status = 'active'
  ) then
    raise exception 'not_member';
  end if;

  perform public.enforce_household_plan_guard(p_household_id);

  v_plan := public.get_effective_household_plan(p_household_id);
  v_limit := public.plan_member_limit(v_plan);

  select count(*)
    into v_active
  from public.household_members hm
  where hm.household_id = p_household_id
    and hm.status = 'active';

  select g.*
    into v_guard
  from public.household_plan_guards g
  where g.household_id = p_household_id
    and g.status = 'pending'
  limit 1;

  if v_guard.household_id is null then
    return jsonb_build_object(
      'over_capacity', false,
      'effective_plan', v_plan,
      'max_members', v_limit,
      'active_members', v_active,
      'members_to_remove', 0,
      'grace_ends_at', null,
      'members_preview', '[]'::jsonb
    );
  end if;

  with removable as (
    select hm.user_id, coalesce(u.name, u.email, 'Miembro') as name
    from public.household_members hm
    join public.users u on u.id = hm.user_id
    where hm.household_id = p_household_id
      and hm.status = 'active'
      and hm.user_id <> (select h.admin_user_id from public.households h where h.id = p_household_id)
    order by coalesce(hm.joined_at, hm.created_at) desc, hm.created_at desc, hm.user_id::text desc
    limit v_guard.members_to_remove
  )
  select coalesce(
    jsonb_agg(jsonb_build_object('user_id', r.user_id, 'name', r.name)),
    '[]'::jsonb
  )
  into v_members_preview
  from removable r;

  return jsonb_build_object(
    'over_capacity', true,
    'effective_plan', v_guard.effective_plan,
    'max_members', v_guard.max_members,
    'active_members', v_guard.active_members,
    'members_to_remove', v_guard.members_to_remove,
    'grace_ends_at', v_guard.grace_ends_at,
    'members_preview', v_members_preview
  );
end;
$$;

create or replace function public.trg_refresh_household_plan_guard_from_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.refresh_household_plan_guard(new.household_id, 'member_change');
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.household_id is distinct from new.household_id then
      perform public.refresh_household_plan_guard(old.household_id, 'member_change');
      perform public.refresh_household_plan_guard(new.household_id, 'member_change');
    elsif old.status is distinct from new.status
      or old.joined_at is distinct from new.joined_at then
      perform public.refresh_household_plan_guard(new.household_id, 'member_change');
    end if;
    return new;
  end if;

  perform public.refresh_household_plan_guard(old.household_id, 'member_change');
  return old;
end;
$$;

drop trigger if exists trg_household_members_plan_guard on public.household_members;
create trigger trg_household_members_plan_guard
after insert or update or delete on public.household_members
for each row execute function public.trg_refresh_household_plan_guard_from_members();

create or replace function public.trg_refresh_household_plan_guard_from_subscriptions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.refresh_household_plan_guard(new.household_id, 'subscription_change');
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.household_id is distinct from new.household_id then
      perform public.refresh_household_plan_guard(old.household_id, 'subscription_change');
      perform public.refresh_household_plan_guard(new.household_id, 'subscription_change');
    elsif old.plan is distinct from new.plan
      or old.status is distinct from new.status
      or old.expires_at is distinct from new.expires_at
      or old.owner_user_id is distinct from new.owner_user_id then
      perform public.refresh_household_plan_guard(new.household_id, 'subscription_change');
    end if;
    return new;
  end if;

  perform public.refresh_household_plan_guard(old.household_id, 'subscription_change');
  return old;
end;
$$;

drop trigger if exists trg_subscriptions_plan_guard on public.subscriptions;
create trigger trg_subscriptions_plan_guard
after insert or update or delete on public.subscriptions
for each row execute function public.trg_refresh_household_plan_guard_from_subscriptions();

revoke all on function public.plan_member_limit(subscription_plan) from public;
grant execute on function public.plan_member_limit(subscription_plan) to authenticated;

revoke all on function public.enqueue_household_plan_guard_notifications(uuid, text, subscription_plan, integer, integer, integer, timestamptz, uuid[]) from public;
grant execute on function public.enqueue_household_plan_guard_notifications(uuid, text, subscription_plan, integer, integer, integer, timestamptz, uuid[]) to authenticated;

revoke all on function public.get_household_plan_guard_status(uuid) from public;
grant execute on function public.get_household_plan_guard_status(uuid) to authenticated;
