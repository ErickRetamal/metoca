import { Ionicons } from '@expo/vector-icons'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { BorderRadius, Colors } from '../../constants/theme'

type RouteIconName = keyof typeof Ionicons.glyphMap
const TAB_HORIZONTAL_PADDING = 8
const INDICATOR_SIZE = 52
const LABEL_PILL_WIDTH = 64

const OUTER_SHADOW_STYLE = Platform.select({
  web: {
    boxShadow: '0px 8px 18px rgba(15, 23, 42, 0.14)',
  },
  default: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
})

const INDICATOR_SHADOW_STYLE = Platform.select({
  web: {
    boxShadow: '0px 5px 10px rgba(30, 58, 138, 0.28)',
  },
  default: {
    shadowColor: '#1E3A8A',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
})

function resolveIconName(routeName: string, focused: boolean): RouteIconName {
  if (routeName === 'today') {
    return focused ? 'home' : 'home-outline'
  }

  if (routeName === 'my-month') {
    return focused ? 'calendar' : 'calendar-outline'
  }

  if (routeName === 'household-today') {
    return focused ? 'people' : 'people-outline'
  }

  if (routeName === 'household-month') {
    return focused ? 'bar-chart' : 'bar-chart-outline'
  }

  return focused ? 'ellipse' : 'ellipse-outline'
}

function resolveAccentColor(routeName: string): string {
  if (routeName === 'today') return '#2563EB'
  if (routeName === 'my-month') return '#7C3AED'
  if (routeName === 'household-today') return '#0EA5A4'
  if (routeName === 'household-month') return '#EA580C'
  return Colors.primary
}

function resolveShortLabel(routeName: string): string {
  if (routeName === 'today') return 'Hoy'
  if (routeName === 'my-month') return 'Mes'
  if (routeName === 'household-today') return 'Casa'
  if (routeName === 'household-month') return 'Hogar'
  return ''
}

export function MagicTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const [barWidth, setBarWidth] = useState(0)
  const [tabCenters, setTabCenters] = useState<number[]>([])
  const centerX = useRef(new Animated.Value(INDICATOR_SIZE / 2)).current
  const colorIndex = useRef(new Animated.Value(state.index)).current
  const iconScale = useRef(state.routes.map((_, index) => new Animated.Value(index === state.index ? 1.1 : 1))).current

  const tabWidth = useMemo(() => {
    if (state.routes.length === 0) return 0
    const innerWidth = Math.max(0, barWidth - TAB_HORIZONTAL_PADDING * 2)
    return innerWidth / state.routes.length
  }, [barWidth, state.routes.length])

  const activeCenter = useMemo(() => {
    const measuredCenter = tabCenters[state.index]
    if (typeof measuredCenter === 'number') {
      return measuredCenter
    }

    if (tabWidth <= 0) return INDICATOR_SIZE / 2
    return TAB_HORIZONTAL_PADDING + state.index * tabWidth + tabWidth / 2
  }, [state.index, tabWidth, tabCenters])

  const accentColors = useMemo(() => state.routes.map(route => resolveAccentColor(route.name)), [state.routes])
  const activeRouteName = state.routes[state.index]?.name ?? 'today'
  const activeIconName = resolveIconName(activeRouteName, true)

  const indicatorColor = colorIndex.interpolate({
    inputRange: state.routes.map((_, index) => index),
    outputRange: accentColors,
  })

  useEffect(() => {
    Animated.spring(centerX, {
      toValue: activeCenter,
      useNativeDriver: false,
      speed: 16,
      bounciness: 6,
    }).start()
  }, [activeCenter, centerX])

  useEffect(() => {
    Animated.timing(colorIndex, {
      toValue: state.index,
      duration: 220,
      useNativeDriver: false,
    }).start()
  }, [colorIndex, state.index])

  useEffect(() => {
    const animations = iconScale.map((value, index) =>
      Animated.spring(value, {
        toValue: index === state.index ? 1.1 : 1,
        useNativeDriver: false,
        speed: 20,
        bounciness: 4,
      })
    )

    Animated.parallel(animations).start()
  }, [iconScale, state.index])

  const onBarLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout
    if (width !== barWidth) {
      setBarWidth(width)
    }
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.outerShadow}>
        <View style={styles.barClip}>
          <View style={styles.container} onLayout={onBarLayout}>
            <Animated.View
              style={[
                styles.indicator,
                {
                  backgroundColor: indicatorColor,
                  borderColor: indicatorColor,
                  transform: [{ translateX: Animated.subtract(centerX, INDICATOR_SIZE / 2) }],
                },
              ]}
            >
              <Ionicons name={activeIconName} size={22} color={Colors.text.inverse} />

              <View style={styles.activeLabelPill}>
                <Text style={styles.activeLabelPillText}>{resolveShortLabel(activeRouteName)}</Text>
              </View>
            </Animated.View>

            {state.routes.map((route, index) => {
              const focused = state.index === index
              const { options } = descriptors[route.key]

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                })

                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name)
                }
              }

              const onLongPress = () => {
                navigation.emit({
                  type: 'tabLongPress',
                  target: route.key,
                })
              }

              const iconName = resolveIconName(route.name, focused)
              const tintColor = focused ? 'transparent' : '#64748B'
              const accessibilityLabel = options.tabBarAccessibilityLabel ?? options.title ?? route.name

              return (
                <Pressable
                  key={route.key}
                  accessibilityRole="button"
                  accessibilityState={focused ? { selected: true } : {}}
                  accessibilityLabel={accessibilityLabel}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  style={styles.tabButton}
                  onLayout={event => {
                    const { x, width } = event.nativeEvent.layout
                    const center = x + width / 2

                    setTabCenters(prev => {
                      if (prev[index] === center) return prev
                      const next = [...prev]
                      next[index] = center
                      return next
                    })
                  }}
                >
                  <Animated.View style={[styles.iconWrap, { transform: [{ scale: iconScale[index] }] }]}>
                    <Ionicons name={iconName} size={22} color={tintColor} />
                  </Animated.View>
                </Pressable>
              )
            })}
          </View>
        </View>

      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: Platform.OS === 'ios' ? 18 : 12,
    pointerEvents: 'box-none',
  },
  outerShadow: {
    overflow: 'visible',
    ...OUTER_SHADOW_STYLE,
  },
  barClip: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  container: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#D6DEEE',
    minHeight: 74,
    paddingHorizontal: 8,
    overflow: 'visible',
  },
  tabButton: {
    flex: 1,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  iconWrap: {
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeLabelPill: {
    position: 'absolute',
    width: LABEL_PILL_WIDTH,
    left: (INDICATOR_SIZE - LABEL_PILL_WIDTH) / 2,
    bottom: -15,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#D6DEEE',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  activeLabelPillText: {
    color: '#334155',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
    width: '100%',
  },
  indicator: {
    position: 'absolute',
    top: 9,
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...INDICATOR_SHADOW_STYLE,
    zIndex: 1,
  },
})
