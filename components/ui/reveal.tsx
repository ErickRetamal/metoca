import { ReactNode, useEffect, useRef } from 'react'
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native'

interface RevealProps {
  children: ReactNode
  delay?: number
  distance?: number
  style?: StyleProp<ViewStyle>
}

export function Reveal({ children, delay = 0, distance = 16, style }: RevealProps) {
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 420,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()
  }, [delay, progress])

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [distance, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  )
}