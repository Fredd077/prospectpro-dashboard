'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { assertCanWrite } from '@/lib/utils/authz'
import { recalcActivityGoalsFromPerformance } from '@/lib/queries/activity-goals'
import type { ActivityInsert, ActivityUpdate } from '@/lib/types/database'

/** Revalida TODAS las rutas que muestran actividades o sus metas/logro, para que
 *  ninguna vista se quede con datos viejos tras crear/editar/borrar o cambiar metas. */
function revalidateActivityPaths() {
  revalidatePath('/dashboard')
  revalidatePath('/recipe', 'layout')
  revalidatePath('/activities')
  revalidatePath('/checkin')
}

export async function saveActivityMeetingsExpected(
  activityId: string,
  meetingsExpected: number,
): Promise<void> {
  const sb = await getSupabaseServerClient()
  const user = await assertCanWrite(sb)

  await sb.from('activities')
    .update({ meetings_expected: meetingsExpected })
    .eq('id', activityId)
    .eq('user_id', user.id)

  // Las metas dependen de este campo: se recalculan al instante, sin necesidad
  // de volver a activar el escenario.
  await recalcActivityGoalsFromPerformance(sb, user.id)

  revalidateActivityPaths()
}

export async function saveActivityConversionRates(
  rates: Array<{ activityId: string; conversionRatePct: number | null }>,
): Promise<void> {
  const sb = await getSupabaseServerClient()
  const user = await assertCanWrite(sb)

  await Promise.all(
    rates.map(({ activityId, conversionRatePct }) =>
      sb.from('activities')
        .update({ conversion_rate_pct: conversionRatePct })
        .eq('id', activityId)
        .eq('user_id', user.id),
    ),
  )

  // Idem: la tasa de conversión alimenta directamente monthly_goal.
  await recalcActivityGoalsFromPerformance(sb, user.id)

  revalidateActivityPaths()
}

// Replaces setActiveScenario from lib/queries/recipe — also recalculates all
// activity goals. Antes repartía una bolsa mensual entre actividades según
// `weight`; ahora cada actividad se dimensiona con su propio meetings_expected
// y conversion_rate_pct. Se sigue recalculando al activar porque
// working_days_per_month cambia entre escenarios y afecta weekly/daily aunque
// monthly no dependa del escenario.
export async function activateScenario(scenarioId: string) {
  const sb = await getSupabaseServerClient()
  const user = await assertCanWrite(sb)

  // Deactivate all, then activate the selected scenario
  await sb.from('recipe_scenarios').update({ is_active: false }).eq('user_id', user.id)
  const { data: scenario, error } = await sb
    .from('recipe_scenarios')
    .update({ is_active: true })
    .eq('id', scenarioId)
    .eq('user_id', user.id)
    .select('working_days_per_month')
    .single()

  if (error || !scenario) throw error ?? new Error('Scenario not found')

  await recalcActivityGoalsFromPerformance(sb, user.id, scenario.working_days_per_month ?? 20)

  revalidateActivityPaths()
}

// ── CRUD de actividades (server actions con revalidación) ─────────────────────
// Antes vivía en lib/queries/activities.ts escribiendo desde el navegador SIN
// revalidatePath, por lo que el dashboard/recipe quedaban con datos viejos.

export async function createActivityAction(payload: ActivityInsert) {
  const sb = await getSupabaseServerClient()
  const user = await assertCanWrite(sb)
  const { data, error } = await sb
    .from('activities')
    .insert({ ...payload, user_id: user.id })
    .select()
    .single()
  if (error) throw error
  revalidateActivityPaths()
  return data
}

export async function updateActivityAction(id: string, payload: ActivityUpdate) {
  const sb = await getSupabaseServerClient()
  const user = await assertCanWrite(sb)
  const { data, error } = await sb
    .from('activities')
    .update(payload)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()
  if (error) throw error
  revalidateActivityPaths()
  return data
}

export async function deleteActivityAction(id: string) {
  const sb = await getSupabaseServerClient()
  const user = await assertCanWrite(sb)
  const { error } = await sb
    .from('activities')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw error
  revalidateActivityPaths()
}
