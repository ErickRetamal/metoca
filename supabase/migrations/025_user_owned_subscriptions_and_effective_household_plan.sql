-- ============================================================
-- MeToca - User-owned subscriptions with household inheritance
-- ============================================================

alter table public.subscriptions
  add column if not exists owner_user_id uuid references public.users(id);

update public.subscriptions s
set owner_user_id = h.admin_user_id
from public.households h
where s.household_id = h.id
  and s.owner_user_id is null;

create index if not exists idx_subscriptions_owner_user_id on public.subscriptions(owner_user_id);

create or replace function public.get_effective_household_plan(p_household_id uuid)
returns subscription_plan
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan subscription_plan;
begin
  if p_household_id is null then
    return 'free';
  end if;

  select s.plan
    into v_plan
  from public.subscriptions s
  join public.household_members hm
    on hm.user_id = s.owner_user_id
   and hm.household_id = p_household_id
   and hm.status = 'active'
  where s.status = 'active'
    and (s.expires_at is null or s.expires_at > now())
  order by
    case s.plan
      when 'familia' then 3
      when 'hogar' then 2
      else 1
    end desc,
    coalesce(s.expires_at, 'infinity'::timestamptz) desc,
    s.updated_at desc,
    s.created_at desc
  limit 1;

  return coalesce(v_plan, 'free');
end;
$$;

revoke all on function public.get_effective_household_plan(uuid) from public;
grant execute on function public.get_effective_household_plan(uuid) to authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_name text;
  v_first_name text;
  v_last_name text;
  v_gender text;
  v_household_id uuid;
begin
  v_first_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''),
    nullif(trim(split_part(new.raw_user_meta_data ->> 'name', ' ', 1)), ''),
    nullif(trim(initcap(replace(split_part(new.email, '@', 1), '.', ' '))), ''),
    'Usuario'
  );

  v_last_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''),
    case
      when position(' ' in coalesce(new.raw_user_meta_data ->> 'name', '')) > 0
        then nullif(trim(substring(new.raw_user_meta_data ->> 'name' from position(' ' in new.raw_user_meta_data ->> 'name') + 1)), '')
      else null
    end,
    nullif(trim(new.raw_user_meta_data ->> 'apellido'), ''),
    ''
  );

  v_name := trim(concat_ws(' ', v_first_name, nullif(v_last_name, '')));

  v_gender := lower(trim(coalesce(new.raw_user_meta_data ->> 'gender', '')));
  if v_gender not in ('masculino', 'femenino', 'otro', 'prefiero_no_decir') then
    v_gender := null;
  end if;

  insert into public.users (id, name, email, first_name, last_name, gender)
  values (
    new.id,
    left(v_name, 100),
    new.email,
    left(v_first_name, 80),
    left(nullif(v_last_name, ''), 80),
    v_gender
  )
  on conflict (id) do update
    set
      email = excluded.email,
      name = coalesce(excluded.name, public.users.name),
      first_name = coalesce(excluded.first_name, public.users.first_name),
      last_name = coalesce(excluded.last_name, public.users.last_name),
      gender = coalesce(excluded.gender, public.users.gender);

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

    insert into public.subscriptions (household_id, owner_user_id, plan, max_members, status)
    values (v_household_id, new.id, 'free', 2, 'active');

    perform public.seed_default_household_data(v_household_id, new.id);
  end if;

  return new;
end;
$$;

create or replace function public.enforce_free_plan_custom_tasks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan subscription_plan;
begin
  if not (new.is_custom = true and new.is_active = true and new.deleted_at is null) then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and coalesce(old.is_custom, false) = true
     and coalesce(old.is_active, false) = true
     and old.deleted_at is null then
    return new;
  end if;

  v_plan := public.get_effective_household_plan(new.household_id);

  if coalesce(v_plan, 'free') = 'free' then
    raise exception 'free_plan_disallows_custom_tasks';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_free_plan_custom_tasks on public.tasks;
create trigger trg_enforce_free_plan_custom_tasks
before insert or update on public.tasks
for each row execute function public.enforce_free_plan_custom_tasks();
