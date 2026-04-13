import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { BorderRadius, Colors, ShadowPresets, Spacing } from '../../../constants/theme'
import { Reveal } from '../../../components/ui/reveal'
import { HamburgerButton } from '../../../components/dashboard/side-menu'
import { useMenuContext } from '../../../lib/menu-context'
import { supabase } from '../../../lib/supabase'
import {
  getCurrentDate,
  getHouseholdNameAsync,
  getHouseholdTodaySummary,
  getHouseholdTodaySummaryAsync,
} from '../../../lib/dashboard'

function shouldShowAlert(completed: number, assigned: number): boolean {
  const hour = getCurrentDate().getHours()
  return hour >= 17 && assigned > 0 && completed === 0
}

export default function HouseholdTodayScreen() {
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null)
  const [householdName, setHouseholdName] = useState('')
  const [rows, setRows] = useState(getHouseholdTodaySummary())
  const { onMenuPress } = useMenuContext()

  useEffect(() => {
    let mounted = true

    async function loadSummary() {
      const [name, summaryRows] = await Promise.all([
        getHouseholdNameAsync(),
        getHouseholdTodaySummaryAsync(),
      ])

      if (!mounted) return
      setHouseholdName(name)
      setRows(summaryRows)
    }

    loadSummary()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('household-today-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_executions' }, () => {
        getHouseholdTodaySummaryAsync().then(setRows)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const totalAssigned = rows.reduce((acc, row) => acc + row.assigned, 0)
  const totalCompleted = rows.reduce((acc, row) => acc + row.completed, 0)
  const totalProgress = totalAssigned === 0 ? 0 : Math.round((totalCompleted / totalAssigned) * 100)
  const laggingCount = rows.filter(row => shouldShowAlert(row.completed, row.assigned)).length

  return (
    <View style={styles.container}>
      <View style={styles.bgShapeTop} />
      <View style={styles.bgShapeBottom} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Reveal>
      <View style={styles.headerCard}>
        <View style={styles.headerMenuRow}>
          <HamburgerButton onPress={onMenuPress} />
          <Text style={styles.eyebrow}>Pulso del hogar</Text>
        </View>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{householdName || '...'} - Hoy</Text>
        </View>
        <Text style={styles.summary}>Total {totalCompleted}/{totalAssigned} ({totalProgress}%)</Text>
        <View style={styles.summaryChips}>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryChipValue}>{rows.length}</Text>
            <Text style={styles.summaryChipLabel}>Miembros</Text>
          </View>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryChipValue}>{laggingCount}</Text>
            <Text style={styles.summaryChipLabel}>En riesgo</Text>
          </View>
        </View>
      </View>
      </Reveal>

      <Reveal delay={90}>
      <View style={styles.listCard}>
        {rows.map(row => {
          const progress = row.assigned === 0 ? 0 : Math.round((row.completed / row.assigned) * 100)
          const isExpanded = expandedMemberId === row.member.id
          const alert = shouldShowAlert(row.completed, row.assigned)

          return (
            <View key={row.member.id} style={styles.memberBlock}>
              <Pressable
                style={[styles.memberHeader, isExpanded && styles.memberHeaderExpanded]}
                onPress={() => setExpandedMemberId(prev => (prev === row.member.id ? null : row.member.id))}
              >
                <View style={styles.memberIdentity}>
                  <View style={styles.memberAvatar}><Text style={styles.memberAvatarText}>{row.member.name.charAt(0).toUpperCase()}</Text></View>
                  <View style={styles.memberMeta}>
                    <Text style={styles.memberName}>{row.member.name}</Text>
                    <Text style={styles.memberRatio}>{row.completed}/{row.assigned} completadas</Text>
                  </View>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${progress}%` }]} />
                </View>
                {alert && <Text style={styles.alert}>⚠</Text>}
              </Pressable>

              {isExpanded && (
                <View style={styles.memberTasks}>
                  {row.tasks.map(task => (
                    <View key={task.id} style={styles.taskRow}>
                      <Text style={styles.taskName}>{task.taskName}</Text>
                      <Text style={styles.taskStatus}>{task.status}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )
        })}
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
    top: -70,
    left: -70,
    width: 220,
    height: 220,
    borderRadius: BorderRadius.full,
    backgroundColor: '#CCFBF1',
  },
  bgShapeBottom: {
    position: 'absolute',
    bottom: 70,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: BorderRadius.full,
    backgroundColor: '#DBEAFE',
  },
  headerCard: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#164E63',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
    ...ShadowPresets.card,
  },
  eyebrow: {
    color: '#5EEAD4',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  titleRow: {
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  summary: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  summaryChips: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  summaryChip: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(45, 212, 191, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(94, 234, 212, 0.14)',
  },
  summaryChipValue: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 16,
  },
  summaryChipLabel: {
    color: '#99F6E4',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  listCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    ...ShadowPresets.soft,
  },
  memberBlock: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5EDF6',
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.xs,
  },
  memberHeader: {
    gap: Spacing.sm,
    paddingVertical: 4,
  },
  memberHeaderExpanded: {
    opacity: 0.98,
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
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    color: '#0F766E',
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
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  alert: {
    color: Colors.warning,
    fontSize: 16,
  },
  memberTasks: {
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  taskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  taskName: {
    color: Colors.text.primary,
    fontSize: 13,
  },
  taskStatus: {
    color: Colors.text.secondary,
    fontSize: 12,
    textTransform: 'capitalize',
  },
})
