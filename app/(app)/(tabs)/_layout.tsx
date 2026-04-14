import { Tabs } from 'expo-router'
import { Platform, StyleSheet } from 'react-native'
import { MagicTabBar } from '../../../components/dashboard/magic-tab-bar'

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={props => <MagicTabBar {...props} />}
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
        name="household-today"
        options={{ title: 'Hogar hoy' }}
      />
      <Tabs.Screen
        name="household-month"
        options={{ title: 'Hogar mes' }}
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
