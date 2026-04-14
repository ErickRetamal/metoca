-- ============================================================
-- MeToca - Household create/join permissions and secure join RPC
-- ============================================================

-- Allow authenticated users to create households where they are the admin.
drop policy if exists "households_insert_self_admin" on households;
create policy "households_insert_self_admin" on households
  for insert
  with check (admin_user_id = auth.uid());

-- Allow authenticated users to insert their own membership row.
drop policy if exists "household_members_insert_self" on household_members;
create policy "household_members_insert_self" on household_members
  for insert
  with check (user_id = auth.uid());

-- Join household using invite code without exposing household table reads.
create or replace function public.join_household_by_invite_code(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_household_id uuid;
  v_membership_id uuid;
  v_membership_status member_status;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select h.id
    into v_household_id
  from public.households h
  where h.invite_code = upper(trim(p_invite_code))
    and h.deleted_at is null
  limit 1;

  if v_household_id is null then
    raise exception 'invalid_invite_code';
  end if;

  select hm.id, hm.status
    into v_membership_id, v_membership_status
  from public.household_members hm
  where hm.household_id = v_household_id
    and hm.user_id = v_user_id
  limit 1;

  if v_membership_id is not null then
    if v_membership_status <> 'active' then
      update public.household_members
      set status = 'active', joined_at = now()
      where id = v_membership_id;
    end if;

    return v_household_id;
  end if;

  insert into public.household_members (household_id, user_id, status, joined_at)
  values (v_household_id, v_user_id, 'active', now());

  return v_household_id;
end;
$$;

revoke all on function public.join_household_by_invite_code(text) from public;
grant execute on function public.join_household_by_invite_code(text) to authenticated;
