'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { calcRecipe, DEFAULT_FUNNEL_STAGES, DEFAULT_OUTBOUND_RATES, DEFAULT_INBOUND_RATES } from '@/lib/calculations/recipe'

// Default starter activities for new users
const DEFAULT_ACTIVITIES = [
  { name: 'Llamadas en frío',      type: 'OUTBOUND' as const, channel: 'Teléfono',   monthly_goal: 60, sort_order: 1 },
  { name: 'Mensajes LinkedIn',     type: 'OUTBOUND' as const, channel: 'LinkedIn',   monthly_goal: 80, sort_order: 2 },
  { name: 'Emails de prospección', type: 'OUTBOUND' as const, channel: 'Email',      monthly_goal: 80, sort_order: 3 },
  { name: 'Seguimientos',          type: 'OUTBOUND' as const, channel: 'Múltiple',   monthly_goal: 40, sort_order: 4 },
  { name: 'Eventos de networking', type: 'OUTBOUND' as const, channel: 'Presencial', monthly_goal: 4,  sort_order: 5 },
  { name: 'Respuestas a inbound',  type: 'INBOUND'  as const, channel: 'Múltiple',   monthly_goal: 20, sort_order: 6 },
  { name: 'Demos realizadas',      type: 'INBOUND'  as const, channel: 'Video',      monthly_goal: 8,  sort_order: 7 },
]

interface RecipeFormData {
  name: string
  monthly_revenue_goal: number
  average_ticket: number
  outbound_pct: number
  funnel_stages: string[]
  outbound_rates: number[]
  inbound_rates: number[]
}

export async function saveOnboardingRecipe(data: RecipeFormData) {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const funnel_stages  = data.funnel_stages  ?? DEFAULT_FUNNEL_STAGES
  const outbound_rates = data.outbound_rates ?? DEFAULT_OUTBOUND_RATES
  const inbound_rates  = data.inbound_rates  ?? DEFAULT_INBOUND_RATES

  const result = calcRecipe({
    monthly_revenue_goal:  data.monthly_revenue_goal,
    average_ticket:        data.average_ticket,
    outbound_pct:          data.outbound_pct,
    working_days_per_month: 20,
    funnel_stages,
    outbound_rates,
    inbound_rates,
  })

  // Deactivate any existing active scenario for this user
  await sb
    .from('recipe_scenarios')
    .update({ is_active: false })
    .eq('user_id', user.id)
    .eq('is_active', true)

  const { error } = await sb.from('recipe_scenarios').insert({
    user_id: user.id,
    name: data.name,
    is_active: true,
    monthly_revenue_goal: data.monthly_revenue_goal,
    average_ticket: data.average_ticket,
    outbound_pct: data.outbound_pct,
    // inbound_pct is GENERATED ALWAYS AS (100 - outbound_pct) STORED — do not insert
    working_days_per_month: 20,
    funnel_stages,
    outbound_rates,
    inbound_rates,
    activities_needed_monthly: result.activities_needed_monthly,
    activities_needed_weekly:  result.activities_needed_weekly,
    activities_needed_daily:   result.activities_needed_daily,
  })

  if (error) throw error
}

interface ActivityGoalOverride {
  name: string
  monthly_goal: number
}

export async function saveOnboardingCompany(company: string) {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  await sb.from('profiles').update({ company: company || null }).eq('id', user.id)
}

export async function saveOnboardingActivities(overrides: ActivityGoalOverride[]) {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const activities = DEFAULT_ACTIVITIES.map((act) => {
    const override = overrides.find((o) => o.name === act.name)
    const monthly_goal = override ? override.monthly_goal : act.monthly_goal
    const weekly_goal  = Math.ceil(monthly_goal / 4)
    const daily_goal   = Math.ceil(monthly_goal / 20)
    return {
      user_id: user.id,
      name: act.name,
      type: act.type,
      channel: act.channel,
      monthly_goal,
      weekly_goal,
      daily_goal,
      status: 'active' as const,
      sort_order: act.sort_order,
    }
  })

  const { error } = await sb.from('activities').insert(activities)
  if (error) throw error

  // Mark onboarding as complete
  await sb
    .from('profiles')
    .update({ onboarding_completed: true })
    .eq('id', user.id)

  revalidatePath('/dashboard')
}
