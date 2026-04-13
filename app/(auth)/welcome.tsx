import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Colors, Spacing, BorderRadius } from '../../constants/theme'
import { AnimatedBorderCard } from '../../components/ui/animated-border-card'

export default function WelcomeScreen() {
  const router = useRouter()

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.logoContainer}>
        <AnimatedBorderCard style={styles.heroCard} tone="violet" delayMs={80}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>🏠</Text>
          </View>
          <Text style={styles.appName}>MeToca</Text>
          <Text style={styles.tagline}>Hogar ordenado, sin discusiones.</Text>
        </AnimatedBorderCard>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/(auth)/value-prop')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Comenzar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/(auth)/login')}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryButtonText}>Ya tengo cuenta</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    justifyContent: 'space-between',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  heroCard: {
    backgroundColor: '#0B1222',
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(37,99,235,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  logoEmoji: {
    fontSize: 48,
  },
  appName: {
    fontSize: 42,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 17,
    color: '#CBD5E1',
    fontWeight: '500',
    textAlign: 'center',
  },
  actions: {
    gap: Spacing.sm,
  },
  primaryButton: {
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: Colors.primary,
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    fontWeight: '500',
  },
})
