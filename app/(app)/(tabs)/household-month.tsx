import { useEffect, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
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
  getHouseholdNameAsync,
} from '../../../lib/dashboard'

export default function HouseholdMonthScreen() {
  const [monthOffset, setMonthOffset] = useState(0)
  const [householdName, setHouseholdName] = useState('')
  const [plan, setPlan] = useState(CURRENT_PLAN)
  const [summary, setSummary] = useState(getHouseholdMonthSummary(0))
  const { onMenuPress } = useMenuContext()

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
      const nextSummary = await getHouseholdMonthSummaryAsync(monthOffset)
      if (mounted) setSummary(nextSummary)
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

  return (
    <View style={styles.container}>
      <View style={styles.bgShapeTop} />
      <View style={styles.bgShapeBottom} />

      <Reveal>
      <View style={styles.headerCard}>
        <Text style={styles.eyebrow}>Radar mensual</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{householdName || '...'} - {summary.monthKey}</Text>
        </View>
        <Text style={styles.subtitle}>Progreso general: {summary.completionRate}%</Text>
      </View>
      </Reveal>

      <Reveal delay={90}>
      <View style={styles.chartCard}>
        {summary.byMember.map((item, index) => {
          const assignedHeight = item.assigned * 14
          const completedHeight = item.completed * 14

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
            <Text style={styles.legendText}>Asignadas</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendSwatch, { backgroundColor: Colors.primary }]} />
            <Text style={styles.legendText}>Completadas</Text>
          </View>
        </View>
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
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.lg,
    gap: Spacing.md,
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
  },
})
