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

  const { data: deal, error: dealError } = await sb
    .from('deals')
    .insert({
      user_id: user.id,
      recipe_scenario_id: data.recipe_scenario_id ?? null,
      company_name: data.company_name?.trim() ?? null,
      prospect_name: data.prospect_name?.trim() ?? null,
      prospect_type: data.prospect_type,
      current_stage: data.initial_stage,
      status: 'active',
      amount_usd: data.amount_usd ?? null,
      entry_date: data.entry_date,
    })
    .select('id')
    .single()

  if (dealError) throw dealError

  const { error: entryError } = await sb
    .from('pipeline_entries')
    .insert({
      user_id: user.id,
      recipe_scenario_id: data.recipe_scenario_id ?? null,
      deal_id: deal.id,
      stage: data.initial_stage,
      from_stage: null,
      prospect_type: data.prospect_type,
      company_name: data.company_name?.trim() ?? null,
      prospect_name: data.prospect_name?.trim() ?? null,
      quantity: 1,
      amount_usd: data.amount_usd ?? null,
      entry_date: data.entry_date,
      is_quick_entry: false,
    })

  if (entryError) throw entryError

  revalidatePath('/pipeline')
  return deal.id
}

export async function advanceDeal(
  dealId: string,
  toStage: string,
  moveDate: string,
): Promise<void> {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: deal, error: fetchError } = await sb
    .from('deals')
    .select('current_stage, prospect_type, recipe_scenario_id, company_name, prospect_name')
    .eq('id', dealId)
    .eq('user_id', user.id)
    .single()

  if (fetchError) throw fetchError

  const { error: updateError } = await sb
    .from('deals')
    .update({ current_stage: toStage, updated_at: new Date().toISOString() })
    .eq('id', dealId)
    .eq('user_id', user.id)

  if (updateError) throw updateError

  const { error: entryError } = await sb
    .from('pipeline_entries')
    .insert({
      user_id: user.id,
      recipe_scenario_id: deal.recipe_scenario_id ?? null,
      deal_id: dealId,
      stage: toStage,
      from_stage: deal.current_stage,
      prospect_type: deal.prospect_type as 'OUTBOUND' | 'INBOUND',
      company_name: deal.company_name ?? null,
      prospect_name: deal.prospect_name ?? null,
      quantity: 1,
      entry_date: moveDate,
      is_quick_entry: false,
    })

  if (entryError) throw entryError

  revalidatePath('/pipeline')
}

export async function closeDealWon(
  dealId: string,
  amount_usd: number | null,
  closeDate: string,
): Promise<void> {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: deal, error: fetchError } = await sb
    .from('deals')
    .select('current_stage, prospect_type, recipe_scenario_id, company_name, prospect_name')
    .eq('id', dealId)
    .eq('user_id', user.id)
    .single()

  if (fetchError) throw fetchError

  const updatePayload: Record<string, unknown> = {
    status: 'won',
    closed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  if (amount_usd != null) updatePayload.amount_usd = amount_usd

  const { error: updateError } = await sb
    .from('deals')
    .update(updatePayload)
    .eq('id', dealId)
    .eq('user_id', user.id)

  if (updateError) throw updateError

  const { error: entryError } = await sb
    .from('pipeline_entries')
    .insert({
      user_id: user.id,
      recipe_scenario_id: deal.recipe_scenario_id ?? null,
      deal_id: dealId,
      stage: deal.current_stage,
      from_stage: deal.current_stage,
      prospect_type: deal.prospect_type as 'OUTBOUND' | 'INBOUND',
      company_name: deal.company_name ?? null,
      prospect_name: deal.prospect_name ?? null,
      quantity: 1,
      amount_usd: amount_usd,
      entry_date: closeDate,
      is_quick_entry: false,
    })

  if (entryError) throw entryError

  revalidatePath('/pipeline')
}

export async function closeDealLost(
  dealId: string,
  lost_reason: string | null,
  lostDate: string,
): Promise<void> {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: deal, error: fetchError } = await sb
    .from('deals')
    .select('current_stage')
    .eq('id', dealId)
    .eq('user_id', user.id)
    .single()

  if (fetchError) throw fetchError

  const { error: updateError } = await sb
    .from('deals')
    .update({
      status: 'lost',
      lost_reason: lost_reason ?? null,
      lost_at_stage: deal.current_stage,
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', dealId)
    .eq('user_id', user.id)

  if (updateError) throw updateError

  // No pipeline_entry on lost — el trato se cayó
  revalidatePath('/pipeline')

  // lostDate param accepted for API consistency; not stored on lost deals
  void lostDate
}
