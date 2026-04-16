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

async function fetchUserPushToken(userId: string): Promise<string | null> {
  const response = await supabaseFetch(
    `/rest/v1/users?id=eq.${userId}&select=push_token_apns,push_token_fcm&limit=1`,
    { method: 'GET' }
  )
  if (!response.ok) return null

  const rows = await response.json() as Array<{ push_token_apns: string | null; push_token_fcm: string | null }>
  const row = rows[0]
  if (!row) return null

  return row.push_token_apns ?? row.push_token_fcm ?? null
}

function buildPushMessage(row: OutboxRow): { title: string; body: string } {
  const payload = row.payload as Record<string, unknown>

  if (row.event_type === 'grace_started') {
    const graceDate = typeof payload.grace_ends_at === 'string'
      ? new Date(payload.grace_ends_at).toLocaleDateString('es-CL')
      : 'pronto'
    return {
      title: 'Tu hogar tiene más miembros de los permitidos',
      body: `Tu plan permite ${payload.max_members} miembros, pero tienes ${payload.active_members}. Actualiza antes del ${graceDate} para evitar que se eliminen miembro(s).`,
    }
  }

  if (row.event_type === 'enforced') {
    return {
      title: 'Período de gracia vencido',
      body: `Se han eliminado ${payload.members_to_remove ?? 'algunos'} miembro(s) de tu hogar por exceder la capacidad del plan.`,
    }
  }

  return { title: 'Aviso sobre tu hogar', body: 'Revisa el estado de tu hogar en la app.' }
}

async function sendPushViaExpo(token: string, title: string, body: string): Promise<void> {
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ to: token, title, body, sound: 'default' }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Expo push request failed: ${detail}`)
  }

  const result = await response.json() as { data?: { status?: string; message?: string } }
  if (result.data?.status === 'error') {
    throw new Error(`Expo push error: ${result.data.message ?? 'unknown'}`)
  }
}

async function sendNotification(row: OutboxRow): Promise<void> {
  if (row.channel !== 'push') {
    // Email and other channels: not yet implemented.
    return
  }

  const token = await fetchUserPushToken(row.user_id)
  if (!token) return // No push token registered – skip silently.

  const { title, body } = buildPushMessage(row)
  await sendPushViaExpo(token, title, body)
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
