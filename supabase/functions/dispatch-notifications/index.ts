import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

serve(() => {
  return new Response(
    JSON.stringify({ ok: true, message: 'dispatch-notifications placeholder ready' }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
