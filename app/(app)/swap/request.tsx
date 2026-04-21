import { useEffect, useMemo, useState } from 'react'
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { router } from 'expo-router'
import { BorderRadius, Colors, Spacing, ShadowPresets } from '../../../constants/theme'
import { CollapsibleCard } from '../../../components/ui/collapsible-card'
import { Reveal } from '../../../components/ui/reveal'
import { createTaskSwapRequest, getSwapRequestData, SwapExecutionOption, SwapMemberOptions } from '../../../lib/swaps'
import { SwapScope } from '../../../types'

const SCOPES: SwapScope[] = ['daily', 'weekly', 'monthly']

function scopeLabel(scope: SwapScope): string {
  if (scope === 'daily') return 'Diario'
  if (scope === 'weekly') return 'Semanal'
  return 'Mensual'
}

export default function SwapRequestScreen() {
  const [myTasks, setMyTasks] = useState<SwapExecutionOption[]>([])
  const [memberOptions, setMemberOptions] = useState<SwapMemberOptions[]>([])
  const [selectedMyExecutionId, setSelectedMyExecutionId] = useState<string | null>(null)
  const [selectedTargetExecutionId, setSelectedTargetExecutionId] = useState<string | null>(null)
  const [scope, setScope] = useState<SwapScope>('daily')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true

    async function loadOptions() {
      try {
        const data = await getSwapRequestData()
        if (!mounted) return
        setMyTasks(data.myTasks)
        setMemberOptions(data.memberOptions)
      } catch (error) {
        if (!mounted) return
        Alert.alert('No se pudieron cargar los intercambios', error instanceof Error ? error.message : 'Intenta nuevamente.')
      }
    }

    loadOptions()

    return () => {
      mounted = false
    }
  }, [])

  const canSubmit = useMemo(
    () => Boolean(selectedMyExecutionId && selectedTargetExecutionId && !saving),
    [selectedMyExecutionId, selectedTargetExecutionId, saving]
  )

  const handleSubmit = async () => {
    if (!selectedMyExecutionId || !selectedTargetExecutionId) {
      Alert.alert('Faltan datos', 'Selecciona tu tarea y la tarea a intercambiar.')
      return
    }

    setSaving(true)
    try {
      await createTaskSwapRequest({
        requesterExecutionId: selectedMyExecutionId,
        targetExecutionId: selectedTargetExecutionId,
        scope,
      })

      Alert.alert('Solicitud enviada', 'El otro miembro recibira la solicitud para aceptar o rechazar.')
      setSelectedMyExecutionId(null)
      setSelectedTargetExecutionId(null)
    } catch (error) {
      Alert.alert('No se pudo enviar', error instanceof Error ? error.message : 'Intenta nuevamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Reveal delay={0}>
        <View style={styles.headerCard}>
          <Text style={styles.eyebrow}>Flexibilidad</Text>
          <Text style={styles.title}>Solicitar intercambio</Text>
          <Text style={styles.subtitle}>Propón un intercambio de tareas con otro miembro del hogar.</Text>
        </View>
      </Reveal>

      <Reveal delay={90}>
        <View style={styles.sectionCard}>
          <CollapsibleCard
            title="1) Tu tarea para ceder"
            subtitle="Elige cuál de tus tareas quieres intercambiar."
            defaultExpanded={true}
            forceExpanded={selectedMyExecutionId !== null}
          >
            {myTasks.map(task => (
              <Pressable
                key={task.executionId}
                style={[
                  styles.optionRow,
                  selectedMyExecutionId === task.executionId && styles.optionRowSelected,
                ]}
                onPress={() => setSelectedMyExecutionId(task.executionId)}
              >
                <Text style={styles.optionName}>{task.taskName}</Text>
                <Text style={styles.optionTime}>{task.scheduledTime}</Text>
              </Pressable>
            ))}
          </CollapsibleCard>
        </View>
      </Reveal>

      <Reveal delay={100}>
        <View style={styles.sectionCard}>
          <CollapsibleCard
            title="2) Tarea que tomas a cambio"
            subtitle="Selecciona una tarea de otro miembro del hogar."
            forceExpanded={selectedTargetExecutionId !== null}
          >
            {memberOptions.map(member => (
              <View key={member.memberId} style={styles.memberBlock}>
                <Text style={styles.memberTitle}>{member.memberName}</Text>
                {member.tasks.map(task => (
                  <Pressable
                    key={task.executionId}
                    style={[
                      styles.optionRow,
                      selectedTargetExecutionId === task.executionId && styles.optionRowSelected,
                    ]}
                    onPress={() => setSelectedTargetExecutionId(task.executionId)}
                  >
                    <Text style={styles.optionName}>{task.taskName}</Text>
                    <Text style={styles.optionTime}>{task.scheduledTime}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </CollapsibleCard>
        </View>
      </Reveal>

      <Reveal delay={110}>
        <View style={styles.sectionCard}>
          <CollapsibleCard
            title="3) Alcance"
            subtitle="Define si el intercambio aplica al día, semana o mes."
            defaultExpanded={true}
          >
            <View style={styles.scopeRow}>
              {SCOPES.map(item => (
                <Pressable
                  key={item}
                  style={[styles.scopeChip, scope === item && styles.scopeChipSelected]}
                  onPress={() => setScope(item)}
                >
                  <Text style={[styles.scopeChipText, scope === item && styles.scopeChipTextSelected]}>{scopeLabel(item)}</Text>
                </Pressable>
              ))}
            </View>
          </CollapsibleCard>
        </View>
      </Reveal>

      <Reveal delay={120}>
        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          <Text style={styles.submitButtonText}>{saving ? 'Enviando...' : 'Enviar solicitud'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/(app)/swap/inbox')}>
          <Text style={styles.secondaryButtonText}>Ver solicitudes recibidas</Text>
        </TouchableOpacity>
      </Reveal>
    </ScrollView>
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
  },
  headerCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.xs,
    ...ShadowPresets.soft,
  },
  eyebrow: {
    color: '#0EA5E9',
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.8,
    fontSize: 12,
  },
  title: {
    color: Colors.text.primary,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: Colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionCard: {
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
    fontSize: 16,
    fontWeight: '700',
  },
  memberBlock: {
    gap: Spacing.xs,
  },
  memberTitle: {
    color: Colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  optionRow: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionRowSelected: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}12`,
  },
  optionName: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  optionTime: {
    color: Colors.text.secondary,
    fontSize: 13,
  },
  scopeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  scopeChip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  scopeChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}12`,
  },
  scopeChipText: {
    color: Colors.text.secondary,
    fontSize: 12,
  },
  scopeChipTextSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    ...ShadowPresets.primary,
  },
  submitButtonDisabled: {
    opacity: 0.45,
  },
  submitButtonText: {
    color: Colors.text.inverse,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
})
