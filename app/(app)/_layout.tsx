import { useMemo, useState } from 'react'
import { Stack, usePathname } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { SideMenu, type DashboardMenuSection } from '../../components/dashboard/side-menu'
import { LayoutShell } from '../../components/ui/layout-shell'
import { MenuContext } from '../../lib/menu-context'

export default function AppLayout() {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const currentSection = useMemo<DashboardMenuSection>(() => {
    if (pathname.includes('/configure-tasks')) return 'tasks'
    if (pathname.includes('/profile')) return 'profile'
    if (pathname.includes('/settings')) return 'settings'
    if (pathname.includes('/household')) return 'household'
    return 'stats'
  }, [pathname])

  return (
    <MenuContext.Provider value={{ onMenuPress: () => setIsMenuOpen(true) }}>
      <LayoutShell variant="app">
        <View style={styles.container}>
          <SideMenu
            visible={isMenuOpen}
            onClose={() => setIsMenuOpen(false)}
            currentSection={currentSection}
          />

          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'fade_from_bottom',
              contentStyle: { backgroundColor: 'transparent' },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="swap" options={{ headerShown: false }} />
            <Stack.Screen name="household/index" options={{ headerShown: false }} />
            <Stack.Screen name="household/configure-tasks" options={{ headerShown: false }} />
            <Stack.Screen name="profile/index" options={{ headerShown: false }} />
            <Stack.Screen name="settings/index" options={{ headerShown: false }} />
          </Stack>
        </View>
      </LayoutShell>
    </MenuContext.Provider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
