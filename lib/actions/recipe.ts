'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { calcRecipe, DEFAULT_FUNNEL_STAGES, DEFAULT_OUTBOUND_RATES, DEFAULT_INBOUND_RATES } from '@/lib/calculations/recipe'
import type { RecipeScenarioUpdate } from '@/lib/types/database'

export async function updateScenarioAction(id: string, payload: RecipeScenarioUpdate) {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: current, error: fetchError } = await sb
    .from('recipe_scenarios')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (fetchError || !current) throw fetchError ?? new Error('Scenario not found')

  const funnel_stages  = payload.funnel_stages  ?? current.funnel_stages  ?? DEFAULT_FUNNEL_STAGES
  const outbound_rates = payload.outbound_rates ?? current.outbound_rates ?? DEFAULT_OUTBOUND_RATES
  const inbound_rates  = payload.inbound_rates  ?? current.inbound_rates  ?? DEFAULT_INBOUND_RATES

  const outputs = calcRecipe({
    monthly_revenue_goal:   payload.monthly_revenue_goal   ?? current.monthly_revenue_goal,
    outbound_pct:           payload.outbound_pct           ?? current.outbound_pct,
    average_ticket:         payload.average_ticket         ?? current.average_ticket,
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
    .eq('user_id', user.id)
    .select()
    .single()
  if (error) throw error

  revalidatePath('/recipe', 'layout')
  revalidatePath('/activities')
  revalidatePath('/dashboard')

  return data
}
