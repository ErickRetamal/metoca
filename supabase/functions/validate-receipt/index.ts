import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const REVENUECAT_SECRET_API_KEY = Deno.env.get('REVENUECAT_SECRET_API_KEY')
const REVENUECAT_HOGAR_PRODUCT_IDS = (Deno.env.get('REVENUECAT_HOGAR_PRODUCT_IDS') ?? 'metoca_hogar_monthly').split(',').map(value => value.trim()).filter(Boolean)
const REVENUECAT_FAMILIA_PRODUCT_IDS = (Deno.env.get('REVENUECAT_FAMILIA_PRODUCT_IDS') ?? 'metoca_familia_monthly').split(',').map(value => value.trim()).filter(Boolean)

type AppPlan = 'free' | 'hogar' | 'familia'
type AppPlatform = 'apple' | 'google' | null

interface RevenueCatSubscriberResponse {
  subscriber?: {
    subscriptions?: Record<string, {
      product_identifier?: string | null
      expires_date?: string | null
      purchase_date?: string | null
      original_purchase_date?: string | null
      original_transaction_id?: string | null
      store?: string | null
    }>
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function encodeEqValue(value: string): string {
  return encodeURIComponent(value)
}

function encodeInValues(values: string[]): string {
  return values.map(value => encodeURIComponent(value)).join(',')
}

async function fetchSupabase(path: string, init: RequestInit = {}, useServiceRole = false): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  const apiKey = useServiceRole ? SUPABASE_SERVICE_ROLE_KEY : (SUPABASE_ANON_KEY ?? SUPABASE_SERVICE_ROLE_KEY)
  headers.set('apikey', apiKey)
  headers.set('Authorization', `Bearer ${apiKey}`)

  return fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers,
  })
}

async function getRequestUserId(request: Request): Promise<string> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY')
  }

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) {
    throw new Error('missing_authorization_header')
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: authHeader,
    },
  })

  if (!response.ok) {
    throw new Error('unauthorized')
  }

  const data = await response.json() as { id?: string }
  if (!data.id) {
    throw new Error('unauthorized')
  }

  return data.id
}

function resolvePlanFromProductId(productId: string | null | undefined): AppPlan {
  if (!productId) return 'free'
  if (REVENUECAT_FAMILIA_PRODUCT_IDS.includes(productId) || productId.includes('familia')) return 'familia'
  if (REVENUECAT_HOGAR_PRODUCT_IDS.includes(productId) || productId.includes('hogar')) return 'hogar'
  return 'free'
}

function resolveMaxMembers(plan: AppPlan): number {
  if (plan === 'familia') return 10
  if (plan === 'hogar') return 5
  return 2
}

function resolvePlatform(store: string | null | undefined): AppPlatform {
  if (store === 'app_store') return 'apple'
  if (store === 'play_store') return 'google'
  return null
}

function pickBestActiveSubscription(payload: RevenueCatSubscriberResponse): {
  plan: AppPlan
  expiresAt: string | null
  startedAt: string | null
  platformSubscriptionId: string | null
  platform: AppPlatform
} {
  const subscriptions = Object.values(payload.subscriber?.subscriptions ?? {})
  const now = Date.now()

  const activePaid = subscriptions
    .map(subscription => {
      const productId = subscription.product_identifier ?? null
      const plan = resolvePlanFromProductId(productId)
      const expiresAt = subscription.expires_date ?? null
      const expiresTime = expiresAt ? new Date(expiresAt).getTime() : Number.POSITIVE_INFINITY

      return {
        plan,
        expiresAt,
        expiresTime,
        startedAt: subscription.purchase_date ?? subscription.original_purchase_date ?? null,
        platformSubscriptionId: subscription.original_transaction_id ?? null,
        platform: resolvePlatform(subscription.store),
      }
    })
    .filter(item => item.plan !== 'free' && (item.expiresAt === null || item.expiresTime > now))
    .sort((left, right) => {
      const leftPriority = left.plan === 'familia' ? 2 : 1
      const rightPriority = right.plan === 'familia' ? 2 : 1
      if (leftPriority !== rightPriority) return rightPriority - leftPriority
      return right.expiresTime - left.expiresTime
    })

  const best = activePaid[0]
  if (!best) {
    return {
      plan: 'free',
      expiresAt: null,
      startedAt: null,
      platformSubscriptionId: null,
      platform: null,
    }
  }

  return best
}

async function fetchRevenueCatSubscriber(appUserId: string): Promise<RevenueCatSubscriberResponse> {
  if (!REVENUECAT_SECRET_API_KEY) {
    throw new Error('Missing REVENUECAT_SECRET_API_KEY')
  }

  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}?exclude_historical_transactions=true`, {
    headers: {
      Authorization: `Bearer ${REVENUECAT_SECRET_API_KEY}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`RevenueCat lookup failed: ${await response.text()}`)
  }

  return await response.json() as RevenueCatSubscriberResponse
}

async function fetchActiveHouseholdIds(userId: string): Promise<string[]> {
  const response = await fetchSupabase(`/rest/v1/household_members?user_id=eq.${encodeEqValue(userId)}&status=eq.active&select=household_id`, { method: 'GET' }, true)
  if (!response.ok) {
    throw new Error(`Failed to load households: ${await response.text()}`)
  }

  const rows = await response.json() as Array<{ household_id: string }>
  return rows.map(row => row.household_id).filter(Boolean)
}

async function upsertSubscription(householdId: string, ownerUserId: string, subscription: ReturnType<typeof pickBestActiveSubscription>): Promise<void> {
  const existingResponse = await fetchSupabase(
    `/rest/v1/subscriptions?household_id=eq.${encodeEqValue(householdId)}&owner_user_id=eq.${encodeEqValue(ownerUserId)}&status=eq.active&select=id&order=updated_at.desc`,
    { method: 'GET' },
    true
  )

  if (!existingResponse.ok) {
    throw new Error(`Failed to read subscriptions: ${await existingResponse.text()}`)
  }

  const existingRows = await existingResponse.json() as Array<{ id: string }>
  const [primaryRow, ...duplicateRows] = existingRows
  const payload = {
    household_id: householdId,
    owner_user_id: ownerUserId,
    plan: subscription.plan,
    max_members: resolveMaxMembers(subscription.plan),
    status: 'active',
    platform: subscription.platform,
    platform_subscription_id: subscription.platformSubscriptionId,
    started_at: subscription.startedAt ?? new Date().toISOString(),
    expires_at: subscription.expiresAt,
  }

  if (primaryRow?.id) {
    const updateResponse = await fetchSupabase(`/rest/v1/subscriptions?id=eq.${encodeEqValue(primaryRow.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(payload),
    }, true)

    if (!updateResponse.ok) {
      throw new Error(`Failed to update subscription: ${await updateResponse.text()}`)
    }
  } else {
    const insertResponse = await fetchSupabase('/rest/v1/subscriptions', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(payload),
    }, true)

    if (!insertResponse.ok) {
      throw new Error(`Failed to insert subscription: ${await insertResponse.text()}`)
    }
  }

  if (duplicateRows.length > 0) {
    const duplicateIds = duplicateRows.map(row => row.id)
    const expireResponse = await fetchSupabase(`/rest/v1/subscriptions?id=in.(${encodeInValues(duplicateIds)})`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'expired' }),
    }, true)

    if (!expireResponse.ok) {
      throw new Error(`Failed to cleanup duplicate subscriptions: ${await expireResponse.text()}`)
    }
  }
}

serve(async (request) => {
  try {
    if (request.method !== 'POST') {
      return json({ ok: false, error: 'method_not_allowed' }, 405)
    }

    const requestUserId = await getRequestUserId(request)
    const body = await request.json().catch(() => ({})) as { appUserId?: string }
    const appUserId = typeof body.appUserId === 'string' && body.appUserId.trim().length > 0 ? body.appUserId.trim() : requestUserId

    if (appUserId !== requestUserId) {
      return json({ ok: false, error: 'app_user_id_mismatch' }, 403)
    }

    const revenueCatPayload = await fetchRevenueCatSubscriber(appUserId)
    const bestSubscription = pickBestActiveSubscription(revenueCatPayload)
    const householdIds = await fetchActiveHouseholdIds(requestUserId)

    for (const householdId of householdIds) {
      await upsertSubscription(householdId, requestUserId, bestSubscription)
    }

    return json({
      ok: true,
      appUserId,
      plan: bestSubscription.plan,
      syncedHouseholds: householdIds.length,
      expiresAt: bestSubscription.expiresAt,
    })
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})
