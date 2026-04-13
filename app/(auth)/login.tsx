import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { supabase } from '../../lib/supabase'
import { Colors, Spacing, BorderRadius } from '../../constants/theme'

export default function LoginScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [inlineError, setInlineError] = useState<string | null>(null)

  const handleLogin = async () => {
    const trimmedEmail = email.trim().toLowerCase()

    if (!trimmedEmail || !password) {
      Alert.alert('Faltan datos', 'Ingresa tu correo y contraseña.')
      return
    }

    setInlineError(null)

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    })
    setLoading(false)

    if (error) {
      const message = error.message ?? ''
      const status = (error as any)?.status

      if (status === 429 || /too many requests/i.test(message)) {
        const detail = 'Demasiados intentos. Espera 60 segundos y vuelve a intentar.'
        setInlineError(detail)
        Alert.alert('Demasiados intentos', detail)
        return
      }

      if (/email not confirmed/i.test(message)) {
        const detail = 'Tu correo aun no esta confirmado. Revisa tu email y luego vuelve a iniciar sesion.'
        setInlineError(detail)
        Alert.alert(
          'Correo no confirmado',
          detail
        )
        return
      }

      if (/invalid login credentials/i.test(message)) {
        const detail = 'Correo o contraseña incorrectos.'
        setInlineError(detail)
        Alert.alert('Credenciales inválidas', 'Revisa tu correo y contraseña.')
        return
      }

      setInlineError(message)
      Alert.alert('No pudimos iniciar sesión', message)
      return
    }
    // La redirección la maneja el listener en app/_layout.tsx
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />

      <View style={styles.content}>
        <Text style={styles.headline}>Bienvenido de vuelta</Text>
        <Text style={styles.subtext}>Ingresa a tu cuenta de MeToca.</Text>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="tu@correo.com"
              placeholderTextColor={Colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Tu contraseña"
              placeholderTextColor={Colors.muted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
            />
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={Colors.text.inverse} />
            : <Text style={styles.primaryButtonText}>Iniciar sesión</Text>
          }
        </TouchableOpacity>

        {inlineError && <Text style={styles.inlineError}>{inlineError}</Text>}

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.push('/(auth)/register')}
          activeOpacity={0.7}
        >
          <Text style={styles.linkButtonText}>¿No tienes cuenta? Regístrate gratis</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    gap: Spacing.sm,
  },
  headline: {
    fontSize: 30,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  subtext: {
    fontSize: 15,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
  },
  form: {
    gap: Spacing.md,
  },
  inputGroup: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    fontSize: 16,
    color: Colors.text.primary,
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
  linkButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  linkButtonText: {
    color: Colors.primary,
    fontSize: 15,
  },
  inlineError: {
    color: Colors.danger,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
})
