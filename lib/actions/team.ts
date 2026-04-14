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

  const weeklyGoal = Math.ceil(monthlyGoal / 4)
  const dailyGoal  = Math.ceil(monthlyGoal / 20)

  const service = getSupabaseServiceClient()
  const { error } = await service
    .from('activities')
    .update({ monthly_goal: monthlyGoal, weekly_goal: weeklyGoal, daily_goal: dailyGoal })
    .eq('id', activityId)
    .eq('user_id', userId)

  if (error) throw error

  revalidatePath(`/team/${userId}`)
}
