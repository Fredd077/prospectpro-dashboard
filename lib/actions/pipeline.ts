'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export interface PipelineEntryData {
  stage: string
  prospect_type: 'OUTBOUND' | 'INBOUND'
  company_name?: string | null
  prospect_name?: string | null
  quantity: number
  amount_usd: number | null
  entry_date: string
  notes: string | null
  recipe_scenario_id?: string | null
  is_quick_entry?: boolean
}

export interface FunnelCheckinStageData {
  stage: string
  quantity: number
  amount_usd: number | null
  companies: string[]  // empty = quick entry; populated = one row per company
}

function revalidateAll() {
  revalidatePath('/pipeline')
  revalidatePath('/dashboard')
  revalidatePath('/checkin')
}

export async function savePipelineEntry(data: PipelineEntryData): Promise<string> {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: inserted, error } = await sb
    .from('pipeline_entries')
    .insert({
      user_id: user.id,
      recipe_scenario_id: data.recipe_scenario_id ?? null,
      stage: data.stage,
      prospect_type: data.prospect_type,
      company_name: data.company_name?.trim() ?? null,
      prospect_name: data.prospect_name?.trim() ?? null,
      quantity: data.quantity,
      amount_usd: data.amount_usd,
      entry_date: data.entry_date,
      notes: data.notes?.trim() || null,
      is_quick_entry: data.is_quick_entry ?? false,
    })
    .select('id')
    .single()

  if (error) throw error
  revalidateAll()
  return inserted.id
}

export async function updatePipelineEntry(id: string, data: Partial<PipelineEntryData>): Promise<void> {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await sb
    .from('pipeline_entries')
    .update({
      stage:         data.stage,
      prospect_type: data.prospect_type,
      company_name:  data.company_name !== undefined ? data.company_name?.trim() ?? null : undefined,
      prospect_name: data.prospect_name !== undefined ? data.prospect_name?.trim() ?? null : undefined,
      quantity:      data.quantity,
      amount_usd:    data.amount_usd,
      entry_date:    data.entry_date,
      notes:         data.notes?.trim() || null,
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error
  revalidateAll()
}

export async function deletePipelineEntry(id: string): Promise<void> {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await sb
    .from('pipeline_entries')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error
  revalidateAll()
}

/**
 * Upsert quick funnel checkin for a given date and prospect type.
 * For each stage:
 *   - If companies provided → delete existing quick entry, insert one row per company (is_quick_entry=false)
 *   - Else → upsert a single quick entry (is_quick_entry=true) by finding existing or inserting new
 */
export async function saveQuickFunnelCheckin(
  date: string,
  type: 'OUTBOUND' | 'INBOUND',
  stages: FunnelCheckinStageData[],
  scenarioId: string | null,
): Promise<void> {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  for (const s of stages) {
    if (s.quantity <= 0 && s.companies.length === 0) continue

    if (s.companies.length > 0) {
      // Detail mode: clear any existing quick entry for this slot, insert per-company rows
      await sb
        .from('pipeline_entries')
        .delete()
        .eq('user_id', user.id)
        .eq('stage', s.stage)
        .eq('entry_date', date)
        .eq('prospect_type', type)
        .eq('is_quick_entry', true)

      // Only the first company row carries the amount to avoid double-counting
      const rows = s.companies.map((company, idx) => ({
        user_id: user.id,
        recipe_scenario_id: scenarioId,
        stage: s.stage,
        prospect_type: type,
        company_name: company.trim(),
        prospect_name: null as string | null,
        quantity: 1,
        amount_usd: idx === 0 ? s.amount_usd : null,
        entry_date: date,
        is_quick_entry: false,
      }))

      const { error } = await sb.from('pipeline_entries').insert(rows)
      if (error) throw error
    } else {
      // Quick mode: upsert — find existing quick row and update, or insert new
      const { data: existing } = await sb
        .from('pipeline_entries')
        .select('id')
        .eq('user_id', user.id)
        .eq('stage', s.stage)
        .eq('entry_date', date)
        .eq('prospect_type', type)
        .eq('is_quick_entry', true)
        .maybeSingle()

      if (existing) {
        const { error } = await sb
          .from('pipeline_entries')
          .update({ quantity: s.quantity, amount_usd: s.amount_usd })
          .eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await sb
          .from('pipeline_entries')
          .insert({
            user_id: user.id,
            recipe_scenario_id: scenarioId,
            stage: s.stage,
            prospect_type: type,
            company_name: null,
            prospect_name: null,
            quantity: s.quantity,
            amount_usd: s.amount_usd,
            entry_date: date,
            is_quick_entry: true,
          })
        if (error) throw error
      }
    }
  }

  revalidateAll()
}

export async function getActiveScenarioForFunnel(): Promise<{
  id: string
  funnel_stages: string[]
} | null> {
  const sb = await getSupabaseServerClient()
  const { data } = await sb
    .from('recipe_scenarios')
    .select('id,funnel_stages')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export async function getCompanyNames(): Promise<string[]> {
  const sb = await getSupabaseServerClient()
  const { data } = await sb
    .from('pipeline_entries')
    .select('company_name')
    .not('company_name', 'is', null)
    .order('company_name')

  if (!data) return []
  const unique = [...new Set(data.map((r) => r.company_name as string))]
  return unique.sort()
}
