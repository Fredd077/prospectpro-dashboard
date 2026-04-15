'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export async function createDeal(data: {
  company_name?: string | null
  prospect_name?: string | null
  prospect_type: 'OUTBOUND' | 'INBOUND'
  initial_stage: string
  amount_usd?: number | null
  recipe_scenario_id?: string | null
  entry_date: string
}): Promise<string> {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: entry, error } = await sb
    .from('pipeline_entries')
    .insert({
      user_id: user.id,
      recipe_scenario_id: data.recipe_scenario_id ?? null,
      company_name: data.company_name?.trim() ?? null,
      prospect_name: data.prospect_name?.trim() ?? null,
      prospect_type: data.prospect_type,
      stage: data.initial_stage,
      from_stage: null,
      quantity: 1,
      amount_usd: data.amount_usd ?? null,
      entry_date: data.entry_date,
      is_quick_entry: false,
    })
    .select('id')
    .single()

  if (error) throw error

  revalidatePath('/pipeline')
  return entry.id
}

export async function advanceDeal(
  entryId: string,
  toStage: string,
  moveDate: string,
): Promise<void> {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: entry, error: fetchError } = await sb
    .from('pipeline_entries')
    .select('stage')
    .eq('id', entryId)
    .eq('user_id', user.id)
    .single()

  if (fetchError) throw fetchError

  const { error } = await sb
    .from('pipeline_entries')
    .update({
      stage:      toStage,
      from_stage: entry.stage,
      entry_date: moveDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId)
    .eq('user_id', user.id)

  if (error) throw error

  revalidatePath('/pipeline')
}

export async function closeDealWon(
  entryId: string,
  amount_usd: number | null,
  closeDate: string,
): Promise<void> {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const updatePayload: Record<string, unknown> = {
    stage:      'Ganado',
    entry_date: closeDate,
    updated_at: new Date().toISOString(),
  }
  if (amount_usd != null) updatePayload.amount_usd = amount_usd

  const { error } = await sb
    .from('pipeline_entries')
    .update(updatePayload)
    .eq('id', entryId)
    .eq('user_id', user.id)

  if (error) throw error

  revalidatePath('/pipeline')
}

export async function closeDealLost(
  entryId: string,
  lost_reason: string | null,
  lostDate: string,
): Promise<void> {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await sb
    .from('pipeline_entries')
    .update({
      stage:      'Perdido',
      notes:      lost_reason ?? null,
      entry_date: lostDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId)
    .eq('user_id', user.id)

  if (error) throw error

  revalidatePath('/pipeline')
}

export async function updateDeal(
  entryId: string,
  data: {
    company_name?:  string | null
    prospect_name?: string | null
    amount_usd?:    number | null
    prospect_type?: 'OUTBOUND' | 'INBOUND'
    entry_date?:    string
    stage?:         string
  },
): Promise<void> {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await sb
    .from('pipeline_entries')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId)
    .eq('user_id', user.id)

  if (error) throw error
  revalidatePath('/pipeline')
}
