'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { calcRecipe, DEFAULT_FUNNEL_STAGES, DEFAULT_OUTBOUND_RATES, DEFAULT_INBOUND_RATES } from '@/lib/calculations/recipe'

interface WeightUpdate {
  id: string
  weight: number
  monthly_goal: number
  weekly_goal: number
  daily_goal: number
}

export async function saveWeightDistribution(updates: WeightUpdate[]) {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  await Promise.all(
    updates.map(({ id, weight, monthly_goal, weekly_goal, daily_goal }) =>
      sb.from('activities')
        .update({ weight, monthly_goal, weekly_goal, daily_goal })
        .eq('id', id)
        .eq('user_id', user.id),
    ),
  )

  revalidatePath('/activities')
  revalidatePath('/dashboard')
  revalidatePath('/checkin')
}

// Replaces setActiveScenario from lib/queries/recipe — also recalculates
// all activity goals using the new scenario's totals and stored weights.
export async function activateScenario(scenarioId: string) {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Deactivate all, then activate the selected scenario
  await sb.from('recipe_scenarios').update({ is_active: false }).eq('user_id', user.id)
  const { data: scenario, error } = await sb
    .from('recipe_scenarios')
    .update({ is_active: true })
    .eq('id', scenarioId)
    .eq('user_id', user.id)
    .select('monthly_revenue_goal, average_ticket, outbound_pct, working_days_per_month, funnel_stages, outbound_rates, inbound_rates')
    .single()

  if (error || !scenario) throw error ?? new Error('Scenario not found')

  // Use calcRecipe to get correct per-type activity counts (same formula as RecipeValidationCard)
  const recipeResult = calcRecipe({
    monthly_revenue_goal:   scenario.monthly_revenue_goal,
    outbound_pct:           scenario.outbound_pct,
    average_ticket:         scenario.average_ticket,
    working_days_per_month: scenario.working_days_per_month ?? 20,
    funnel_stages:  scenario.funnel_stages  ?? DEFAULT_FUNNEL_STAGES,
    outbound_rates: scenario.outbound_rates ?? DEFAULT_OUTBOUND_RATES,
    inbound_rates:  scenario.inbound_rates  ?? DEFAULT_INBOUND_RATES,
  })
  const outboundTotal = recipeResult.outbound.activities_monthly
  const inboundTotal  = recipeResult.inbound.activities_monthly
  const workingDays   = scenario.working_days_per_month ?? 20

  const { data: activities } = await sb
    .from('activities')
    .select('id, type, weight')
    .eq('user_id', user.id)
    .eq('status', 'active')

  if (activities && activities.length > 0) {
    await Promise.all(
      activities.map((act) => {
        const typeTotal    = act.type === 'OUTBOUND' ? outboundTotal : inboundTotal
        const monthly_goal = Math.ceil(typeTotal * (act.weight ?? 0) / 100)
        const weekly_goal  = Math.ceil(monthly_goal / (workingDays / 5))
        const daily_goal   = Math.ceil(monthly_goal / workingDays)
        return sb.from('activities')
          .update({ monthly_goal, weekly_goal, daily_goal })
          .eq('id', act.id)
      }),
    )
  }

  revalidatePath('/recipe')
  revalidatePath('/activities')
  revalidatePath('/dashboard')
  revalidatePath('/checkin')
}
