import { supabase } from '../supabase'
import { TaskExecutionStatus, SubscriptionPlan } from '../../types'

export interface DashboardTaskExecution {
  id: string
  taskName: string
  assignedTo: string
  scheduledDate: string
  scheduledTime: string
  status: TaskExecutionStatus
}

export interface DashboardMember {
  id: string
  name: string
}

interface DashboardContext {
  currentUserId: string
  currentUserName: string
  householdId: string | null
  householdName: string
  plan: SubscriptionPlan
  members: DashboardMember[]
}

function getNow(): Date {
  return new Date()
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const CURRENT_USER_ID = 'u1'
export const CURRENT_HOUSEHOLD_NAME = 'Mi hogar'
export const CURRENT_PLAN: SubscriptionPlan = 'free'

const DEFAULT_MEMBER: DashboardMember = { id: CURRENT_USER_ID, name: 'Usuario' }
const CONTEXT_CACHE_TTL_MS = 15000

let contextCache: { value: DashboardContext; expiresAt: number } | null = null
let contextPromise: Promise<DashboardContext> | null = null

function monthOffsetToKey(offset: number): string {
  const date = new Date(getNow())
  date.setMonth(date.getMonth() + offset)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function dateRangeFromMonthOffset(monthOffset: number): { start: string, end: string } {
  const now = getNow()
  const date = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  const year = date.getFullYear()
  const month = date.getMonth()
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDay = new Date(year, month + 1, 0).getDate()
  const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

function normalizeTaskRows(rows: any[]): DashboardTaskExecution[] {
  return rows.map(row => ({
    id: row.id,
    assignedTo: row.assigned_to,
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
    status: row.status,
    taskName: row.tasks?.name ?? 'Tarea',
  }))
}

function getMockCurrentUser(): DashboardMember {
  return DEFAULT_MEMBER
}

function getMockMonthTasks(monthOffset: number, userId: string): DashboardTaskExecution[] {
  return []
}

function getMockHouseholdTodaySummary() {
  return []
}

function getMockHouseholdMonthSummary(monthOffset: number) {
  const monthKey = monthOffsetToKey(monthOffset)
  return {
    monthKey,
    byMember: [],
    totalAssigned: 0,
    totalCompleted: 0,
    completionRate: 0,
  }
}

async function resolveContext(): Promise<DashboardContext> {
  const now = Date.now()
  if (contextCache && now < contextCache.expiresAt) {
    return contextCache.value
  }

  if (contextPromise) {
    return contextPromise
  }

  contextPromise = (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        return {
          currentUserId: CURRENT_USER_ID,
          currentUserName: DEFAULT_MEMBER.name,
          householdId: null,
          householdName: CURRENT_HOUSEHOLD_NAME,
          plan: CURRENT_PLAN,
          members: [DEFAULT_MEMBER],
        }
      }

      const currentUserName = user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'Usuario'
      const currentMember: DashboardMember = { id: user.id, name: currentUserName }

      const { data: membership } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()

      if (!membership?.household_id) {
        return {
          currentUserId: user.id,
          currentUserName,
          householdId: null,
          householdName: CURRENT_HOUSEHOLD_NAME,
          plan: CURRENT_PLAN,
          members: [currentMember],
        }
      }

      const householdId = membership.household_id

      const [{ data: household }, { data: subscription }, { data: memberRows }] = await Promise.all([
        supabase.from('households').select('name').eq('id', householdId).maybeSingle(),
        supabase
          .from('subscriptions')
          .select('plan')
          .eq('household_id', householdId)
          .eq('status', 'active')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('household_members')
          .select('user_id, users(name, email)')
          .eq('household_id', householdId)
          .eq('status', 'active'),
      ])

      const members: DashboardMember[] =
        memberRows?.map((row: any) => ({
          id: row.user_id,
          name: row.users?.name ?? row.users?.email?.split('@')[0] ?? 'Miembro',
        })) ?? [currentMember]

      const resolvedCurrentUserName =
        members.find(member => member.id === user.id)?.name ?? user.email?.split('@')[0] ?? 'Usuario'

      return {
        currentUserId: user.id,
        currentUserName: resolvedCurrentUserName,
        householdId,
        householdName: household?.name ?? CURRENT_HOUSEHOLD_NAME,
        plan: (subscription?.plan ?? CURRENT_PLAN) as SubscriptionPlan,
        members,
      }
    } catch {
      return {
        currentUserId: CURRENT_USER_ID,
        currentUserName: DEFAULT_MEMBER.name,
        householdId: null,
        householdName: CURRENT_HOUSEHOLD_NAME,
        plan: CURRENT_PLAN,
        members: [DEFAULT_MEMBER],
      }
    }
  })()

  try {
    const resolved = await contextPromise
    contextCache = { value: resolved, expiresAt: Date.now() + CONTEXT_CACHE_TTL_MS }
    return resolved
  } finally {
    contextPromise = null
  }
}

export function invalidateDashboardContextCache() {
  contextCache = null
}

export function getCurrentDate(): Date {
  return getNow()
}

export function getCurrentUser(): DashboardMember {
  return getMockCurrentUser()
}

export function getMembers(): DashboardMember[] {
  return [DEFAULT_MEMBER]
}

export function getMyTodayTasks(): DashboardTaskExecution[] {
  return []
}

export function markMyTaskAsCompleted(taskExecutionId: string): DashboardTaskExecution[] {
  return getMyTodayTasks()
}

export function getMyMonthTasks(monthOffset: number, userId?: string): DashboardTaskExecution[] {
  return getMockMonthTasks(monthOffset, userId ?? CURRENT_USER_ID)
}

export function getHouseholdTodaySummary() {
  return getMockHouseholdTodaySummary()
}

export function getHouseholdMonthSummary(monthOffset: number) {
  return getMockHouseholdMonthSummary(monthOffset)
}

export function getMonthKey(offset: number): string {
  return monthOffsetToKey(offset)
}

export function isCurrentMonth(offset: number): boolean {
  return monthOffsetToKey(offset) === monthOffsetToKey(0)
}

export async function getCurrentPlanAsync(): Promise<SubscriptionPlan> {
  const context = await resolveContext()
  return context.plan
}

export async function getCurrentUserAsync(): Promise<DashboardMember> {
  const context = await resolveContext()
  return { id: context.currentUserId, name: context.currentUserName }
}

export async function getHouseholdNameAsync(): Promise<string> {
  const context = await resolveContext()
  return context.householdName
}

export async function getMyTodayTasksAsync(): Promise<DashboardTaskExecution[]> {
  const context = await resolveContext()
  const today = formatDateKey(getNow())

  if (!context.householdId) {
    return getMyTodayTasks()
  }

  const { data, error } = await supabase
    .from('task_executions')
    .select('id, assigned_to, scheduled_date, scheduled_time, status, tasks(name)')
    .eq('assigned_to', context.currentUserId)
    .eq('scheduled_date', today)
    .order('scheduled_time', { ascending: true })

  if (error || !data) {
    return getMyTodayTasks()
  }

  return normalizeTaskRows(data)
}

export async function markTaskAsCompletedAsync(taskExecutionId: string): Promise<DashboardTaskExecution[]> {
  const completedAt = new Date().toISOString()

  const { error } = await supabase
    .from('task_executions')
    .update({ status: 'completed', completed_at: completedAt })
    .eq('id', taskExecutionId)

  if (error) {
    return markMyTaskAsCompleted(taskExecutionId)
  }

  return getMyTodayTasksAsync()
}

export async function getMonthTasksAsync(monthOffset: number, userId?: string): Promise<DashboardTaskExecution[]> {
  const context = await resolveContext()
  const targetUserId = userId ?? context.currentUserId

  if (!context.householdId) {
    return getMockMonthTasks(monthOffset, targetUserId)
  }

  const { start, end } = dateRangeFromMonthOffset(monthOffset)

  const { data, error } = await supabase
    .from('task_executions')
    .select('id, assigned_to, scheduled_date, scheduled_time, status, tasks(name)')
    .eq('assigned_to', targetUserId)
    .gte('scheduled_date', start)
    .lte('scheduled_date', end)
    .order('scheduled_date', { ascending: true })

  if (error || !data) {
    return getMockMonthTasks(monthOffset, targetUserId)
  }

  return normalizeTaskRows(data)
}

export async function getHouseholdTodaySummaryAsync() {
  const context = await resolveContext()
  const today = formatDateKey(getNow())

  if (!context.householdId) {
    return getHouseholdTodaySummary()
  }

  const memberIds = context.members.map(member => member.id)
  if (memberIds.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('task_executions')
    .select('id, assigned_to, scheduled_date, scheduled_time, status, tasks(name)')
    .in('assigned_to', memberIds)
    .eq('scheduled_date', today)

  if (error || !data) {
    return getHouseholdTodaySummary()
  }

  const tasks = normalizeTaskRows(data)

  return context.members.map(member => {
    const memberTasks = tasks.filter(task => task.assignedTo === member.id)
    const completed = memberTasks.filter(task => task.status === 'completed').length

    return {
      member,
      assigned: memberTasks.length,
      completed,
      tasks: memberTasks,
    }
  })
}

export async function getHouseholdMonthSummaryAsync(monthOffset: number) {
  const context = await resolveContext()

  if (!context.householdId) {
    return getHouseholdMonthSummary(monthOffset)
  }

  const memberIds = context.members.map(member => member.id)
  if (memberIds.length === 0) {
    return getHouseholdMonthSummary(monthOffset)
  }

  const { start, end } = dateRangeFromMonthOffset(monthOffset)
  const monthKey = monthOffsetToKey(monthOffset)

  const { data, error } = await supabase
    .from('task_executions')
    .select('id, assigned_to, scheduled_date, scheduled_time, status, tasks(name)')
    .in('assigned_to', memberIds)
    .gte('scheduled_date', start)
    .lte('scheduled_date', end)

  if (error || !data) {
    return getHouseholdMonthSummary(monthOffset)
  }

  const tasks = normalizeTaskRows(data)

  const byMember = context.members.map(member => {
    const memberTasks = tasks.filter(task => task.assignedTo === member.id)
    const assigned = memberTasks.length
    const completed = memberTasks.filter(task => task.status === 'completed').length

    return {
      member,
      assigned,
      completed,
      completionRate: assigned === 0 ? 0 : Math.round((completed / assigned) * 100),
    }
  })

  const totalAssigned = byMember.reduce((acc, item) => acc + item.assigned, 0)
  const totalCompleted = byMember.reduce((acc, item) => acc + item.completed, 0)

  return {
    monthKey,
    byMember,
    totalAssigned,
    totalCompleted,
    completionRate: totalAssigned === 0 ? 0 : Math.round((totalCompleted / totalAssigned) * 100),
  }
}
