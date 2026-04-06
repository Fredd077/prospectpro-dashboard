import { startOfWeek, parseISO } from 'date-fns'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { todayISO, toISODate } from '@/lib/utils/dates'
import { buildDailyContextForCron } from '@/lib/utils/coach-context'
import { generateAndSaveCoachMessage } from '@/lib/utils/coach-generator'

export const maxDuration = 300 // Vercel Pro: up to 5 min for batch jobs

export async function GET(req: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb   = getSupabaseServiceClient()
  const today = todayISO()

  // Solo ejecutar de lunes a viernes (Colombia UTC-5)
  // parseISO(today) es seguro porque todayISO() ya devuelve la fecha
  // correcta en timezone Colombia — getDay(): 0=Dom, 1=Lun, ..., 6=Sáb
  const dayOfWeek = parseISO(today).getDay()
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return Response.json({
      skipped: true,
      reason: 'Weekend — daily coach only runs Mon–Fri',
      today,
      dayOfWeek,
    })
  }

  // ── Fetch all active users ──────────────────────────────────────────────────
  const { data: users, error } = await sb
    .from('profiles')
    .select('id,full_name')
    .in('role', ['active', 'admin'])

  if (error) {
    console.error('[cron/daily-coach] Failed to fetch users:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  let generated = 0, skipped = 0
  const errors: string[] = []

  for (const user of users ?? []) {
    try {
      // Skip if already generated for today
      const { data: existing } = await sb
        .from('coach_messages')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'daily')
        .eq('period_date', today)
        .maybeSingle()

      if (existing) { skipped++; continue }

      // Skip if no active activities
      const { count: actCount } = await sb
        .from('activities')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'active')

      if (!actCount || actCount === 0) { skipped++; continue }

      // Skip if no logs today
      const { count: logCount } = await sb
        .from('activity_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('log_date', today)

      if (!logCount || logCount === 0) { skipped++; continue }

      const ctx = await buildDailyContextForCron(user.id, today, sb)

      // Insert with explicit user_id (service client bypasses RLS)
      const result = await generateAndSaveCoachMessage(ctx, 'daily', today, sb)

      // Fix user_id on the saved row (generateAndSaveCoachMessage uses DEFAULT auth.uid() which is null for service client)
      if (result.id) {
        await sb.from('coach_messages').update({ user_id: user.id } as never).eq('id', result.id)
      }

      generated++
      console.log(`[cron/daily-coach] Generated for user ${user.id} (${user.full_name ?? 'unknown'})`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${user.id}: ${msg}`)
      console.error(`[cron/daily-coach] Error for user ${user.id}:`, msg)
    }
  }

  const summary = {
    date: today,
    generated,
    skipped,
    errors: errors.length ? errors : undefined,
  }
  console.log('[cron/daily-coach]', JSON.stringify(summary))
  return Response.json(summary)
}
