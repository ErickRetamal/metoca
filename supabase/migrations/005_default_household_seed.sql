-- ============================================================
-- MeToca - Seed inicial para hogares nuevos
-- ============================================================

create or replace function public.seed_default_household_data(
  p_household_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_month char(7);
  v_today date := current_date;
  v_next_seed_date date;
  v_task_lavar_loza uuid;
  v_task_sacar_basura uuid;
  v_task_ordenar_cama uuid;
  v_assignment_1 uuid;
  v_assignment_2 uuid;
  v_assignment_3 uuid;
begin
  v_current_month := to_char(v_today, 'YYYY-MM');
  v_next_seed_date := case
    when to_char(v_today + 1, 'YYYY-MM') = v_current_month then v_today + 1
    else v_today
  end;

  if exists (
    select 1
    from public.tasks
    where household_id = p_household_id
  ) then
    return;
  end if;

  insert into public.tasks (household_id, name, frequency, notification_time, created_by)
  values (p_household_id, 'Lavar la loza', 'daily', '20:00', p_user_id)
  returning id into v_task_lavar_loza;

  insert into public.tasks (household_id, name, frequency, notification_time, created_by)
  values (p_household_id, 'Sacar la basura', 'weekly', '21:00', p_user_id)
  returning id into v_task_sacar_basura;

  insert into public.tasks (household_id, name, frequency, notification_time, created_by)
  values (p_household_id, 'Ordenar la cama', 'daily', '08:00', p_user_id)
  returning id into v_task_ordenar_cama;

  insert into public.task_assignments (task_id, household_id, user_id, month)
  values (v_task_lavar_loza, p_household_id, p_user_id, v_current_month)
  returning id into v_assignment_1;

  insert into public.task_assignments (task_id, household_id, user_id, month)
  values (v_task_sacar_basura, p_household_id, p_user_id, v_current_month)
  returning id into v_assignment_2;

  insert into public.task_assignments (task_id, household_id, user_id, month)
  values (v_task_ordenar_cama, p_household_id, p_user_id, v_current_month)
  returning id into v_assignment_3;

  insert into public.task_executions (task_assignment_id, task_id, assigned_to, scheduled_date, scheduled_time, status)
  values
    (v_assignment_1, v_task_lavar_loza, p_user_id, v_today, '20:00', 'pending'),
    (v_assignment_1, v_task_lavar_loza, p_user_id, v_next_seed_date, '20:00', 'pending'),
    (v_assignment_2, v_task_sacar_basura, p_user_id, v_today, '21:00', 'pending'),
    (v_assignment_3, v_task_ordenar_cama, p_user_id, v_today, '08:00', 'pending'),
    (v_assignment_3, v_task_ordenar_cama, p_user_id, v_next_seed_date, '08:00', 'pending');
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_name text;
  v_household_id uuid;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    initcap(replace(split_part(new.email, '@', 1), '.', ' ')),
    'Usuario'
  );

  insert into public.users (id, name, email)
  values (new.id, left(v_name, 100), new.email)
  on conflict (id) do update
    set email = excluded.email;

  if not exists (
    select 1
    from public.household_members
    where user_id = new.id
      and status = 'active'
  ) then
    insert into public.households (name, admin_user_id)
    values (concat('Hogar de ', left(v_name, 80)), new.id)
    returning id into v_household_id;

    insert into public.household_members (household_id, user_id, status, joined_at)
    values (v_household_id, new.id, 'active', now());

    insert into public.subscriptions (household_id, plan, max_members, status)
    values (v_household_id, 'free', 2, 'active');

    perform public.seed_default_household_data(v_household_id, new.id);
  end if;

  return new;
end;
$$;