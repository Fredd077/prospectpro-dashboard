import { startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { todayISO, toISODate } from '@/lib/utils/dates'
import { buildMonthlyContextForCron } from '@/lib/utils/coach-context'
import { generateAndSaveCoachMessage } from '@/lib/utils/coach-generator'

export const maxDuration = 300

export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb    = getSupabaseServiceClient()
  const today = todayISO()

  // Only run on the last day of the month (schedule catches days 28-31;
  // this guard ensures we only generate once, on the actual last day)
  const lastDayOfMonth = toISODate(endOfMonth(parseISO(today)))
  if (today !== lastDayOfMonth) {
    return Response.json({ skipped: true, reason: 'Not last day of month', today, lastDay: lastDayOfMonth })
  }

  const monthStart = toISODate(startOfMonth(parseISO(today)))

  const { data: users, error } = await sb
    .from('profiles')
    .select('id,full_name')
    .in('role', ['active', 'admin'])

  if (error) {
    console.error('[cron/monthly-coach] Failed to fetch users:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  let generated = 0, skipped = 0
  const errors: string[] = []

  for (const user of users ?? []) {
    try {
      // Skip if already generated for this month
      const { data: existing } = await sb
        .from('coach_messages')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'monthly')
        .eq('period_date', monthStart)
        .maybeSingle()

      if (existing) { skipped++; continue }

      // Monthly: generate for all active users regardless of check-in count
      const ctx = await buildMonthlyContextForCron(user.id, monthStart, sb)
      const result = await generateAndSaveCoachMessage(ctx, 'monthly', monthStart, sb, 500)

      if (result.id) {
        await sb.from('coach_messages').update({ user_id: user.id } as never).eq('id', result.id)
      }

      generated++
      console.log(`[cron/monthly-coach] Generated for user ${user.id} (${user.full_name ?? 'unknown'})`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${user.id}: ${msg}`)
      console.error(`[cron/monthly-coach] Error for user ${user.id}:`, msg)
    }
  }

  const summary = { date: today, monthStart, generated, skipped, errors: errors.length ? errors : undefined }
  console.log('[cron/monthly-coach]', JSON.stringify(summary))
  return Response.json(summary)
}
