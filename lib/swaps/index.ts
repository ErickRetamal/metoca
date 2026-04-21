import { supabase } from '../supabase'
import { SwapScope } from '../../types'
import { firstNameOnly, nameFromEmail } from '../user-name'

export interface SwapExecutionOption {
  executionId: string
  taskName: string
  scheduledTime: string
  assignedTo: string
  assignedToName: string
}

export interface SwapMemberOptions {
  memberId: string
  memberName: string
  tasks: SwapExecutionOption[]
}

export interface SwapRequestData {
  myTasks: SwapExecutionOption[]
  memberOptions: SwapMemberOptions[]
}

export interface IncomingSwapRequest {
  id: string
  requesterName: string
  requesterTaskName: string
  targetTaskName: string
  requestedAt: string
  scope: SwapScope
}

interface SwapRecord {
  id: string
  requester_id: string
  target_id: string
  requester_execution_id: string | null
  target_execution_id: string
  scope: SwapScope
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  requested_at: string
}

function currentDateKey(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createEmptySwapRequestData(): SwapRequestData {
  return {
    myTasks: [],
    memberOptions: [],
  }
}

async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) {
    throw new Error('No hay sesión activa.')
  }

  return user.id
}

async function getCurrentHouseholdId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  return data?.household_id ?? null
}

export async function getSwapRequestData(): Promise<SwapRequestData> {
  const currentUserId = await getCurrentUserId()
  const householdId = await getCurrentHouseholdId(currentUserId)
  const today = currentDateKey()

  if (!householdId) {
    return createEmptySwapRequestData()
  }

  const { data: memberRows, error: memberError } = await supabase
    .from('household_members')
    .select('user_id, users(name, email)')
    .eq('household_id', householdId)
    .eq('status', 'active')

  if (memberError || !memberRows) {
    throw new Error(memberError?.message ?? 'No pudimos cargar los miembros del hogar.')
  }

  const members = memberRows.map((row: any) => ({
    id: row.user_id,
    name: firstNameOnly(row.users?.name ?? nameFromEmail(row.users?.email), 'Miembro'),
  }))

  const memberIds = members.map(member => member.id)
  if (memberIds.length === 0) {
    return createEmptySwapRequestData()
  }

  const { data: executionRows, error: executionsError } = await supabase
    .from('task_executions')
    .select('id, assigned_to, scheduled_date, scheduled_time, status, tasks(name)')
    .in('assigned_to', memberIds)
    .eq('scheduled_date', today)
    .eq('status', 'pending')

  if (executionsError || !executionRows) {
    throw new Error(executionsError?.message ?? 'No pudimos cargar las tareas intercambiables.')
  }

  const taskOptions: SwapExecutionOption[] = executionRows.map((row: any) => ({
    executionId: row.id,
    taskName: row.tasks?.name ?? 'Tarea',
    scheduledTime: row.scheduled_time,
    assignedTo: row.assigned_to,
    assignedToName: members.find(member => member.id === row.assigned_to)?.name ?? 'Miembro',
  }))

  const myTasks = taskOptions.filter(task => task.assignedTo === currentUserId)
  const memberOptions = members
    .filter(member => member.id !== currentUserId)
    .map(member => ({
      memberId: member.id,
      memberName: member.name,
      tasks: taskOptions
        .filter(task => task.assignedTo === member.id)
        .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime)),
    }))
    .filter(member => member.tasks.length > 0)

  return {
    myTasks,
    memberOptions,
  }
}

export async function createTaskSwapRequest(input: {
  requesterExecutionId: string
  targetExecutionId: string
  scope: SwapScope
}): Promise<void> {
  const currentUserId = await getCurrentUserId()

  const { data: targetExecution, error: targetExecutionError } = await supabase
    .from('task_executions')
    .select('assigned_to')
    .eq('id', input.targetExecutionId)
    .maybeSingle()

  if (targetExecutionError || !targetExecution?.assigned_to) {
    throw new Error('No se pudo determinar el usuario destino.')
  }

  const { error } = await supabase
    .from('task_swaps')
    .insert({
      requester_id: currentUserId,
      target_id: targetExecution.assigned_to,
      requester_execution_id: input.requesterExecutionId,
      target_execution_id: input.targetExecutionId,
      scope: input.scope,
      status: 'pending',
    })

  if (error) {
    throw new Error(error.message)
  }
}

function mapIncomingRecordsToUi(records: SwapRecord[], usersMap: Map<string, string>, executionsMap: Map<string, string>): IncomingSwapRequest[] {
  return records.map(record => ({
    id: record.id,
    requesterName: usersMap.get(record.requester_id) ?? 'Miembro',
    requesterTaskName: record.requester_execution_id ? executionsMap.get(record.requester_execution_id) ?? 'Tarea' : 'Sin tarea',
    targetTaskName: executionsMap.get(record.target_execution_id) ?? 'Tarea',
    requestedAt: record.requested_at,
    scope: record.scope,
  }))
}

export async function getIncomingSwapRequests(): Promise<IncomingSwapRequest[]> {
  const currentUserId = await getCurrentUserId()

  const { data: rows, error } = await supabase
    .from('task_swaps')
    .select('id, requester_id, target_id, requester_execution_id, target_execution_id, scope, status, requested_at')
    .eq('target_id', currentUserId)
    .eq('status', 'pending')
    .order('requested_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  if (!rows || rows.length === 0) {
    return []
  }

  const requesterIds = [...new Set(rows.map((row: any) => row.requester_id))]
  const executionIds = [...new Set(rows.flatMap((row: any) => [row.requester_execution_id, row.target_execution_id].filter(Boolean)))]

  const [{ data: usersRows, error: usersError }, { data: executionRows, error: executionsError }] = await Promise.all([
    supabase.from('users').select('id, name, email').in('id', requesterIds),
    supabase.from('task_executions').select('id, tasks(name)').in('id', executionIds as string[]),
  ])

  if (usersError || executionsError) {
    throw new Error(usersError?.message ?? executionsError?.message ?? 'No se pudieron cargar los detalles del intercambio.')
  }

  const usersMap = new Map<string, string>()
  usersRows?.forEach((row: any) => {
    usersMap.set(row.id, firstNameOnly(row.name ?? nameFromEmail(row.email), 'Miembro'))
  })

  const executionsMap = new Map<string, string>()
  executionRows?.forEach((row: any) => {
    executionsMap.set(row.id, row.tasks?.name ?? 'Tarea')
  })

  return mapIncomingRecordsToUi(rows as SwapRecord[], usersMap, executionsMap)
}

export async function respondToSwapRequest(swapId: string, decision: 'accepted' | 'rejected'): Promise<void> {
  const { error: rpcError } = await supabase.rpc('respond_task_swap', {
    p_swap_id: swapId,
    p_decision: decision,
  })

  if (!rpcError) {
    return
  }

  const { data: swap, error: swapError } = await supabase
    .from('task_swaps')
    .select('id, requester_id, target_id, requester_execution_id, target_execution_id, scope, status')
    .eq('id', swapId)
    .maybeSingle()

  if (swapError || !swap) {
    throw new Error(swapError?.message ?? 'No se encontró la solicitud.')
  }

  if (decision === 'accepted' && swap.requester_execution_id) {
    const [{ data: requesterExecution }, { data: targetExecution }] = await Promise.all([
      supabase.from('task_executions').select('assigned_to').eq('id', swap.requester_execution_id).maybeSingle(),
      supabase.from('task_executions').select('assigned_to').eq('id', swap.target_execution_id).maybeSingle(),
    ])

    if (requesterExecution?.assigned_to && targetExecution?.assigned_to) {
      await Promise.all([
        supabase
          .from('task_executions')
          .update({ assigned_to: targetExecution.assigned_to })
          .eq('id', swap.requester_execution_id),
        supabase
          .from('task_executions')
          .update({ assigned_to: requesterExecution.assigned_to })
          .eq('id', swap.target_execution_id),
      ])
    }
  }

  const { error: updateError } = await supabase
    .from('task_swaps')
    .update({ status: decision, resolved_at: new Date().toISOString() })
    .eq('id', swapId)

  if (updateError) {
    throw new Error(updateError.message)
  }
}
