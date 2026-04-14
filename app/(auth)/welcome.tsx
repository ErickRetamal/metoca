import { useEffect, useRef } from 'react'
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { BorderRadius, Spacing } from '../../constants/theme'

const PREVIEW = [
  { code: 'LR', label: 'Lavar ropa', sub: 'Semanal · Mie', bg: '#DCFCE7', fg: '#166534' },
  { code: 'HC', label: 'Hacer camas', sub: 'Diaria · 08:00', bg: '#FEF3C7', fg: '#92400E' },
  { code: 'LP', label: 'Lavar platos', sub: 'Diaria · 20:00', bg: '#DBEAFE', fg: '#1D4ED8' },
]

const HOUSE_IDLE_SCALE = 1.03
const HOUSE_ENTRY_SCALE = 2.35
const HOUSE_ENTRY_TRANSLATE_Y = -190
const VALUE_PROP_BG = '#FFFBF5'

export default function WelcomeScreen() {
  const reveal = useRef(new Animated.Value(0)).current
  const contentFade = useRef(new Animated.Value(1)).current
  const driftOne = useRef(new Animated.Value(0)).current
  const driftTwo = useRef(new Animated.Value(0)).current
  const driftThree = useRef(new Animated.Value(0)).current
  const doorGlow = useRef(new Animated.Value(0)).current
  const doorLeftOpen = useRef(new Animated.Value(0)).current
  const doorRightOpen = useRef(new Animated.Value(0)).current
  const houseScale = useRef(new Animated.Value(HOUSE_IDLE_SCALE)).current
  const houseTranslateY = useRef(new Animated.Value(0)).current
  const flashOpacity = useRef(new Animated.Value(0)).current

  const navigatingRef = useRef(false)

  useEffect(() => {
    Animated.timing(reveal, {
      toValue: 1,
      duration: 680,
      delay: 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()

    const createLoop = (value: Animated.Value, duration: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 1,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      )

    const loopOne = createLoop(driftOne, 3400)
    const loopTwo = createLoop(driftTwo, 4100)
    const loopThree = createLoop(driftThree, 2800)

    loopOne.start()
    loopTwo.start()
    loopThree.start()

    return () => {
      loopOne.stop()
      loopTwo.stop()
      loopThree.stop()
    }
  }, [driftOne, driftTwo, driftThree, reveal])

  function handlePress(path: '/(auth)/value-prop' | '/(auth)/login') {
    if (navigatingRef.current) return
    navigatingRef.current = true

    Animated.parallel([
      Animated.sequence([
        Animated.delay(120),
        Animated.timing(contentFade, {
          toValue: 0,
          duration: 240,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(doorGlow, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(doorLeftOpen, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(doorRightOpen, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(180),
        Animated.timing(houseScale, {
          toValue: HOUSE_ENTRY_SCALE,
          duration: 980,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(180),
        Animated.timing(houseTranslateY, {
          toValue: HOUSE_ENTRY_TRANSLATE_Y,
          duration: 980,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(620),
        Animated.timing(flashOpacity, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      router.push(path)
      navigatingRef.current = false
      houseScale.setValue(HOUSE_IDLE_SCALE)
      houseTranslateY.setValue(0)
      flashOpacity.setValue(0)
      contentFade.setValue(1)
      doorGlow.setValue(0)
      doorLeftOpen.setValue(0)
      doorRightOpen.setValue(0)
    })
  }

  const driftFront = driftOne.interpolate({ inputRange: [0, 1], outputRange: [0, -10] })
  const driftMiddle = driftTwo.interpolate({ inputRange: [0, 1], outputRange: [0, -14] })
  const driftBack = driftThree.interpolate({ inputRange: [0, 1], outputRange: [0, -8] })

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <Animated.Image
        source={require('../../assets/images/onboarding/welcome-bg.png.png')}
        style={[
          styles.photoBg,
          { transform: [{ scale: houseScale }, { translateY: houseTranslateY }] },
        ]}
        resizeMode="cover"
      />

      <View style={styles.veil} />

      <Animated.View pointerEvents="none" style={[styles.flash, { opacity: flashOpacity }]} />

      <Animated.View
        style={[
          styles.inner,
          {
            opacity: reveal,
            transform: [
              { translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
            ],
          },
        ]}
      >
        <Animated.View style={[styles.innerContent, { opacity: contentFade }]}>
          <View style={styles.topContent}>
            <View style={styles.brand}>
              <View style={styles.wordmark}>
                <View style={styles.wordmarkDot} />
                <Text style={styles.wordmarkLabel}>MeToca</Text>
              </View>
              <Text style={styles.tagline}>{'Hogar ordenado,\nsin discusiones.'}</Text>
            </View>

            <View style={styles.hero}>
              <View style={styles.deck}>
                <Animated.View style={[styles.card, { transform: [{ rotate: '-5.5deg' }, { translateY: driftBack }] }]}>
                  <View style={[styles.thumb, { backgroundColor: PREVIEW[0].bg }]}>
                    <Text style={[styles.code, { color: PREVIEW[0].fg }]}>{PREVIEW[0].code}</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardLabel}>{PREVIEW[0].label}</Text>
                    <Text style={styles.cardSub}>{PREVIEW[0].sub}</Text>
                  </View>
                </Animated.View>

                <Animated.View style={[styles.card, styles.cardMid, { transform: [{ rotate: '3deg' }, { translateY: driftMiddle }] }]}>
                  <View style={[styles.thumb, { backgroundColor: PREVIEW[1].bg }]}>
                    <Text style={[styles.code, { color: PREVIEW[1].fg }]}>{PREVIEW[1].code}</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardLabel}>{PREVIEW[1].label}</Text>
                    <Text style={styles.cardSub}>{PREVIEW[1].sub}</Text>
                  </View>
                </Animated.View>

                <Animated.View style={[styles.card, styles.cardFront, { transform: [{ translateY: driftFront }] }]}>
                  <View style={[styles.thumb, { backgroundColor: PREVIEW[2].bg }]}>
                    <Text style={[styles.code, { color: PREVIEW[2].fg }]}>{PREVIEW[2].code}</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardLabel}>{PREVIEW[2].label}</Text>
                    <Text style={styles.cardSub}>{PREVIEW[2].sub}</Text>
                  </View>
                  <View style={[styles.checkBadge, { backgroundColor: PREVIEW[2].fg }]}>
                    <Text style={styles.checkText}>✓</Text>
                  </View>
                </Animated.View>
              </View>
            </View>
          </View>

          <View style={styles.bottomContent}>
            <View style={styles.actions}>
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.buttonPressed]}
                onPress={() => handlePress('/(auth)/value-prop')}
              >
                <Text style={styles.primaryBtnText}>Comenzar gratis</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.ghostBtn, pressed && styles.buttonPressed]}
                onPress={() => handlePress('/(auth)/login')}
              >
                <Text style={styles.ghostBtnText}>Ya tengo cuenta</Text>
              </Pressable>
            </View>

            <Text style={styles.legal}>Gratis para siempre · Sin tarjeta de credito</Text>
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1C0F05',
    overflow: 'hidden',
  },
  photoBg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  veil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28,15,5,0.30)',
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: VALUE_PROP_BG,
    zIndex: 10,
  },
  inner: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.lg,
  },
  innerContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topContent: {
    flex: 1,
    paddingTop: 4,
  },
  bottomContent: {
    gap: Spacing.sm,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 18,
  },
  deck: {
    alignItems: 'center',
    width: '100%',
    marginTop: -10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    width: 248,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 22,
    elevation: 12,
  },
  cardMid: {
    marginTop: -36,
  },
  cardFront: {
    marginTop: -30,
  },
  thumb: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  code: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  cardInfo: {
    flex: 1,
  },
  cardLabel: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  cardSub: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  checkBadge: {
    width: 26,
    height: 26,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  brand: {
    gap: Spacing.sm,
    paddingTop: 8,
  },
  wordmark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  wordmarkDot: {
    width: 9,
    height: 9,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F59E0B',
  },
  wordmarkLabel: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  tagline: {
    color: '#FEF3C7',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 38,
  },
  actions: {
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
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
    paddingVertical: 15,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(254,243,199,0.20)',
  },
  ghostBtnText: {
    color: 'rgba(254,243,199,0.65)',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonPressed: {
    opacity: 0.75,
  },
  legal: {
    textAlign: 'center',
    color: 'rgba(254,243,199,0.28)',
    fontSize: 12,
    fontWeight: '500',
  },
})
