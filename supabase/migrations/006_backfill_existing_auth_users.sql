-- ============================================================
-- MeToca - Backfill para usuarios ya existentes en auth.users
-- ============================================================

create or replace function public.backfill_existing_auth_users()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_auth_user auth.users%rowtype;
  v_name text;
  v_household_id uuid;
begin
  for v_auth_user in
    select * from auth.users
  loop
    v_name := coalesce(
      nullif(trim(v_auth_user.raw_user_meta_data ->> 'name'), ''),
      initcap(replace(split_part(v_auth_user.email, '@', 1), '.', ' ')),
      'Usuario'
    );

    insert into public.users (id, name, email)
    values (v_auth_user.id, left(v_name, 100), v_auth_user.email)
    on conflict (id) do update
      set email = excluded.email;

    if not exists (
      select 1
      from public.household_members
      where user_id = v_auth_user.id
        and status = 'active'
    ) then
      insert into public.households (name, admin_user_id)
      values (concat('Hogar de ', left(v_name, 80)), v_auth_user.id)
      returning id into v_household_id;

      insert into public.household_members (household_id, user_id, status, joined_at)
      values (v_household_id, v_auth_user.id, 'active', now());

      insert into public.subscriptions (household_id, plan, max_members, status)
      values (v_household_id, 'free', 2, 'active');

      perform public.seed_default_household_data(v_household_id, v_auth_user.id);
    end if;
  end loop;
end;
$$;

select public.backfill_existing_auth_users();