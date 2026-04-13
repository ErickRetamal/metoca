-- ============================================================
-- MeToca - User profile fields (first_name, last_name, gender)
-- ============================================================

alter table public.users
  add column if not exists first_name varchar(80),
  add column if not exists last_name varchar(80),
  add column if not exists gender varchar(24);

alter table public.users
  drop constraint if exists users_gender_check;

alter table public.users
  add constraint users_gender_check
  check (gender is null or gender in ('masculino', 'femenino', 'otro', 'prefiero_no_decir'));

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

    insert into public.subscriptions (household_id, plan, max_members, status)
    values (v_household_id, 'free', 2, 'active');

    perform public.seed_default_household_data(v_household_id, new.id);
  end if;

  return new;
end;
$$;

update public.users u
set
  first_name = coalesce(
    u.first_name,
    nullif(trim(au.raw_user_meta_data ->> 'first_name'), ''),
    nullif(trim(split_part(u.name, ' ', 1)), ''),
    'Usuario'
  ),
  last_name = coalesce(
    u.last_name,
    nullif(trim(au.raw_user_meta_data ->> 'last_name'), ''),
    case
      when position(' ' in coalesce(u.name, '')) > 0
        then nullif(trim(substring(u.name from position(' ' in u.name) + 1)), '')
      else null
    end,
    null
  ),
  gender = coalesce(
    u.gender,
    case
      when lower(trim(coalesce(au.raw_user_meta_data ->> 'gender', ''))) in ('masculino', 'femenino', 'otro', 'prefiero_no_decir')
        then lower(trim(au.raw_user_meta_data ->> 'gender'))
      else null
    end
  )
from auth.users au
where au.id = u.id;

update public.users
set name = trim(concat_ws(' ', coalesce(first_name, ''), coalesce(last_name, '')))
where coalesce(trim(name), '') = '';
