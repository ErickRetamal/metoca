-- ============================================================
-- MeToca - Manual task redistribution for current/new members
-- ============================================================

create or replace function public.redistribute_household_tasks(
  p_household_id uuid,
  p_month char(7) default to_char(current_date, 'YYYY-MM')
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_month_start date;
  v_month_end date;
  v_plan subscription_plan;
  v_member_ids uuid[];
  v_adult_member_ids uuid[];
  v_young_member_ids uuid[];
  v_target_member_ids uuid[];
  v_member_count integer;
  v_adult_member_count integer;
  v_young_member_count integer;
  v_target_member_count integer;
  v_member_index integer := 1;
  v_target_member_index integer;
  v_assignment_id uuid;
  v_task record;
  v_schedule record;
  v_date date;
  v_day integer;
  v_rows integer;
  v_assigned_count integer := 0;
  v_execution_created_count integer := 0;
  v_pending_reassigned_count integer := 0;
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
    from public.households h
    where h.id = p_household_id
      and h.admin_user_id = v_actor_id
  ) then
    raise exception 'only_admin_can_redistribute';
  end if;

  begin
    v_month_start := to_date(p_month || '-01', 'YYYY-MM-DD');
  exception
    when others then
      raise exception 'invalid_month_format';
  end;

  v_month_end := (v_month_start + interval '1 month - 1 day')::date;

  v_plan := public.get_effective_household_plan(p_household_id);

  with active_members as (
    select
      hm.user_id,
      coalesce(to_jsonb(hm) ->> 'profile', 'adulto') as profile,
      coalesce(hm.joined_at, hm.created_at) as sort_joined,
      hm.user_id::text as sort_user
    from public.household_members hm
    where hm.household_id = p_household_id
      and hm.status = 'active'
  )
  select
    array_agg(am.user_id order by am.sort_joined, am.sort_user),
    count(*),
    array_agg(am.user_id order by am.sort_joined, am.sort_user) filter (where am.profile = 'adulto'),
    count(*) filter (where am.profile = 'adulto'),
    array_agg(am.user_id order by am.sort_joined, am.sort_user) filter (where am.profile = 'joven'),
    count(*) filter (where am.profile = 'joven')
  into
    v_member_ids,
    v_member_count,
    v_adult_member_ids,
    v_adult_member_count,
    v_young_member_ids,
    v_young_member_count
  from active_members am;

  if v_member_count = 0 then
    raise exception 'no_active_members';
  end if;

  for v_task in
    select t.id, t.frequency, t.notification_time, t.day_of_week, t.day_of_month, t.weekly_days,
           coalesce(to_jsonb(t) ->> 'audience', 'todos') as audience
    from public.tasks t
    where t.household_id = p_household_id
      and t.is_active = true
      and t.deleted_at is null
    order by t.created_at, t.id
  loop
    if v_plan = 'free' then
      v_target_member_ids := v_member_ids;
      v_target_member_count := v_member_count;
    elsif v_task.audience = 'solo_adultos' then
      v_target_member_ids := coalesce(v_adult_member_ids, v_member_ids);
      v_target_member_count := case when v_adult_member_count > 0 then v_adult_member_count else v_member_count end;
    elsif v_task.audience = 'solo_jovenes' then
      v_target_member_ids := coalesce(v_young_member_ids, v_member_ids);
      v_target_member_count := case when v_young_member_count > 0 then v_young_member_count else v_member_count end;
    else
      v_target_member_ids := v_member_ids;
      v_target_member_count := v_member_count;
    end if;

    if coalesce(v_target_member_count, 0) = 0 then
      v_target_member_ids := v_member_ids;
      v_target_member_count := v_member_count;
    end if;

    v_target_member_index := ((v_member_index - 1) % v_target_member_count) + 1;

    insert into public.task_assignments (task_id, household_id, user_id, month)
    values (v_task.id, p_household_id, v_target_member_ids[v_target_member_index], p_month)
    on conflict (task_id, month) do update
      set user_id = excluded.user_id,
          household_id = excluded.household_id
    returning id into v_assignment_id;

    v_assigned_count := v_assigned_count + 1;

    update public.task_executions te
    set
      assigned_to = v_target_member_ids[v_target_member_index],
      task_assignment_id = v_assignment_id,
      updated_at = now()
    where te.task_id = v_task.id
      and te.scheduled_date >= v_month_start
      and te.scheduled_date <= v_month_end
      and te.status = 'pending'
      and (
        te.assigned_to is distinct from v_target_member_ids[v_target_member_index]
        or te.task_assignment_id is distinct from v_assignment_id
      );

    get diagnostics v_rows = row_count;
    v_pending_reassigned_count := v_pending_reassigned_count + v_rows;

    for v_schedule in
      select s.frequency, s.notification_time, s.day_of_week, s.day_of_month, s.weekly_days
      from public.task_schedules s
      where s.task_id = v_task.id
      union all
      select v_task.frequency, v_task.notification_time, v_task.day_of_week, v_task.day_of_month, v_task.weekly_days
      where not exists (
        select 1 from public.task_schedules sx where sx.task_id = v_task.id
      )
    loop
      if v_schedule.frequency = 'daily' then
        v_date := v_month_start;
        while v_date <= v_month_end loop
          insert into public.task_executions (task_assignment_id, task_id, assigned_to, scheduled_date, scheduled_time, status)
          select v_assignment_id, v_task.id, v_target_member_ids[v_target_member_index], v_date, v_schedule.notification_time, 'pending'
          where not exists (
            select 1
            from public.task_executions te
            where te.task_id = v_task.id
              and te.scheduled_date = v_date
              and te.scheduled_time = v_schedule.notification_time
          );

          get diagnostics v_rows = row_count;
          v_execution_created_count := v_execution_created_count + v_rows;
          v_date := v_date + 1;
        end loop;

      elsif v_schedule.frequency = 'weekly' then
        if v_schedule.weekly_days is not null
          and jsonb_typeof(v_schedule.weekly_days) = 'array'
          and jsonb_array_length(v_schedule.weekly_days) > 0 then

          for v_day in
            select (value::text)::int
            from jsonb_array_elements(v_schedule.weekly_days)
          loop
            v_date := v_month_start;
            while v_date <= v_month_end loop
              if extract(dow from v_date)::int = v_day then
                insert into public.task_executions (task_assignment_id, task_id, assigned_to, scheduled_date, scheduled_time, status)
                select v_assignment_id, v_task.id, v_target_member_ids[v_target_member_index], v_date, v_schedule.notification_time, 'pending'
                where not exists (
                  select 1
                  from public.task_executions te
                  where te.task_id = v_task.id
                    and te.scheduled_date = v_date
                    and te.scheduled_time = v_schedule.notification_time
                );

                get diagnostics v_rows = row_count;
                v_execution_created_count := v_execution_created_count + v_rows;
              end if;

              v_date := v_date + 1;
            end loop;
          end loop;

        elsif v_schedule.day_of_week is not null then
          v_date := v_month_start;
          while v_date <= v_month_end loop
            if extract(dow from v_date)::int = v_schedule.day_of_week then
              insert into public.task_executions (task_assignment_id, task_id, assigned_to, scheduled_date, scheduled_time, status)
              select v_assignment_id, v_task.id, v_target_member_ids[v_target_member_index], v_date, v_schedule.notification_time, 'pending'
              where not exists (
                select 1
                from public.task_executions te
                where te.task_id = v_task.id
                  and te.scheduled_date = v_date
                  and te.scheduled_time = v_schedule.notification_time
              );

              get diagnostics v_rows = row_count;
              v_execution_created_count := v_execution_created_count + v_rows;
            end if;

            v_date := v_date + 1;
          end loop;
        end if;

      elsif v_schedule.frequency = 'monthly' and v_schedule.day_of_month is not null then
        v_date := make_date(
          extract(year from v_month_start)::int,
          extract(month from v_month_start)::int,
          least(greatest(v_schedule.day_of_month, 1), 28)
        );

        if v_date >= v_month_start and v_date <= v_month_end then
          insert into public.task_executions (task_assignment_id, task_id, assigned_to, scheduled_date, scheduled_time, status)
          select v_assignment_id, v_task.id, v_target_member_ids[v_target_member_index], v_date, v_schedule.notification_time, 'pending'
          where not exists (
            select 1
            from public.task_executions te
            where te.task_id = v_task.id
              and te.scheduled_date = v_date
              and te.scheduled_time = v_schedule.notification_time
          );

          get diagnostics v_rows = row_count;
          v_execution_created_count := v_execution_created_count + v_rows;
        end if;
      end if;
    end loop;

    v_member_index := v_member_index + 1;
    if v_member_index > v_member_count then
      v_member_index := 1;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'household_id', p_household_id,
    'month', p_month,
    'tasks_assigned', v_assigned_count,
    'pending_reassigned', v_pending_reassigned_count,
    'executions_created', v_execution_created_count
  );
end;
$$;

revoke all on function public.redistribute_household_tasks(uuid, char) from public;
grant execute on function public.redistribute_household_tasks(uuid, char) to authenticated;
