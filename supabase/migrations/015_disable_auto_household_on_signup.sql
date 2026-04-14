-- ============================================================
-- MeToca - Disable automatic household creation on signup
-- New users must decide to create or join a household manually.
-- ============================================================

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

  return new;
end;
$$;
