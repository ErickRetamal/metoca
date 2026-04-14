import { useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { BorderRadius, Colors, ShadowPresets, Spacing } from '../../../constants/theme'
import { Reveal } from '../../../components/ui/reveal'
import { HamburgerButton } from '../../../components/dashboard/side-menu'
import { useMenuContext } from '../../../lib/menu-context'
import { supabase } from '../../../lib/supabase'
import { goToPaywall } from '../../../lib/navigation'
import {
  CURRENT_PLAN,
  getCurrentPlanAsync,
  getHouseholdMonthSummary,
  getHouseholdMonthSummaryAsync,
  getHouseholdMonthTasksAsync,
  getHouseholdNameAsync,
} from '../../../lib/dashboard'

interface HouseholdMonthTaskView {
  id: string
  taskName: string
  frequency: 'daily' | 'weekly' | 'monthly'
  assignedToName: string
  scheduledDate: string
  scheduledTime: string
  status: 'pending' | 'completed' | 'missed'
}

function formatFrequencyLabel(frequency: 'daily' | 'weekly' | 'monthly'): string {
  if (frequency === 'daily') return 'Diaria'
  if (frequency === 'weekly') return 'Semanal'
  return 'Mensual'
}

export default function HouseholdMonthScreen() {
  const insets = useSafeAreaInsets()
  const [monthOffset, setMonthOffset] = useState(0)
  const [householdName, setHouseholdName] = useState('')
  const [plan, setPlan] = useState(CURRENT_PLAN)
  const [summary, setSummary] = useState(getHouseholdMonthSummary(0))
  const [monthTasks, setMonthTasks] = useState<HouseholdMonthTaskView[]>([])
  const { onMenuPress } = useMenuContext()

  const taskGroups = useMemo(() => {
    const grouped = new Map<string, {
      key: string
      taskName: string
      frequency: 'daily' | 'weekly' | 'monthly'
      total: number
      completed: number
      pending: number
      missed: number
    }>()

    for (const task of monthTasks) {
      const key = `${task.taskName}::${task.frequency}`
      const current = grouped.get(key) ?? {
        key,
        taskName: task.taskName,
        frequency: task.frequency,
        total: 0,
        completed: 0,
        pending: 0,
        missed: 0,
      }

      current.total += 1
      if (task.status === 'completed') current.completed += 1
      if (task.status === 'pending') current.pending += 1
      if (task.status === 'missed') current.missed += 1
      grouped.set(key, current)
    }

    return Array.from(grouped.values()).sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total
      return a.taskName.localeCompare(b.taskName)
    })
  }, [monthTasks])

  useEffect(() => {
    let mounted = true

    async function loadHeader() {
      const [nextPlan, nextHouseholdName] = await Promise.all([
        getCurrentPlanAsync(),
        getHouseholdNameAsync(),
      ])

      if (!mounted) return
      setPlan(nextPlan)
      setHouseholdName(nextHouseholdName)
    }

    loadHeader()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true

    async function loadSummary() {
      const [nextSummary, nextMonthTasks] = await Promise.all([
        getHouseholdMonthSummaryAsync(monthOffset),
        getHouseholdMonthTasksAsync(monthOffset),
      ])
      if (!mounted) return
      setSummary(nextSummary)
      setMonthTasks(nextMonthTasks)
    }

    loadSummary()

    return () => {
      mounted = false
    }
  }, [monthOffset])

  useEffect(() => {
    const channel = supabase
      .channel('household-month-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_executions' }, () => {
        getHouseholdMonthSummaryAsync(monthOffset).then(setSummary)
        getHouseholdMonthTasksAsync(monthOffset).then(setMonthTasks)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_reports' }, () => {
        getHouseholdMonthSummaryAsync(monthOffset).then(setSummary)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [monthOffset])

  const canNavigateHistory = plan !== 'free'

  const handleMoveMonth = (direction: -1 | 1) => {
    if (!canNavigateHistory) {
      Alert.alert(
        'Plan Gratis',
        'El historial mensual del hogar esta disponible en planes pagos.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Ver planes', onPress: () => goToPaywall('household-month-history-alert') },
        ]
      )
      return
    }
    setMonthOffset(prev => prev + direction)
  }

  const openMemberMonth = (memberId: string, memberName: string) => {
    router.push({
      pathname: '/(app)/(tabs)/my-month',
      params: { memberId, memberName },
    })
  }

  const openTaskDetail = (taskName: string, frequency: 'daily' | 'weekly' | 'monthly') => {
    router.push({
      pathname: '/(app)/(tabs)/household-task-month-detail',
      params: {
        monthOffset: String(monthOffset),
        taskName,
        frequency,
      },
    })
  }

  return (
    <View style={styles.container}>
      <View style={styles.bgShapeTop} />
      <View style={styles.bgShapeBottom} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        <Reveal>
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <HamburgerButton onPress={onMenuPress} />
            <Text style={styles.eyebrow}>Radar mensual</Text>
          </View>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{householdName || '...'} - {summary.monthKey}</Text>
          </View>
          <Text style={styles.subtitle}>Progreso general: {summary.completionRate}%</Text>
        </View>
        </Reveal>

        <Reveal delay={90}>
        <View style={styles.chartCard}>
          {summary.byMember.map((item, index) => {
            const maxBarHeight = 150
            const completionPct = item.assigned > 0 ? item.completed / item.assigned : 0
            const assignedHeight = maxBarHeight
            const completedHeight = Math.max(4, Math.round(maxBarHeight * completionPct))

            return (
              <Pressable
                key={item.member.id}
                style={styles.barGroup}
                onPress={() => openMemberMonth(item.member.id, item.member.name)}
              >
                <View style={styles.barsWrapper}>
                  <View style={[styles.assignedBar, { height: assignedHeight }]} />
                  <View
                    style={[
                      styles.completedBar,
                      { height: completedHeight, backgroundColor: Colors.members[index % Colors.members.length] },
                    ]}
                  />
                </View>
                <Text style={styles.memberLabel}>{item.member.name}</Text>
                <Text style={styles.memberScore}>{item.completed}/{item.assigned}</Text>
              </Pressable>
            )
          })}

          <View style={styles.legend}>
            <View style={styles.legendRow}>
              <View style={[styles.legendSwatch, { backgroundColor: Colors.text.secondary }]} />
              <Text style={styles.legendText}>Meta (100%)</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendSwatch, { backgroundColor: Colors.primary }]} />
              <Text style={styles.legendText}>Completadas (%)</Text>
            </View>
          </View>
        </View>
        </Reveal>

        <Reveal delay={120}>
        <View style={styles.listCard}>
          <Text style={styles.listTitle}>Tareas del hogar (resumen)</Text>
          {taskGroups.length === 0 ? (
            <Text style={styles.emptyText}>No hay tareas asignadas para este mes.</Text>
          ) : (
            <View style={styles.groupList}>
              {taskGroups.map(group => {
                const pct = group.total === 0 ? 0 : Math.round((group.completed / group.total) * 100)
                return (
                  <Pressable key={group.key} style={styles.groupRow} onPress={() => openTaskDetail(group.taskName, group.frequency)}>
                    <View style={styles.groupMain}>
                      <Text style={styles.groupTaskName}>{group.taskName}</Text>
                      <Text style={styles.groupMeta}>
                        {formatFrequencyLabel(group.frequency)} · {group.completed}/{group.total} completadas · {pct}%
                      </Text>
                      <View style={styles.groupStatusRow}>
                        <View style={[styles.statusChip, styles.statusChipPending]}>
                          <Text style={styles.statusChipTextPending}>Pend {group.pending}</Text>
                        </View>
                        <View style={[styles.statusChip, styles.statusChipDone]}>
                          <Text style={styles.statusChipTextDone}>Comp {group.completed}</Text>
                        </View>
                        <View style={[styles.statusChip, styles.statusChipMissed]}>
                          <Text style={styles.statusChipTextMissed}>Venc {group.missed}</Text>
                        </View>
                      </View>
                    </View>
                    <Text style={styles.groupDetailCta}>Abrir detalle</Text>
                  </Pressable>
                )
              })}
            </View>
          )}
        </View>
        </Reveal>

        <Reveal delay={160}>
        <View style={styles.monthNav}>
          <Pressable
            style={[styles.navButton, !canNavigateHistory && styles.navButtonDisabled]}
            onPress={() => handleMoveMonth(-1)}
          >
            <Text style={styles.navText}>{'< Anterior'}</Text>
          </Pressable>
          <Text style={styles.navCenter}>Mes {summary.monthKey}</Text>
          <Pressable
            style={[styles.navButton, !canNavigateHistory && styles.navButtonDisabled]}
            onPress={() => handleMoveMonth(1)}
          >
            <Text style={styles.navText}>{'Siguiente >'}</Text>
          </Pressable>
        </View>
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
    paddingBottom: Spacing.xxl,
  },
  bgShapeTop: {
    position: 'absolute',
    top: -72,
    right: -82,
    width: 240,
    height: 240,
    borderRadius: BorderRadius.full,
    backgroundColor: '#FFEDD5',
  },
  bgShapeBottom: {
    position: 'absolute',
    bottom: 85,
    left: -86,
    width: 250,
    height: 250,
    borderRadius: BorderRadius.full,
    backgroundColor: '#DBEAFE',
  },
  headerCard: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
    ...ShadowPresets.card,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  eyebrow: {
    color: '#FDBA74',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  titleRow: {
    alignItems: 'flex-start',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '600',
  },
  chartCard: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    minHeight: 230,
    ...ShadowPresets.soft,
  },
  barGroup: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  barsWrapper: {
    width: 42,
    height: 150,
    justifyContent: 'flex-end',
    alignItems: 'center',
    position: 'relative',
  },
  assignedBar: {
    width: 22,
    borderRadius: BorderRadius.md,
    backgroundColor: '#D1D5DB',
    position: 'absolute',
    bottom: 0,
  },
  completedBar: {
    width: 14,
    borderRadius: BorderRadius.md,
    position: 'absolute',
    bottom: 0,
  },
  memberLabel: {
    color: Colors.text.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  memberScore: {
    color: Colors.text.secondary,
    fontSize: 11,
  },
  legend: {
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: BorderRadius.sm,
  },
  legendText: {
    color: Colors.text.secondary,
    fontSize: 13,
  },
  listCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
    ...ShadowPresets.soft,
  },
  listTitle: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyText: {
    color: Colors.text.secondary,
    fontSize: 13,
    paddingVertical: Spacing.sm,
  },
  groupList: {
    gap: Spacing.xs,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: BorderRadius.md,
    backgroundColor: '#F8FAFF',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  groupMain: {
    flex: 1,
    gap: 2,
  },
  groupTaskName: {
    color: Colors.text.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  groupMeta: {
    color: Colors.text.secondary,
    fontSize: 11,
  },
  groupStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 2,
  },
  statusChip: {
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  statusChipPending: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  statusChipDone: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  statusChipMissed: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  statusChipTextPending: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '700',
  },
  statusChipTextDone: {
    color: '#166534',
    fontSize: 11,
    fontWeight: '700',
  },
  statusChipTextMissed: {
    color: '#991B1B',
    fontSize: 11,
    fontWeight: '700',
  },
  groupDetailCta: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '700',
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  navButton: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    ...ShadowPresets.soft,
  },
  navButtonDisabled: {
    opacity: 0.45,
  },
  navText: {
    color: Colors.text.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  navCenter: {
    flex: 1,
    textAlign: 'center',
    color: Colors.text.secondary,
    fontSize: 13,
    fontWeight: '700',
  },
})
