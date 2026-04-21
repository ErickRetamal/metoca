import { useEffect } from 'react'
import { Stack, router } from 'expo-router'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
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
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
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
      </SafeAreaView>
    </SafeAreaProvider>
  )
}
