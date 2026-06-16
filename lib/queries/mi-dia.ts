/**
 * Mi Día — capa de datos.
 * Orquesta datos que YA existen (recetario, actividades, logs, efectividad de
 * canal y pipeline). No inventa cálculos nuevos: reutiliza las mismas utilidades
 * que el Dashboard y el Recetario para que los números concuerden.
 *
 * Fechas: SOLO utilidades de lib/utils/dates.ts (todayISO, getPeriodRange,
 * addDaysToISO, totalDays). El conteo de días hábiles usa aritmética UTC pura
 * (igual que el motor de inteligencia), nunca parseISO sobre cadenas del usuario.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import type { SemaphoreColor } from '@/lib/types/common'
import { todayISO, getPeriodRange, addDaysToISO, totalDays } from '@/lib/utils/dates'
import { getActivityGoal, getDailyImpliedGoal } from '@/lib/utils/goals'
import { getSemaphoreColor } from '@/lib/utils/colors'
import { _fetchActivityEffectiveness } from '@/lib/utils/coach-context'

type Sb = SupabaseClient<Database>

export type WeekState = 'EN META' | 'EN RIESGO' | 'CRÍTICO'

export interface MiDiaActivityPlan {
  id: string
  name: string
  channel: string
  type: 'OUTBOUND' | 'INBOUND'
  goal: number
  real: number
  pct: number | null
  semaphore: SemaphoreColor
}

export interface MiDiaPipelineAlert {
  id: string
  company: string
  amount: number
  daysStale: number
}

export interface MiDiaData {
  hasScenario: boolean
  userName: string
  todayISO: string
  monthlyGoal: number
  // Estado de la semana (lun → hoy vs meta semanal)
  weekGoal: number
  weekReal: number
  weekCompliancePct: number
  weekDeviationPct: number
  weekSemaphore: SemaphoreColor
  weekState: WeekState
  // Plan de hoy
  plan: MiDiaActivityPlan[]
  todayReal: number
  todayGoal: number
  // Prioridad de canal + mensaje de recuperación
  topChannel: { name: string; conversionToMeeting: number } | null
  recovery: { activityName: string; unitsNeeded: number } | null
  // Alertas de pipeline (oportunidades frenadas)
  alerts: MiDiaPipelineAlert[]
  alertsTotalAmount: number
  // Proyección del mes
  projectionPct: number
  projectionSemaphore: SemaphoreColor
}

/** Días hábiles (lun–vie) de startISO a endISO inclusive. Aritmética UTC pura. */
function workingDaysBetween(startISO: string, endISO: string): number {
  if (startISO > endISO) return 0
  let [y, m, d] = startISO.split('-').map(Number)
  const [ey, em, ed] = endISO.split('-').map(Number)
  let count = 0
  while (y < ey || (y === ey && m < em) || (y === ey && m === em && d <= ed)) {
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
    if (dow > 0 && dow < 6) count++
    d++
    const dim = new Date(Date.UTC(y, m, 0)).getUTCDate()
    if (d > dim) { d = 1; m++ }
    if (m > 12) { m = 1; y++ }
  }
  return count
}

function weekStateFor(sem: SemaphoreColor): WeekState {
  if (sem === 'green') return 'EN META'
  if (sem === 'yellow') return 'EN RIESGO'
  return 'CRÍTICO'
}

export async function getMiDiaData(sb: Sb, userId: string): Promise<MiDiaData> {
  const today = todayISO()
  const [ty, tm, td] = today.split('-').map(Number)
  const anchor = new Date(Date.UTC(ty, tm - 1, td, 12, 0, 0))
  const week = getPeriodRange('weekly', anchor)   // start = lunes, end = domingo
  const month = getPeriodRange('monthly', anchor) // start = día 1, end = último día
  const weekStart = week.start
  const monthStart = month.start
  const monthEnd = month.end
  const staleCutoff = addDaysToISO(today, -7)     // updated_at anterior a esto = >7 días

  const [
    { data: profile },
    { data: scenario },
    { data: activitiesRaw },
    { data: todayLogs },
    { data: weekLogs },
    { data: alertRows },
    { data: wonRows },
  ] = await Promise.all([
    sb.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
    sb.from('recipe_scenarios').select('monthly_revenue_goal').eq('user_id', userId)
      .eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('activities').select('id,name,channel,type,daily_goal,weekly_goal,monthly_goal')
      .eq('user_id', userId).eq('status', 'active').order('type').order('sort_order'),
    sb.from('activity_logs').select('activity_id,real_executed')
      .eq('user_id', userId).eq('log_date', today),
    sb.from('activity_logs').select('activity_id,real_executed')
      .eq('user_id', userId).gte('log_date', weekStart).lte('log_date', today),
    sb.from('pipeline_simple').select('id,company_name,amount_usd,updated_at')
      .eq('user_id', userId).eq('status', 'abierto').lt('updated_at', staleCutoff)
      .order('amount_usd', { ascending: false, nullsFirst: false }).limit(5),
    sb.from('pipeline_simple').select('amount_usd')
      .eq('user_id', userId).eq('stage', 'Por facturar/cobrar')
      .gte('entry_date', monthStart).lte('entry_date', monthEnd),
  ])

  const userName = profile?.full_name ?? 'Vendedor'
  const monthlyGoal = scenario?.monthly_revenue_goal ?? 0

  type Act = { id: string; name: string; channel: string; type: 'OUTBOUND' | 'INBOUND'; daily_goal: number; weekly_goal: number; monthly_goal: number }
  const activities = (activitiesRaw ?? []) as Act[]

  if (!scenario || activities.length === 0) {
    return {
      hasScenario: false, userName, todayISO: today, monthlyGoal,
      weekGoal: 0, weekReal: 0, weekCompliancePct: 0, weekDeviationPct: 0,
      weekSemaphore: 'no_goal', weekState: 'CRÍTICO',
      plan: [], todayReal: 0, todayGoal: 0,
      topChannel: null, recovery: null, alerts: [], alertsTotalAmount: 0,
      projectionPct: 0, projectionSemaphore: 'no_goal',
    }
  }

  // ── Real por actividad (hoy y semana) ──
  const todayRealByAct: Record<string, number> = {}
  for (const l of todayLogs ?? []) todayRealByAct[l.activity_id] = (todayRealByAct[l.activity_id] ?? 0) + l.real_executed
  const weekRealByAct: Record<string, number> = {}
  for (const l of weekLogs ?? []) weekRealByAct[l.activity_id] = (weekRealByAct[l.activity_id] ?? 0) + l.real_executed

  // ── Plan de hoy (mismo criterio de semáforo que vw_daily_compliance) ──
  const plan: MiDiaActivityPlan[] = activities.map((a) => {
    const goal = Math.round(getDailyImpliedGoal(a))
    const real = todayRealByAct[a.id] ?? 0
    const pct = goal > 0 ? Math.round((real / goal) * 100) : null
    const semaphore: SemaphoreColor = goal > 0 ? getSemaphoreColor(pct) : 'no_goal'
    return { id: a.id, name: a.name, channel: a.channel, type: a.type, goal, real, pct, semaphore }
  })
  const todayGoal = plan.reduce((s, p) => s + p.goal, 0)
  const todayReal = plan.reduce((s, p) => s + p.real, 0)

  // ── Estado de la semana ──
  const weekGoal = activities.reduce((s, a) => s + getActivityGoal(a, 'weekly'), 0)
  const weekReal = (weekLogs ?? []).reduce((s, l) => s + l.real_executed, 0)
  const weekCompliancePct = weekGoal > 0 ? Math.round((weekReal / weekGoal) * 1000) / 10 : 0
  const weekDeviationPct = weekGoal > 0 ? Math.round(((weekReal - weekGoal) / weekGoal) * 1000) / 10 : 0
  const weekSemaphore = getSemaphoreColor(weekCompliancePct)
  const weekState = weekStateFor(weekSemaphore)

  // ── Prioridad de canal (efectividad real por actividad) ──
  const effectiveness = await _fetchActivityEffectiveness(
    sb as Parameters<typeof _fetchActivityEffectiveness>[0],
    monthStart, today, userId,
  )
  const top = effectiveness[0] // ya viene ordenado por conversionToMeeting desc
  const topChannel = top ? { name: top.name, conversionToMeeting: top.conversionToMeeting } : null

  // ── Mensaje de recuperación: unidades de la actividad más efectiva que faltan
  //    esta semana para cerrarla al 100% ──
  let recovery: { activityName: string; unitsNeeded: number } | null = null
  if (top) {
    const act = activities.find((a) => a.name === top.name)
    if (act) {
      const actWeekGoal = getActivityGoal(act, 'weekly')
      const actWeekReal = weekRealByAct[act.id] ?? 0
      recovery = { activityName: act.name, unitsNeeded: Math.max(0, Math.ceil(actWeekGoal - actWeekReal)) }
    }
  }

  // ── Alertas de pipeline (oportunidades frenadas) ──
  const alerts: MiDiaPipelineAlert[] = (alertRows ?? []).map((r) => {
    const updatedDate = (r.updated_at ?? today).slice(0, 10)
    const daysStale = Math.max(0, totalDays(updatedDate, today) - 1)
    return { id: r.id, company: r.company_name ?? 'Oportunidad sin nombre', amount: r.amount_usd ?? 0, daysStale }
  })
  const alertsTotalAmount = alerts.reduce((s, a) => s + a.amount, 0)

  // ── Proyección del mes (lineal por días hábiles, sin IA) ──
  const revenueSoFar = (wonRows ?? []).reduce((s, r) => s + (r.amount_usd ?? 0), 0)
  const wdElapsed = workingDaysBetween(monthStart, today)
  const wdTotal = workingDaysBetween(monthStart, monthEnd)
  const pace = wdElapsed > 0 ? revenueSoFar / wdElapsed : 0
  const projected = pace * wdTotal
  const projectionPct = monthlyGoal > 0 ? Math.round((projected / monthlyGoal) * 1000) / 10 : 0
  const projectionSemaphore = getSemaphoreColor(projectionPct)

  return {
    hasScenario: true, userName, todayISO: today, monthlyGoal,
    weekGoal, weekReal, weekCompliancePct, weekDeviationPct, weekSemaphore, weekState,
    plan, todayReal, todayGoal,
    topChannel, recovery, alerts, alertsTotalAmount,
    projectionPct, projectionSemaphore,
  }
}
