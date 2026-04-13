import { useEffect } from 'react'
import { Stack, router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { initializePurchases } from '../lib/purchases'

initializePurchases()

export default function RootLayout() {
  useEffect(() => {
    // Escuchar cambios de sesión y redirigir según estado de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.replace('/(app)/(tabs)/today')
      } else if (event === 'SIGNED_OUT') {
        router.replace('/(auth)/welcome')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  )
}
