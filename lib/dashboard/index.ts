import { supabase } from '../supabase'
import { TaskExecutionStatus, SubscriptionPlan, TaskFrequency } from '../../types'
import { firstNameOnly, nameFromEmail } from '../user-name'

export interface DashboardTaskExecution {
  id: string
  taskName: string
  frequency: TaskFrequency
  assignedTo: string
  scheduledDate: string
  scheduledTime: string
  status: TaskExecutionStatus
}

export interface DashboardMember {
  id: string
  name: string
}

export interface HouseholdMonthTaskItem {
  id: string
  taskName: string
  frequency: TaskFrequency
  assignedTo: string
  assignedToName: string
  scheduledDate: string
  scheduledTime: string
  status: TaskExecutionStatus
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

function getPlanPriority(plan: SubscriptionPlan): number {
  if (plan === 'familia') return 3
  if (plan === 'hogar') return 2
  return 1
}

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
  const today = formatDateKey(getNow())

  return rows.map(row => ({
    // Tasks remain completable for the whole scheduled day even if another process marked them missed early.
    status:
      row.status === 'missed' && String(row.scheduled_date) === today
        ? 'pending'
        : row.status === 'pending' && String(row.scheduled_date) < today
          ? 'missed'
          : row.status,
    id: row.id,
    assignedTo: row.assigned_to,
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
    frequency: row.tasks?.frequency === 'weekly' || row.tasks?.frequency === 'monthly' ? row.tasks.frequency : 'daily',
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

function getMockHouseholdMonthTasks(): HouseholdMonthTaskItem[] {
  return []
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

      const currentUserName = firstNameOnly(user.user_metadata?.name ?? nameFromEmail(user.email), 'Usuario')
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

      const [{ data: household }, { data: memberRows }, { data: effectivePlan }] = await Promise.all([
        supabase.from('households').select('name').eq('id', householdId).maybeSingle(),
        supabase
          .from('household_members')
          .select('user_id, users(name, email)')
          .eq('household_id', householdId)
          .eq('status', 'active'),
        supabase.rpc('get_effective_household_plan', { p_household_id: householdId }),
      ])

      const members: DashboardMember[] =
        memberRows?.map((row: any) => ({
          id: row.user_id,
          name: firstNameOnly(row.users?.name ?? nameFromEmail(row.users?.email), 'Miembro'),
        })) ?? [currentMember]

      const resolvedCurrentUserName =
        members.find(member => member.id === user.id)?.name ?? firstNameOnly(nameFromEmail(user.email), 'Usuario')

      return {
        currentUserId: user.id,
        currentUserName: resolvedCurrentUserName,
        householdId,
        householdName: household?.name ?? CURRENT_HOUSEHOLD_NAME,
        plan: (effectivePlan ?? CURRENT_PLAN) as SubscriptionPlan,
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

export function getHouseholdTomorrowSummary() {
  return []
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

export async function getCurrentOwnedPlanAsync(): Promise<SubscriptionPlan> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return CURRENT_PLAN
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan, expires_at')
    .eq('owner_user_id', user.id)
    .eq('status', 'active')

  if (error || !data?.length) {
    return CURRENT_PLAN
  }

  const now = getNow().getTime()

  const bestPlan = data
    .filter(row => !row.expires_at || new Date(row.expires_at).getTime() > now)
    .reduce<SubscriptionPlan>((currentBest, row) => {
      const nextPlan = (row.plan ?? CURRENT_PLAN) as SubscriptionPlan
      return getPlanPriority(nextPlan) > getPlanPriority(currentBest) ? nextPlan : currentBest
    }, CURRENT_PLAN)

  return bestPlan
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
    .select('id, assigned_to, scheduled_date, scheduled_time, status, tasks!inner(name, frequency, is_active, deleted_at)')
    .eq('assigned_to', context.currentUserId)
    .eq('scheduled_date', today)
    .eq('tasks.is_active', true)
    .is('tasks.deleted_at', null)
    .order('scheduled_time', { ascending: true })

  if (error || !data) {
    return []
  }

  return normalizeTaskRows(data)
}

export async function getMyTomorrowTasksAsync(): Promise<DashboardTaskExecution[]> {
  const context = await resolveContext()
  const tomorrow = new Date(getNow())
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowKey = formatDateKey(tomorrow)

  if (!context.householdId) {
    return []
  }

  const { data, error } = await supabase
    .from('task_executions')
    .select('id, assigned_to, scheduled_date, scheduled_time, status, tasks!inner(name, frequency, is_active, deleted_at)')
    .eq('assigned_to', context.currentUserId)
    .eq('scheduled_date', tomorrowKey)
    .eq('tasks.is_active', true)
    .is('tasks.deleted_at', null)
    .order('scheduled_time', { ascending: true })

  if (error || !data) {
    return []
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
    throw new Error(error.message)
  }

  return getMyTodayTasksAsync()
}

export async function getMonthTasksAsync(monthOffset: number, userId?: string): Promise<DashboardTaskExecution[]> {
  const context = await resolveContext()
  const targetUserId = userId ?? context.currentUserId

  if (!context.householdId) {
    return []
  }

  const { start, end } = dateRangeFromMonthOffset(monthOffset)

  const { data, error } = await supabase
    .from('task_executions')
    .select('id, assigned_to, scheduled_date, scheduled_time, status, tasks!inner(name, frequency, is_active, deleted_at)')
    .eq('assigned_to', targetUserId)
    .gte('scheduled_date', start)
    .lte('scheduled_date', end)
    .eq('tasks.is_active', true)
    .is('tasks.deleted_at', null)
    .order('scheduled_date', { ascending: true })

  if (error || !data) {
    return []
  }

  return normalizeTaskRows(data)
}

export async function getHouseholdTodaySummaryAsync() {
  const context = await resolveContext()
  const today = formatDateKey(getNow())
  return getHouseholdSummaryByDateKeyAsync(context, today, getHouseholdTodaySummary())
}

export async function getHouseholdTomorrowSummaryAsync() {
  const context = await resolveContext()
  const tomorrow = new Date(getNow())
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowKey = formatDateKey(tomorrow)
  return getHouseholdSummaryByDateKeyAsync(context, tomorrowKey, getHouseholdTomorrowSummary())
}

async function getHouseholdSummaryByDateKeyAsync(
  context: DashboardContext,
  scheduledDate: string,
  fallback: Array<{ member: DashboardMember; assigned: number; completed: number; tasks: DashboardTaskExecution[] }>
) {

  if (!context.householdId) {
    return fallback
  }

  const memberIds = context.members.map(member => member.id)
  if (memberIds.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('task_executions')
    .select('id, assigned_to, scheduled_date, scheduled_time, status, tasks!inner(name, frequency, is_active, deleted_at)')
    .in('assigned_to', memberIds)
    .eq('scheduled_date', scheduledDate)
    .eq('tasks.is_active', true)
    .is('tasks.deleted_at', null)
    .order('scheduled_time', { ascending: true })

  if (error || !data) {
    return fallback
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
    .select('id, assigned_to, scheduled_date, scheduled_time, status, tasks!inner(name, frequency, is_active, deleted_at)')
    .in('assigned_to', memberIds)
    .gte('scheduled_date', start)
    .lte('scheduled_date', end)
    .eq('tasks.is_active', true)
    .is('tasks.deleted_at', null)

  if (error || !data) {
    return {
      monthKey,
      byMember: context.members.map(member => ({
        member,
        assigned: 0,
        completed: 0,
        completionRate: 0,
      })),
      totalAssigned: 0,
      totalCompleted: 0,
      completionRate: 0,
    }
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

export async function getHouseholdMonthTasksAsync(monthOffset: number): Promise<HouseholdMonthTaskItem[]> {
  const context = await resolveContext()

  if (!context.householdId) {
    return []
  }

  const memberIds = context.members.map(member => member.id)
  if (memberIds.length === 0) {
    return []
  }

  const { start, end } = dateRangeFromMonthOffset(monthOffset)

  const { data, error } = await supabase
    .from('task_executions')
    .select('id, assigned_to, scheduled_date, scheduled_time, status, tasks!inner(name, frequency, is_active, deleted_at)')
    .in('assigned_to', memberIds)
    .gte('scheduled_date', start)
    .lte('scheduled_date', end)
    .eq('tasks.is_active', true)
    .is('tasks.deleted_at', null)
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true })

  if (error || !data) {
    return []
  }

  const memberNameById = new Map(context.members.map(member => [member.id, member.name]))
  const tasks = normalizeTaskRows(data)

  return tasks.map(task => ({
    id: task.id,
    taskName: task.taskName,
    frequency: task.frequency,
    assignedTo: task.assignedTo,
    assignedToName: memberNameById.get(task.assignedTo) ?? 'Miembro',
    scheduledDate: task.scheduledDate,
    scheduledTime: task.scheduledTime,
    status: task.status,
  }))
}

export interface PlanGuardStatus {
  overCapacity: boolean
  effectivePlan: SubscriptionPlan
  maxMembers: number
  activeMembers: number
  membersToRemove: number
  graceEndsAt: string | null
  membersPreview: Array<{ user_id: string; name: string }>
}

export async function getPlanGuardStatusAsync(): Promise<PlanGuardStatus | null> {
  const context = await resolveContext()
  if (!context.householdId) return null

  const { data: household } = await supabase
    .from('households')
    .select('admin_user_id')
    .eq('id', context.householdId)
    .maybeSingle()

  if (!household || household.admin_user_id !== context.currentUserId) return null

  const { data: guardData } = await supabase.rpc('get_household_plan_guard_status', {
    p_household_id: context.householdId,
  })

  if (!guardData || (guardData as any).over_capacity !== true) return null

  const rawMembers = Array.isArray((guardData as any).members_preview)
    ? (guardData as any).members_preview
    : []

  return {
    overCapacity: true,
    effectivePlan: ((guardData as any).effective_plan ?? 'free') as SubscriptionPlan,
    maxMembers: Number((guardData as any).max_members ?? 2),
    activeMembers: Number((guardData as any).active_members ?? 0),
    membersToRemove: Number((guardData as any).members_to_remove ?? 0),
    graceEndsAt: typeof (guardData as any).grace_ends_at === 'string'
      ? (guardData as any).grace_ends_at
      : null,
    membersPreview: rawMembers
      .map((row: any) => ({
        user_id: String(row.user_id ?? ''),
        name: firstNameOnly(String(row.name ?? ''), 'Miembro'),
      }))
      .filter((row: any) => row.user_id),
  }
}
