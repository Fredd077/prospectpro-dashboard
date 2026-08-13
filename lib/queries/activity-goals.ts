/**
 * Cálculo de metas por actividad a partir de su PROPIO rendimiento esperado.
 *
 * Modelo nuevo: cada actividad se dimensiona sola con los dos campos que el
 * usuario configura en la pestaña "Rendimiento" del Recetario:
 *
 *     monthly_goal = ceil(meetings_expected / (conversion_rate_pct / 100))
 *     weekly_goal  = ceil(monthly_goal / (workingDays / 5))
 *     daily_goal   = ceil(monthly_goal / workingDays)
 *
 * Sustituye al modelo anterior, que repartía una bolsa mensual entre actividades
 * según `activities.weight`. Ese campo ya no se lee ni se escribe desde la app
 * (la columna sigue en la base de datos, pendiente de una migración aparte).
 *
 * Vive en lib/queries/ —y no en lib/actions/— porque recibe el cliente de
 * Supabase como parámetro: un archivo 'use server' solo puede exportar funciones
 * async serializables, y un cliente no lo es. Sigue el mismo patrón que
 * getRecipePerformance(sb, …) y getMiDiaData(sb, …).
 *
 * Fechas: solo utilidades de lib/utils/dates.ts (todayISO).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import { todayISO } from '@/lib/utils/dates'

type Sb = SupabaseClient<Database>

export interface RecalcResult {
  /** Actividades cuya meta se recalculó. */
  updated: number
  /** Actividades intactas por no tener los dos campos configurados. */
  skipped: number
  /** Filas de activity_logs de HOY cuyo day_goal se re-sincronizó. */
  resnapshotted: number
}

const DEFAULT_WORKING_DAYS = 20

/**
 * Recalcula las metas de todas las actividades activas del usuario.
 *
 * @param workingDaysOverride  días hábiles a usar. Si se omite, se toma del
 *   escenario activo del usuario; si tampoco hay, 20.
 *
 * Una actividad SIN `meetings_expected` o SIN `conversion_rate_pct` (nulos o 0)
 * NO se toca: conserva la meta que ya tuviera. Es deliberado, para no romper
 * actividades que el usuario todavía no ha configurado en Rendimiento.
 */
export async function recalcActivityGoalsFromPerformance(
  sb: Sb,
  userId: string,
  workingDaysOverride?: number,
): Promise<RecalcResult> {
  let workingDays = workingDaysOverride
  if (workingDays == null) {
    const { data: scenario } = await sb
      .from('recipe_scenarios')
      .select('working_days_per_month')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    workingDays = scenario?.working_days_per_month ?? DEFAULT_WORKING_DAYS
  }
  if (!workingDays || workingDays <= 0) workingDays = DEFAULT_WORKING_DAYS

  const { data: activities } = await sb
    .from('activities')
    .select('id,meetings_expected,conversion_rate_pct,monthly_goal,weekly_goal,daily_goal')
    .eq('user_id', userId)
    .eq('status', 'active')

  const rows = activities ?? []
  const result: RecalcResult = { updated: 0, skipped: 0, resnapshotted: 0 }
  // Actividades cuyo daily_goal cambió → hay que re-sincronizar el snapshot de hoy.
  const newDailyById = new Map<string, number>()

  for (const a of rows) {
    const expected = a.meetings_expected ?? 0
    const rate = a.conversion_rate_pct ?? 0
    // Sin los dos campos configurados no se recalcula: se respeta la meta actual.
    if (expected <= 0 || rate <= 0) {
      result.skipped++
      continue
    }

    const monthly_goal = Math.ceil(expected / (rate / 100))
    const weekly_goal = Math.ceil(monthly_goal / (workingDays / 5))
    const daily_goal = Math.ceil(monthly_goal / workingDays)

    const unchanged =
      monthly_goal === a.monthly_goal &&
      weekly_goal === a.weekly_goal &&
      daily_goal === a.daily_goal
    if (unchanged) continue

    const { error } = await sb
      .from('activities')
      .update({ monthly_goal, weekly_goal, daily_goal })
      .eq('id', a.id)
      .eq('user_id', userId)

    if (error) continue
    result.updated++
    if (daily_goal !== a.daily_goal) newDailyById.set(a.id, daily_goal)
  }

  // ── Re-snapshot de day_goal de HOY ────────────────────────────────────────
  // activity_logs.day_goal es una foto tomada al hacer check-in y nunca se
  // resincroniza sola. Si la meta cambia el mismo día en que ya se registró el
  // check-in, el log quedaría con la meta vieja y el Dashboard mostraría un
  // cumplimiento distinto al de Mi Día. Solo se ACTUALIZAN filas existentes:
  // nunca se crea un log que el usuario no haya hecho.
  if (newDailyById.size > 0) {
    const today = todayISO()
    const ids = [...newDailyById.keys()]
    const { data: todayLogs } = await sb
      .from('activity_logs')
      .select('id,activity_id')
      .eq('user_id', userId)
      .eq('log_date', today)
      .in('activity_id', ids)

    for (const log of todayLogs ?? []) {
      const newGoal = newDailyById.get(log.activity_id)
      if (newGoal == null) continue
      const { error } = await sb
        .from('activity_logs')
        .update({ day_goal: newGoal })
        .eq('id', log.id)
        .eq('user_id', userId)
      if (!error) result.resnapshotted++
    }
  }

  return result
}
