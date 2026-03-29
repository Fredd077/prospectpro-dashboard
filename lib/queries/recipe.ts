import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { RecipeScenarioInsert, RecipeScenarioUpdate, RecipeActualInsert } from '@/lib/types/database'
import { calcRecipe, DEFAULT_FUNNEL_STAGES, DEFAULT_OUTBOUND_RATES, DEFAULT_INBOUND_RATES } from '@/lib/calculations/recipe'

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

export async function createScenario(payload: Omit<RecipeScenarioInsert, 'activities_needed_monthly' | 'activities_needed_weekly' | 'activities_needed_daily'>) {
  const sb = getSupabaseBrowserClient()
  const funnel_stages   = payload.funnel_stages   ?? DEFAULT_FUNNEL_STAGES
  const outbound_rates  = payload.outbound_rates  ?? DEFAULT_OUTBOUND_RATES
  const inbound_rates   = payload.inbound_rates   ?? DEFAULT_INBOUND_RATES

  const outputs = calcRecipe({
    monthly_revenue_goal:  payload.monthly_revenue_goal,
    outbound_pct:          payload.outbound_pct ?? 60,
    average_ticket:        payload.average_ticket,
    working_days_per_month: payload.working_days_per_month ?? 22,
    funnel_stages,
    outbound_rates,
    inbound_rates,
  })

  const { data, error } = await sb
    .from('recipe_scenarios')
    .insert({
      ...payload,
      funnel_stages,
      outbound_rates,
      inbound_rates,
      activities_needed_monthly: outputs.activities_needed_monthly,
      activities_needed_weekly:  outputs.activities_needed_weekly,
      activities_needed_daily:   outputs.activities_needed_daily,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateScenario(id: string, payload: RecipeScenarioUpdate) {
  const sb = getSupabaseBrowserClient()
  const current = await fetchScenario(id)
  const funnel_stages  = payload.funnel_stages  ?? current.funnel_stages
  const outbound_rates = payload.outbound_rates ?? current.outbound_rates
  const inbound_rates  = payload.inbound_rates  ?? current.inbound_rates

  const outputs = calcRecipe({
    monthly_revenue_goal:  payload.monthly_revenue_goal  ?? current.monthly_revenue_goal,
    outbound_pct:          payload.outbound_pct          ?? current.outbound_pct,
    average_ticket:        payload.average_ticket        ?? current.average_ticket,
    working_days_per_month: payload.working_days_per_month ?? current.working_days_per_month,
    funnel_stages,
    outbound_rates,
    inbound_rates,
  })

  const { data, error } = await sb
    .from('recipe_scenarios')
    .update({
      ...payload,
      funnel_stages,
      outbound_rates,
      inbound_rates,
      activities_needed_monthly: outputs.activities_needed_monthly,
      activities_needed_weekly:  outputs.activities_needed_weekly,
      activities_needed_daily:   outputs.activities_needed_daily,
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
  // Exclude generated/readonly columns from the spread
  const { id: _id, created_at, updated_at, inbound_pct: _inbound_pct, ...rest } = original
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
