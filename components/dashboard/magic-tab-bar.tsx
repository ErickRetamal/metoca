import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { BorderRadius, Colors } from '../../constants/theme'

type RouteIconName =
  | 'home'
  | 'home-outline'
  | 'calendar'
  | 'calendar-outline'
  | 'checkbox'
  | 'checkbox-outline'
  | 'ellipse'
  | 'ellipse-outline'

const TAB_HORIZONTAL_PADDING = 8
const INDICATOR_HEIGHT = 48
const INDICATOR_WIDTH = 132
const HIDDEN_TAB_ROUTES = new Set(['task-month-detail', 'household-task-month-detail'])

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

const BAR_SHELL_SHADOW_STYLE = Platform.select({
  web: {
    boxShadow: '0px 10px 24px rgba(92, 64, 39, 0.12)',
  },
  default: {
    shadowColor: '#5C4027',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
})

function resolveIconName(routeName: string, focused: boolean): RouteIconName {
  if (routeName === 'today') {
    return focused ? 'home' : 'home-outline'
  }

  if (routeName === 'my-month') {
    return focused ? 'calendar' : 'calendar-outline'
  }

  if (routeName === 'tasks') {
    return focused ? 'checkbox' : 'checkbox-outline'
  }

  return focused ? 'ellipse' : 'ellipse-outline'
}

function resolveAccentColor(routeName: string): string {
  if (routeName === 'today') return '#C96B2C'
  if (routeName === 'my-month') return '#8F5B3E'
  if (routeName === 'tasks') return '#A14A33'
  return Colors.primary
}

function resolveShortLabel(routeName: string): string {
  if (routeName === 'today') return 'Hoy'
  if (routeName === 'my-month') return 'Mes'
  if (routeName === 'tasks') return 'Asignar'
  return ''
}

export function MagicTabBar({ state, descriptors, navigation, canManageTasks = false }: BottomTabBarProps & { canManageTasks?: boolean }) {
  const [barWidth, setBarWidth] = useState(0)
  const [tabCenters, setTabCenters] = useState<number[]>([])
  const centerX = useRef(new Animated.Value(INDICATOR_WIDTH / 2)).current
  const colorIndex = useRef(new Animated.Value(state.index)).current
  const iconScale = useRef(state.routes.map((_, index) => new Animated.Value(index === state.index ? 1.1 : 1))).current

  const visibleRoutes = useMemo(
    () =>
      state.routes.filter(route => {
        if (HIDDEN_TAB_ROUTES.has(route.name)) return false
        if (route.name === 'tasks' && !canManageTasks) return false
        const options = descriptors[route.key]?.options
        return options?.href !== null
      }),
    [state.routes, descriptors, canManageTasks]
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

    if (tabWidth <= 0) return INDICATOR_WIDTH / 2
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
      <View style={styles.barClip}>
        <View style={styles.container} onLayout={onBarLayout}>
          <Animated.View
            style={[
              styles.indicator,
              {
                backgroundColor: indicatorColor,
                borderColor: indicatorColor,
                transform: [{ translateX: Animated.subtract(centerX, INDICATOR_WIDTH / 2) }],
              },
            ]}
          >
            <View style={styles.activeContentRow}>
              <Ionicons name={activeIconName} size={20} color={Colors.text.inverse} />
              <Text style={styles.activeLabelInline}>{resolveShortLabel(activeRouteName)}</Text>
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
            const tintColor = focused ? 'transparent' : '#685345'
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
                  <Ionicons name={iconName} size={21} color={tintColor} />
                </Animated.View>
              </Pressable>
            )
          })}
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
  barClip: {
    borderRadius: 28,
    overflow: 'visible',
    backgroundColor: 'rgba(255, 248, 241, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(214, 191, 167, 0.9)',
    ...BAR_SHELL_SHADOW_STYLE,
  },
  container: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    borderRadius: 28,
    borderWidth: 0,
    borderColor: 'transparent',
    minHeight: 68,
    paddingHorizontal: 10,
    overflow: 'visible',
  },
  tabButton: {
    flex: 1,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  iconWrap: {
    width: INDICATOR_HEIGHT,
    height: INDICATOR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  activeLabelInline: {
    color: Colors.text.inverse,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'capitalize',
  },
  indicator: {
    position: 'absolute',
    top: 8,
    width: INDICATOR_WIDTH,
    height: INDICATOR_HEIGHT,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderColor: '#EAD0B8',
    alignItems: 'center',
    justifyContent: 'center',
    ...INDICATOR_SHADOW_STYLE,
    zIndex: 1,
  },
})
