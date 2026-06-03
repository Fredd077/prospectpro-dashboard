import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { todayISO } from '@/lib/utils/dates'
import {
  sendTrialReminder7d,
  sendTrialReminder3d,
  sendTrialReminder1d,
  sendTrialExpired,
} from '@/lib/utils/emails'

export const maxDuration = 60

export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb    = getSupabaseServiceClient()
  const today = todayISO()

  // Fetch all active users with a trial period set
  const { data: users, error } = await sb
    .from('profiles')
    .select('id, email, full_name, trial_ends_at, trial_reminder_7d, trial_reminder_3d, trial_reminder_1d, trial_expired_email')
    .eq('role', 'active')
    .not('trial_ends_at', 'is', null)

  if (error) {
    console.error('[cron/trial-reminders] fetch error:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  const results = { sent_7d: 0, sent_3d: 0, sent_1d: 0, sent_expired: 0, errors: 0 }

  for (const user of users ?? []) {
    if (!user.trial_ends_at || !user.email) continue

    const endsAt  = new Date(user.trial_ends_at)
    const todayMs = new Date(today).getTime()
    const daysLeft = Math.ceil((endsAt.getTime() - todayMs) / (1000 * 60 * 60 * 24))

    try {
      if (daysLeft <= 0 && !user.trial_expired_email) {
        await sendTrialExpired({ full_name: user.full_name, email: user.email })
        await sb.from('profiles').update({ trial_expired_email: true }).eq('id', user.id)
        results.sent_expired++
      } else if (daysLeft <= 1 && daysLeft > 0 && !user.trial_reminder_1d) {
        await sendTrialReminder1d({ full_name: user.full_name, email: user.email })
        await sb.from('profiles').update({ trial_reminder_1d: true }).eq('id', user.id)
        results.sent_1d++
      } else if (daysLeft <= 3 && daysLeft > 1 && !user.trial_reminder_3d) {
        await sendTrialReminder3d({ full_name: user.full_name, email: user.email })
        await sb.from('profiles').update({ trial_reminder_3d: true }).eq('id', user.id)
        results.sent_3d++
      } else if (daysLeft <= 7 && daysLeft > 3 && !user.trial_reminder_7d) {
        await sendTrialReminder7d({ full_name: user.full_name, email: user.email })
        await sb.from('profiles').update({ trial_reminder_7d: true }).eq('id', user.id)
        results.sent_7d++
      }
    } catch (err) {
      console.error(`[cron/trial-reminders] user ${user.id}:`, err)
      results.errors++
    }
  }

  console.log('[cron/trial-reminders]', today, results)
  return Response.json({ ok: true, today, ...results })
}
