import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { GoalInsert, GoalUpdate } from '@/lib/types/database'
import type { PeriodType } from '@/lib/types/common'

export async function fetchGoals(periodType?: PeriodType, activityId?: string | null) {
  const sb = getSupabaseBrowserClient()
  let query = sb
    .from('goals')
    .select('*')
    .order('period_start', { ascending: false })

  if (periodType) query = query.eq('period_type', periodType)
  if (activityId !== undefined) {
    query = activityId === null
      ? query.is('activity_id', null)
      : query.eq('activity_id', activityId)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function fetchGoalsForPeriod(start: string, end: string) {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb
    .from('goals')
    .select('*')
    .lte('period_start', end)
    .gte('period_end', start)
    .order('period_start', { ascending: true })
  if (error) throw error
  return data
}

export async function createGoal(payload: GoalInsert) {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb
    .from('goals')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateGoal(id: string, payload: GoalUpdate) {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb
    .from('goals')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteGoal(id: string) {
  const sb = getSupabaseBrowserClient()
  const { error } = await sb.from('goals').delete().eq('id', id)
  if (error) throw error
}
