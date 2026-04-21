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

function previousMonthKey(): string {
  const date = new Date()
  date.setMonth(date.getMonth() - 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthRange(month: string): { start: string; end: string } {
  const [yearText, monthText] = month.split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()
  return {
    start: `${month}-01`,
    end: `${month}-${String(lastDay).padStart(2, '0')}`,
  }
}

function isAuthorized(request: Request): boolean {
  if (!CRON_SECRET) return false
  return request.headers.get('x-cron-secret') === CRON_SECRET
}

function encodeEqValue(value: string): string {
  return encodeURIComponent(value)
}

function encodeInValues(values: string[]): string {
  return values.map(value => encodeURIComponent(value)).join(',')
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

serve(async (request) => {
  try {
    if (request.method !== 'POST') {
      return json({ ok: false, error: 'method_not_allowed' }, 405)
    }

    if (!isAuthorized(request)) {
      return json({ ok: false, error: CRON_SECRET ? 'unauthorized' : 'cron_secret_missing' }, CRON_SECRET ? 401 : 500)
    }

    const body = await request.json().catch(() => ({})) as { month?: string; householdId?: string }
    const month = typeof body.month === 'string' && /^\d{4}-\d{2}$/.test(body.month) ? body.month : previousMonthKey()
    const { start, end } = monthRange(month)

    const householdIds = await getTargetHouseholdIds(body.householdId)
    const results: Array<{ householdId: string; totalTasks?: number; completedTasks?: number; error?: string }> = []

    for (const householdId of householdIds) {
      try {
        const membersResponse = await supabaseFetch(`/rest/v1/household_members?household_id=eq.${encodeEqValue(householdId)}&status=eq.active&select=user_id,users(name,email)`, { method: 'GET' })
        if (!membersResponse.ok) {
          throw new Error(`Failed to load members: ${await membersResponse.text()}`)
        }

        const members = await membersResponse.json() as Array<{ user_id: string; users?: { name?: string | null; email?: string | null } }>
        const memberIds = members.map(member => member.user_id)
        const detail = Object.fromEntries(members.map(member => {
          const rawName = member.users?.name ?? member.users?.email ?? 'Miembro'
          return [member.user_id, {
            user_id: member.user_id,
            name: rawName,
            total: 0,
            completed: 0,
            missed: 0,
            rate: 0,
          }]
        })) as Record<string, { user_id: string; name: string; total: number; completed: number; missed: number; rate: number }>

        let executions: Array<{ assigned_to: string; status: 'pending' | 'completed' | 'missed' }> = []
        if (memberIds.length > 0) {
          const executionsResponse = await supabaseFetch(
            `/rest/v1/task_executions?assigned_to=in.(${encodeInValues(memberIds)})&scheduled_date=gte.${start}&scheduled_date=lte.${end}&select=assigned_to,status`,
            { method: 'GET' }
          )

          if (!executionsResponse.ok) {
            throw new Error(`Failed to load executions: ${await executionsResponse.text()}`)
          }

          executions = await executionsResponse.json() as Array<{ assigned_to: string; status: 'pending' | 'completed' | 'missed' }>
        }

        let totalTasks = 0
        let completedTasks = 0
        for (const execution of executions) {
          totalTasks += 1
          if (execution.status === 'completed') completedTasks += 1

          const memberDetail = detail[execution.assigned_to]
          if (!memberDetail) continue
          memberDetail.total += 1
          if (execution.status === 'completed') memberDetail.completed += 1
          if (execution.status === 'missed') memberDetail.missed += 1
        }

        Object.values(detail).forEach(memberDetail => {
          memberDetail.rate = memberDetail.total === 0 ? 0 : Number(((memberDetail.completed / memberDetail.total) * 100).toFixed(2))
        })

        const completionRate = totalTasks === 0 ? 0 : Number(((completedTasks / totalTasks) * 100).toFixed(2))
        const upsertResponse = await supabaseFetch('/rest/v1/monthly_reports?on_conflict=household_id,month', {
          method: 'POST',
          headers: {
            Prefer: 'resolution=merge-duplicates,return=minimal',
          },
          body: JSON.stringify({
            household_id: householdId,
            month,
            total_tasks: totalTasks,
            completed_tasks: completedTasks,
            completion_rate: completionRate,
            detail,
            generated_at: new Date().toISOString(),
          }),
        })

        if (!upsertResponse.ok) {
          throw new Error(`Failed to write monthly report: ${await upsertResponse.text()}`)
        }

        results.push({ householdId, totalTasks, completedTasks })
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
