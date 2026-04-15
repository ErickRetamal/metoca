// Tipos centrales de MeToca
// Refleja exactamente el modelo de datos definido en la documentación

export type Platform = 'android' | 'ios'

export type HouseholdMemberStatus = 'invited' | 'active' | 'removed'

export type MemberProfile = 'adulto' | 'joven'

export type TaskFrequency = 'daily' | 'weekly' | 'monthly'

export type TaskAudience = 'todos' | 'solo_adultos' | 'solo_jovenes'

export type TaskExecutionStatus = 'pending' | 'completed' | 'missed'

export type SubscriptionPlan = 'free' | 'hogar' | 'familia'

export type SubscriptionStatus = 'active' | 'cancelled' | 'expired'

export type SubscriptionPlatform = 'apple' | 'google'

export type NotificationType =
  | 'task_reminder'
  | 'second_reminder'
  | 'assignment_published'
  | 'monthly_report'

export type NotificationStatus = 'sent' | 'delivered' | 'failed'

export type SwapScope = 'daily' | 'weekly' | 'monthly'

export type SwapStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled'

// ─── Entidades ────────────────────────────────────────────────────────────────

export interface User {
  id: string
  name: string
  first_name: string | null
  last_name: string | null
  gender: 'masculino' | 'femenino' | 'otro' | 'prefiero_no_decir' | null
  email: string
  phone: string | null
  push_token_fcm: string | null
  push_token_apns: string | null
  platform: Platform | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Household {
  id: string
  name: string
  admin_user_id: string
  invite_code: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface HouseholdMember {
  id: string
  household_id: string
  user_id: string
  status: HouseholdMemberStatus
  profile: MemberProfile
  joined_at: string | null
  created_at: string
}

export interface Task {
  id: string
  household_id: string
  name: string
  frequency: TaskFrequency
  audience: TaskAudience
  notification_time: string // HH:MM
  day_of_week: number | null // 0=Lun … 6=Dom
  day_of_month: number | null // 1–28
  is_active: boolean
  is_custom: boolean
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface TaskAssignment {
  id: string
  task_id: string
  household_id: string
  user_id: string
  month: string // YYYY-MM
  created_at: string
}

export interface TaskExecution {
  id: string
  task_assignment_id: string
  task_id: string
  assigned_to: string
  scheduled_date: string // YYYY-MM-DD
  scheduled_time: string // HH:MM
  status: TaskExecutionStatus
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface Subscription {
  id: string
  household_id: string
  owner_user_id: string | null
  plan: SubscriptionPlan
  max_members: number
  status: SubscriptionStatus
  platform: SubscriptionPlatform | null
  platform_subscription_id: string | null
  started_at: string
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface MonthlyReport {
  id: string
  household_id: string
  month: string // YYYY-MM
  total_tasks: number
  completed_tasks: number
  completion_rate: number // 0.00 – 100.00
  detail: Record<string, MemberReportDetail>
  generated_at: string
}

export interface MemberReportDetail {
  user_id: string
  name: string
  total: number
  completed: number
  missed: number
  rate: number
}

export interface NotificationLog {
  id: string
  user_id: string
  task_execution_id: string | null
  type: NotificationType
  status: NotificationStatus
  sent_at: string
}

export interface TaskSwap {
  id: string
  requester_id: string
  target_id: string
  requester_execution_id: string | null
  target_execution_id: string
  scope: SwapScope
  status: SwapStatus
  requested_at: string
  resolved_at: string | null
}

// ─── Vistas enriquecidas (joins para la UI) ────────────────────────────────────

export interface TaskExecutionWithTask extends TaskExecution {
  task: Task
}

export interface HouseholdMemberWithUser extends HouseholdMember {
  user: User
}

export interface TaskSwapWithDetails extends TaskSwap {
  requester: User
  target: User
  target_execution: TaskExecutionWithTask
}

// ─── Plan limits ──────────────────────────────────────────────────────────────

export const PLAN_MAX_MEMBERS: Record<SubscriptionPlan, number> = {
  free: 2,
  hogar: 5,
  familia: 10,
}
