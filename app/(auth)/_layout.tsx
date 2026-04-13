import { Stack } from 'expo-router'
import { LayoutShell } from '../../components/ui/layout-shell'

export default function AuthLayout() {
  return (
    <LayoutShell variant="auth">
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade_from_bottom',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Stack.Screen name="welcome" />
        <Stack.Screen name="value-prop" />
        <Stack.Screen name="how-it-works" />
        <Stack.Screen name="register" />
        <Stack.Screen name="check-email" />
        <Stack.Screen name="login" />
        <Stack.Screen name="push-permission" />
        <Stack.Screen name="paywall" />
        <Stack.Screen name="privacy-policy" />
        <Stack.Screen name="terms-of-use" />
      </Stack>
    </LayoutShell>
  )
}
