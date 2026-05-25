import { endOfMonth, endOfWeek, startOfMonth, startOfWeek, parseISO } from 'date-fns'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { generateVendedorReport } from '@/lib/intelligence/intelligence-engine'
import { todayISO, toISODate } from '@/lib/utils/dates'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

function reanchorNoon(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0))
}

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
      periodStart = body.periodStart ?? toISODate(reanchorNoon(startOfWeek(base, { weekStartsOn: 1 })))
      periodEnd = toISODate(endOfWeek(parseISO(periodStart), { weekStartsOn: 1 }))
    } else {
      const base = parseISO(body.periodStart ?? today)
      periodStart = body.periodStart ?? toISODate(reanchorNoon(startOfMonth(base)))
      periodEnd = toISODate(endOfMonth(parseISO(periodStart)))
    }

    const report = await generateVendedorReport({
      userId: user.id,
      periodType,
      periodStart,
      periodEnd,
    })

    // Cross-persist to coach_messages so the coach history sees intelligence reports
    const content = report.report_content as unknown as Record<string, unknown>
    const message = typeof content?.resumen_ejecutivo === 'string'
      ? content.resumen_ejecutivo
      : JSON.stringify(report.report_content)
    const { error: saveError } = await sb
      .from('coach_messages')
      .upsert({
        user_id:     user.id,
        type:        periodType,
        message,
        context:     report.report_content,
        period_date: periodStart,
        is_read:     false,
      }, { onConflict: 'user_id,type,period_date' })
    if (saveError) {
      console.error('[intelligence/vendedor] SAVE FAILED (coach_messages):', JSON.stringify(saveError))
    }

    return Response.json(report)
  } catch (err) {
    if ((err as { code?: string }).code === 'NO_DATA') {
      const msg = err instanceof Error ? err.message : 'No hay datos registrados en este período'
      return Response.json({ error: msg }, { status: 422 })
    }
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error('[intelligence/vendedor] Error:', msg, stack)
    return Response.json({ error: 'Internal server error', detail: msg }, { status: 500 })
  }
}
