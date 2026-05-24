import { endOfMonth, endOfWeek, startOfMonth, startOfWeek, parseISO } from 'date-fns'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { generateVendedorReport } from '@/lib/intelligence/intelligence-engine'
import { todayISO, toISODate } from '@/lib/utils/dates'

export async function POST(req: Request) {
  try {
    const sb = await getSupabaseServerClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as {
      periodType?: 'daily' | 'weekly' | 'monthly'
      periodStart?: string
    }

    const periodType = body.periodType ?? 'monthly'
    const today = todayISO()

    let periodStart: string
    let periodEnd: string

    if (periodType === 'daily') {
      periodStart = body.periodStart ?? today
      periodEnd = periodStart
    } else if (periodType === 'weekly') {
      const base = parseISO(body.periodStart ?? today)
      periodStart = toISODate(startOfWeek(base, { weekStartsOn: 1 }))
      periodEnd = toISODate(endOfWeek(base, { weekStartsOn: 1 }))
    } else {
      const base = parseISO(body.periodStart ?? today)
      periodStart = toISODate(startOfMonth(base))
      periodEnd = toISODate(endOfMonth(base))
    }

    const report = await generateVendedorReport({
      userId: user.id,
      periodType,
      periodStart,
      periodEnd,
    })

    return Response.json(report)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error('[intelligence/vendedor] Error:', msg, stack)
    return Response.json({ error: 'Internal server error', detail: msg }, { status: 500 })
  }
}
