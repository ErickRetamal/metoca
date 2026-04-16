import { useState } from 'react'
import { router } from 'expo-router'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { supabase } from '../../lib/supabase'
import { requestPushPermission, registerPushToken } from '../../lib/notifications'
import { Colors, Spacing, BorderRadius } from '../../constants/theme'
import { AnimatedBorderCard } from '../../components/ui/animated-border-card'

export default function PushPermissionScreen() {
  const [loading, setLoading] = useState(false)

  const handleAllow = async () => {
    setLoading(true)
    const granted = await requestPushPermission()

    if (granted) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await registerPushToken(user.id)
    }

    setLoading(false)
    router.replace('/(app)/(tabs)/today')
  }

  const handleSkip = () => {
    router.replace('/(app)/(tabs)/today')
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>🔔</Text>
        </View>

        <Text style={styles.headline}>Activá los recordatorios</Text>
        <Text style={styles.body}>
          MeToca te avisa el día que te toca hacer algo en casa. Sin notificaciones, la app pierde su gracia.
        </Text>

        <View style={styles.benefitListStack}>
          {[
            'Te avisamos el día de tu tarea',
            'Segundo aviso si no la marcaste',
            'Resumen mensual del hogar',
          ].map((item, i) => (
            <AnimatedBorderCard key={i} style={styles.benefitList} tone="teal" delayMs={i * 180}>
              <View style={styles.benefitRow}>
                <Text style={styles.checkmark}>✓</Text>
                <Text style={styles.benefitText}>{item}</Text>
              </View>
            </AnimatedBorderCard>
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
          onPress={handleAllow}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={Colors.text.inverse} />
            : <Text style={styles.primaryButtonText}>Sí, activar notificaciones</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          activeOpacity={0.7}
        >
          <Text style={styles.skipButtonText}>Ahora no</Text>
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
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
    backgroundColor: `${Colors.primary}18`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  icon: {
    fontSize: 38,
  },
  headline: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: Colors.text.secondary,
    lineHeight: 22,
    textAlign: 'center',
  },
  benefitListStack: {
    alignSelf: 'stretch',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  benefitList: {
    alignSelf: 'stretch',
    backgroundColor: '#0B1222',
    padding: Spacing.md,
    borderRadius: BorderRadius.md - 1,
  },
  benefitRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  checkmark: {
    color: Colors.success,
    fontSize: 16,
    fontWeight: '700',
  },
  benefitText: {
    fontSize: 15,
    color: '#E2E8F0',
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
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: Colors.text.inverse,
    fontSize: 17,
    fontWeight: '600',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  skipButtonText: {
    color: Colors.text.secondary,
    fontSize: 15,
  },
})
