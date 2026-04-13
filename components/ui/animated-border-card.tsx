import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleProp, StyleSheet, ViewStyle } from 'react-native'
import { BorderRadius } from '../../constants/theme'

interface AnimatedBorderCardProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  delayMs?: number
  tone?: 'blue' | 'violet' | 'teal' | 'amber'
}

function resolveToneOutput(tone: 'blue' | 'violet' | 'teal' | 'amber') {
  if (tone === 'violet') return ['#1E1B4B', '#7C3AED', '#4F46E5']
  if (tone === 'teal') return ['#042F2E', '#14B8A6', '#0EA5A4']
  if (tone === 'amber') return ['#3F2A0B', '#F59E0B', '#EA580C']
  return ['#1E293B', '#3B82F6', '#14B8A6']
}

export function AnimatedBorderCard({ children, style, delayMs = 0, tone = 'blue' }: AnimatedBorderCardProps) {
  const phase = useRef(new Animated.Value(0)).current
  const toneOutput = resolveToneOutput(tone)

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(phase, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
          delay: delayMs,
        }),
        Animated.timing(phase, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
      ])
    )

    loop.start()

    return () => {
      loop.stop()
    }
  }, [delayMs, phase])

  const borderColor = phase.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: toneOutput,
  })

  const glowOpacity = phase.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.15, 0.42, 0.22],
  })

  const glowScale = phase.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.98, 1.02, 1],
  })

  return (
    <Animated.View style={[styles.outer, { borderColor }, style]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            borderColor,
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      />
      {children}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: BorderRadius.md,
    borderWidth: 1.4,
    backgroundColor: '#0F172A',
    overflow: 'hidden',
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#60A5FA',
  },
})
