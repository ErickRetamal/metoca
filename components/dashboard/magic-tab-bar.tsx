import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { BorderRadius, Colors } from '../../constants/theme'

type RouteIconName =
  | 'home'
  | 'home-outline'
  | 'calendar'
  | 'calendar-outline'
  | 'people'
  | 'people-outline'
  | 'bar-chart'
  | 'bar-chart-outline'
  | 'ellipse'
  | 'ellipse-outline'

const TAB_HORIZONTAL_PADDING = 8
const INDICATOR_SIZE = 52
const LABEL_PILL_WIDTH = 64
const HIDDEN_TAB_ROUTES = new Set(['task-month-detail', 'household-task-month-detail'])

const OUTER_SHADOW_STYLE = Platform.select({
  web: {
    boxShadow: '0px 8px 18px rgba(90, 64, 45, 0.16)',
  },
  default: {
    shadowColor: '#5A402D',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
})

const INDICATOR_SHADOW_STYLE = Platform.select({
  web: {
    boxShadow: '0px 5px 10px rgba(180, 83, 9, 0.32)',
  },
  default: {
    shadowColor: '#B45309',
    shadowOpacity: 0.32,
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
  if (routeName === 'today') return '#C96B2C'
  if (routeName === 'my-month') return '#8F5B3E'
  if (routeName === 'household-today') return '#5D8A64'
  if (routeName === 'household-month') return '#B6493A'
  return Colors.primary
}

function resolveShortLabel(routeName: string): string {
  if (routeName === 'today') return 'Hoy'
  if (routeName === 'my-month') return 'Mes'
  if (routeName === 'household-today') return 'Casa'
  if (routeName === 'household-month') return 'Hogar'
  return ''
}

function resolveIconGlyph(iconName: RouteIconName): string {
  if (iconName === 'home') return '⌂'
  if (iconName === 'home-outline') return '⌂'
  if (iconName === 'calendar') return '◫'
  if (iconName === 'calendar-outline') return '◫'
  if (iconName === 'people') return '◉'
  if (iconName === 'people-outline') return '◉'
  if (iconName === 'bar-chart') return '▮'
  if (iconName === 'bar-chart-outline') return '▯'
  if (iconName === 'ellipse') return '●'
  return '○'
}

export function MagicTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const [barWidth, setBarWidth] = useState(0)
  const [tabCenters, setTabCenters] = useState<number[]>([])
  const centerX = useRef(new Animated.Value(INDICATOR_SIZE / 2)).current
  const colorIndex = useRef(new Animated.Value(state.index)).current
  const iconScale = useRef(state.routes.map((_, index) => new Animated.Value(index === state.index ? 1.1 : 1))).current

  const visibleRoutes = useMemo(
    () => state.routes.filter(route => !HIDDEN_TAB_ROUTES.has(route.name)),
    [state.routes]
  )

  const activeVisibleIndex = useMemo(() => {
    const activeKey = state.routes[state.index]?.key
    const found = visibleRoutes.findIndex(route => route.key === activeKey)
    return found >= 0 ? found : 0
  }, [state.routes, state.index, visibleRoutes])

  const tabWidth = useMemo(() => {
    if (visibleRoutes.length === 0) return 0
    const innerWidth = Math.max(0, barWidth - TAB_HORIZONTAL_PADDING * 2)
    return innerWidth / visibleRoutes.length
  }, [barWidth, visibleRoutes.length])

  const activeCenter = useMemo(() => {
    const measuredCenter = tabCenters[activeVisibleIndex]
    if (typeof measuredCenter === 'number') {
      return measuredCenter
    }

    if (tabWidth <= 0) return INDICATOR_SIZE / 2
    return TAB_HORIZONTAL_PADDING + activeVisibleIndex * tabWidth + tabWidth / 2
  }, [activeVisibleIndex, tabWidth, tabCenters])

  const accentColors = useMemo(() => visibleRoutes.map(route => resolveAccentColor(route.name)), [visibleRoutes])
  const activeRouteName = visibleRoutes[activeVisibleIndex]?.name ?? visibleRoutes[0]?.name ?? 'today'
  const activeIconName = resolveIconName(activeRouteName, true)

  const indicatorColor = colorIndex.interpolate({
    inputRange: accentColors.map((_, index) => index),
    outputRange: accentColors.length > 0 ? accentColors : [Colors.primary],
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
      toValue: activeVisibleIndex,
      duration: 220,
      useNativeDriver: false,
    }).start()
  }, [colorIndex, activeVisibleIndex])

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
              <Text style={styles.activeIconText}>{resolveIconGlyph(activeIconName)}</Text>

              <View style={styles.activeLabelPill}>
                <Text style={styles.activeLabelPillText}>{resolveShortLabel(activeRouteName)}</Text>
              </View>
            </Animated.View>

            {visibleRoutes.map((route, index) => {
              const routeIndex = state.routes.findIndex(item => item.key === route.key)
              const focused = state.index === routeIndex
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
              const tintColor = focused ? 'transparent' : '#8E7869'
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
                  <Animated.View style={[styles.iconWrap, { transform: [{ scale: routeIndex >= 0 ? iconScale[routeIndex] : 1 }] }]}>
                    <Text style={[styles.iconText, { color: tintColor }]}>{resolveIconGlyph(iconName)}</Text>
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
    borderColor: '#E7D6C4',
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
  iconText: {
    fontSize: 20,
    fontWeight: '800',
  },
  activeIconText: {
    color: Colors.text.inverse,
    fontSize: 20,
    fontWeight: '900',
  },
  activeLabelPill: {
    position: 'absolute',
    width: LABEL_PILL_WIDTH,
    left: (INDICATOR_SIZE - LABEL_PILL_WIDTH) / 2,
    bottom: -15,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#E7D6C4',
    backgroundColor: '#FFF8F1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  activeLabelPillText: {
    color: '#5A402D',
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
