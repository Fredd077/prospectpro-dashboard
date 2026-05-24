import { getSupabaseServiceClient } from '@/lib/supabase/server'
import type { IntelligenceReport, IntelligenceReportInsert } from '@/lib/types/database'

/**
 * Returns a cached report if the data hash matches exactly.
 * Returns null if no matching cache entry exists.
 */
export async function getCachedReport(
  userId: string,
  audience: 'vendedor' | 'gerente',
  periodType: 'daily' | 'weekly' | 'monthly',
  periodStart: string,
  periodEnd: string,
  dataHash: string,
): Promise<IntelligenceReport | null> {
  const sb = getSupabaseServiceClient()
  const { data, error } = await sb
    .from('intelligence_reports')
    .select('*')
    .eq('user_id', userId)
    .eq('report_audience', audience)
    .eq('period_type', periodType)
    .eq('period_start', periodStart)
    .eq('period_end', periodEnd)
    .eq('data_hash', dataHash)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

/**
 * Persists a generated report. Uses the service role client so this works
 * from server-side agent code without requiring an authenticated session.
 */
export async function saveReport(
  reportData: IntelligenceReportInsert,
): Promise<IntelligenceReport> {
  const sb = getSupabaseServiceClient()
  const { data, error } = await sb
    .from('intelligence_reports')
    .insert(reportData)
    .select()
    .single()

  if (error) throw error
  return data
}
