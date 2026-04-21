import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const CRON_SECRET = Deno.env.get('CRON_SECRET')

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function nextMonthKey(): string {
  const date = new Date()
  date.setMonth(date.getMonth() + 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function isAuthorized(request: Request): boolean {
  if (!CRON_SECRET) return false
  return request.headers.get('x-cron-secret') === CRON_SECRET
}

function encodeEqValue(value: string): string {
  return encodeURIComponent(value)
}

async function supabaseFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  const headers = new Headers(init.headers)
  headers.set('apikey', SUPABASE_SERVICE_ROLE_KEY)
  headers.set('Authorization', `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`)
  headers.set('Content-Type', 'application/json')

  return fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers,
  })
}

async function getTargetHouseholdIds(householdId?: string): Promise<string[]> {
  if (householdId) {
    const membersResponse = await supabaseFetch(
      `/rest/v1/household_members?household_id=eq.${encodeEqValue(householdId)}&status=eq.active&select=user_id&limit=1`,
      { method: 'GET' }
    )

    if (!membersResponse.ok) {
      throw new Error(`Failed to validate household members: ${await membersResponse.text()}`)
    }

    const members = await membersResponse.json() as Array<{ user_id: string }>
    return members.length > 0 ? [householdId] : []
  }

  const membersResponse = await supabaseFetch('/rest/v1/household_members?status=eq.active&select=household_id', { method: 'GET' })
  if (!membersResponse.ok) {
    throw new Error(`Failed to load active memberships: ${await membersResponse.text()}`)
  }

  const rows = await membersResponse.json() as Array<{ household_id: string }>
  return [...new Set(rows.map(row => row.household_id).filter(Boolean))]
}

serve(async (request) => {
  try {
    if (request.method !== 'POST') {
      return json({ ok: false, error: 'method_not_allowed' }, 405)
    }

    if (!isAuthorized(request)) {
      return json({ ok: false, error: CRON_SECRET ? 'unauthorized' : 'cron_secret_missing' }, CRON_SECRET ? 401 : 500)
    }

    const body = await request.json().catch(() => ({})) as { month?: string; householdId?: string }
    const month = typeof body.month === 'string' && /^\d{4}-\d{2}$/.test(body.month) ? body.month : nextMonthKey()

    const householdIds = await getTargetHouseholdIds(body.householdId)
    const results: Array<{ householdId: string; result?: unknown; error?: string }> = []

    for (const householdId of householdIds) {
      try {
        const rpcResponse = await supabaseFetch('/rest/v1/rpc/redistribute_household_tasks_system', {
          method: 'POST',
          body: JSON.stringify({ p_household_id: householdId, p_month: month }),
        })

        if (!rpcResponse.ok) {
          throw new Error(await rpcResponse.text())
        }

        results.push({ householdId, result: await rpcResponse.json() })
      } catch (error) {
        results.push({ householdId, error: error instanceof Error ? error.message : 'unknown_error' })
      }
    }

    return json({
      ok: true,
      month,
      processed: householdIds.length,
      succeeded: results.filter(item => !item.error).length,
      failed: results.filter(item => item.error).length,
      results,
    })
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})
