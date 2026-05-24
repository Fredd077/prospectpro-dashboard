import { startOfWeek } from 'date-fns'
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

  // Compute thisMonday and thisFriday (timezone-safe, anchored to noon UTC)
  const [ty, tm, td] = today.split('-').map(Number)
  const todayNoon   = new Date(Date.UTC(ty, tm - 1, td, 12, 0, 0))
  const rawMonday   = startOfWeek(todayNoon, { weekStartsOn: 1 })
  const mondayNoon  = new Date(Date.UTC(rawMonday.getUTCFullYear(), rawMonday.getUTCMonth(), rawMonday.getUTCDate(), 12, 0, 0))
  const fridayNoon  = new Date(mondayNoon.getTime() + 4 * 24 * 60 * 60 * 1000)
  const thisMonday  = toISODate(mondayNoon)
  const thisFriday  = toISODate(fridayNoon)

  const { data: users, error } = await sb
    .from('profiles')
    .select('id,full_name')
    .in('role', ['active', 'admin'])

  if (error) {
    console.error('[cron/weekly-coach] Failed to fetch users:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  const allUsers = users ?? []
  const userIds  = allUsers.map((u) => u.id)

  // Skip users with fewer than 2 active days this week
  const { data: logsData } = await sb
    .from('activity_logs')
    .select('user_id,log_date')
    .gte('log_date', thisMonday)
    .lte('log_date', today)
    .in('user_id', userIds)

  const daysByUser = new Map<string, Set<string>>()
  for (const log of logsData ?? []) {
    if (!daysByUser.has(log.user_id)) daysByUser.set(log.user_id, new Set())
    daysByUser.get(log.user_id)!.add(log.log_date as string)
  }

  const eligible = allUsers.filter((u) => (daysByUser.get(u.id)?.size ?? 0) >= 2)

  let generated = 0
  const skipped = allUsers.length - eligible.length
  const errors: string[] = []

  const BATCH_SIZE = 5
  for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
    const batch = eligible.slice(i, i + BATCH_SIZE)
    await Promise.all(batch.map(async (user) => {
      try {
        await generateVendedorReport({ userId: user.id, periodType: 'weekly', periodStart: thisMonday, periodEnd: thisFriday })
        generated++
        console.log(`[cron/weekly-coach] Generated for ${user.id} (${user.full_name ?? 'unknown'})`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`${user.id}: ${msg}`)
        console.error(`[cron/weekly-coach] Error for ${user.id}:`, msg)
      }
    }))
  }

  const summary = { date: today, weekStart: thisMonday, generated, skipped, errors: errors.length ? errors : undefined }
  console.log('[cron/weekly-coach]', JSON.stringify(summary))

  // ── Manager team reports ──────────────────────────────────────────────────
  let gerenteGenerated = 0
  try {
    const { data: managers } = await sb
      .from('profiles')
      .select('id')
      .eq('org_role', 'manager')
      .in('role', ['active', 'admin'])
      .not('company', 'is', null)

    for (const mgr of managers ?? []) {
      try {
        await generateGerenteReport({ managerUserId: mgr.id, periodType: 'weekly', periodStart: thisMonday, periodEnd: thisFriday })
        gerenteGenerated++
        console.log(`[cron/weekly-coach] Gerente report for ${mgr.id}`)
      } catch (err) {
        console.error(`[cron/weekly-coach] Gerente report failed for ${mgr.id}:`, err)
      }
    }
  } catch (err) {
    console.error('[cron/weekly-coach] Manager reports loop failed:', err)
  }

  return Response.json({ ...summary, gerenteGenerated })
}
