import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { BorderRadius, Colors, ShadowPresets, Spacing } from '../../../constants/theme'
import { Skeleton } from '../../../components/ui/skeleton'
import { getMonthKey, getMonthTasksAsync } from '../../../lib/dashboard'

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, month - 1, 1)
  return date.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
}

function formatDayLabel(dateText: string): string {
  const date = new Date(`${dateText}T00:00:00`)
  return date.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' })
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

function formatFrequencyLabel(frequency: string): string {
  if (frequency === 'daily') return 'Diaria'
  if (frequency === 'weekly') return 'Semanal'
  return 'Mensual'
}

export default function TaskMonthDetailScreen() {
  const params = useLocalSearchParams<{
    monthOffset?: string
    taskName?: string
    frequency?: string
    memberId?: string
    memberName?: string
  }>()

  const monthOffset = Number.parseInt(params.monthOffset ?? '0', 10) || 0
  const taskName = typeof params.taskName === 'string' ? params.taskName : ''
  const frequency = typeof params.frequency === 'string' ? params.frequency : 'daily'
  const memberId = typeof params.memberId === 'string' ? params.memberId : undefined
  const memberName = typeof params.memberName === 'string' ? params.memberName : undefined

  const [executions, setExecutions] = useState<Array<{
    id: string
    taskName: string
    scheduledDate: string
    scheduledTime: string
    status: 'pending' | 'completed' | 'missed'
    frequency: 'daily' | 'weekly' | 'monthly'
  }>>([])
  const [loading, setLoading] = useState(true)

  const monthLabel = useMemo(() => formatMonthLabel(getMonthKey(monthOffset)), [monthOffset])

  useEffect(() => {
    let mounted = true

    async function loadDetail() {
      if (mounted) setLoading(true)
      try {
        const rows = await getMonthTasksAsync(monthOffset, memberId)
        const filtered = rows
          .filter(row => row.taskName === taskName && row.frequency === frequency)
          .sort((a, b) => {
            const byDate = a.scheduledDate.localeCompare(b.scheduledDate)
            if (byDate !== 0) return byDate
            return a.scheduledTime.localeCompare(b.scheduledTime)
          })

        if (mounted) setExecutions(filtered)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadDetail()

    return () => {
      mounted = false
    }
  }, [monthOffset, memberId, taskName, frequency])

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
          <Text style={styles.subtitle}>{formatFrequencyLabel(frequency)} · {memberName ?? 'Mi mes'} · {monthLabel}</Text>

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
          <Text style={styles.sectionTitle}>Ejecuciones del mes</Text>
          {executions.length === 0 ? (
            <Text style={styles.emptyText}>No hay ejecuciones para esta tarea en este mes.</Text>
          ) : (
            executions.map(execution => (
              <View key={execution.id} style={styles.row}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(execution.status) }]} />
                <Text style={styles.status}>{getStatusSymbol(execution.status)}</Text>
                <Text style={styles.day}>{formatDayLabel(execution.scheduledDate)}</Text>
                <Text style={styles.time}>{execution.scheduledTime.slice(0, 5)}</Text>
              </View>
            ))
          )}
        </View>

        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Volver a tareas del mes</Text>
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
    backgroundColor: '#0F172A',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#1E3A8A',
    padding: Spacing.lg,
    gap: Spacing.xs,
    ...ShadowPresets.card,
  },
  eyebrow: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: '#CBD5E1',
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
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.26)',
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  kpiValue: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  kpiLabel: {
    color: '#BFDBFE',
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
    borderColor: '#E8EEF8',
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
    borderColor: '#DBEAFE',
    borderRadius: BorderRadius.md,
    backgroundColor: '#F8FAFF',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  backButtonText: {
    color: '#1D4ED8',
    fontSize: 14,
    fontWeight: '700',
  },
})
