import { useLocalSearchParams, useRouter } from 'expo-router'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { Colors, Spacing, BorderRadius } from '../../constants/theme'

export default function CheckEmailScreen() {
  const router = useRouter()
  const { email } = useLocalSearchParams<{ email?: string }>()

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.content}>
        <Text style={styles.title}>Revisa tu correo</Text>
        <Text style={styles.text}>
          Te enviamos un enlace de confirmacion a {email || 'tu email'}.
        </Text>
        <Text style={styles.text}>
          Cuando lo confirmes, vuelve e inicia sesion para continuar.
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.primaryButtonText}>Ir a iniciar sesion</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace('/(auth)/register')}>
          <Text style={styles.secondaryButtonText}>Usar otro correo</Text>
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
    gap: Spacing.md,
    marginTop: Spacing.xxl,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  text: {
    color: Colors.text.secondary,
    fontSize: 15,
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
    fontSize: 16,
    fontWeight: '600',
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