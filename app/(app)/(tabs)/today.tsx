import { useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Colors, Spacing, BorderRadius, ShadowPresets } from '../../../constants/theme'
import { Reveal } from '../../../components/ui/reveal'
import { Skeleton } from '../../../components/ui/skeleton'
import { HamburgerButton } from '../../../components/dashboard/side-menu'
import { useMenuContext } from '../../../lib/menu-context'
import { supabase } from '../../../lib/supabase'
import { goToPaywall } from '../../../lib/navigation'
import {
  CURRENT_PLAN,
  getCurrentPlanAsync,
  getCurrentDate,
  getCurrentUser,
  getCurrentUserAsync,
  getHouseholdNameAsync,
  getHouseholdTodaySummary,
  getHouseholdTodaySummaryAsync,
  getHouseholdTomorrowSummaryAsync,
  getMyTodayTasks,
  getMyTodayTasksAsync,
  getMyTomorrowTasksAsync,
  markTaskAsCompletedAsync,
  getPlanGuardStatusAsync,
  DashboardTaskExecution,
  PlanGuardStatus,
} from '../../../lib/dashboard'

function formatLongDate(date: Date): string {
  return date.toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function getStatusSymbol(status: 'pending' | 'completed' | 'missed'): string {
  if (status === 'completed') return '✓'
  if (status === 'missed') return '✗'
  return '○'
}

function getStatusColor(status: 'pending' | 'completed' | 'missed'): string {
  if (status === 'completed') return Colors.success
  if (status === 'missed') return Colors.danger
  return Colors.warning
}

function getStatusLabel(status: 'pending' | 'completed' | 'missed'): string {
  if (status === 'completed') return 'Completada'
  if (status === 'missed') return 'Vencida'
  return 'Pendiente'
}

function shouldShowAlert(completed: number, assigned: number): boolean {
  const hour = getCurrentDate().getHours()
  return hour >= 17 && assigned > 0 && completed === 0
}

export default function TodayScreen() {
  const params = useLocalSearchParams<{ mode?: string }>()
  const initialViewMode = params.mode === 'household' ? 'household' : 'mine'
  const [tasks, setTasks] = useState(getMyTodayTasks())
  const [householdRows, setHouseholdRows] = useState<Awaited<ReturnType<typeof getHouseholdTodaySummaryAsync>>>(getHouseholdTodaySummary())
  const [householdTomorrowRows, setHouseholdTomorrowRows] = useState<Awaited<ReturnType<typeof getHouseholdTomorrowSummaryAsync>>>([])
  const [householdName, setHouseholdName] = useState('')
  const [tomorrowTasks, setTomorrowTasks] = useState<DashboardTaskExecution[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'mine' | 'household'>(initialViewMode)
  const [expandedHouseholdMemberId, setExpandedHouseholdMemberId] = useState<string | null>(null)
  const [currentPlan, setCurrentPlan] = useState(CURRENT_PLAN)
  const [currentUserName, setCurrentUserName] = useState(getCurrentUser().name)
  const [taskActionFeedback, setTaskActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
  const [planGuardNotice, setPlanGuardNotice] = useState<PlanGuardStatus | null>(null)
  const { onMenuPress } = useMenuContext()

  const formattedDate = useMemo(() => formatLongDate(getCurrentDate()), [])

  useEffect(() => {
    let mounted = true

    async function loadToday() {
      try {
        const [plan, user, todayTasks, tomorrowTasksData, guardStatus, summaryRows, summaryTomorrowRows, nextHouseholdName] = await Promise.all([
          getCurrentPlanAsync(),
          getCurrentUserAsync(),
          getMyTodayTasksAsync(),
          getMyTomorrowTasksAsync(),
          getPlanGuardStatusAsync(),
          getHouseholdTodaySummaryAsync(),
          getHouseholdTomorrowSummaryAsync(),
          getHouseholdNameAsync(),
        ])

        if (!mounted) return
        setCurrentPlan(plan)
        setCurrentUserName(user.name)
        setTasks(todayTasks)
        setHouseholdRows(summaryRows)
        setHouseholdTomorrowRows(summaryTomorrowRows)
        setHouseholdName(nextHouseholdName)
        setTomorrowTasks(tomorrowTasksData)
        setPlanGuardNotice(guardStatus)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadToday()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('today-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_executions' }, () => {
        Promise.all([
          getMyTodayTasksAsync(),
          getHouseholdTodaySummaryAsync(),
          getHouseholdTomorrowSummaryAsync(),
        ]).then(([nextTasks, summaryRows, summaryTomorrowRows]) => {
          setTasks(nextTasks)
          setHouseholdRows(summaryRows)
          setHouseholdTomorrowRows(summaryTomorrowRows)
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    if (!taskActionFeedback) return

    const timer = setTimeout(() => {
      setTaskActionFeedback(null)
    }, 3500)

    return () => clearTimeout(timer)
  }, [taskActionFeedback])

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.bgShapeTop} />
        <View style={styles.bgShapeBottom} />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.headerCard}>
            <Skeleton width={160} height={14} style={{ marginBottom: Spacing.sm }} />
            <Skeleton width="72%" height={36} style={{ marginBottom: Spacing.sm }} />
            <Skeleton width={150} height={14} style={{ marginBottom: Spacing.md }} />
            <Skeleton width="55%" height={30} style={{ marginBottom: Spacing.xs }} />
            <Skeleton width={120} height={16} style={{ marginBottom: Spacing.md }} />
            <Skeleton width="100%" height={8} borderRadius={BorderRadius.full} />
          </View>

          <View style={styles.listCard}>
            <Skeleton width={170} height={28} style={{ marginBottom: Spacing.md }} />
            <Skeleton width="100%" height={74} style={{ marginBottom: Spacing.sm }} />
            <Skeleton width="100%" height={74} style={{ marginBottom: Spacing.sm }} />
            <Skeleton width="100%" height={74} />
          </View>
        </ScrollView>
      </View>
    )
  }

  const completedCount = tasks.filter(task => task.status === 'completed').length
  const pendingCount = Math.max(tasks.length - completedCount, 0)
  const totalAssigned = householdRows.reduce((acc, row) => acc + row.assigned, 0)
  const totalCompleted = householdRows.reduce((acc, row) => acc + row.completed, 0)
  const laggingCount = householdRows.filter(row => shouldShowAlert(row.completed, row.assigned)).length
  const householdTomorrowWithTasks = householdTomorrowRows.filter(row => row.assigned > 0)

  const handleTaskPress = async (taskId: string, status: 'pending' | 'completed' | 'missed', taskName: string) => {
    if (status !== 'pending' || completingTaskId) return

    setTaskActionFeedback(null)
    setCompletingTaskId(taskId)

    try {
      const next = await markTaskAsCompletedAsync(taskId)
      setTasks(next)

      const updatedTask = next.find(task => task.id === taskId)
      if (updatedTask?.status === 'completed') {
        setTaskActionFeedback({ type: 'success', message: `"${taskName}" marcada como completada.` })
      } else {
        setTaskActionFeedback({ type: 'error', message: 'No se pudo marcar la tarea. Reintenta.' })
      }
    } catch {
      setTaskActionFeedback({ type: 'error', message: 'Error inesperado al marcar la tarea.' })
    } finally {
      setCompletingTaskId(null)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.bgShapeTop} />
      <View style={styles.bgShapeBottom} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Reveal>
        <View style={styles.headerCard}>
          <View style={styles.headerMenuRow}>
            <HamburgerButton onPress={onMenuPress} />
            <Text style={styles.eyebrow}>{viewMode === 'mine' ? 'Tu ritmo de hoy' : 'Ritmo del hogar'}</Text>
          </View>
          <View style={styles.headerTopRow}>
            <Text style={styles.greeting}>{viewMode === 'mine' ? `Hola, ${currentUserName}` : `${householdName || 'Mi hogar'} · Hoy`}</Text>
            <View style={styles.headerActions}>
              <Pressable style={styles.planPill} onPress={() => goToPaywall('today-plan-pill')}>
                <Text style={styles.planPillText}>
                  {currentPlan === 'hogar' ? 'Plan Hogar' : currentPlan === 'familia' ? 'Plan Familia' : 'Plan Gratis'}
                </Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.date}>{formattedDate}</Text>

          <View style={styles.viewSwitchRow}>
            <Pressable
              style={[styles.viewSwitchChip, viewMode === 'mine' && styles.viewSwitchChipActive]}
              onPress={() => setViewMode('mine')}
            >
              <Text style={[styles.viewSwitchText, viewMode === 'mine' && styles.viewSwitchTextActive]}>Mi día</Text>
            </Pressable>
            <Pressable
              style={[styles.viewSwitchChip, viewMode === 'household' && styles.viewSwitchChipActive]}
              onPress={() => setViewMode('household')}
            >
              <Text style={[styles.viewSwitchText, viewMode === 'household' && styles.viewSwitchTextActive]}>Hogar</Text>
            </Pressable>
          </View>

          <View style={styles.quickStatsRow}>
            {viewMode === 'mine' ? (
              <>
                <View style={[styles.quickStatChip, styles.quickStatChipAssigned]}>
                  <Text style={styles.quickStatValue}>{tasks.length}</Text>
                  <Text style={styles.quickStatLabel}>Asignadas</Text>
                </View>
                <View style={[styles.quickStatChip, styles.quickStatChipCompleted]}>
                  <Text style={styles.quickStatValue}>{completedCount}</Text>
                  <Text style={styles.quickStatLabel}>Listas</Text>
                </View>
                <View style={[styles.quickStatChip, styles.quickStatChipPending]}>
                  <Text style={styles.quickStatValue}>{pendingCount}</Text>
                  <Text style={styles.quickStatLabel}>Pendientes</Text>
                </View>
              </>
            ) : (
              <>
                <View style={[styles.quickStatChip, styles.quickStatChipAssigned]}>
                  <Text style={styles.quickStatValue}>{householdRows.length}</Text>
                  <Text style={styles.quickStatLabel}>Miembros</Text>
                </View>
                <View style={[styles.quickStatChip, styles.quickStatChipCompleted]}>
                  <Text style={styles.quickStatValue}>{totalCompleted}/{totalAssigned}</Text>
                  <Text style={styles.quickStatLabel}>Completadas</Text>
                </View>
                <View style={[styles.quickStatChip, styles.quickStatChipPending]}>
                  <Text style={styles.quickStatValue}>{laggingCount}</Text>
                  <Text style={styles.quickStatLabel}>En riesgo</Text>
                </View>
              </>
            )}
          </View>
        </View>
        </Reveal>

        {planGuardNotice?.overCapacity && (
          <Reveal delay={60}>
            <View style={styles.guardBanner}>
              <Text style={styles.guardBannerTitle}>Cambio de plan detectado</Text>
              <Text style={styles.guardBannerText}>
                Tu hogar tiene {planGuardNotice.activeMembers} miembros pero el plan actual permite {planGuardNotice.maxMembers}.
                {planGuardNotice.graceEndsAt
                  ? ` Tienes hasta el ${new Date(planGuardNotice.graceEndsAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })} para actualizar.`
                  : ''}
              </Text>
              <Pressable style={styles.guardBannerButton} onPress={() => goToPaywall('today-plan-guard-banner')}>
                <Text style={styles.guardBannerButtonText}>Actualizar plan</Text>
              </Pressable>
            </View>
          </Reveal>
        )}

        <Reveal delay={90}>
        <View style={styles.listCard}>
          {viewMode === 'mine' ? (
            <>
              <Text style={styles.sectionTitle}>{`${currentUserName.toUpperCase()} - DIA`}</Text>

              {taskActionFeedback && (
                <View style={[
                  styles.feedbackBox,
                  taskActionFeedback.type === 'success' ? styles.feedbackSuccessBox : styles.feedbackErrorBox,
                ]}>
                  <Text style={[
                    styles.feedbackText,
                    taskActionFeedback.type === 'success' ? styles.feedbackSuccessText : styles.feedbackErrorText,
                  ]}>{taskActionFeedback.message}</Text>
                </View>
              )}

              {tasks.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <Text style={styles.emptyStateIcon}>📭</Text>
                  <Text style={styles.emptyStateTitle}>Sin tareas hoy</Text>
                  <Text style={styles.emptyStateText}>¡Impresionante! No tienes tareas asignadas para hoy.</Text>
                  <Text style={styles.emptyStateSubtext}>Usa "Solicitar intercambio" si necesitas tomar una tarea de otro miembro.</Text>
                </View>
              ) : (
                tasks.map(task => (
                  <View
                    key={task.id}
                    style={[styles.taskRow, task.status === 'completed' && styles.taskRowCompleted]}
                  >
                    <View style={styles.taskRowContent}>
                      <View style={[styles.statusDot, { backgroundColor: getStatusColor(task.status) }]} />
                      <View style={styles.taskNameContainer}>
                        <Text style={styles.taskName}>{task.taskName}</Text>
                        <Text style={styles.taskStatusLabel}>{getStatusLabel(task.status)}</Text>
                      </View>
                    </View>

                    <View style={styles.taskRowActions}>
                      <Text style={styles.taskTime}>{task.scheduledTime}</Text>

                      {task.status === 'pending' ? (
                        <Pressable
                          style={[styles.completeButton, completingTaskId === task.id && styles.completeButtonDisabled]}
                          onPress={() => handleTaskPress(task.id, task.status, task.taskName)}
                          disabled={completingTaskId === task.id}
                        >
                          <Text style={styles.completeButtonText}>{completingTaskId === task.id ? 'Guardando...' : 'Realizada'}</Text>
                        </Pressable>
                      ) : (
                        <Text style={[styles.status, { color: getStatusColor(task.status) }]}>{getStatusSymbol(task.status)}</Text>
                      )}
                    </View>
                  </View>
                ))
              )}
            </>
          ) : (
            <>
              <Text style={styles.sectionTitle}>HOGAR - DIA</Text>
              {householdRows.length === 0 ? (
                <Text style={styles.emptyText}>No hay tareas asignadas para tu hogar hoy.</Text>
              ) : (
                householdRows.map(row => {
                  const rowProgress = row.assigned === 0 ? 0 : Math.round((row.completed / row.assigned) * 100)
                  const isExpanded = expandedHouseholdMemberId === row.member.id
                  const alert = shouldShowAlert(row.completed, row.assigned)

                  return (
                    <View key={row.member.id} style={styles.memberBlock}>
                      <Pressable
                        style={[styles.memberHeader, isExpanded && styles.memberHeaderExpanded]}
                        onPress={() => setExpandedHouseholdMemberId(prev => (prev === row.member.id ? null : row.member.id))}
                      >
                        <View style={styles.memberIdentity}>
                          <View style={styles.memberAvatar}><Text style={styles.memberAvatarText}>{row.member.name.charAt(0).toUpperCase()}</Text></View>
                          <View style={styles.memberMeta}>
                            <Text style={styles.memberName}>{row.member.name}</Text>
                            <Text style={styles.memberRatio}>{row.completed}/{row.assigned} completadas</Text>
                          </View>
                        </View>
                        <View style={styles.memberBarTrack}>
                          <View style={[styles.memberBarFill, { width: `${rowProgress}%` }]} />
                        </View>
                        {alert && <Text style={styles.memberAlert}>⚠</Text>}
                      </Pressable>

                      {isExpanded && (
                        <View style={styles.memberTasks}>
                          {row.tasks.map(task => (
                            <View key={task.id} style={styles.memberTaskRow}>
                              <Text style={styles.memberTaskName}>{task.taskName}</Text>
                              <Text style={styles.memberTaskStatus}>{getStatusLabel(task.status)}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )
                })
              )}
            </>
          )}
        </View>
        </Reveal>

        {viewMode === 'mine' && tomorrowTasks.length > 0 && (
          <Reveal delay={200}>
            <View style={styles.tomorrowCard}>
              <Text style={styles.tomorrowTitle}>{`${currentUserName.toUpperCase()} - MAÑANA`}</Text>
              {tomorrowTasks.map(task => (
                <View key={task.id} style={styles.tomorrowRow}>
                  <View style={styles.tomorrowDot} />
                  <View style={styles.tomorrowTaskInfo}>
                    <Text style={styles.tomorrowTaskName}>{task.taskName}</Text>
                    <Text style={styles.tomorrowTaskMeta}>{task.scheduledTime}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Reveal>
        )}

        {viewMode === 'household' && (
          <Reveal delay={200}>
            <View style={styles.tomorrowCard}>
              <Text style={styles.tomorrowTitle}>HOGAR - MAÑANA</Text>
              {householdTomorrowWithTasks.length === 0 ? (
                <Text style={styles.emptyText}>No hay tareas del hogar para mañana.</Text>
              ) : (
                householdTomorrowWithTasks.map(row => (
                  <View key={row.member.id} style={styles.tomorrowRow}>
                    <View style={styles.tomorrowDot} />
                    <View style={styles.tomorrowTaskInfo}>
                      <Text style={styles.tomorrowTaskName}>{row.member.name}</Text>
                      <Text style={styles.tomorrowTaskMeta}>{row.assigned} tarea{row.assigned === 1 ? '' : 's'}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </Reveal>
        )}

        {viewMode === 'mine' && (
        <Reveal delay={240}>
          <TouchableOpacity
            style={styles.swapButton}
            onPress={() => router.push('/(app)/swap/request')}
          >
            <Text style={styles.swapButtonEyebrow}>Flexibilidad</Text>
            <Text style={styles.swapButtonText}>Solicitar intercambio</Text>
          </TouchableOpacity>
        </Reveal>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: 120,
  },
  tomorrowCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.xs,
    ...ShadowPresets.soft,
  },
  tomorrowTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  tomorrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tomorrowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.muted,
  },
  tomorrowTaskInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tomorrowTaskName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  tomorrowTaskMeta: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  bgShapeTop: {
    position: 'absolute',
    top: -70,
    right: -55,
    width: 220,
    height: 220,
    borderRadius: BorderRadius.full,
    backgroundColor: '#FFE8D2',
  },
  bgShapeBottom: {
    position: 'absolute',
    bottom: 95,
    left: -80,
    width: 240,
    height: 240,
    borderRadius: BorderRadius.full,
    backgroundColor: '#FBE4CC',
  },
  headerCard: {
    backgroundColor: '#4A2F1E',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#8A5A3B',
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...ShadowPresets.card,
  },
  headerMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  eyebrow: {
    color: '#F4D3B2',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  greeting: {
    color: '#FFF7EF',
    fontSize: 24,
    fontWeight: '800',
  },
  planPill: {
    backgroundColor: 'rgba(244, 211, 178, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(244, 211, 178, 0.4)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
  },
  planPillText: {
    color: '#FFF2E6',
    fontSize: 12,
    fontWeight: '700',
  },
  date: {
    color: '#E9C4A0',
    fontSize: 14,
    textTransform: 'capitalize',
  },
  viewSwitchRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  viewSwitchChip: {
    flex: 1,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(244, 211, 178, 0.35)',
    backgroundColor: 'rgba(244, 211, 178, 0.08)',
    paddingVertical: 8,
    alignItems: 'center',
  },
  viewSwitchChipActive: {
    backgroundColor: 'rgba(214, 139, 69, 0.24)',
    borderColor: 'rgba(214, 139, 69, 0.5)',
  },
  viewSwitchText: {
    color: '#F4D3B2',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  viewSwitchTextActive: {
    color: '#FFF7EF',
  },
  quickStatsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  quickStatChip: {
    flex: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm + 2,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
    gap: 2,
  },
  quickStatChipAssigned: {
    backgroundColor: 'rgba(214, 139, 69, 0.15)',
    borderColor: 'rgba(214, 139, 69, 0.32)',
  },
  quickStatChipCompleted: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.25)',
  },
  quickStatChipPending: {
    backgroundColor: 'rgba(197, 123, 42, 0.16)',
    borderColor: 'rgba(197, 123, 42, 0.35)',
  },
  quickStatValue: {
    color: '#FFF7EF',
    fontSize: 18,
    fontWeight: '800',
  },
  quickStatLabel: {
    color: '#E9C4A0',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...ShadowPresets.soft,
  },
  sectionTitle: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg + Spacing.md,
    gap: Spacing.sm,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  emptyStateTitle: {
    color: Colors.text.primary,
    fontSize: 17,
    fontWeight: '700',
  },
  emptyStateText: {
    color: Colors.text.secondary,
    fontSize: 14,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    color: Colors.text.secondary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: Spacing.xs,
  },
  emptyText: {
    color: Colors.text.secondary,
    fontSize: 14,
    paddingVertical: Spacing.md,
  },
  memberBlock: {
    borderBottomWidth: 1,
    borderBottomColor: '#EFE2D0',
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.xs,
  },
  memberHeader: {
    gap: Spacing.sm,
    paddingVertical: 4,
  },
  memberHeaderExpanded: {
    opacity: 1,
  },
  memberIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F6E6D5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    color: '#8F5B3E',
    fontSize: 14,
    fontWeight: '800',
  },
  memberMeta: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  memberRatio: {
    color: Colors.text.secondary,
    fontSize: 12,
  },
  memberBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  memberBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  memberAlert: {
    color: Colors.warning,
    fontSize: 16,
  },
  memberTasks: {
    backgroundColor: '#FFF6EC',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: '#EADFCC',
  },
  memberTaskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  memberTaskName: {
    color: Colors.text.primary,
    fontSize: 13,
  },
  memberTaskStatus: {
    color: Colors.text.secondary,
    fontSize: 12,
    textTransform: 'capitalize',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  taskRowCompleted: {
    opacity: 0.82,
  },
  taskRowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minWidth: 0,
  },
  taskRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  completeButton: {
    borderWidth: 1,
    borderColor: '#D9A576',
    backgroundColor: '#F9E8D6',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  completeButtonText: {
    color: '#8A4C1B',
    fontSize: 11,
    fontWeight: '700',
  },
  completeButtonDisabled: {
    opacity: 0.6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
  },
  status: {
    fontSize: 15,
    width: 20,
    textAlign: 'center',
    fontWeight: '800',
  },
  taskNameContainer: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  taskName: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  taskStatusLabel: {
    color: Colors.text.secondary,
    fontSize: 11,
  },
  taskTime: {
    color: Colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
    minWidth: 58,
    textAlign: 'right',
  },
  feedbackBox: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  feedbackSuccessBox: {
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  feedbackErrorBox: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  feedbackText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  feedbackSuccessText: {
    color: '#065F46',
  },
  feedbackErrorText: {
    color: '#991B1B',
  },
  swapButton: {
    backgroundColor: '#8F5B3E',
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: '#D2A47A',
    gap: 2,
    ...ShadowPresets.primary,
  },
  swapButtonEyebrow: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  swapButtonText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  guardBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#FCD34D',
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  guardBannerTitle: {
    color: '#92400E',
    fontSize: 14,
    fontWeight: '800',
  },
  guardBannerText: {
    color: '#78350F',
    fontSize: 13,
    lineHeight: 19,
  },
  guardBannerButton: {
    marginTop: Spacing.xs,
    backgroundColor: '#D97706',
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignSelf: 'flex-start',
  },
  guardBannerButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
})
