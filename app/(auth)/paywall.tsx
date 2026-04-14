import { useEffect, useRef, useState } from 'react'
import {
  Animated, Easing, Pressable, ScrollView,
  StyleSheet, Text, View, ActivityIndicator, Alert, Image,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { BorderRadius, Spacing } from '../../constants/theme'
import { supabase } from '../../lib/supabase'

const PLANS = [
  {
    id: 'free',
    name: 'Gratis',
    price: '$0',
    period: 'para siempre',
    members: '2 personas',
    features: ['Hasta 2 miembros', 'Notificaciones básicas', 'Vista del mes actual'],
    revenucatId: null as string | null,
  },
  {
    id: 'hogar',
    name: 'Hogar',
    price: '$2.990',
    period: 'al mes',
    members: 'Hasta 5 personas',
    features: [
      'Hasta 5 miembros',
      'Acción directa desde notificación',
      'Historial completo',
      'Reporte mensual del hogar',
    ],
    revenucatId: 'metoca_hogar_monthly' as string | null,
  },
  {
    id: 'familia',
    name: 'Familia',
    price: '$4.990',
    period: 'al mes',
    members: 'Hasta 10 personas',
    features: ['Hasta 10 miembros', 'Todo lo del plan Hogar', 'Soporte prioritario'],
    revenucatId: 'metoca_familia_monthly' as string | null,
  },
]

export default function PaywallScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>()
  const [selectedPlan, setSelectedPlan] = useState('hogar')
  const [loading, setLoading]           = useState(false)
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null)
  const [accountEmail, setAccountEmail] = useState<string | null>(email ?? null)
  const [resending, setResending] = useState(false)
  const [refreshingVerification, setRefreshingVerification] = useState(false)

  const reveal   = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(reveal, {
      toValue: 1, duration: 560, delay: 60,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start()
  }, [])

  const readVerificationState = async (options?: { forceRefresh?: boolean }) => {
    const { data: sessionData } = await supabase.auth.getSession()
    const hasSession = Boolean(sessionData.session)
    let refreshRateLimited = false

    // Avoid automatic refresh loops; force refresh only on explicit user action.
    if (hasSession && options?.forceRefresh) {
      const { error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError?.status === 429) {
        refreshRateLimited = true
      }
    }

    const { data } = await supabase.auth.getUser()
    const user = data.user

    return {
      hasSession,
      user,
      confirmed: Boolean(user?.email_confirmed_at),
      resolvedEmail: user?.email ?? email ?? null,
      refreshRateLimited,
    }
  }

  useEffect(() => {
    let mounted = true

    async function refreshVerificationState() {
      const result = await readVerificationState()
      if (!mounted) return
      if (result.user) {
        setAccountEmail(result.resolvedEmail)
        setEmailVerified(result.confirmed)
      } else {
        setAccountEmail(result.resolvedEmail)
        setEmailVerified(false)
      }
    }

    void refreshVerificationState()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED') return
      void refreshVerificationState()
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [email])

  useEffect(() => {
    if (emailVerified === false && selectedPlan !== 'free') {
      setSelectedPlan('free')
    }
  }, [emailVerified, selectedPlan])

  const handleResendVerification = async () => {
    if (!accountEmail) {
      Alert.alert('Falta correo', 'No encontramos tu correo. Vuelve a registrarte o inicia sesión.')
      return
    }

    setResending(true)
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: accountEmail,
    })
    setResending(false)

    if (error) {
      Alert.alert('No se pudo reenviar', error.message)
      return
    }

    Alert.alert('Correo reenviado', `Te enviamos un nuevo enlace a ${accountEmail}.`)
  }

  const handleRefreshVerificationStatus = async () => {
    if (refreshingVerification) return

    setRefreshingVerification(true)
    const result = await readVerificationState({ forceRefresh: true })
    setRefreshingVerification(false)
    if (result.refreshRateLimited) {
      Alert.alert(
        'Demasiadas solicitudes',
        'Estamos recibiendo muchos intentos seguidos. Espera unos segundos y vuelve a intentar.'
      )
      return
    }


    setAccountEmail(result.resolvedEmail)
    setEmailVerified(result.confirmed)

    if (!result.hasSession || !result.user) {
      Alert.alert(
        'Necesitas iniciar sesión',
        'Tu correo puede ya estar confirmado, pero para actualizar este estado debes iniciar sesión nuevamente.',
        [
          { text: 'Cancelar' },
          { text: 'Ir a iniciar sesión', onPress: () => router.replace('/(auth)/login') },
        ]
      )
      return
    }

    if (result.confirmed) {
      Alert.alert('Correo confirmado', 'Listo. Ya puedes seleccionar un plan de pago.')
      return
    }

    Alert.alert('Aún pendiente', 'Sigue pendiente la confirmación. Revisa tu correo y vuelve a intentar.')
  }

  const handleSubscribe = async () => {
    const plan = PLANS.find(p => p.id === selectedPlan)
    if (!plan) return

    if (plan.id !== 'free' && emailVerified === false) {
      Alert.alert(
        'Confirma tu correo primero',
        'Antes de activar un plan de pago, necesitamos que confirmes tu correo electrónico.',
        [
          { text: 'Reenviar correo', onPress: handleResendVerification },
          { text: 'OK' },
        ]
      )
      return
    }

    if (plan.id === 'free') {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        Alert.alert(
          'Inicia sesión para continuar',
          'Para empezar con el plan gratis, primero inicia sesión con tu cuenta.',
          [{ text: 'Ir a iniciar sesión', onPress: () => router.replace('/(auth)/login') }]
        )
        return
      }

      router.replace('/(app)/(tabs)/today')
      return
    }
    Alert.alert(
      'Próximamente',
      'La suscripción estará disponible muy pronto. Por ahora puedes usar el plan gratis.',
      [{ text: 'Continuar gratis', onPress: () => router.replace('/(app)/(tabs)/today') }]
    )
  }

  const hogarPlan = PLANS[1]
  const altPlans  = [PLANS[0], PLANS[2]]

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <Image
        source={require('../../assets/images/onboarding/paywall.png.png')}
        style={styles.photoBg}
        resizeMode="cover"
      />
      <View style={styles.photoVeil} />

      {/* Contenido scrolleable */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Animated.View style={[
          styles.inner,
          {
            opacity: reveal,
            transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
          },
        ]}>
          {/* Eyebrow */}
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowDot} />
            <Text style={styles.eyebrow}>MeToca · Tu hogar</Text>
          </View>

          {/* Headline aspiracional */}
          <Text style={styles.headline}>{'Tu hogar,\ntu paz.'}</Text>
          <Text style={styles.subline}>
            Cuando la carga se reparte sola, todo cambia dentro del hogar.
          </Text>

          {emailVerified === false && (
            <View style={styles.verifyBox}>
              <Text style={styles.verifyTitle}>Confirma tu correo para activar planes pagos</Text>
              <Text style={styles.verifyText}>
                {accountEmail
                  ? `Te enviamos un correo a ${accountEmail}.`
                  : 'Te enviamos un correo de verificación.'}
              </Text>
              <Pressable
                style={({ pressed }) => [styles.verifyBtn, pressed && { opacity: 0.82 }, resending && styles.verifyBtnDisabled]}
                onPress={handleResendVerification}
                disabled={resending}
              >
                <Text style={styles.verifyBtnText}>{resending ? 'Reenviando...' : 'Reenviar correo de verificación'}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.verifyBtnSecondary, pressed && { opacity: 0.82 }, refreshingVerification && styles.verifyBtnDisabled]}
                onPress={handleRefreshVerificationStatus}
                disabled={refreshingVerification}
              >
                <Text style={styles.verifyBtnSecondaryText}>{refreshingVerification ? 'Verificando...' : 'Ya confirmé mi correo'}</Text>
              </Pressable>
            </View>
          )}

          {/* Plan section */}
          <Text style={styles.sectionLabel}>Elige tu plan</Text>

          {/* — Hero card: Hogar — */}
          <Pressable
            style={[
              styles.heroCard,
              selectedPlan === 'hogar' && styles.heroCardSelected,
              emailVerified === false && styles.planLocked,
            ]}
            onPress={() => setSelectedPlan('hogar')}
            disabled={emailVerified === false}
          >
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>🏠  El favorito de los hogares</Text>
            </View>
            <View style={styles.heroCardInner}>
              <View>
                <Text style={styles.heroName}>{hogarPlan.name}</Text>
                <Text style={styles.heroMembers}>{hogarPlan.members}</Text>
              </View>
              <View style={styles.heroPriceWrap}>
                <Text style={styles.heroPrice}>{hogarPlan.price}</Text>
                <Text style={styles.heroPeriod}>{hogarPlan.period}</Text>
              </View>
            </View>
            <View style={styles.heroFeatures}>
              {hogarPlan.features.map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <Text style={styles.featureCheck}>✓</Text>
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>
            {selectedPlan === 'hogar' && <View style={styles.selectDot} />}
          </Pressable>

          {/* — Planes alternativos (Free + Familia) — */}
          <View style={styles.altRow}>
            {altPlans.map(plan => (
              <Pressable
                key={plan.id}
                style={[
                  styles.altCard,
                  selectedPlan === plan.id && styles.altCardSelected,
                  emailVerified === false && plan.id !== 'free' && styles.planLocked,
                ]}
                onPress={() => setSelectedPlan(plan.id)}
                disabled={emailVerified === false && plan.id !== 'free'}
              >
                <Text style={[styles.altName, selectedPlan === plan.id && styles.altNameSel]}>
                  {plan.name}
                </Text>
                <Text style={styles.altPrice}>{plan.price}</Text>
                <Text style={styles.altPeriod}>{plan.period}</Text>
                <Text style={styles.altMembers}>{plan.members}</Text>
                {selectedPlan === plan.id && <View style={styles.selectDotSm} />}
              </Pressable>
            ))}
          </View>

          {/* Acciones */}
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && { opacity: 0.86 },
                loading && styles.primaryBtnDisabled,
              ]}
              onPress={handleSubscribe}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>
                    {selectedPlan === 'free'
                      ? 'Empezar sin costo →'
                      : 'Quiero esto para mi hogar →'}
                  </Text>
              }
            </Pressable>

            {selectedPlan !== 'free' && (
              <Pressable
                style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.6 }]}
                onPress={() => router.replace('/(app)/(tabs)/today')}
              >
                <Text style={styles.ghostBtnText}>Empezar sin costo</Text>
              </Pressable>
            )}

            <Text style={styles.riskText}>Sin compromiso · Cancela cuando quieras</Text>

            <Text style={styles.legalText}>
              Precios en CLP. Se renueva automáticamente. Cancela desde la tienda de apps.
            </Text>

            <View style={styles.legalLinks}>
              <Pressable onPress={() => router.push('/(auth)/privacy-policy')}>
                <Text style={styles.legalLink}>Privacidad</Text>
              </Pressable>
              <Text style={styles.legalDot}>·</Text>
              <Pressable onPress={() => router.push('/(auth)/terms-of-use')}>
                <Text style={styles.legalLink}>Términos</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFF8EE',
    overflow: 'hidden',
  },
  photoBg: {
    ...StyleSheet.absoluteFillObject,
  },
  photoVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,248,238,0.82)',
  },
  scroll: { flex: 1 },
  container: { paddingBottom: Spacing.xl },

  // ── Layout principal ─────────────────────────────────────────
  inner: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl + 8,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  eyebrowDot: {
    width: 7,
    height: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: '#D97706',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#92400E',
  },
  headline: {
    fontSize: 44,
    fontWeight: '800',
    color: '#1C1917',
    letterSpacing: -1,
    lineHeight: 52,
    marginTop: Spacing.xs,
  },
  subline: {
    fontSize: 15,
    color: '#57534E',
    lineHeight: 23,
    marginBottom: Spacing.xs,
  },
  verifyBox: {
    backgroundColor: '#FFF8EE',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: 8,
  },
  verifyTitle: {
    color: '#92400E',
    fontSize: 13,
    fontWeight: '700',
  },
  verifyText: {
    color: '#78716C',
    fontSize: 12,
    lineHeight: 18,
  },
  verifyBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#D97706',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  verifyBtnDisabled: {
    opacity: 0.65,
  },
  verifyBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  verifyBtnSecondary: {
    alignSelf: 'flex-start',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#D97706',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  verifyBtnSecondaryText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '700',
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: '#A8A29E',
  },

  // ── Hero card (Hogar) ────────────────────────────────────────
  heroCard: {
    backgroundColor: '#FFFBF5',
    borderWidth: 2,
    borderColor: '#FDE68A',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  heroCardSelected: {
    borderColor: '#D97706',
    shadowOpacity: 0.28,
  },
  planLocked: {
    opacity: 0.5,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#D97706',
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  heroBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  heroCardInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroName:     { fontSize: 22, fontWeight: '800', color: '#1C1917' },
  heroMembers:  { fontSize: 13, color: '#78716C', marginTop: 2 },
  heroPriceWrap: { alignItems: 'flex-end' },
  heroPrice:    { fontSize: 26, fontWeight: '800', color: '#D97706' },
  heroPeriod:   { fontSize: 12, color: '#A8A29E', marginTop: 2 },
  heroFeatures: { gap: 6 },
  featureRow:   { flexDirection: 'row', gap: 8, alignItems: 'center' },
  featureCheck: { color: '#16A34A', fontWeight: '700', fontSize: 14 },
  featureText:  { fontSize: 13, color: '#57534E', flex: 1 },
  selectDot: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: '#D97706',
  },

  // ── Planes alternativos ──────────────────────────────────────
  altRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  altCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: 2,
    alignItems: 'center',
    backgroundColor: '#FFFBF5',
  },
  altCardSelected: {
    borderColor: '#D97706',
    backgroundColor: '#FEF3C7',
  },
  altName:    { fontSize: 14, fontWeight: '700', color: '#78716C' },
  altNameSel: { color: '#D97706' },
  altPrice:   { fontSize: 18, fontWeight: '800', color: '#1C1917' },
  altPeriod:  { fontSize: 11, color: '#A8A29E' },
  altMembers: { fontSize: 11, color: '#A8A29E', marginTop: 2 },
  selectDotSm: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#D97706',
  },

  // ── Acciones ─────────────────────────────────────────────────
  actions: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  primaryBtn: {
    backgroundColor: '#D97706',
    paddingVertical: 17,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  ghostBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  ghostBtnText: {
    color: '#A8A29E',
    fontSize: 15,
    fontWeight: '500',
  },
  riskText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#78716C',
    fontWeight: '500',
  },
  legalText: {
    fontSize: 11,
    color: '#A8A29E',
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 4,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legalLink: {
    color: '#A8A29E',
    fontSize: 11,
    textDecorationLine: 'underline',
  },
  legalDot: {
    color: '#A8A29E',
    fontSize: 10,
  },
})
