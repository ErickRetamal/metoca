-- ============================================================
-- MeToca - Member profiles and task audience controls
-- ============================================================

create type member_profile_type as enum ('adulto', 'joven');
create type task_audience_type as enum ('todos', 'solo_adultos', 'solo_jovenes');

alter table public.household_members
  add column if not exists profile member_profile_type not null default 'adulto';

alter table public.tasks
  add column if not exists audience task_audience_type not null default 'todos',
  add column if not exists is_custom boolean not null default false;

update public.tasks
set is_custom = case
  when lower(name) in (
    'lavar platos',
    'sacar basura',
    'barrer piso',
    'limpiar bano',
    'lavar ropa',
    'orden cocina',
    'hacer camas',
    'regar plantas',
    'revisar refri',
    'quitar polvo',
    'limpiar vidrios',
    'orden despensa',
    'orden garage',
    'lista compras',
    'reponer bano',
    'zona mascota'
  ) then false
  else true
end
where is_custom is distinct from case
  when lower(name) in (
    'lavar platos',
    'sacar basura',
    'barrer piso',
    'limpiar bano',
    'lavar ropa',
    'orden cocina',
    'hacer camas',
    'regar plantas',
    'revisar refri',
    'quitar polvo',
    'limpiar vidrios',
    'orden despensa',
    'orden garage',
    'lista compras',
    'reponer bano',
    'zona mascota'
  ) then false
  else true
end;

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

  select s.plan
    into v_plan
  from public.subscriptions s
  where s.household_id = new.household_id
    and s.status = 'active'
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
