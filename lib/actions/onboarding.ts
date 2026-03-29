'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { calcRecipe } from '@/lib/calculations/recipe'

// Default starter activities for new users
const DEFAULT_ACTIVITIES = [
  { name: 'Llamadas en frío',      type: 'OUTBOUND' as const, channel: 'Teléfono',  monthly_goal: 60,  sort_order: 1 },
  { name: 'Mensajes LinkedIn',     type: 'OUTBOUND' as const, channel: 'LinkedIn',  monthly_goal: 80,  sort_order: 2 },
  { name: 'Emails de prospección', type: 'OUTBOUND' as const, channel: 'Email',     monthly_goal: 80,  sort_order: 3 },
  { name: 'Seguimientos',          type: 'OUTBOUND' as const, channel: 'Múltiple',  monthly_goal: 40,  sort_order: 4 },
  { name: 'Eventos de networking', type: 'OUTBOUND' as const, channel: 'Presencial', monthly_goal: 4,  sort_order: 5 },
  { name: 'Respuestas a inbound',  type: 'INBOUND'  as const, channel: 'Múltiple',  monthly_goal: 20,  sort_order: 6 },
  { name: 'Demos realizadas',      type: 'INBOUND'  as const, channel: 'Video',     monthly_goal: 8,   sort_order: 7 },
]

interface RecipeFormData {
  name: string
  monthly_revenue_goal: number
  average_ticket: number
  outbound_pct: number
  conv_activity_to_speech: number
  conv_speech_to_meeting: number
  conv_meeting_to_proposal: number
  conv_proposal_to_close: number
  inbound_conv_activity_to_speech: number
  inbound_conv_speech_to_meeting: number
  inbound_conv_meeting_to_proposal: number
  inbound_conv_proposal_to_close: number
}

export async function saveOnboardingRecipe(data: RecipeFormData) {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const inbound_pct = 100 - data.outbound_pct

  // Calculate funnel numbers using independent inbound rates
  const result = calcRecipe({
    monthly_revenue_goal: data.monthly_revenue_goal,
    average_ticket: data.average_ticket,
    outbound_pct: data.outbound_pct,
    working_days_per_month: 20,
    conv_activity_to_speech: data.conv_activity_to_speech,
    conv_speech_to_meeting: data.conv_speech_to_meeting,
    conv_meeting_to_proposal: data.conv_meeting_to_proposal,
    conv_proposal_to_close: data.conv_proposal_to_close,
    inbound_conv_activity_to_speech: data.inbound_conv_activity_to_speech,
    inbound_conv_speech_to_meeting: data.inbound_conv_speech_to_meeting,
    inbound_conv_meeting_to_proposal: data.inbound_conv_meeting_to_proposal,
    inbound_conv_proposal_to_close: data.inbound_conv_proposal_to_close,
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
    inbound_pct,
    working_days_per_month: 20,
    conv_activity_to_speech: data.conv_activity_to_speech,
    conv_speech_to_meeting: data.conv_speech_to_meeting,
    conv_meeting_to_proposal: data.conv_meeting_to_proposal,
    conv_proposal_to_close: data.conv_proposal_to_close,
    inbound_conv_activity_to_speech: data.inbound_conv_activity_to_speech,
    inbound_conv_speech_to_meeting: data.inbound_conv_speech_to_meeting,
    inbound_conv_meeting_to_proposal: data.inbound_conv_meeting_to_proposal,
    inbound_conv_proposal_to_close: data.inbound_conv_proposal_to_close,
    closes_needed_monthly: result.outbound.closes_needed + result.inbound.closes_needed,
    proposals_needed_monthly: result.outbound.proposals_needed + result.inbound.proposals_needed,
    meetings_needed_monthly: result.outbound.meetings_needed + result.inbound.meetings_needed,
    speeches_needed_monthly: result.outbound.speeches_needed + result.inbound.speeches_needed,
    activities_needed_monthly: result.outbound.activities_monthly + result.inbound.activities_monthly,
    activities_needed_weekly: Math.ceil((result.outbound.activities_monthly + result.inbound.activities_monthly) / 4),
    activities_needed_daily: Math.ceil((result.outbound.activities_monthly + result.inbound.activities_monthly) / 20),
  })

  if (error) throw error
}

interface ActivityGoalOverride {
  name: string
  monthly_goal: number
}

export async function saveOnboardingActivities(overrides: ActivityGoalOverride[]) {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Build activities with overrides applied
  const activities = DEFAULT_ACTIVITIES.map((act) => {
    const override = overrides.find((o) => o.name === act.name)
    const monthly_goal = override ? override.monthly_goal : act.monthly_goal
    const weekly_goal = Math.ceil(monthly_goal / 4)
    const daily_goal = Math.ceil(monthly_goal / 20)
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
