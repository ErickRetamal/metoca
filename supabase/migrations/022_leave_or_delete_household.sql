-- ============================================================
-- MeToca - Leave household or delete+leave when sole admin
-- ============================================================

create or replace function public.leave_or_delete_household(p_household_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_admin_user_id uuid;
  v_member_status member_status;
  v_active_members integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_household_id is null then
    raise exception 'household_required';
  end if;

  select h.admin_user_id
    into v_admin_user_id
  from public.households h
  where h.id = p_household_id
    and h.deleted_at is null
  limit 1;

  if v_admin_user_id is null then
    raise exception 'household_not_found';
  end if;

  select hm.status
    into v_member_status
  from public.household_members hm
  where hm.household_id = p_household_id
    and hm.user_id = v_user_id
  limit 1;

  if v_member_status is null then
    raise exception 'not_member';
  end if;

  if v_member_status <> 'active' then
    raise exception 'membership_not_active';
  end if;

  select count(*)
    into v_active_members
  from public.household_members hm
  where hm.household_id = p_household_id
    and hm.status = 'active';

  if v_admin_user_id = v_user_id then
    if v_active_members > 1 then
      raise exception 'transfer_required';
    end if;

    update public.households
    set deleted_at = now(), updated_at = now()
    where id = p_household_id;

    update public.household_members
    set status = 'removed'
    where household_id = p_household_id
      and user_id = v_user_id;

    return jsonb_build_object(
      'ok', true,
      'mode', 'deleted_and_left'
    );
  end if;

  update public.household_members
  set status = 'removed'
  where household_id = p_household_id
    and user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'mode', 'left'
  );
end;
$$;

revoke all on function public.leave_or_delete_household(uuid) from public;
grant execute on function public.leave_or_delete_household(uuid) to authenticated;
