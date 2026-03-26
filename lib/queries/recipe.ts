import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { RecipeScenarioInsert, RecipeScenarioUpdate, RecipeActualInsert } from '@/lib/types/database'
import { calcRecipe } from '@/lib/calculations/recipe'

export async function fetchScenarios() {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb
    .from('recipe_scenarios')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchScenario(id: string) {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb
    .from('recipe_scenarios')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createScenario(payload: Omit<RecipeScenarioInsert,
  'closes_needed_monthly' | 'proposals_needed_monthly' | 'meetings_needed_monthly' |
  'speeches_needed_monthly' | 'activities_needed_monthly' | 'activities_needed_weekly' |
  'activities_needed_daily'>) {
  const sb = getSupabaseBrowserClient()
  const outputs = calcRecipe({
    monthly_revenue_goal: payload.monthly_revenue_goal,
    outbound_pct: payload.outbound_pct ?? 50,
    average_ticket: payload.average_ticket,
    working_days_per_month: payload.working_days_per_month ?? 22,
    conv_activity_to_speech: payload.conv_activity_to_speech,
    conv_speech_to_meeting: payload.conv_speech_to_meeting,
    conv_meeting_to_proposal: payload.conv_meeting_to_proposal,
    conv_proposal_to_close: payload.conv_proposal_to_close,
    inbound_conv_activity_to_speech:  payload.inbound_conv_activity_to_speech  ?? payload.conv_activity_to_speech,
    inbound_conv_speech_to_meeting:   payload.inbound_conv_speech_to_meeting   ?? payload.conv_speech_to_meeting,
    inbound_conv_meeting_to_proposal: payload.inbound_conv_meeting_to_proposal ?? payload.conv_meeting_to_proposal,
    inbound_conv_proposal_to_close:   payload.inbound_conv_proposal_to_close   ?? payload.conv_proposal_to_close,
  })
  const { data, error } = await sb
    .from('recipe_scenarios')
    .insert({
      ...payload,
      closes_needed_monthly: outputs.closes_needed_monthly,
      proposals_needed_monthly: outputs.proposals_needed_monthly,
      meetings_needed_monthly: outputs.meetings_needed_monthly,
      speeches_needed_monthly: outputs.speeches_needed_monthly,
      activities_needed_monthly: outputs.activities_needed_monthly,
      activities_needed_weekly: outputs.activities_needed_weekly,
      activities_needed_daily: outputs.activities_needed_daily,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateScenario(id: string, payload: RecipeScenarioUpdate) {
  const sb = getSupabaseBrowserClient()
  const current = await fetchScenario(id)
  const outputs = calcRecipe({
    monthly_revenue_goal: payload.monthly_revenue_goal ?? current.monthly_revenue_goal,
    outbound_pct: payload.outbound_pct ?? current.outbound_pct,
    average_ticket: payload.average_ticket ?? current.average_ticket,
    working_days_per_month: payload.working_days_per_month ?? current.working_days_per_month,
    conv_activity_to_speech: payload.conv_activity_to_speech ?? current.conv_activity_to_speech,
    conv_speech_to_meeting: payload.conv_speech_to_meeting ?? current.conv_speech_to_meeting,
    conv_meeting_to_proposal: payload.conv_meeting_to_proposal ?? current.conv_meeting_to_proposal,
    conv_proposal_to_close: payload.conv_proposal_to_close ?? current.conv_proposal_to_close,
    inbound_conv_activity_to_speech:  payload.inbound_conv_activity_to_speech  ?? current.inbound_conv_activity_to_speech,
    inbound_conv_speech_to_meeting:   payload.inbound_conv_speech_to_meeting   ?? current.inbound_conv_speech_to_meeting,
    inbound_conv_meeting_to_proposal: payload.inbound_conv_meeting_to_proposal ?? current.inbound_conv_meeting_to_proposal,
    inbound_conv_proposal_to_close:   payload.inbound_conv_proposal_to_close   ?? current.inbound_conv_proposal_to_close,
  })
  const { data, error } = await sb
    .from('recipe_scenarios')
    .update({
      ...payload,
      closes_needed_monthly: outputs.closes_needed_monthly,
      proposals_needed_monthly: outputs.proposals_needed_monthly,
      meetings_needed_monthly: outputs.meetings_needed_monthly,
      speeches_needed_monthly: outputs.speeches_needed_monthly,
      activities_needed_monthly: outputs.activities_needed_monthly,
      activities_needed_weekly: outputs.activities_needed_weekly,
      activities_needed_daily: outputs.activities_needed_daily,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteScenario(id: string) {
  const sb = getSupabaseBrowserClient()
  const { error } = await sb.from('recipe_scenarios').delete().eq('id', id)
  if (error) throw error
}

export async function setActiveScenario(id: string) {
  const sb = getSupabaseBrowserClient()
  // Deactivate all, then activate the target
  const { error: e1 } = await sb
    .from('recipe_scenarios')
    .update({ is_active: false })
    .neq('id', id)
  if (e1) throw e1
  const { error: e2 } = await sb
    .from('recipe_scenarios')
    .update({ is_active: true })
    .eq('id', id)
  if (e2) throw e2
}

export async function duplicateScenario(id: string) {
  const sb = getSupabaseBrowserClient()
  const original = await fetchScenario(id)
  const { id: _id, created_at, updated_at, ...rest } = original
  const { data, error } = await sb
    .from('recipe_scenarios')
    .insert({ ...rest, name: `Copia de ${original.name}`, is_active: false })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function fetchActuals(scenarioId: string) {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb
    .from('recipe_actuals')
    .select('*')
    .eq('scenario_id', scenarioId)
    .order('period_start', { ascending: false })
  if (error) throw error
  return data
}

export async function upsertActual(payload: RecipeActualInsert) {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb
    .from('recipe_actuals')
    .upsert(payload, { onConflict: 'scenario_id,period_type,period_start' })
    .select()
    .single()
  if (error) throw error
  return data
}
