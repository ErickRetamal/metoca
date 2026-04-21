import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { BorderRadius, Colors, ShadowPresets, Spacing } from '../../../constants/theme'
import { CollapsibleCard } from '../../../components/ui/collapsible-card'
import { Skeleton } from '../../../components/ui/skeleton'
import { getHouseholdMonthTasksAsync, getMonthKey } from '../../../lib/dashboard'
import { TaskExecutionStatus, TaskFrequency } from '../../../types'

interface HouseholdTaskDetailRow {
  id: string
  assignedToName: string
  scheduledDate: string
  scheduledTime: string
  status: TaskExecutionStatus
  taskName: string
  frequency: TaskFrequency
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

function getStatusSymbol(status: TaskExecutionStatus): string {
  if (status === 'completed') return '✓'
  if (status === 'missed') return '✗'
  return '○'
}

function getStatusColor(status: TaskExecutionStatus): string {
  if (status === 'completed') return Colors.success
  if (status === 'missed') return Colors.danger
  return Colors.warning
}

function formatFrequencyLabel(frequency: TaskFrequency): string {
  if (frequency === 'daily') return 'Diaria'
  if (frequency === 'weekly') return 'Semanal'
  return 'Mensual'
}

export default function HouseholdTaskMonthDetailScreen() {
  const params = useLocalSearchParams<{
    monthOffset?: string
    taskName?: string
    frequency?: string
  }>()

  const monthOffset = Number.parseInt(params.monthOffset ?? '0', 10) || 0
  const taskName = typeof params.taskName === 'string' ? params.taskName : ''
  const frequency =
    params.frequency === 'weekly' || params.frequency === 'monthly' ? params.frequency : 'daily'

  const [executions, setExecutions] = useState<HouseholdTaskDetailRow[]>([])
  const [loading, setLoading] = useState(true)
  const monthLabel = useMemo(() => formatMonthLabel(getMonthKey(monthOffset)), [monthOffset])

  useEffect(() => {
    let mounted = true

    async function loadDetail() {
      if (mounted) setLoading(true)
      try {
        const rows = await getHouseholdMonthTasksAsync(monthOffset)
        const filtered = rows
          .filter(row => row.taskName === taskName && row.frequency === frequency)
          .sort((a, b) => {
            const byDate = a.scheduledDate.localeCompare(b.scheduledDate)
            if (byDate !== 0) return byDate
            return a.scheduledTime.localeCompare(b.scheduledTime)
          })

        if (!mounted) return
        setExecutions(
          filtered.map(row => ({
            id: row.id,
            assignedToName: row.assignedToName,
            scheduledDate: row.scheduledDate,
            scheduledTime: row.scheduledTime,
            status: row.status,
            taskName: row.taskName,
            frequency: row.frequency,
          }))
        )
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadDetail()

    return () => {
      mounted = false
    }
  }, [monthOffset, taskName, frequency])

  const completed = executions.filter(item => item.status === 'completed').length
  const missed = executions.filter(item => item.status === 'missed').length
  const pending = executions.filter(item => item.status === 'pending').length

  if (loading) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.headerCard}>
            <Skeleton width={120} height={14} style={{ marginBottom: Spacing.sm }} />
            <Skeleton width={230} height={30} style={{ marginBottom: Spacing.sm }} />
            <Skeleton width={260} height={14} style={{ marginBottom: Spacing.md }} />
            <View style={styles.kpiRow}>
              <Skeleton width="24%" height={56} />
              <Skeleton width="24%" height={56} />
              <Skeleton width="24%" height={56} />
              <Skeleton width="24%" height={56} />
            </View>
          </View>

          <View style={styles.listCard}>
            <Skeleton width={190} height={20} style={{ marginBottom: Spacing.md }} />
            <Skeleton width="100%" height={48} style={{ marginBottom: Spacing.sm }} />
            <Skeleton width="100%" height={48} style={{ marginBottom: Spacing.sm }} />
            <Skeleton width="100%" height={48} />
          </View>
        </ScrollView>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <Text style={styles.eyebrow}>Detalle de tarea</Text>
          <Text style={styles.title}>{taskName || 'Tarea'}</Text>
          <Text style={styles.subtitle}>{formatFrequencyLabel(frequency)} · Hogar · {monthLabel}</Text>

          <View style={styles.kpiRow}>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiValue}>{executions.length}</Text>
              <Text style={styles.kpiLabel}>Total</Text>
            </View>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiValue}>{completed}</Text>
              <Text style={styles.kpiLabel}>Completadas</Text>
            </View>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiValue}>{pending}</Text>
              <Text style={styles.kpiLabel}>Pendientes</Text>
            </View>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiValue}>{missed}</Text>
              <Text style={styles.kpiLabel}>Vencidas</Text>
            </View>
          </View>
        </View>

        <View style={styles.listCard}>
          <CollapsibleCard
            title="Ejecuciones del hogar"
            subtitle="Historial distribuido por miembro en el mes seleccionado."
          >
            {executions.length === 0 ? (
              <Text style={styles.emptyText}>No hay ejecuciones para esta tarea en este mes.</Text>
            ) : (
              executions.map(execution => (
                <View key={execution.id} style={styles.row}>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(execution.status) }]} />
                  <Text style={styles.status}>{getStatusSymbol(execution.status)}</Text>
                  <Text style={styles.memberName}>{execution.assignedToName}</Text>
                  <Text style={styles.day}>{formatDayLabel(execution.scheduledDate)}</Text>
                  <Text style={styles.time}>{execution.scheduledTime.slice(0, 5)}</Text>
                </View>
              ))
            )}
          </CollapsibleCard>
        </View>

        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Volver a tareas del hogar</Text>
        </Pressable>
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
  headerCard: {
    backgroundColor: '#2E1A11',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#8F5B3E',
    padding: Spacing.lg,
    gap: Spacing.xs,
    ...ShadowPresets.card,
  },
  eyebrow: {
    color: '#F4DCC3',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFF8F1',
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: '#E8D9C8',
    fontSize: 13,
    textTransform: 'capitalize',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  kpiItem: {
    flex: 1,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(244, 220, 195, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(244, 220, 195, 0.24)',
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  kpiValue: {
    color: '#FFF8F1',
    fontSize: 16,
    fontWeight: '800',
  },
  kpiLabel: {
    color: '#F4DCC3',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  listCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
    ...ShadowPresets.soft,
  },
  sectionTitle: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  emptyText: {
    color: Colors.text.secondary,
    fontSize: 14,
    paddingVertical: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: '#EADFCC',
    borderRadius: BorderRadius.md,
    backgroundColor: '#FFFFFF',
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: BorderRadius.full,
  },
  status: {
    width: 16,
    textAlign: 'center',
    color: Colors.text.primary,
    fontWeight: '800',
  },
  memberName: {
    width: 92,
    color: Colors.text.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  day: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: 13,
    textTransform: 'capitalize',
  },
  time: {
    color: Colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  backButton: {
    borderWidth: 1,
    borderColor: '#E6C6A1',
    borderRadius: BorderRadius.md,
    backgroundColor: '#FFF1E4',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  backButtonText: {
    color: '#B45309',
    fontSize: 14,
    fontWeight: '700',
  },
})
