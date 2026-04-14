import { useEffect, useMemo, useState } from 'react'
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { BorderRadius, Colors, Spacing } from '../../../constants/theme'
import { supabase } from '../../../lib/supabase'
import { goToPaywall } from '../../../lib/navigation'
import {
  CURRENT_PLAN,
  getCurrentUserAsync,
  getCurrentPlanAsync,
  getMonthKey,
  getMonthTasksAsync,
  getMyMonthTasks,
  isCurrentMonth,
} from '../../../lib/dashboard'

interface HistoryStat {
  offset: number
  label: string
  completion: number
  total: number
}

const CARD_SHADOW_STYLE = Platform.select({
  web: {
    boxShadow: '0px 6px 16px rgba(17, 24, 39, 0.06)',
  },
  default: {
    shadowColor: '#111827',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
})

const LIGHT_CARD_SHADOW_STYLE = Platform.select({
  web: {
    boxShadow: '0px 4px 12px rgba(17, 24, 39, 0.05)',
  },
  default: {
    shadowColor: '#111827',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
})

const DARK_CARD_SHADOW_STYLE = Platform.select({
  web: {
    boxShadow: '0px 8px 16px rgba(2, 6, 23, 0.3)',
  },
  default: {
    shadowColor: '#020617',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
})

function getStatusSymbol(status: 'pending' | 'completed' | 'missed'): string {
  if (status === 'completed') return '✓'
  if (status === 'missed') return '✗'
  return '○'
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, month - 1, 1)
  return date.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
}

function formatDayLabel(dateText: string): string {
  const date = new Date(`${dateText}T00:00:00`)
  return date.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' })
}

function getStatusColor(status: 'pending' | 'completed' | 'missed'): string {
  if (status === 'completed') return Colors.success
  if (status === 'missed') return Colors.danger
  return Colors.warning
}

function formatFrequencyLabel(frequency: 'daily' | 'weekly' | 'monthly'): string {
  if (frequency === 'daily') return 'Diaria'
  if (frequency === 'weekly') return 'Semanal'
  return 'Mensual'
}

function computeStreak(tasks: Array<{ status: 'pending' | 'completed' | 'missed'; scheduledDate: string }>): number {
  if (tasks.length === 0) return 0

  const dayMap = new Map<string, { completed: number; total: number }>()

  for (const task of tasks) {
    const current = dayMap.get(task.scheduledDate) ?? { completed: 0, total: 0 }
    current.total += 1
    if (task.status === 'completed') current.completed += 1
    dayMap.set(task.scheduledDate, current)
  }

  const sortedDays = Array.from(dayMap.keys()).sort().reverse()
  let streak = 0

  for (const day of sortedDays) {
    const summary = dayMap.get(day)
    if (!summary || summary.total === 0) continue
    if (summary.completed === 0) break
    streak += 1
  }

  return streak
}

export default function MyMonthScreen() {
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ memberId?: string, memberName?: string }>()
  const [monthOffset, setMonthOffset] = useState(0)
  const [plan, setPlan] = useState(CURRENT_PLAN)
  const [tasks, setTasks] = useState(getMyMonthTasks(0, params.memberId))
  const [currentUserName, setCurrentUserName] = useState('')
  const [historyStats, setHistoryStats] = useState<HistoryStat[]>([])

  const monthKey = useMemo(() => getMonthKey(monthOffset), [monthOffset])
  const monthLabel = useMemo(() => formatMonthLabel(monthKey), [monthKey])
  const memberId = typeof params.memberId === 'string' ? params.memberId : undefined
  const memberName = typeof params.memberName === 'string' ? params.memberName : undefined

  useEffect(() => {
    let mounted = true

    getCurrentPlanAsync().then(nextPlan => {
      if (mounted) setPlan(nextPlan)
    })

    getCurrentUserAsync().then(user => {
      if (mounted) setCurrentUserName(user.name)
    })

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true

    async function loadMonthTasks() {
      const nextTasks = await getMonthTasksAsync(monthOffset, memberId)
      if (mounted) setTasks(nextTasks)
    }

    loadMonthTasks()

    return () => {
      mounted = false
    }
  }, [monthOffset, memberId])

  useEffect(() => {
    const channel = supabase
      .channel('my-month-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_executions' }, () => {
        getMonthTasksAsync(monthOffset, memberId).then(setTasks)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [monthOffset, memberId])

  const completed = tasks.filter(task => task.status === 'completed').length
  const pending = tasks.filter(task => task.status === 'pending').length
  const missed = tasks.filter(task => task.status === 'missed').length
  const progress = tasks.length === 0 ? 0 : Math.round((completed / tasks.length) * 100)
  const pendingRate = tasks.length === 0 ? 0 : Math.round((pending / tasks.length) * 100)
  const missedRate = tasks.length === 0 ? 0 : Math.round((missed / tasks.length) * 100)
  const consistency = tasks.length === 0 ? 0 : Math.round(((tasks.length - missed) / tasks.length) * 100)
  const streak = useMemo(() => computeStreak(tasks), [tasks])
  const previousMonthCompletion = historyStats[0]?.completion ?? 0
  const completionDelta = progress - previousMonthCompletion

  const taskGroups = useMemo(() => {
    const grouped = new Map<string, {
      key: string
      taskName: string
      frequency: 'daily' | 'weekly' | 'monthly'
      total: number
      completed: number
      pending: number
      missed: number
      executions: typeof tasks
    }>()

    for (const task of tasks) {
      const frequency = task.frequency ?? 'daily'
      const key = `${task.taskName}::${frequency}`
      const current = grouped.get(key) ?? {
        key,
        taskName: task.taskName,
        frequency,
        total: 0,
        completed: 0,
        pending: 0,
        missed: 0,
        executions: [],
      }

      current.total += 1
      if (task.status === 'completed') current.completed += 1
      if (task.status === 'pending') current.pending += 1
      if (task.status === 'missed') current.missed += 1
      current.executions.push(task)

      grouped.set(key, current)
    }

    return Array.from(grouped.values())
      .map(group => ({
        ...group,
        executions: [...group.executions].sort((a, b) => {
          const byDate = a.scheduledDate.localeCompare(b.scheduledDate)
          if (byDate !== 0) return byDate
          return a.scheduledTime.localeCompare(b.scheduledTime)
        }),
      }))
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total
        return a.taskName.localeCompare(b.taskName)
      })
  }, [tasks])

  const canNavigateHistory = plan !== 'free'

  useEffect(() => {
    let mounted = true

    if (!canNavigateHistory) {
      setHistoryStats([])
      return () => {
        mounted = false
      }
    }

    async function loadHistoryStats() {
      const offsets = [-1, -2, -3]
      const rows = await Promise.all(
        offsets.map(async delta => {
          const targetOffset = monthOffset + delta
          const monthTasks = await getMonthTasksAsync(targetOffset, memberId)
          const total = monthTasks.length
          const done = monthTasks.filter(task => task.status === 'completed').length

          return {
            offset: targetOffset,
            label: formatMonthLabel(getMonthKey(targetOffset)),
            completion: total === 0 ? 0 : Math.round((done / total) * 100),
            total,
          }
        })
      )

      if (mounted) {
        setHistoryStats(rows)
      }
    }

    loadHistoryStats()

    return () => {
      mounted = false
    }
  }, [canNavigateHistory, monthOffset, memberId])

  const openTaskDetail = (taskName: string, frequency: 'daily' | 'weekly' | 'monthly') => {
    router.push({
      pathname: '/(app)/(tabs)/task-month-detail',
      params: {
        monthOffset: String(monthOffset),
        taskName,
        frequency,
        ...(memberId ? { memberId } : {}),
        ...(memberName ? { memberName } : {}),
      },
    })
  }

  const moveMonth = (direction: -1 | 1) => {
    if (!canNavigateHistory && direction !== 0) {
      Alert.alert(
        'Plan Gratis',
        'El historial de meses anteriores esta disponible en planes Hogar y Familia.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Ver planes', onPress: () => goToPaywall('my-month-history-alert') },
        ]
      )
      return
    }

    setMonthOffset(prev => prev + direction)
  }

  return (
    <View style={styles.container}>
      <View style={styles.bgShapeTop} />
      <View style={styles.bgShapeBottom} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.eyebrow}>Resumen mensual</Text>
              <Text style={styles.title}>{memberName ?? currentUserName}</Text>
            </View>

            <View style={styles.headerActions}>
              <View style={styles.progressBadge}>
                <Text style={styles.progressBadgeValue}>{progress}%</Text>
              </View>
            </View>
          </View>

          <Text style={styles.month}>{monthLabel}</Text>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.progressText}>{completed} de {tasks.length} tareas completadas</Text>
            <Pressable style={styles.historyPill} onPress={() => goToPaywall('my-month-history-pill')}>
              <Text style={styles.historyPillText}>{canNavigateHistory ? 'Historial activo' : 'Historial bloqueado'}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.fitnessCard}>
          <View style={styles.fitnessHeaderRow}>
            <Text style={styles.fitnessTitle}>Indicadores del mes</Text>
            <Text style={styles.fitnessSubtitle}>{monthLabel}</Text>
          </View>

          <View style={styles.ringsRow}>
            <View style={styles.ringItem}>
              <View style={[styles.ringOuter, { borderColor: '#1D4ED8' }]}>
                <View style={styles.ringInner}>
                  <Text style={styles.ringValue}>{progress}%</Text>
                </View>
              </View>
              <Text style={styles.ringLabel}>Cumplidas</Text>
            </View>

            <View style={styles.ringItem}>
              <View style={[styles.ringOuter, { borderColor: '#16A34A' }]}>
                <View style={styles.ringInner}>
                  <Text style={styles.ringValue}>{consistency}%</Text>
                </View>
              </View>
              <Text style={styles.ringLabel}>Consistencia</Text>
            </View>

            <View style={styles.ringItem}>
              <View style={[styles.ringOuter, { borderColor: '#DC2626' }]}>
                <View style={styles.ringInner}>
                  <Text style={styles.ringValue}>{missedRate}%</Text>
                </View>
              </View>
              <Text style={styles.ringLabel}>Vencidas</Text>
            </View>
          </View>

          <View style={styles.kpiRow}>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiLabel}>Racha actual</Text>
              <Text style={styles.kpiValue}>{streak} dias</Text>
            </View>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiLabel}>Pendientes</Text>
              <Text style={styles.kpiValue}>{pendingRate}%</Text>
            </View>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiLabel}>Vs mes anterior</Text>
              <Text style={[styles.kpiValue, completionDelta >= 0 ? styles.kpiPositive : styles.kpiNegative]}>
                {completionDelta >= 0 ? '+' : ''}{completionDelta}%
              </Text>
            </View>
          </View>

          {canNavigateHistory ? (
            <View style={styles.historyList}>
              <Text style={styles.historyTitle}>Meses anteriores</Text>
              {historyStats.map(item => (
                <View key={item.offset} style={styles.historyRow}>
                  <View style={styles.historyRowHeader}>
                    <Text style={styles.historyMonth}>{item.label}</Text>
                    <Text style={styles.historyPct}>{item.completion}%</Text>
                  </View>
                  <View style={styles.historyBarTrack}>
                    <View style={[styles.historyBarFill, { width: `${item.completion}%` }]} />
                  </View>
                  <Text style={styles.historyMeta}>{item.total} tareas en total</Text>
                </View>
              ))}
            </View>
          ) : (
            <Pressable style={styles.lockedHistoryCard} onPress={() => goToPaywall('my-month-locked-card')}>
              <Text style={styles.lockedHistoryTitle}>Activa plan Hogar o Familia</Text>
              <Text style={styles.lockedHistoryText}>Desbloquea comparativa de meses anteriores y tendencias.</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.listCard}>
          <Text style={styles.sectionTitle}>Tareas del mes (resumen)</Text>

          {taskGroups.length === 0 ? (
            <Text style={styles.emptyText}>No hay tareas para este mes.</Text>
          ) : (
            <View style={styles.groupList}>
              {taskGroups.map(group => {
                const completionPct = group.total === 0 ? 0 : Math.round((group.completed / group.total) * 100)
                return (
                  <Pressable
                    key={group.key}
                    style={styles.groupRow}
                    onPress={() => openTaskDetail(group.taskName, group.frequency)}
                  >
                    <View style={styles.groupMain}>
                      <Text style={styles.groupTaskName}>{group.taskName}</Text>
                      <Text style={styles.groupMeta}>
                        {formatFrequencyLabel(group.frequency)} · {group.completed}/{group.total} completadas · {completionPct}%
                      </Text>
                    </View>
                    <Text style={styles.groupDetailCta}>Abrir detalle</Text>
                  </Pressable>
                )
              })}
            </View>
          )}
        </View>

        <View style={styles.monthNav}>
          <Pressable
            style={[styles.navButton, !canNavigateHistory && styles.navButtonDisabled]}
            onPress={() => moveMonth(-1)}
          >
            <Text style={styles.navText}>Anterior</Text>
          </Pressable>

          <Text style={styles.navCenterLabel}>{isCurrentMonth(monthOffset) ? 'Mes actual' : monthLabel}</Text>

          <Pressable
            style={[styles.navButton, !canNavigateHistory && styles.navButtonDisabled]}
            onPress={() => moveMonth(1)}
          >
            <Text style={styles.navText}>Siguiente</Text>
          </Pressable>
        </View>
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
    paddingBottom: Spacing.xxl,
  },
  bgShapeTop: {
    position: 'absolute',
    top: -65,
    left: -75,
    width: 220,
    height: 220,
    borderRadius: BorderRadius.full,
    backgroundColor: '#DBEAFE',
  },
  bgShapeBottom: {
    position: 'absolute',
    bottom: 70,
    right: -85,
    width: 260,
    height: 260,
    borderRadius: BorderRadius.full,
    backgroundColor: '#E0E7FF',
  },
  headerCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...CARD_SHADOW_STYLE,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerActions: {
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: Colors.text.secondary,
    marginBottom: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  progressBadge: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.full,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBadgeValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  month: {
    textTransform: 'capitalize',
    color: Colors.text.secondary,
    fontSize: 14,
  },
  summaryRow: {
    marginTop: Spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  historyPill: {
    borderRadius: BorderRadius.full,
    backgroundColor: '#F9E9D9',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
  },
  historyPillText: {
    color: '#8A4C1B',
    fontSize: 11,
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  listCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...LIGHT_CARD_SHADOW_STYLE,
  },
  fitnessCard: {
    backgroundColor: '#4A2F1E',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#8A5A3B',
    padding: Spacing.md,
    gap: Spacing.md,
    ...DARK_CARD_SHADOW_STYLE,
  },
  fitnessHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fitnessTitle: {
    color: '#FFF7EF',
    fontSize: 16,
    fontWeight: '800',
  },
  fitnessSubtitle: {
    color: '#F2CFAE',
    fontSize: 12,
    textTransform: 'capitalize',
    fontWeight: '700',
  },
  ringsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  ringItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  ringOuter: {
    width: 76,
    height: 76,
    borderRadius: BorderRadius.full,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3F281A',
  },
  ringInner: {
    width: 54,
    height: 54,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5B3822',
  },
  ringValue: {
    color: '#FFF1E3',
    fontSize: 12,
    fontWeight: '800',
  },
  ringLabel: {
    color: '#F1D7BF',
    fontSize: 11,
    fontWeight: '700',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  kpiItem: {
    flex: 1,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#8A5A3B',
    backgroundColor: '#5B3822',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    gap: 2,
  },
  kpiLabel: {
    color: '#EAC9A8',
    fontSize: 11,
    fontWeight: '700',
  },
  kpiValue: {
    color: '#FFF7EF',
    fontSize: 14,
    fontWeight: '800',
  },
  kpiPositive: {
    color: '#22C55E',
  },
  kpiNegative: {
    color: '#F87171',
  },
  historyList: {
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#8A5A3B',
    paddingTop: Spacing.sm,
  },
  historyTitle: {
    color: '#FFF1E3',
    fontSize: 13,
    fontWeight: '700',
  },
  historyRow: {
    gap: 6,
  },
  historyRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyMonth: {
    color: '#F1D7BF',
    fontSize: 12,
    textTransform: 'capitalize',
    fontWeight: '600',
  },
  historyPct: {
    color: '#F2CFAE',
    fontSize: 12,
    fontWeight: '800',
  },
  historyBarTrack: {
    height: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: '#6B4730',
    overflow: 'hidden',
  },
  historyBarFill: {
    height: '100%',
    backgroundColor: '#D68B45',
  },
  historyMeta: {
    color: '#EAC9A8',
    fontSize: 11,
  },
  lockedHistoryCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#8A5A3B',
    backgroundColor: '#5B3822',
    padding: Spacing.sm,
    gap: 4,
  },
  lockedHistoryTitle: {
    color: '#FFF7EF',
    fontSize: 13,
    fontWeight: '700',
  },
  lockedHistoryText: {
    color: '#F1D7BF',
    fontSize: 12,
    lineHeight: 16,
  },
  sectionTitle: {
    color: Colors.text.primary,
    fontSize: 17,
    fontWeight: '700',
  },
  emptyText: {
    color: Colors.text.secondary,
    fontSize: 14,
    paddingVertical: Spacing.md,
  },
  groupList: {
    gap: Spacing.xs,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: '#E9D8C4',
    borderRadius: BorderRadius.md,
    backgroundColor: '#FFFAF5',
  },
  groupRowSelected: {
    borderColor: '#D9A576',
    backgroundColor: '#F9E9D9',
  },
  groupMain: {
    flex: 1,
    gap: 2,
  },
  groupTaskName: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  groupMeta: {
    color: Colors.text.secondary,
    fontSize: 12,
  },
  groupDetailCta: {
    color: '#8A4C1B',
    fontSize: 11,
    fontWeight: '700',
  },
  detailCard: {
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: '#E4C7A7',
    borderRadius: BorderRadius.md,
    backgroundColor: '#FFFAF5',
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  detailTitle: {
    color: Colors.text.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  detailMeta: {
    color: Colors.text.secondary,
    fontSize: 12,
    marginBottom: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: 6,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  detailDay: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: 12,
    textTransform: 'capitalize',
  },
  detailTime: {
    color: Colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: BorderRadius.md,
    backgroundColor: '#FBFDFF',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: BorderRadius.full,
  },
  status: {
    width: 16,
    textAlign: 'center',
    color: Colors.text.primary,
    fontWeight: '800',
  },
  taskName: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  day: {
    color: Colors.text.secondary,
    fontSize: 12,
    textTransform: 'capitalize',
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  navButton: {
    backgroundColor: '#8F5B3E',
    borderWidth: 1,
    borderColor: '#8F5B3E',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  navButtonDisabled: {
    opacity: 0.45,
  },
  navText: {
    color: Colors.text.inverse,
    fontSize: 13,
    fontWeight: '700',
  },
  navCenterLabel: {
    flex: 1,
    textAlign: 'center',
    color: Colors.text.primary,
    fontSize: 13,
    fontWeight: '600',
  },
})
