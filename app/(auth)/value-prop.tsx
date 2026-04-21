import { useRef } from 'react'
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { BorderRadius, Spacing } from '../../constants/theme'

const ENTRY_SCALE = 2.1
const ENTRY_TRANSLATE_Y = -150

const PAIN_POINTS = [
  {
    icon: '🧠',
    title: 'Siempre eres tú quien se acuerda',
    desc: 'Mentalmente cargas con todo mientras los demás olvidan.',
  },
  {
    icon: '😤',
    title: 'Las mismas personas, siempre',
    desc: 'La carga no se reparte. Y eso genera tensión.',
  },
  {
    icon: '🤷',
    title: '"No sabía que me tocaba"',
    desc: 'Sin claridad, no hay responsabilidad. Todos pierden.',
  },
]

export default function ValuePropScreen() {
  const reveal = useRef(new Animated.Value(0)).current
  const contentFade = useRef(new Animated.Value(1)).current
  const sceneScale = useRef(new Animated.Value(1)).current
  const sceneTranslateY = useRef(new Animated.Value(0)).current
  const flashOpacity = useRef(new Animated.Value(0)).current
  const navigatingRef = useRef(false)

  const startReveal = () => {
    Animated.timing(reveal, {
      toValue: 1,
      duration: 540,
      delay: 80,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }

  const handleContinue = () => {
    if (navigatingRef.current) return
    navigatingRef.current = true

    Animated.parallel([
      Animated.timing(contentFade, {
        toValue: 0,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(120),
        Animated.timing(sceneScale, {
          toValue: ENTRY_SCALE,
          duration: 920,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(120),
        Animated.timing(sceneTranslateY, {
          toValue: ENTRY_TRANSLATE_Y,
          duration: 920,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(610),
        Animated.timing(flashOpacity, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      router.push('/(auth)/how-it-works')
      navigatingRef.current = false
      contentFade.setValue(1)
      sceneScale.setValue(1)
      sceneTranslateY.setValue(0)
      flashOpacity.setValue(0)
    })
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <Animated.Image
        source={require('../../assets/images/onboarding/value-prop.png.png')}
        style={[
          styles.photoBg,
          { transform: [{ scale: sceneScale }, { translateY: sceneTranslateY }] },
        ]}
        resizeMode="cover"
        onLoad={startReveal}
      />
      <View style={styles.photoVeil} />
      <Animated.View pointerEvents="none" style={[styles.flash, { opacity: flashOpacity }]} />

      <Animated.View style={[
        styles.inner,
        {
          opacity: reveal,
          transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        },
      ]}>
        <Animated.View style={[styles.contentFadeLayer, { opacity: contentFade }]}>
        {/* Eyebrow */}
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowDot} />
          <Text style={styles.eyebrow}>MeToca · Onboarding</Text>
        </View>

        {/* Título */}
        <Text style={styles.headline}>{'¿Siempre te\ntoca a ti?'}</Text>
        <Text style={styles.sub}>
          En la mayoría de hogares, la carga mental recae en una sola persona. Eso tiene solución.
        </Text>

        {/* Cards de pain */}
        <View style={styles.cards}>
          {PAIN_POINTS.map((item, i) => (
            <View key={i} style={styles.card}>
              <View style={styles.iconWrap}>
                <Text style={styles.icon}>{item.icon}</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDesc}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTA */}
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.86 }]}
            onPress={handleContinue}
          >
            <Text style={styles.primaryBtnText}>Así lo resolvemos →</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.6 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.ghostBtnText}>Volver</Text>
          </Pressable>
        </View>
        </Animated.View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFBF5',   // crema cálido — tono "hogar"
    overflow: 'hidden',
  },
  photoBg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  photoVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,251,245,0.66)',
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFBF5',
    zIndex: 8,
  },
  topAccent: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: BorderRadius.full,
    backgroundColor: '#FEF3C7',   // amarillo miel muy suave
    opacity: 0.7,
  },
  wallSplit: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '60%',
    height: 1,
    backgroundColor: 'rgba(217, 119, 6, 0.10)',
  },
  floorBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '40%',
    backgroundColor: 'rgba(146, 64, 14, 0.07)',
  },
  baseboard: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '60%',
    height: 10,
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
  },
  bgScene: {
    ...StyleSheet.absoluteFillObject,
  },
  bgObject: {
    position: 'absolute',
    opacity: 0.36,
  },
  frameWrap: {
    top: 96,
    right: 18,
    width: 124,
    height: 96,
  },
  frameOuter: {
    width: 124,
    height: 96,
    borderRadius: 10,
    borderWidth: 7,
    borderColor: '#C79A63',
    backgroundColor: '#FDE7B0',
    padding: 9,
  },
  frameInner: {
    flex: 1,
    borderRadius: 6,
    backgroundColor: '#FFF8EE',
    overflow: 'hidden',
  },
  frameArtA: {
    position: 'absolute',
    left: 10,
    bottom: 0,
    width: 28,
    height: 28,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: '#DFAE6D',
  },
  frameArtB: {
    position: 'absolute',
    right: 10,
    bottom: 6,
    width: 48,
    height: 36,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: '#F2D7A6',
  },
  coatRackWrap: {
    left: -6,
    bottom: 216,
    width: 86,
    height: 176,
  },
  coatPole: {
    position: 'absolute',
    left: 34,
    top: 18,
    width: 8,
    height: 124,
    borderRadius: 999,
    backgroundColor: '#B45309',
  },
  coatHookA: {
    position: 'absolute',
    left: 14,
    top: 26,
    width: 30,
    height: 8,
    borderTopLeftRadius: 7,
    borderBottomLeftRadius: 7,
    backgroundColor: '#B45309',
  },
  coatHookB: {
    position: 'absolute',
    left: 42,
    top: 26,
    width: 28,
    height: 8,
    borderTopRightRadius: 7,
    borderBottomRightRadius: 7,
    backgroundColor: '#B45309',
  },
  coatScarf: {
    position: 'absolute',
    left: 7,
    top: 34,
    width: 24,
    height: 54,
    borderRadius: 10,
    backgroundColor: '#D97706',
  },
  coatBase: {
    position: 'absolute',
    left: 22,
    bottom: 16,
    width: 32,
    height: 9,
    borderRadius: 7,
    backgroundColor: '#A16207',
  },
  benchWrap: {
    right: -2,
    bottom: 148,
    width: 154,
    height: 92,
  },
  benchTop: {
    position: 'absolute',
    top: 8,
    left: 16,
    width: 122,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#B45309',
  },
  benchLegA: {
    position: 'absolute',
    left: 24,
    top: 18,
    width: 8,
    height: 50,
    borderRadius: 4,
    backgroundColor: '#92400E',
  },
  benchLegB: {
    position: 'absolute',
    right: 24,
    top: 18,
    width: 8,
    height: 50,
    borderRadius: 4,
    backgroundColor: '#92400E',
  },
  benchShelf: {
    position: 'absolute',
    left: 20,
    bottom: 16,
    width: 114,
    height: 8,
    borderRadius: 5,
    backgroundColor: '#A16207',
  },
  rugWrap: {
    left: '50%',
    marginLeft: -78,
    bottom: 112,
    width: 156,
    height: 48,
  },
  rugOuter: {
    width: 156,
    height: 48,
    borderRadius: 18,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rugInner: {
    width: 128,
    height: 28,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D97706',
  },
  inner: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl + 8,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  contentFadeLayer: {
    flex: 1,
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
    fontSize: 38,
    fontWeight: '800',
    color: '#1C1917',
    letterSpacing: -0.8,
    lineHeight: 46,
    marginTop: Spacing.xs,
  },
  sub: {
    fontSize: 15,
    color: '#57534E',
    lineHeight: 23,
  },
  cards: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: Spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: '#FFF8EE',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    shadowColor: '#92400E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 22,
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1917',
  },
  cardDesc: {
    fontSize: 13,
    color: '#78716C',
    lineHeight: 19,
  },
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
