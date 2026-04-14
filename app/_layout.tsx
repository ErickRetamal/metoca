import { useEffect } from 'react'
import { Stack, router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { initializePurchases } from '../lib/purchases'

initializePurchases()

export default function RootLayout() {
  useEffect(() => {
    // Mantener solo redirección de cierre de sesión para evitar
    // sobreescribir flujos específicos (ej. login -> paywall).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
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
