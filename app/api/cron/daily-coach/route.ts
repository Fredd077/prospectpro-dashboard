import { parseISO } from 'date-fns'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { todayISO } from '@/lib/utils/dates'
import { buildDailyContextForCron } from '@/lib/utils/coach-context'
import { generateAndSaveCoachMessage } from '@/lib/utils/coach-generator'

export const maxDuration = 300

const BATCH_SIZE = 5

export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb    = getSupabaseServiceClient()
  const today = todayISO()

  const dayOfWeek = parseISO(today).getDay()
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return Response.json({ skipped: true, reason: 'Weekend — daily coach only runs Mon–Fri', today, dayOfWeek })
  }

  const { data: users, error } = await sb
    .from('profiles')
    .select('id,full_name')
    .in('role', ['active', 'admin'])

  if (error) {
    console.error('[cron/daily-coach] Failed to fetch users:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  const allUsers = users ?? []
  const userIds  = allUsers.map((u) => u.id)

  // ── Bulk pre-fetch all skip checks (3 queries instead of N×3) ─────────────
  const [doneRes, actRes, logRes] = await Promise.all([
    sb.from('coach_messages').select('user_id').eq('type', 'daily').eq('period_date', today).in('user_id', userIds),
    sb.from('activities').select('user_id').eq('status', 'active').in('user_id', userIds),
    sb.from('activity_logs').select('user_id').eq('log_date', today).in('user_id', userIds),
  ])

  const alreadyDone   = new Set((doneRes.data   ?? []).map((r) => r.user_id))
  const hasActivities = new Set((actRes.data     ?? []).map((r) => r.user_id))
  const loggedToday   = new Set((logRes.data     ?? []).map((r) => r.user_id))

  const eligible = allUsers.filter((u) =>
    !alreadyDone.has(u.id) && hasActivities.has(u.id) && loggedToday.has(u.id)
  )

  let generated = 0
  const skipped = allUsers.length - eligible.length
  const errors: string[] = []

  // ── Process in batches of BATCH_SIZE ──────────────────────────────────────
  for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
    const batch = eligible.slice(i, i + BATCH_SIZE)
    await Promise.all(batch.map(async (user) => {
      try {
        const ctx    = await buildDailyContextForCron(user.id, today, sb)
        const result = await generateAndSaveCoachMessage(ctx, 'daily', today, sb)
        if (result.id) {
          await sb.from('coach_messages').update({ user_id: user.id } as never).eq('id', result.id)
        }
        generated++
        console.log(`[cron/daily-coach] Generated for ${user.id} (${user.full_name ?? 'unknown'})`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`${user.id}: ${msg}`)
        console.error(`[cron/daily-coach] Error for ${user.id}:`, msg)
      }
    }))
  }

  const summary = { date: today, generated, skipped, errors: errors.length ? errors : undefined }
  console.log('[cron/daily-coach]', JSON.stringify(summary))
  return Response.json(summary)
}
