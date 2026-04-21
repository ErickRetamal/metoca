-- ============================================================
-- MeToca - Cleanup empty households (keep homes with members)
-- ============================================================

create or replace function public.cleanup_empty_households(
  p_days_without_members integer default 14
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days integer := greatest(coalesce(p_days_without_members, 14), 1);
  v_cutoff timestamptz;
  v_ids uuid[];
  v_count integer := 0;
begin
  v_cutoff := now() - make_interval(days => v_days);

  with candidates as (
    select h.id
    from public.households h
    where h.deleted_at is null
      and h.updated_at <= v_cutoff
      and not exists (
        select 1
        from public.household_members hm
        where hm.household_id = h.id
          and hm.status in ('active', 'invited')
      )
  ), updated as (
    update public.households h
    set deleted_at = now(),
        updated_at = now()
    where h.id in (select c.id from candidates c)
    returning h.id
  )
  select array_agg(u.id), count(*)
    into v_ids, v_count
  from updated u;

  return jsonb_build_object(
    'ok', true,
    'days_without_members', v_days,
    'cutoff', v_cutoff,
    'deleted_count', coalesce(v_count, 0),
    'deleted_household_ids', coalesce(to_jsonb(v_ids), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.cleanup_empty_households(integer) from public;
grant execute on function public.cleanup_empty_households(integer) to service_role;
