import { startOfWeek, parseISO } from 'date-fns'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { todayISO, toISODate } from '@/lib/utils/dates'
import { buildWeeklyContextForCron } from '@/lib/utils/coach-context'
import { generateAndSaveCoachMessage } from '@/lib/utils/coach-generator'

export const maxDuration = 300

export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb    = getSupabaseServiceClient()
  const today = todayISO()

  // Weekly runs Friday — analyse Mon-Fri of current week
  const thisMonday = toISODate(startOfWeek(parseISO(today), { weekStartsOn: 1 }))

  const { data: users, error } = await sb
    .from('profiles')
    .select('id,full_name')
    .in('role', ['active', 'admin'])

  if (error) {
    console.error('[cron/weekly-coach] Failed to fetch users:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  let generated = 0, skipped = 0
  const errors: string[] = []

  for (const user of users ?? []) {
    try {
      // Skip if already generated for this Monday
      const { data: existing } = await sb
        .from('coach_messages')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'weekly')
        .eq('period_date', thisMonday)
        .maybeSingle()

      if (existing) { skipped++; continue }

      // Skip if fewer than 2 check-in days this week
      const { data: checkInDays } = await sb
        .from('activity_logs')
        .select('log_date')
        .eq('user_id', user.id)
        .gte('log_date', thisMonday)
        .lte('log_date', today)

      const uniqueDays = new Set((checkInDays ?? []).map((l) => l.log_date)).size
      if (uniqueDays < 2) { skipped++; continue }

      const ctx = await buildWeeklyContextForCron(user.id, thisMonday, sb)
      const result = await generateAndSaveCoachMessage(ctx, 'weekly', thisMonday, sb)

      if (result.id) {
        await sb.from('coach_messages').update({ user_id: user.id } as never).eq('id', result.id)
      }

      generated++
      console.log(`[cron/weekly-coach] Generated for user ${user.id} (${user.full_name ?? 'unknown'})`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${user.id}: ${msg}`)
      console.error(`[cron/weekly-coach] Error for user ${user.id}:`, msg)
    }
  }

  const summary = { date: today, weekStart: thisMonday, generated, skipped, errors: errors.length ? errors : undefined }
  console.log('[cron/weekly-coach]', JSON.stringify(summary))
  return Response.json(summary)
}
