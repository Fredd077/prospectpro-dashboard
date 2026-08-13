'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'

export async function togglePlayerCoach(currentValue: boolean) {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const service = getSupabaseServiceClient()
  const { error } = await service
    .from('profiles')
    .update({ is_player_coach: !currentValue })
    .eq('id', user.id)

  if (error) throw error

  revalidatePath('/team')
}

// Admin-only: update a user's activity monthly goal
export async function updateUserActivityGoal(
  userId: string,
  activityId: string,
  monthlyGoal: number,
) {
  // Verify caller is admin
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Forbidden')

  const service = getSupabaseServiceClient()

  // Días hábiles REALES del vendedor cuya meta se edita (no del gerente).
  // Antes se usaban divisores fijos 4 y 20, lo que descuadraba las metas contra
  // el Recetario de cualquier vendedor con working_days_per_month != 20.
  // Fallback a 20 si ese usuario no tiene ningún escenario activo.
  const { data: scenario } = await service
    .from('recipe_scenarios')
    .select('working_days_per_month')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const workingDays = scenario?.working_days_per_month ?? 20

  // Misma fórmula que recalcActivityGoalsFromPerformance y activateScenario.
  const weeklyGoal = Math.ceil(monthlyGoal / (workingDays / 5))
  const dailyGoal  = Math.ceil(monthlyGoal / workingDays)

  const { error } = await service
    .from('activities')
    .update({ monthly_goal: monthlyGoal, weekly_goal: weeklyGoal, daily_goal: dailyGoal })
    .eq('id', activityId)
    .eq('user_id', userId)

  if (error) throw error

  // Mismas rutas que revalidateActivityPaths(), por consistencia con el resto
  // de escritores de metas, además de la vista del gerente.
  revalidatePath(`/team/${userId}`)
  revalidatePath('/dashboard')
  revalidatePath('/recipe', 'layout')
  revalidatePath('/activities')
  revalidatePath('/checkin')
}
