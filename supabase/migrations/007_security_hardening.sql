-- ============================================================
-- MeToca - Security hardening (Security Advisor warnings)
-- ============================================================

-- Fix: Function Search Path Mutable (public.update_updated_at)
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'update_updated_at'
      and p.pronargs = 0
  ) then
    alter function public.update_updated_at() set search_path = public;
  end if;
end
$$;

-- Fix: Function Search Path Mutable (public.respond_task_swap)
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'respond_task_swap'
      and p.pronargs = 2
  ) then
    alter function public.respond_task_swap(uuid, text) set search_path = public;
  end if;
end
$$;
