import { useEffect, useMemo, useState } from 'react'
import { Stack, usePathname } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { SideMenu, type DashboardMenuSection } from '../../components/dashboard/side-menu'
import { LayoutShell } from '../../components/ui/layout-shell'
import { MenuContext } from '../../lib/menu-context'
import { supabase } from '../../lib/supabase'

export default function AppLayout() {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [canManageTasks, setCanManageTasks] = useState(false)

  useEffect(() => {
    let mounted = true

    async function loadTaskManagementAccess() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (mounted) setCanManageTasks(false)
        return
      }

      const { data: membership } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()

      if (!membership?.household_id) {
        if (mounted) setCanManageTasks(false)
        return
      }

      const { data: householdRow } = await supabase
        .from('households')
        .select('admin_user_id')
        .eq('id', membership.household_id)
        .maybeSingle()

      if (!mounted) return
      setCanManageTasks(Boolean(householdRow?.admin_user_id && householdRow.admin_user_id === user.id))
    }

    void loadTaskManagementAccess()

    return () => {
      mounted = false
    }
  }, [pathname])

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
            canManageTasks={canManageTasks}
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
