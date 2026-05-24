import { startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { todayISO, toISODate } from '@/lib/utils/dates'
import { generateVendedorReport, generateGerenteReport } from '@/lib/intelligence/intelligence-engine'

export const maxDuration = 300

export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb    = getSupabaseServiceClient()
  const today = todayISO()

  // Only run on the last day of the month
  const lastDayOfMonth = toISODate(endOfMonth(parseISO(today)))
  if (today !== lastDayOfMonth) {
    return Response.json({ skipped: true, reason: 'Not last day of month', today, lastDay: lastDayOfMonth })
  }

  const monthStart = toISODate(startOfMonth(parseISO(today)))
  const monthEnd   = today

  const { data: users, error } = await sb
    .from('profiles')
    .select('id,full_name,org_role')
    .in('role', ['active', 'admin'])

  if (error) {
    console.error('[cron/monthly-coach] Failed to fetch users:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  let generated = 0, skipped = 0
  const errors: string[] = []

  for (const user of users ?? []) {
    try {
      await generateVendedorReport({ userId: user.id, periodType: 'monthly', periodStart: monthStart, periodEnd: monthEnd })
      generated++
      console.log(`[cron/monthly-coach] Generated for user ${user.id} (${user.full_name ?? 'unknown'})`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${user.id}: ${msg}`)
      console.error(`[cron/monthly-coach] Error for user ${user.id}:`, msg)
    }
  }

  // ── Manager team reports ──────────────────────────────────────────────────
  let gerenteGenerated = 0
  const managers = (users ?? []).filter((u) => u.org_role === 'manager')
  for (const mgr of managers) {
    try {
      await generateGerenteReport({ managerUserId: mgr.id, periodType: 'monthly', periodStart: monthStart, periodEnd: monthEnd })
      gerenteGenerated++
      console.log(`[cron/monthly-coach] Gerente report for ${mgr.id}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`gerente-${mgr.id}: ${msg}`)
      console.error(`[cron/monthly-coach] Gerente report failed for ${mgr.id}:`, err)
    }
  }

  const summary = { date: today, monthStart, generated, gerenteGenerated, skipped, errors: errors.length ? errors : undefined }
  console.log('[cron/monthly-coach]', JSON.stringify(summary))
  return Response.json(summary)
}
