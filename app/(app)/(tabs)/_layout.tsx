import { Tabs } from 'expo-router'
import { Platform, StyleSheet } from 'react-native'
import { MagicTabBar } from '../../../components/dashboard/magic-tab-bar'
import { useMenuContext } from '../../../lib/menu-context'

export default function TabsLayout() {
  const { canManageTasks } = useMenuContext()

  return (
    <Tabs
      tabBar={props => <MagicTabBar {...props} canManageTasks={canManageTasks} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        sceneStyle: styles.scene,
        tabBarStyle: styles.tabBar,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="today"
        options={{ title: 'Hoy' }}
      />
      <Tabs.Screen
        name="my-month"
        options={{ title: 'Mi mes' }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Asignar',
          href: canManageTasks ? '/(app)/(tabs)/tasks' : null,
        }}
      />
      <Tabs.Screen
        name="task-month-detail"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="household-task-month-detail"
        options={{ href: null }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  scene: {
    backgroundColor: 'transparent',
  },
  tabBar: {
    backgroundColor: 'transparent',
    borderTopColor: 'transparent',
    borderTopWidth: 0,
    elevation: 0,
    height: 90,
    position: 'absolute',
    ...Platform.select({
      web: {
        boxShadow: 'none',
      },
    }),
  },
})
