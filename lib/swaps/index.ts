import { CURRENT_USER_ID } from '../dashboard'
import { supabase } from '../supabase'
import { SwapScope } from '../../types'

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

const MOCK_SWAP_REQUESTS: SwapRecord[] = []

const MOCK_USERS: Record<string, string> = {
  u1: 'Ana',
  u2: 'Pedro',
  u3: 'Maria',
}

const MOCK_EXECUTIONS: Record<string, SwapExecutionOption> = {
  e2: { executionId: 'e2', taskName: 'Lavar la ropa', scheduledTime: '15:00', assignedTo: 'u1', assignedToName: 'Ana' },
  e3: { executionId: 'e3', taskName: 'Pasar aspiradora', scheduledTime: '18:00', assignedTo: 'u1', assignedToName: 'Ana' },
  e5: { executionId: 'e5', taskName: 'Ordenar living', scheduledTime: '19:00', assignedTo: 'u2', assignedToName: 'Pedro' },
  e6: { executionId: 'e6', taskName: 'Lavar platos', scheduledTime: '14:00', assignedTo: 'u3', assignedToName: 'Maria' },
  e7: { executionId: 'e7', taskName: 'Barrer cocina', scheduledTime: '17:30', assignedTo: 'u3', assignedToName: 'Maria' },
}

async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? CURRENT_USER_ID
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

function getMockRequestData(): SwapRequestData {
  return {
    myTasks: [MOCK_EXECUTIONS.e2, MOCK_EXECUTIONS.e3],
    memberOptions: [
      {
        memberId: 'u2',
        memberName: 'Pedro',
        tasks: [MOCK_EXECUTIONS.e5],
      },
      {
        memberId: 'u3',
        memberName: 'Maria',
        tasks: [MOCK_EXECUTIONS.e6, MOCK_EXECUTIONS.e7],
      },
    ],
  }
}

export async function getSwapRequestData(): Promise<SwapRequestData> {
  try {
    const currentUserId = await getCurrentUserId()
    const householdId = await getCurrentHouseholdId(currentUserId)
    const today = currentDateKey()

    if (!householdId) {
      return getMockRequestData()
    }

    const { data: memberRows, error: memberError } = await supabase
      .from('household_members')
      .select('user_id, users(name, email)')
      .eq('household_id', householdId)
      .eq('status', 'active')

    if (memberError || !memberRows) {
      return getMockRequestData()
    }

    const members = memberRows.map((row: any) => ({
      id: row.user_id,
      name: row.users?.name ?? row.users?.email?.split('@')[0] ?? 'Miembro',
    }))

    const memberIds = members.map(member => member.id)

    const { data: executionRows, error: executionsError } = await supabase
      .from('task_executions')
      .select('id, assigned_to, scheduled_date, scheduled_time, status, tasks(name)')
      .in('assigned_to', memberIds)
      .eq('scheduled_date', today)
      .eq('status', 'pending')

    if (executionsError || !executionRows) {
      return getMockRequestData()
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
  } catch {
    return getMockRequestData()
  }
}

export async function createTaskSwapRequest(input: {
  requesterExecutionId: string
  targetExecutionId: string
  scope: SwapScope
}): Promise<void> {
  try {
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
      throw error
    }
  } catch {
    MOCK_SWAP_REQUESTS.unshift({
      id: `mock-${Date.now()}`,
      requester_id: CURRENT_USER_ID,
      target_id: MOCK_EXECUTIONS[input.targetExecutionId]?.assignedTo ?? 'u2',
      requester_execution_id: input.requesterExecutionId,
      target_execution_id: input.targetExecutionId,
      scope: input.scope,
      status: 'pending',
      requested_at: new Date().toISOString(),
    })
  }
}

function mapIncomingRecordsToUi(records: SwapRecord[]): IncomingSwapRequest[] {
  return records.map(record => ({
    id: record.id,
    requesterName: MOCK_USERS[record.requester_id] ?? 'Miembro',
    requesterTaskName: record.requester_execution_id ? MOCK_EXECUTIONS[record.requester_execution_id]?.taskName ?? 'Tarea' : 'Sin tarea',
    targetTaskName: MOCK_EXECUTIONS[record.target_execution_id]?.taskName ?? 'Tarea',
    requestedAt: record.requested_at,
    scope: record.scope,
  }))
}

export async function getIncomingSwapRequests(): Promise<IncomingSwapRequest[]> {
  try {
    const currentUserId = await getCurrentUserId()

    const { data: rows, error } = await supabase
      .from('task_swaps')
      .select('id, requester_id, target_id, requester_execution_id, target_execution_id, scope, status, requested_at')
      .eq('target_id', currentUserId)
      .eq('status', 'pending')
      .order('requested_at', { ascending: false })

    if (error || !rows || rows.length === 0) {
      return mapIncomingRecordsToUi(
        MOCK_SWAP_REQUESTS.filter(item => item.target_id === CURRENT_USER_ID && item.status === 'pending')
      )
    }

    const requesterIds = [...new Set(rows.map((row: any) => row.requester_id))]
    const executionIds = [...new Set(rows.flatMap((row: any) => [row.requester_execution_id, row.target_execution_id].filter(Boolean)))]

    const [{ data: usersRows }, { data: executionRows }] = await Promise.all([
      supabase.from('users').select('id, name, email').in('id', requesterIds),
      supabase.from('task_executions').select('id, tasks(name)').in('id', executionIds as string[]),
    ])

    const usersMap = new Map<string, string>()
    usersRows?.forEach((row: any) => {
      usersMap.set(row.id, row.name ?? row.email?.split('@')[0] ?? 'Miembro')
    })

    const executionsMap = new Map<string, string>()
    executionRows?.forEach((row: any) => {
      executionsMap.set(row.id, row.tasks?.name ?? 'Tarea')
    })

    return rows.map((row: any) => ({
      id: row.id,
      requesterName: usersMap.get(row.requester_id) ?? 'Miembro',
      requesterTaskName: row.requester_execution_id ? executionsMap.get(row.requester_execution_id) ?? 'Tarea' : 'Sin tarea',
      targetTaskName: executionsMap.get(row.target_execution_id) ?? 'Tarea',
      requestedAt: row.requested_at,
      scope: row.scope,
    }))
  } catch {
    return mapIncomingRecordsToUi(
      MOCK_SWAP_REQUESTS.filter(item => item.target_id === CURRENT_USER_ID && item.status === 'pending')
    )
  }
}

export async function respondToSwapRequest(swapId: string, decision: 'accepted' | 'rejected'): Promise<void> {
  try {
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
      throw new Error('No se encontro la solicitud.')
    }

    if (decision === 'accepted') {
      if (swap.requester_execution_id) {
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
    }

    const { error: updateError } = await supabase
      .from('task_swaps')
      .update({ status: decision, resolved_at: new Date().toISOString() })
      .eq('id', swapId)

    if (updateError) {
      throw updateError
    }
  } catch {
    const index = MOCK_SWAP_REQUESTS.findIndex(item => item.id === swapId)
    if (index !== -1) {
      MOCK_SWAP_REQUESTS[index] = {
        ...MOCK_SWAP_REQUESTS[index],
        status: decision,
      }
    }
  }
}
