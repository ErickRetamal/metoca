import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

interface OutboxRow {
  id: string
  household_id: string
  user_id: string
  channel: 'push' | 'email'
  event_type: 'grace_started' | 'enforced'
  payload: Record<string, unknown>
}

async function supabaseFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  const headers = new Headers(init?.headers)
  headers.set('apikey', SUPABASE_SERVICE_ROLE_KEY)
  headers.set('Authorization', `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`)
  headers.set('Content-Type', 'application/json')

  return fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers,
  })
}

async function fetchQueued(limit: number): Promise<OutboxRow[]> {
  const response = await supabaseFetch(
    `/rest/v1/household_plan_guard_outbox?status=eq.queued&order=created_at.asc&limit=${limit}&select=id,household_id,user_id,channel,event_type,payload`,
    { method: 'GET' }
  )

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Failed to fetch outbox: ${detail}`)
  }

  return (await response.json()) as OutboxRow[]
}

async function markSent(ids: string[]): Promise<void> {
  if (ids.length === 0) return

  const response = await supabaseFetch(`/rest/v1/household_plan_guard_outbox?id=in.(${ids.join(',')})`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'sent', sent_at: new Date().toISOString() }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Failed to mark sent: ${detail}`)
  }
}

async function markFailed(ids: string[]): Promise<void> {
  if (ids.length === 0) return

  const response = await supabaseFetch(`/rest/v1/household_plan_guard_outbox?id=in.(${ids.join(',')})`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'failed' }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Failed to mark failed: ${detail}`)
  }
}

async function sendNotification(_row: OutboxRow): Promise<void> {
  // Placeholder transport:
  // - channel='push': integrate Expo push gateway here.
  // - channel='email': integrate transactional email provider here.
  // For now, successful execution marks queued items as sent.
  return
}

serve(async (request) => {
  try {
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {}
    const limit = Math.max(1, Math.min(Number(body?.limit ?? 100), 500))

    const queued = await fetchQueued(limit)
    if (queued.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, sent: 0, failed: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const sentIds: string[] = []
    const failedIds: string[] = []

    for (const row of queued) {
      try {
        await sendNotification(row)
        sentIds.push(row.id)
      } catch {
        failedIds.push(row.id)
      }
    }

    await markSent(sentIds)
    await markFailed(failedIds)

    return new Response(
      JSON.stringify({ ok: true, processed: queued.length, sent: sentIds.length, failed: failedIds.length }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
