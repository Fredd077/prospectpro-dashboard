import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { ActivityLogInsert, ActivityLogUpdate } from '@/lib/types/database'
import { todayISO } from '@/lib/utils/dates'

export async function fetchLogsByDate(date: string) {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb
    .from('vw_daily_compliance')
    .select('*')
    .eq('log_date', date)
    .order('activity_name', { ascending: true })
  if (error) throw error
  return data
}

export async function fetchLogsByDateRange(start: string, end: string, type?: 'OUTBOUND' | 'INBOUND') {
  const sb = getSupabaseBrowserClient()
  let query = sb
    .from('vw_daily_compliance')
    .select('*')
    .gte('log_date', start)
    .lte('log_date', end)
    .order('log_date', { ascending: true })

  if (type) query = query.eq('type', type)

  const { data, error } = await query
  if (error) throw error
  return data
}

/** Upsert a single log entry. day_goal snapshot must be provided by the caller. */
export async function upsertLog(payload: ActivityLogInsert & { is_retroactive?: boolean }) {
  const sb = getSupabaseBrowserClient()
  const isRetroactive = payload.log_date !== todayISO()
  const { data, error } = await sb
    .from('activity_logs')
    .upsert(
      { ...payload, is_retroactive: isRetroactive },
      { onConflict: 'activity_id,log_date' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

/** Bulk upsert for check-in form (one call per active activity) */
export async function bulkUpsertLogs(payloads: ActivityLogInsert[]) {
  const sb = getSupabaseBrowserClient()
  const today = todayISO()
  const rows = payloads.map((p) => ({
    ...p,
    is_retroactive: p.log_date !== today,
  }))
  const { data, error } = await sb
    .from('activity_logs')
    .upsert(rows, { onConflict: 'activity_id,log_date' })
    .select()
  if (error) throw error
  return data
}

export async function updateLog(id: string, payload: ActivityLogUpdate) {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb
    .from('activity_logs')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Aggregate real_executed by date range (for dashboard KPIs) */
export async function fetchAggregateByRange(
  start: string,
  end: string,
  type?: 'OUTBOUND' | 'INBOUND',
  channel?: string
) {
  const sb = getSupabaseBrowserClient()
  let query = sb
    .from('vw_daily_compliance')
    .select('log_date, real_executed, day_goal, compliance_pct, semaphore, type, channel')
    .gte('log_date', start)
    .lte('log_date', end)

  if (type) query = query.eq('type', type)
  if (channel) query = query.eq('channel', channel)

  const { data, error } = await query
  if (error) throw error
  return data
}
