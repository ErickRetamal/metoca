import { useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { router } from 'expo-router'
import { Colors, Spacing, BorderRadius, ShadowPresets } from '../../../constants/theme'
import { Reveal } from '../../../components/ui/reveal'
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
  getMyTodayTasks,
  getMyTodayTasksAsync,
  getMyTomorrowTasksAsync,
  markTaskAsCompletedAsync,
  DashboardTaskExecution,
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

export default function TodayScreen() {
  const [tasks, setTasks] = useState(getMyTodayTasks())
  const [tomorrowTasks, setTomorrowTasks] = useState<DashboardTaskExecution[]>([])
  const [currentPlan, setCurrentPlan] = useState(CURRENT_PLAN)
  const [currentUserName, setCurrentUserName] = useState(getCurrentUser().name)
  const [taskActionFeedback, setTaskActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
  const { onMenuPress } = useMenuContext()

  const formattedDate = useMemo(() => formatLongDate(getCurrentDate()), [])

  useEffect(() => {
    let mounted = true

    async function loadToday() {
      const [plan, user, todayTasks, tomorrowTasksData] = await Promise.all([
        getCurrentPlanAsync(),
        getCurrentUserAsync(),
        getMyTodayTasksAsync(),
        getMyTomorrowTasksAsync(),
      ])

      if (!mounted) return
      setCurrentPlan(plan)
      setCurrentUserName(user.name)
      setTasks(todayTasks)
      setTomorrowTasks(tomorrowTasksData)
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
        getMyTodayTasksAsync().then(setTasks)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const completedCount = tasks.filter(task => task.status === 'completed').length
  const progress = tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100)

  const handleTaskPress = async (taskId: string, status: 'pending' | 'completed' | 'missed', taskName: string) => {
    if (status !== 'pending' || completingTaskId) return

    setTaskActionFeedback(null)
    setCompletingTaskId(taskId)

    try {
      const next = await markTaskAsCompletedAsync(taskId)
      setTasks(next)

      const updatedTask = next.find(task => task.id === taskId)
      if (updatedTask?.status === 'completed') {
        setTaskActionFeedback({ type: 'success', message: `OK: "${taskName}" marcada como completada.` })
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
            <Text style={styles.eyebrow}>Tu ritmo de hoy</Text>
          </View>
          <View style={styles.headerTopRow}>
            <Text style={styles.greeting}>Hola, {currentUserName}</Text>
            <View style={styles.headerActions}>
              <Pressable style={styles.planPill} onPress={() => goToPaywall('today-plan-pill')}>
                <Text style={styles.planPillText}>{currentPlan === 'free' ? 'Plan Free' : 'Plan Premium'}</Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.date}>{formattedDate}</Text>

          <View style={styles.metricsRow}>
            <View>
              <Text style={styles.counter}>{tasks.length} tareas hoy</Text>
              <Text style={styles.progress}>{completedCount}/{tasks.length} completadas</Text>
            </View>
            <View style={styles.progressBadge}>
              <Text style={styles.progressBadgeText}>{progress}%</Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>

          <View style={styles.quickStatsRow}>
            <View style={[styles.quickStatChip, styles.quickStatChipAssigned]}>
              <Text style={styles.quickStatValue}>{tasks.length}</Text>
              <Text style={styles.quickStatLabel}>Asignadas</Text>
            </View>
            <View style={[styles.quickStatChip, styles.quickStatChipCompleted]}>
              <Text style={styles.quickStatValue}>{completedCount}</Text>
              <Text style={styles.quickStatLabel}>Listas</Text>
            </View>
            <View style={[styles.quickStatChip, styles.quickStatChipPending]}>
              <Text style={styles.quickStatValue}>{Math.max(tasks.length - completedCount, 0)}</Text>
              <Text style={styles.quickStatLabel}>Pendientes</Text>
            </View>
          </View>
        </View>
        </Reveal>

        <Reveal delay={90}>
        <View style={styles.listCard}>
          <Text style={styles.sectionTitle}>Agenda del dia</Text>

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
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(task.status) }]} />

                <View style={styles.taskNameContainer}>
                  <Text style={styles.taskName}>{task.taskName}</Text>
                  <Text style={styles.taskStatusLabel}>{getStatusLabel(task.status)}</Text>
                </View>

                <View style={styles.rightMeta}>
                  <Text style={[styles.status, { color: getStatusColor(task.status) }]}>{getStatusSymbol(task.status)}</Text>
                  <Text style={styles.taskTime}>{task.scheduledTime}</Text>
                </View>

                {task.status === 'pending' && (
                  <Pressable
                    style={[styles.completeButton, completingTaskId === task.id && styles.completeButtonDisabled]}
                    onPress={() => handleTaskPress(task.id, task.status, task.taskName)}
                    disabled={completingTaskId === task.id}
                  >
                    <Text style={styles.completeButtonText}>{completingTaskId === task.id ? 'Guardando...' : 'Realizada'}</Text>
                  </Pressable>
                )}
              </View>
            ))
          )}
        </View>
        </Reveal>

        {tomorrowTasks.length > 0 && (
          <Reveal delay={200}>
            <View style={styles.tomorrowCard}>
              <Text style={styles.tomorrowTitle}>Mañana</Text>
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

        <Reveal delay={240}>
          <TouchableOpacity
            style={styles.swapButton}
            onPress={() => router.push('/(app)/swap/request')}
          >
            <Text style={styles.swapButtonEyebrow}>Flexibilidad</Text>
            <Text style={styles.swapButtonText}>Solicitar intercambio</Text>
          </TouchableOpacity>
        </Reveal>
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
    textTransform: 'uppercase',
    letterSpacing: 0.7,
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
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  counter: {
    color: '#FFF7EF',
    fontSize: 19,
    fontWeight: '700',
  },
  progress: {
    color: '#EED8C3',
    fontSize: 13,
  },
  progressBadge: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F7E3CF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#D9A576',
  },
  progressBadgeText: {
    color: '#8A4C1B',
    fontSize: 18,
    fontWeight: '800',
  },
  progressTrack: {
    marginTop: Spacing.xs,
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 235, 217, 0.35)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#D68B45',
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
    fontSize: 17,
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
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: '#EEDFCF',
    borderRadius: BorderRadius.md,
    backgroundColor: '#FFFFFF',
  },
  taskRowCompleted: {
    backgroundColor: '#FFFAF5',
    borderColor: '#E6D2BF',
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
    width: 10,
    height: 10,
    borderRadius: BorderRadius.full,
  },
  rightMeta: {
    alignItems: 'flex-end',
    gap: 2,
    minWidth: 54,
  },
  status: {
    fontSize: 15,
    width: 20,
    textAlign: 'center',
    fontWeight: '800',
  },
  taskNameContainer: {
    flex: 1,
    gap: 2,
  },
  taskName: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  taskStatusLabel: {
    color: Colors.text.secondary,
    fontSize: 12,
  },
  taskTime: {
    color: Colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
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
})
