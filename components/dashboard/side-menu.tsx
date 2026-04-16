import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { BorderRadius, Colors, Spacing } from '../../constants/theme'

export type DashboardMenuSection =
  | 'stats'
  | 'household'
  | 'tasks'
  | 'profile'
  | 'settings'

interface SideMenuProps {
  visible: boolean
  onClose: () => void
  currentSection: DashboardMenuSection
  canManageTasks?: boolean
}

interface HamburgerButtonProps {
  onPress: () => void
}

const PANEL_WIDTH = 292

const MENU_ITEMS: Array<{
  key: DashboardMenuSection
  label: string
  badge: string
  path: string
}> = [
  { key: 'stats', label: 'Estadísticas', badge: 'ES', path: '/(app)/(tabs)/today' },
  { key: 'household', label: 'Mi Hogar', badge: 'MH', path: '/(app)/household' },
  { key: 'tasks', label: 'Asignar Tareas', badge: 'AT', path: '/(app)/household/configure-tasks' },
  { key: 'profile', label: 'Perfil', badge: 'PF', path: '/(app)/profile' },
  { key: 'settings', label: 'Configuración', badge: 'CF', path: '/(app)/settings' },
]

export function SideMenu({ visible, onClose, currentSection, canManageTasks = false }: SideMenuProps) {
  const [isMounted, setIsMounted] = useState(visible)
  const slideX = useRef(new Animated.Value(-PANEL_WIDTH)).current
  const backdropOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      setIsMounted(true)

      Animated.parallel([
        Animated.timing(slideX, {
          toValue: 0,
          duration: 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start()

      return
    }

    setIsMounted(false)
    slideX.setValue(-PANEL_WIDTH)
    backdropOpacity.setValue(0)
  }, [visible, backdropOpacity, slideX])

  const requestClose = (onAfterClose?: () => void) => {
    Animated.parallel([
      Animated.timing(slideX, {
        toValue: -PANEL_WIDTH,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 150,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose()
      onAfterClose?.()
    })
  }

  if (!isMounted) {
    return null
  }

  const handleNavigate = (path: string) => {
    requestClose(() => {
      router.push(path)
    })
  }

  const visibleMenuItems = canManageTasks
    ? MENU_ITEMS
    : MENU_ITEMS.filter(item => item.key !== 'tasks')

  const menuContent = (
    <View style={styles.menuRoot}>
      <Animated.View style={[styles.menuPanel, { transform: [{ translateX: slideX }] }]}>
        <View style={styles.menuHeaderRow}>
          <Text style={styles.menuTitle}>Menu</Text>
          <Pressable style={styles.menuCloseButton} onPress={() => requestClose()}>
            <Text style={styles.menuCloseButtonText}>Cerrar</Text>
          </Pressable>
        </View>

        <Text style={styles.menuSubtitle}>Navegacion del dashboard</Text>

        <View style={styles.menuOptions}>
          {visibleMenuItems.map(item => {
            const isActive = currentSection === item.key

            return (
              <Pressable
                key={item.key}
                style={[styles.menuOptionButton, isActive && styles.menuOptionButtonActive]}
                onPress={() => handleNavigate(item.path)}
              >
                <View style={[styles.menuBadge, isActive && styles.menuBadgeActive]}>
                  <Text style={[styles.menuBadgeText, isActive && styles.menuBadgeTextActive]}>{item.badge}</Text>
                </View>
                <Text style={[styles.menuOptionText, isActive && styles.menuOptionTextActive]}>{item.label}</Text>
                {item.key === 'tasks' && (
                  <View style={styles.adminTag}>
                    <Text style={styles.adminTagText}>ADMIN</Text>
                  </View>
                )}
                {isActive && <Text style={styles.menuActiveTag}>Activo</Text>}
              </Pressable>
            )
          })}
        </View>
      </Animated.View>

      <Pressable style={styles.menuBackdrop} onPress={() => requestClose()}>
        <Animated.View style={[styles.menuBackdropFill, { opacity: backdropOpacity }]} />
      </Pressable>
    </View>
  )

  if (Platform.OS === 'web') {
    return <View style={styles.webMenuOverlay}>{menuContent}</View>
  }

  return (
    <Modal
      visible={isMounted}
      transparent
      animationType="none"
      onRequestClose={() => requestClose()}
    >
      {menuContent}
    </Modal>
  )
}

export function HamburgerButton({ onPress }: HamburgerButtonProps) {
  const [pressed, setPressedState] = useState(false)

  return (
    <Pressable
      style={[styles.hamburgerButton, pressed && styles.hamburgerButtonPressed]}
      onPress={onPress}
      onPressIn={() => setPressedState(true)}
      onPressOut={() => setPressedState(false)}
    >
      <View style={[styles.hamburgerLine, styles.hamburgerLineTop]} />
      <View style={styles.hamburgerLine} />
      <View style={[styles.hamburgerLine, styles.hamburgerLineBottom]} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  menuRoot: {
    flex: 1,
    flexDirection: 'row',
  },
  webMenuOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  menuPanel: {
    width: 292,
    backgroundColor: Colors.surface,
    paddingTop: Spacing.xxl,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    shadowColor: '#111827',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 3, height: 0 },
    elevation: 8,
  },
  menuBackdrop: {
    flex: 1,
  },
  menuBackdropFill: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.3)',
  },
  hamburgerButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderColor: '#DBEAFE',
    shadowColor: '#1E3A8A',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  hamburgerButtonPressed: {
    backgroundColor: '#EFF6FF',
    borderColor: '#60A5FA',
    shadowOpacity: 0.2,
  },
  hamburgerLine: {
    width: 20,
    height: 2.5,
    borderRadius: BorderRadius.full,
    backgroundColor: '#1E3A8A',
  },
  hamburgerLineTop: {
    width: 18,
  },
  hamburgerLineBottom: {
    width: 16,
  },
  menuHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuTitle: {
    color: Colors.text.primary,
    fontSize: 24,
    fontWeight: '800',
  },
  menuCloseButton: {
    backgroundColor: '#EFF6FF',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
  },
  menuCloseButtonText: {
    color: '#1E3A8A',
    fontSize: 12,
    fontWeight: '700',
  },
  menuSubtitle: {
    marginTop: Spacing.xs,
    color: Colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  menuOptions: {
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  menuOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: BorderRadius.md,
    backgroundColor: '#FBFDFF',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.sm + 2,
  },
  menuOptionButtonActive: {
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  menuBadge: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
  },
  menuBadgeActive: {
    backgroundColor: '#1E3A8A',
  },
  menuBadgeText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '800',
  },
  menuBadgeTextActive: {
    color: Colors.text.inverse,
  },
  menuOptionText: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  menuOptionTextActive: {
    color: '#1E3A8A',
    fontWeight: '700',
  },
  adminTag: {
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#B45309',
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  adminTagText: {
    color: '#B45309',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  menuActiveTag: {
    color: '#1E3A8A',
    fontSize: 11,
    fontWeight: '700',
  },
})
