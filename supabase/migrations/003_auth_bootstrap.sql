-- ============================================================
-- MeToca - Bootstrap de alta completa desde auth.users
-- ============================================================

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
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();