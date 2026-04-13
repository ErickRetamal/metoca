import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Colors, Spacing, BorderRadius } from '../../constants/theme'
import { AnimatedBorderCard } from '../../components/ui/animated-border-card'

const STEPS = [
  {
    number: '1',
    emoji: '📋',
    title: 'El admin define las tareas',
    description: 'Quien crea el hogar agrega las tareas del mes y define quiénes participan.',
  },
  {
    number: '2',
    emoji: '🔄',
    title: 'MeToca asigna y rota',
    description: 'El día 15 se publican las asignaciones del mes siguiente. Cada mes rotan automáticamente.',
  },
  {
    number: '3',
    emoji: '🔔',
    title: 'Te avisamos cuando te toca',
    description: 'Recibes una notificación el día que tienes que hacer algo. Sin excusas.',
  },
]

const STEP_TONES: Array<'teal' | 'violet' | 'amber'> = ['teal', 'violet', 'amber']

export default function HowItWorksScreen() {
  const router = useRouter()

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.content}>
        <Text style={styles.headline}>¿Cómo funciona?</Text>

        <View style={styles.steps}>
          {STEPS.map((step, index) => (
            <View key={index} style={styles.stepRow}>
              <View style={styles.stepLeft}>
                <View style={styles.stepNumberCircle}>
                  <Text style={styles.stepNumber}>{step.number}</Text>
                </View>
                {index < STEPS.length - 1 && <View style={styles.stepConnector} />}
              </View>
              <AnimatedBorderCard delayMs={index * 210} tone={STEP_TONES[index % STEP_TONES.length]} style={styles.stepCardShell}>
                <View style={styles.stepContent}>
                  <Text style={styles.stepEmoji}>{step.emoji}</Text>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDescription}>{step.description}</Text>
                </View>
              </AnimatedBorderCard>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/(auth)/register')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Crear mi cuenta</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xl,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  headline: {
    fontSize: 30,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  steps: {
    gap: 0,
  },
  stepRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  stepLeft: {
    alignItems: 'center',
    width: 36,
  },
  stepNumberCircle: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumber: {
    color: Colors.text.inverse,
    fontWeight: '700',
    fontSize: 16,
  },
  stepConnector: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },
  stepContent: {
    flex: 1,
    backgroundColor: '#0B1222',
    borderRadius: BorderRadius.md - 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.xs,
  },
  stepCardShell: {
    flex: 1,
    marginBottom: Spacing.lg,
  },
  stepEmoji: {
    fontSize: 22,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  stepDescription: {
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 20,
  },
  actions: {},
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: Colors.text.inverse,
    fontSize: 17,
    fontWeight: '600',
  },
})
