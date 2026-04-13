import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Colors, Spacing, BorderRadius } from '../../constants/theme'
import { AnimatedBorderCard } from '../../components/ui/animated-border-card'

const PAIN_POINTS = [
  { emoji: '🧠', text: 'Siempre eres tú quien se acuerda de todo en casa' },
  { emoji: '😤', text: 'Las tareas se repiten siempre entre las mismas personas' },
  { emoji: '🤷', text: '"No sabía que me tocaba" — la frase de siempre' },
]

export default function ValuePropScreen() {
  const router = useRouter()

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.content}>
        <Text style={styles.headline}>¿Siempre te toca a ti acordarte de todo?</Text>
        <Text style={styles.subtext}>
          MeToca distribuye las tareas del hogar de forma justa y te avisa cuando es tu turno.
        </Text>

        <View style={styles.painPoints}>
          {PAIN_POINTS.map((item, index) => (
            <AnimatedBorderCard key={index} delayMs={index * 220} tone="blue" style={styles.painCardShell}>
              <View style={styles.painPointRow}>
                <Text style={styles.painPointEmoji}>{item.emoji}</Text>
                <Text style={styles.painPointText}>{item.text}</Text>
              </View>
            </AnimatedBorderCard>
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/(auth)/how-it-works')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Así lo resolvemos →</Text>
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
    gap: Spacing.lg,
  },
  headline: {
    fontSize: 30,
    fontWeight: '700',
    color: Colors.text.primary,
    lineHeight: 38,
  },
  subtext: {
    fontSize: 16,
    color: Colors.text.secondary,
    lineHeight: 24,
  },
  painPoints: {
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  painPointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: '#0B1222',
    padding: Spacing.md,
    borderRadius: BorderRadius.md - 1,
  },
  painCardShell: {
    backgroundColor: '#0B1222',
  },
  painPointEmoji: {
    fontSize: 24,
  },
  painPointText: {
    flex: 1,
    fontSize: 15,
    color: '#E2E8F0',
    lineHeight: 22,
  },
  actions: {
    gap: Spacing.sm,
  },
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
