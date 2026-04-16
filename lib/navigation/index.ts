import { router } from 'expo-router'
import { supabase } from '../supabase'

let paywallAnalyticsDisabled = false

export type PaywallEntryPoint = 'manage' | 'onboarding'

async function logPaywallNavigationEvent(source: string) {
  if (paywallAnalyticsDisabled) {
    return
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { error } = await supabase.from('analytics_events').insert({
      user_id: user?.id ?? null,
      event_name: 'paywall_opened',
      source,
      properties: {
        path: '/(auth)/paywall',
        platform: typeof navigator !== 'undefined' ? 'web' : 'native',
      },
    })

    if (error) {
      if (error.code === 'PGRST106' || error.message.toLowerCase().includes('analytics_events')) {
        paywallAnalyticsDisabled = true
      }
    }
  } catch {
    paywallAnalyticsDisabled = true
  }
}

export function goToPlanChange(source: string) {
  void logPaywallNavigationEvent(source)
  router.push({
    pathname: '/(auth)/paywall',
    params: { source, entry: 'manage' satisfies PaywallEntryPoint },
  })
}

export function goToPaywall(source: string = 'unknown') {
  goToPlanChange(source)
}
