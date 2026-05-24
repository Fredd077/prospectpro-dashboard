import { endOfMonth, endOfWeek, startOfMonth, startOfWeek, parseISO } from 'date-fns'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { generateGerenteReport } from '@/lib/intelligence/intelligence-engine'
import { todayISO, toISODate } from '@/lib/utils/dates'

export async function POST(req: Request) {
  try {
    const sb = await getSupabaseServerClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const service = getSupabaseServiceClient()
    const { data: profile } = await service
      .from('profiles')
      .select('org_role')
      .eq('id', user.id)
      .single()

    if (profile?.org_role !== 'manager') {
      return Response.json({ error: 'Forbidden: manager role required' }, { status: 403 })
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

    const report = await generateGerenteReport({
      managerUserId: user.id,
      periodType,
      periodStart,
      periodEnd,
    })

    return Response.json(report)
  } catch (err) {
    console.error('[intelligence/gerente] Error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
