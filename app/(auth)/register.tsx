import { useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
} from 'react-native'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { supabase } from '../../lib/supabase'
import { Colors, Spacing, BorderRadius } from '../../constants/theme'
import { identifyPurchaseUser } from '../../lib/purchases'
import { normalizeFirstAndLast } from '../../lib/user-name'

export default function RegisterScreen() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [gender, setGender] = useState<'masculino' | 'femenino' | 'otro' | 'prefiero_no_decir'>('prefiero_no_decir')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const isSubmittingRef = useRef(false)
  const imageOpacity = useRef(new Animated.Value(0)).current

  const handleImageLoad = () => {
    Animated.timing(imageOpacity, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }

  const handleRegister = async () => {
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true

    const trimmedEmail = email.trim().toLowerCase()
    const normalizedName = normalizeFirstAndLast(firstName, lastName)
    const trimmedFirstName = normalizedName.firstName
    const trimmedLastName = normalizedName.lastName

    if (!trimmedFirstName || !trimmedLastName || !trimmedEmail || !password) {
      Alert.alert('Faltan datos', 'Ingresa nombre, apellido, correo y una contraseña.')
      isSubmittingRef.current = false
      return
    }
    if (password.length < 6) {
      Alert.alert('Contraseña muy corta', 'Debe tener al menos 6 caracteres.')
      isSubmittingRef.current = false
      return
    }

    const fullName = normalizedName.fullName

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: {
          name: fullName,
          first_name: trimmedFirstName,
          last_name: trimmedLastName,
          gender,
        },
      },
    })
    setLoading(false)
    isSubmittingRef.current = false

    if (error) {
      const status = (error as any)?.status
      if (status === 429 || /too many requests/i.test(error.message)) {
        Alert.alert(
          'Demasiados intentos',
          'Supabase aplicó limite temporal de registro. Espera 60 segundos e intenta nuevamente.'
        )
        return
      }

      Alert.alert('Error al crear cuenta', error.message)
      return
    }

    if (!data.session) {
      router.replace({
        pathname: '/(auth)/check-email',
        params: { email: trimmedEmail },
      })
      return
    }

    if (data.user?.id) {
      await identifyPurchaseUser(data.user.id).catch(() => undefined)
    }

    router.replace('/(auth)/push-permission')
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      <Animated.Image
        source={require('../../assets/images/onboarding/register.png.png')}
        style={[styles.photoBg, { opacity: imageOpacity }]}
        resizeMode="cover"
        onLoad={handleImageLoad}
      />
      <View style={styles.photoVeil} />

      <View style={styles.screenPadding}>

        <View style={styles.content}>
          <Text style={styles.headline}>Crear mi cuenta</Text>
          <Text style={styles.subtext}>Es gratis. Sin tarjeta de crédito.</Text>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nombre</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Tu nombre"
                placeholderTextColor={Colors.muted}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Apellido</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Tu apellido"
                placeholderTextColor={Colors.muted}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Genero</Text>
              <View style={styles.genderRow}>
                <Pressable
                  style={[styles.genderChip, gender === 'femenino' && styles.genderChipActive]}
                  onPress={() => setGender('femenino')}
                >
                  <Text style={[styles.genderChipText, gender === 'femenino' && styles.genderChipTextActive]}>Femenino</Text>
                </Pressable>

                <Pressable
                  style={[styles.genderChip, gender === 'masculino' && styles.genderChipActive]}
                  onPress={() => setGender('masculino')}
                >
                  <Text style={[styles.genderChipText, gender === 'masculino' && styles.genderChipTextActive]}>Masculino</Text>
                </Pressable>

                <Pressable
                  style={[styles.genderChip, gender === 'otro' && styles.genderChipActive]}
                  onPress={() => setGender('otro')}
                >
                  <Text style={[styles.genderChipText, gender === 'otro' && styles.genderChipTextActive]}>Otro</Text>
                </Pressable>
              </View>
            </View>

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
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={Colors.muted}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
              />
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={Colors.text.inverse} />
              : <Text style={styles.primaryButtonText}>Crear cuenta</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.7}
          >
            <Text style={styles.linkButtonText}>¿Ya tienes cuenta? Inicia sesión</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.legalLink}
            onPress={() => router.push('/(auth)/privacy-policy')}
            activeOpacity={0.7}
          >
            <Text style={styles.legalLinkText}>Politica de privacidad</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8EE',
    position: 'relative',
    overflow: 'hidden',
  },
  photoBg: {
    ...StyleSheet.absoluteFillObject,
  },
  photoVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,248,238,0.84)',
  },
  screenPadding: {
    flex: 1,
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
  genderRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  genderChip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
  },
  genderChipActive: {
    borderColor: Colors.primary,
    backgroundColor: '#EEF2FF',
  },
  genderChipText: {
    color: Colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  genderChipTextActive: {
    color: Colors.primary,
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
  legalLink: {
    alignItems: 'center',
    paddingTop: Spacing.xs,
  },
  legalLinkText: {
    color: Colors.text.secondary,
    fontSize: 12,
  },
})
