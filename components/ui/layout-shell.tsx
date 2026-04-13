import { StatusBar } from 'expo-status-bar'
import { ReactNode, useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import { BorderRadius, LayoutThemes } from '../../constants/theme'

export type LayoutShellVariant = keyof typeof LayoutThemes

interface LayoutShellProps {
  variant: LayoutShellVariant
  children: ReactNode
}

export function LayoutShell({ variant, children }: LayoutShellProps) {
  const palette = LayoutThemes[variant]
  const reveal = useRef(new Animated.Value(0)).current
  const drift = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const revealAnimation = Animated.timing(reveal, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    })

    const driftAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 5400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 5400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    )

    revealAnimation.start()
    driftAnimation.start()

    return () => {
      reveal.stopAnimation()
      drift.stopAnimation()
      driftAnimation.stop()
    }
  }, [drift, reveal])

  const contentOpacity = reveal
  const contentTranslateY = reveal.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  })

  const orbOneTranslateY = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 14],
  })

  const orbTwoTranslateY = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [12, -12],
  })

  const orbThreeTranslateX = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 10],
  })

  return (
    <View style={[styles.root, { backgroundColor: palette.background }]}>
      <StatusBar style={palette.statusBar} />

      <Animated.View
        style={[
          styles.orb,
          styles.orbTop,
          {
            backgroundColor: palette.orbPrimary,
            transform: [{ translateY: orbOneTranslateY }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.orb,
          styles.orbRight,
          {
            backgroundColor: palette.orbSecondary,
            transform: [{ translateY: orbTwoTranslateY }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.orb,
          styles.orbBottom,
          {
            backgroundColor: palette.orbAccent,
            transform: [{ translateX: orbThreeTranslateX }],
          },
        ]}
      />

      <View style={[styles.veil, { backgroundColor: palette.veil }]} />
      <View style={[styles.frame, { borderColor: palette.frame }]} />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: contentOpacity,
            transform: [{ translateY: contentTranslateY }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
  veil: {
    ...StyleSheet.absoluteFillObject,
  },
  frame: {
    ...StyleSheet.absoluteFillObject,
    top: 10,
    bottom: 10,
    left: 10,
    right: 10,
    borderWidth: 1,
    borderRadius: 28,
  },
  orb: {
    position: 'absolute',
    borderRadius: BorderRadius.full,
  },
  orbTop: {
    width: 280,
    height: 280,
    top: -110,
    left: -70,
  },
  orbRight: {
    width: 320,
    height: 320,
    top: 110,
    right: -120,
  },
  orbBottom: {
    width: 260,
    height: 260,
    bottom: -90,
    left: 36,
  },
})