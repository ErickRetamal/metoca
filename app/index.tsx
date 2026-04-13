import { Redirect } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { supabase } from '../lib/supabase'

export default function IndexRoute() {
  const [hasSession, setHasSession] = useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        setHasSession(Boolean(session))
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setHasSession(Boolean(session))
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  if (hasSession === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    )
  }

  if (hasSession) {
    return <Redirect href="/(app)/(tabs)/today" />
  }

  return <Redirect href="/(auth)/welcome" />
}
