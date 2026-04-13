-- ============================================================
-- MeToca - Swap security and helper RPC
-- ============================================================

alter table task_swaps enable row level security;

drop policy if exists "task_swaps_select_involved_users" on task_swaps;
create policy "task_swaps_select_involved_users" on task_swaps
for select using (
  requester_id = auth.uid() or target_id = auth.uid()
);

drop policy if exists "task_swaps_insert_requester" on task_swaps;
create policy "task_swaps_insert_requester" on task_swaps
for insert with check (
  requester_id = auth.uid()
);

drop policy if exists "task_swaps_update_target_or_requester" on task_swaps;
create policy "task_swaps_update_target_or_requester" on task_swaps
for update using (
  requester_id = auth.uid() or target_id = auth.uid()
)
with check (
  requester_id = auth.uid() or target_id = auth.uid()
);

create or replace function public.respond_task_swap(
  p_swap_id uuid,
  p_decision text
)
returns void
language plpgsql
security definer
as $$
declare
  v_swap task_swaps%rowtype;
  v_requester_assigned_to uuid;
  v_target_assigned_to uuid;
begin
  if p_decision not in ('accepted', 'rejected') then
    raise exception 'Decision invalida';
  end if;

  select * into v_swap
  from task_swaps
  where id = p_swap_id
  for update;

  if not found then
    raise exception 'Swap no encontrado';
  end if;

  if v_swap.status <> 'pending' then
    raise exception 'Swap ya resuelto';
  end if;

  if auth.uid() is null or auth.uid() <> v_swap.target_id then
    raise exception 'No autorizado';
  end if;

  if p_decision = 'accepted' then
    if v_swap.requester_execution_id is not null then
      select assigned_to into v_requester_assigned_to
      from task_executions
      where id = v_swap.requester_execution_id
      for update;

      select assigned_to into v_target_assigned_to
      from task_executions
      where id = v_swap.target_execution_id
      for update;

      if v_requester_assigned_to is not null and v_target_assigned_to is not null then
        update task_executions
        set assigned_to = v_target_assigned_to
        where id = v_swap.requester_execution_id;

        update task_executions
        set assigned_to = v_requester_assigned_to
        where id = v_swap.target_execution_id;
      end if;
    end if;
  end if;

  update task_swaps
  set status = p_decision::swap_status,
      resolved_at = now()
  where id = p_swap_id;
end;
$$;

grant execute on function public.respond_task_swap(uuid, text) to authenticated;
