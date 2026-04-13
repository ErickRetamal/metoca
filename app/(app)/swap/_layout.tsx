import { Stack } from 'expo-router'

export default function SwapLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: 'transparent' },
        animation: 'slide_from_right',
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: 'rgba(255,255,255,0.82)',
        },
        headerTintColor: '#0F172A',
        headerTitleStyle: {
          fontWeight: '800',
        },
      }}
    >
      <Stack.Screen name="request" options={{ title: 'Solicitar intercambio' }} />
      <Stack.Screen name="inbox" options={{ title: 'Solicitudes recibidas' }} />
    </Stack>
  )
}
