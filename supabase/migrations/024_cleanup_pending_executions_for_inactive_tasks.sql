-- ============================================================
-- MeToca - Cleanup pending executions for inactive/deleted tasks
-- ============================================================

update public.task_executions te
set
  status = 'missed',
  updated_at = now()
from public.tasks t
where te.task_id = t.id
  and te.status = 'pending'
  and (t.is_active = false or t.deleted_at is not null);
