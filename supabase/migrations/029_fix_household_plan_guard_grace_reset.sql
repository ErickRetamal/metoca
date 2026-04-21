-- ============================================================
-- MeToca - Fix grace countdown reset on over-capacity enforcement
-- ============================================================

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
          -- Keep the original deadline while the guard stays pending.
          grace_ends_at = case
            when household_plan_guards.status = 'pending' then household_plan_guards.grace_ends_at
            else now() + interval '5 days'
          end,
          notified_at = case
            when household_plan_guards.status = 'pending' then household_plan_guards.notified_at
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
