'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export interface PipelineEntryData {
  stage: string
  prospect_type: 'OUTBOUND' | 'INBOUND'
  company_name: string
  prospect_name: string
  quantity: number
  amount_usd: number | null
  entry_date: string
  notes: string | null
  recipe_scenario_id?: string | null
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
      company_name: data.company_name.trim(),
      prospect_name: data.prospect_name.trim(),
      quantity: data.quantity,
      amount_usd: data.amount_usd,
      entry_date: data.entry_date,
      notes: data.notes?.trim() || null,
    })
    .select('id')
    .single()

  if (error) throw error

  revalidatePath('/pipeline')
  revalidatePath('/dashboard')
  revalidatePath('/checkin')

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
      company_name:  data.company_name?.trim(),
      prospect_name: data.prospect_name?.trim(),
      quantity:      data.quantity,
      amount_usd:    data.amount_usd,
      entry_date:    data.entry_date,
      notes:         data.notes?.trim() || null,
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error

  revalidatePath('/pipeline')
  revalidatePath('/dashboard')
  revalidatePath('/checkin')
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

  revalidatePath('/pipeline')
  revalidatePath('/dashboard')
  revalidatePath('/checkin')
}

export async function getCompanyNames(): Promise<string[]> {
  const sb = await getSupabaseServerClient()
  const { data } = await sb
    .from('pipeline_entries')
    .select('company_name')
    .order('company_name')

  if (!data) return []
  const unique = [...new Set(data.map((r) => r.company_name))]
  return unique.sort()
}
