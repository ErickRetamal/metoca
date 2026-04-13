import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Colors, Spacing, BorderRadius } from '../../constants/theme'

const PLANS = [
  {
    id: 'free',
    name: 'Gratis',
    price: '$0',
    period: 'para siempre',
    members: '2 personas',
    features: ['Hasta 2 miembros', 'Notificaciones básicas', 'Vista del mes actual'],
    highlighted: false,
    revenucatId: null,
  },
  {
    id: 'hogar',
    name: 'Hogar',
    price: '$2.990',
    period: 'al mes',
    members: '5 personas',
    features: ['Hasta 5 miembros', 'Notificaciones con acción directa', 'Historial de meses anteriores', 'Reporte mensual'],
    highlighted: true,
    revenucatId: 'metoca_hogar_monthly',
  },
  {
    id: 'familia',
    name: 'Familia',
    price: '$4.990',
    period: 'al mes',
    members: '10 personas',
    features: ['Hasta 10 miembros', 'Todo lo del plan Hogar', 'Prioridad en soporte'],
    highlighted: false,
    revenucatId: 'metoca_familia_monthly',
  },
]

export default function PaywallScreen() {
  const router = useRouter()
  const [selectedPlan, setSelectedPlan] = useState('hogar')
  const [loading, setLoading] = useState(false)

  const handleSubscribe = async () => {
    const plan = PLANS.find(p => p.id === selectedPlan)
    if (!plan) return

    if (plan.id === 'free') {
      router.replace('/(app)/(tabs)/today')
      return
    }

    // TODO: conectar con RevenueCat cuando se configuren los productos
    Alert.alert(
      'Próximamente',
      'La suscripción de pago estará disponible muy pronto. Por ahora puedes usar el plan gratis.',
      [{ text: 'Continuar gratis', onPress: () => router.replace('/(app)/(tabs)/today') }]
    )
  }

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.headline}>Elige tu plan</Text>
        <Text style={styles.subtext}>Cambia o cancela cuando quieras.</Text>
      </View>

      <View style={styles.plans}>
        {PLANS.map(plan => (
          <TouchableOpacity
            key={plan.id}
            style={[
              styles.planCard,
              plan.highlighted && styles.planCardHighlighted,
              selectedPlan === plan.id && styles.planCardSelected,
            ]}
            onPress={() => setSelectedPlan(plan.id)}
            activeOpacity={0.85}
          >
            {plan.highlighted && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Más popular</Text>
              </View>
            )}

            <View style={styles.planHeader}>
              <View>
                <Text style={[styles.planName, plan.highlighted && styles.planNameHighlighted]}>
                  {plan.name}
                </Text>
                <Text style={styles.planMembers}>{plan.members}</Text>
              </View>
              <View style={styles.planPriceContainer}>
                <Text style={[styles.planPrice, plan.highlighted && styles.planPriceHighlighted]}>
                  {plan.price}
                </Text>
                <Text style={styles.planPeriod}>{plan.period}</Text>
              </View>
            </View>

            <View style={styles.featureList}>
              {plan.features.map((feature, i) => (
                <View key={i} style={styles.featureRow}>
                  <Text style={styles.featureCheck}>✓</Text>
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.radioOuter, selectedPlan === plan.id && styles.radioOuterSelected]}>
              {selectedPlan === plan.id && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
          onPress={handleSubscribe}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={Colors.text.inverse} />
            : <Text style={styles.primaryButtonText}>
                {selectedPlan === 'free' ? 'Continuar gratis' : `Suscribirme al plan ${PLANS.find(p => p.id === selectedPlan)?.name}`}
              </Text>
          }
        </TouchableOpacity>

        {selectedPlan !== 'free' && (
          <TouchableOpacity
            style={styles.freeLink}
            onPress={() => router.replace('/(app)/(tabs)/today')}
            activeOpacity={0.7}
          >
            <Text style={styles.freeLinkText}>Continuar con el plan gratis</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.legalText}>
          Precios en CLP. Se renueva automáticamente. Cancela cuando quieras desde la tienda de apps.
        </Text>

        <View style={styles.legalLinksRow}>
          <TouchableOpacity onPress={() => router.push('/(auth)/privacy-policy')} activeOpacity={0.7}>
            <Text style={styles.legalLink}>Politica de privacidad</Text>
          </TouchableOpacity>
          <Text style={styles.legalDot}>•</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/terms-of-use')} activeOpacity={0.7}>
            <Text style={styles.legalLink}>Terminos de uso</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xl,
    gap: Spacing.lg,
  },
  header: {
    gap: Spacing.xs,
  },
  headline: {
    fontSize: 30,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  subtext: {
    fontSize: 15,
    color: Colors.text.secondary,
  },
  plans: {
    gap: Spacing.md,
  },
  planCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
    position: 'relative',
  },
  planCardHighlighted: {
    borderColor: Colors.primary,
  },
  planCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}08`,
  },
  badge: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    color: Colors.text.inverse,
    fontSize: 12,
    fontWeight: '600',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: Spacing.xs,
    paddingRight: 26,
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  planNameHighlighted: {
    color: Colors.primary,
  },
  planMembers: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  planPriceContainer: {
    alignItems: 'flex-end',
  },
  planPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  planPriceHighlighted: {
    color: Colors.primary,
  },
  planPeriod: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  featureList: {
    gap: Spacing.xs,
  },
  featureRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  featureCheck: {
    color: Colors.success,
    fontWeight: '700',
    fontSize: 14,
  },
  featureText: {
    fontSize: 14,
    color: Colors.text.secondary,
    flex: 1,
  },
  radioOuter: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 20,
    height: 20,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
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
  freeLink: {
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  freeLinkText: {
    color: Colors.text.secondary,
    fontSize: 14,
  },
  legalText: {
    fontSize: 12,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: Spacing.xs,
  },
  legalLinksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legalLink: {
    color: Colors.text.secondary,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  legalDot: {
    color: Colors.muted,
    fontSize: 11,
  },
})
