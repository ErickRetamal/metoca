import { useRef } from 'react'
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { BorderRadius, Spacing } from '../../constants/theme'

const STEPS = [
  {
    number: '01',
    icon: '🏡',
    title: 'Crea tu hogar',
    desc: 'El admin agrega las tareas del mes y define quiénes viven en casa.',
    accent: '#FEF3C7',
    border: '#FDE68A',
  },
  {
    number: '02',
    icon: '🔄',
    title: 'MeToca asigna y rota',
    desc: 'El día 15 se publican las asignaciones. Cada mes rotan automáticamente.',
    accent: '#FFF0E6',
    border: '#FBCFAC',
  },
  {
    number: '03',
    icon: '🔔',
    title: 'Te avisamos cuando te toca',
    desc: 'Notificación el mismo día que tienes que hacer algo. Sin excusas.',
    accent: '#F0FDF4',
    border: '#BBF7D0',
  },
]

export default function HowItWorksScreen() {
  const reveal = useRef(new Animated.Value(0)).current

  const startReveal = () => {
    Animated.timing(reveal, {
      toValue: 1, duration: 520, delay: 60,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start()
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <Image
        source={require('../../assets/images/onboarding/how-it-works.png.png')}
        style={styles.photoBg}
        resizeMode="cover"
        onLoad={startReveal}
      />
      <View style={styles.photoVeil} />

      <Animated.View style={[
        styles.inner,
        {
          opacity: reveal,
          transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }],
        },
      ]}>
        {/* Eyebrow */}
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowDot} />
          <Text style={styles.eyebrow}>MeToca · Cómo funciona</Text>
        </View>

        <Text style={styles.headline}>{'Simple, justo\ny automático.'}</Text>

        {/* Steps */}
        <View style={styles.steps}>
          {STEPS.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              {/* Línea de tiempo */}
              <View style={styles.timeline}>
                <View style={styles.numBadge}>
                  <Text style={styles.numText}>{step.number}</Text>
                </View>
                {i < STEPS.length - 1 && <View style={styles.connector} />}
              </View>

              {/* Card */}
              <View style={[styles.card, { backgroundColor: step.accent, borderColor: step.border }]}>
                <Text style={styles.cardIcon}>{step.icon}</Text>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{step.title}</Text>
                  <Text style={styles.cardDesc}>{step.desc}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Acciones */}
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.86 }]}
            onPress={() => router.push('/(auth)/register')}
          >
            <Text style={styles.primaryBtnText}>Crear mi cuenta →</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.6 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.ghostBtnText}>Volver</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFBF5',
    overflow: 'hidden',
  },
  photoBg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  photoVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,251,245,0.62)',
  },
  blobTR: {
    position: 'absolute',
    top: -100,
    right: -90,
    width: 300,
    height: 300,
    borderRadius: 999,
    backgroundColor: '#FEF3C7',
    opacity: 0.7,
  },
  blobBL: {
    position: 'absolute',
    bottom: -80,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: '#FDE68A',
    opacity: 0.25,
  },
  // ── Decoración bg ───────────────────────────────────────────
  bgObj: {
    position: 'absolute',
    opacity: 0.38,
  },
  wrenchWrap: {
    top: 80,
    left: -18,
    width: 54,
    height: 160,
  },
  wrenchHead: {
    width: 54,
    height: 32,
    borderRadius: 16,
    borderWidth: 10,
    borderColor: '#DFAE6D',
    backgroundColor: 'transparent',
    alignSelf: 'center',
  },
  wrenchNeck: {
    width: 16,
    height: 24,
    backgroundColor: '#DFAE6D',
    alignSelf: 'center',
  },
  wrenchHandle: {
    width: 20,
    height: 90,
    borderRadius: 10,
    backgroundColor: '#DFAE6D',
    alignSelf: 'center',
  },
  mugWrap: {
    bottom: 140,
    right: -12,
    width: 84,
    height: 110,
  },
  mugBody: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 66,
    height: 70,
    borderRadius: 12,
    backgroundColor: '#FDE7B0',
  },
  mugHandle: {
    position: 'absolute',
    right: -16,
    top: 14,
    width: 20,
    height: 32,
    borderRadius: 99,
    borderWidth: 8,
    borderColor: '#FDE7B0',
    backgroundColor: 'transparent',
  },
  steamA: {
    position: 'absolute',
    bottom: 68,
    left: 16,
    width: 6,
    height: 24,
    borderRadius: 99,
    backgroundColor: '#DFAE6D',
    opacity: 0.6,
  },
  steamB: {
    position: 'absolute',
    bottom: 72,
    left: 34,
    width: 6,
    height: 18,
    borderRadius: 99,
    backgroundColor: '#DFAE6D',
    opacity: 0.5,
  },
  // ── Layout ──────────────────────────────────────────────────
  inner: {
    flex: 1,
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
    fontSize: 36,
    fontWeight: '800',
    color: '#1C1917',
    letterSpacing: -0.6,
    lineHeight: 44,
    marginTop: Spacing.xs,
  },
  // ── Timeline + Cards ────────────────────────────────────────
  steps: {
    flex: 1,
    justifyContent: 'center',
    gap: 0,
  },
  stepRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'stretch',
  },
  timeline: {
    alignItems: 'center',
    width: 38,
  },
  numBadge: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    backgroundColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  numText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.4,
  },
  connector: {
    width: 2,
    flex: 1,
    backgroundColor: '#FDE68A',
    marginVertical: 4,
  },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
    shadowColor: '#92400E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardIcon: {
    fontSize: 24,
    lineHeight: 30,
  },
  cardBody: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1917',
  },
  cardDesc: {
    fontSize: 13,
    color: '#78716C',
    lineHeight: 20,
  },
  // ── Acciones ─────────────────────────────────────────────────
  actions: {
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  primaryBtn: {
    backgroundColor: '#D97706',
    paddingVertical: 16,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  ghostBtn: {
    paddingVertical: 13,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  ghostBtnText: {
    color: '#A8A29E',
    fontSize: 15,
    fontWeight: '500',
  },
})
