/**
 * FUENTE CENTRAL ÚNICA del "rendimiento del recetario" — la única verdad que
 * consumen el Dashboard y la pestaña Rendimiento del Recetario, para que nunca
 * muestren cifras distintas.
 *
 * "Lo logrado" (reuniones reales y cierres reales) proviene EXCLUSIVAMENTE de
 * pipeline_simple, nunca de activity_logs. El recetario es mensual por naturaleza
 * (reuniones esperadas, citas requeridas y meta de ingresos son mensuales), así
 * que esta función SIEMPRE calcula sobre un MES.
 *
 * Funciona con el cliente de servidor o el del navegador (ambos quedan scoped al
 * usuario por RLS), por eso ambas vistas pueden llamarla.
 *
 * Fechas: solo utilidades de lib/utils/dates.ts (getPeriodRange, todayISO). El
 * conteo de días hábiles usa aritmética UTC pura (nunca parseISO sobre cadenas).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import { getPeriodRange, todayISO, periodLabel } from '@/lib/utils/dates'

type Sb = SupabaseClient<Database>

// Etapas donde la reunión ya se ejecutó (= "cita real"), independiente del estado.
const REUNION_STAGES = new Set([
  'Primera reu ejecutada/Propuesta en preparación',
  'Propuesta Presentada',
  'Por facturar/cobrar',
])
// DEFINICIÓN ÚNICA Y DEFINITIVA de cierre ganado: la oportunidad cumple LAS DOS
// condiciones a la vez → etapa 'Por facturar/cobrar' Y estado 'ganado'. Su valor es
// el MONTO REAL de esa oportunidad (nunca el ticket promedio). Una 'Por facturar'
// que sigue 'abierta' NO cuenta; una 'ganada' fuera de esa etapa TAMPOCO cuenta.
const CIERRE_STAGE = 'Por facturar/cobrar'

export interface RecipeActivityPerf {
  id: string
  name: string
  type: 'OUTBOUND' | 'INBOUND'
  channel: string
  weight: number
  conversionRatePct: number
  meetingsExpected: number
  monthlyGoal: number
  weeklyGoal: number
  dailyGoal: number
  reunionesReales: number
  cierresReales: number
  montoReal: number
  eficienciaCanal: number | null
}

export interface RecipeCitas {
  requeridas: number
  reales: number
  proyectadas: number
  alcanza: boolean
}

export interface RecipePerformance {
  periodStart: string
  periodEnd: string
  periodLabel: string
  activities: RecipeActivityPerf[]
  totals: {
    reunionesReales: number
    cierresReales: number
    montoReal: number
    meetingsExpected: number
    eficienciaCanal: number | null
  }
  citas: RecipeCitas
  scenario: { monthlyGoal: number; avgTicket: number; outboundPct: number } | null
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

/**
 * Rendimiento del recetario para el MES del refDate (por defecto, hoy).
 * @param sb  cliente de Supabase (servidor o navegador; RLS lo acota al usuario)
 * @param refDate  cualquier día del mes a analizar (ISO YYYY-MM-DD). Default: hoy.
 */
export async function getRecipePerformance(sb: Sb, refDate?: string): Promise<RecipePerformance> {
  const today = todayISO()
  const ref = (refDate && /^\d{4}-\d{2}-\d{2}$/.test(refDate)) ? refDate : today
  const [ry, rm, rd] = ref.split('-').map(Number)
  const anchor = new Date(Date.UTC(ry, rm - 1, rd, 12, 0, 0))
  const { start: monthStart, end: monthEnd } = getPeriodRange('monthly', anchor)
  const label = periodLabel('monthly', anchor)

  const [
    { data: activitiesRaw },
    { data: pipelineRaw },
    { data: scenarioRaw },
  ] = await Promise.all([
    sb.from('activities')
      .select('id,name,type,channel,weight,conversion_rate_pct,meetings_expected,daily_goal,weekly_goal,monthly_goal')
      .eq('status', 'active')
      .order('type', { ascending: true })
      .order('sort_order', { ascending: true }),
    sb.from('pipeline_simple')
      .select('origin_activity_id,stage,status,amount_usd')
      .gte('entry_date', monthStart)
      .lte('entry_date', monthEnd),
    sb.from('recipe_scenarios')
      .select('monthly_revenue_goal,average_ticket,outbound_pct,outbound_rates')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const pipeline = pipelineRaw ?? []

  // "Lo logrado" por actividad, desde pipeline_simple (por origin_activity_id).
  const reunionesByAct: Record<string, number> = {}
  const cierresByAct: Record<string, number> = {}
  const montoByAct: Record<string, number> = {}
  let citasRealesMes = 0
  for (const row of pipeline) {
    const isReunion = REUNION_STAGES.has(row.stage)
    if (isReunion) citasRealesMes++
    const aid = row.origin_activity_id
    if (!aid) continue
    if (isReunion) reunionesByAct[aid] = (reunionesByAct[aid] ?? 0) + 1
    // Cierre ganado = etapa 'Por facturar/cobrar' Y estado 'ganado' (ambas). Valor = monto real.
    if (row.stage === CIERRE_STAGE && row.status === 'ganado') {
      cierresByAct[aid] = (cierresByAct[aid] ?? 0) + 1
      montoByAct[aid] = (montoByAct[aid] ?? 0) + (row.amount_usd ?? 0)
    }
  }

  type Row = { id: string; name: string; type: 'OUTBOUND' | 'INBOUND'; channel: string; weight: number | null; conversion_rate_pct: number | null; meetings_expected: number | null; daily_goal: number; weekly_goal: number; monthly_goal: number }
  const activities: RecipeActivityPerf[] = ((activitiesRaw ?? []) as Row[]).map((a) => {
    const meetingsExpected = a.meetings_expected ?? 0
    const reunionesReales = reunionesByAct[a.id] ?? 0
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      channel: a.channel,
      weight: a.weight ?? 0,
      conversionRatePct: a.conversion_rate_pct ?? 0,
      meetingsExpected,
      monthlyGoal: a.monthly_goal,
      weeklyGoal: a.weekly_goal,
      dailyGoal: a.daily_goal,
      reunionesReales,
      cierresReales: cierresByAct[a.id] ?? 0,
      montoReal: montoByAct[a.id] ?? 0,
      eficienciaCanal: meetingsExpected > 0 ? Math.round((reunionesReales / meetingsExpected) * 100) : null,
    }
  })

  // Totales
  const totReuniones = activities.reduce((s, a) => s + a.reunionesReales, 0)
  const totCierres = activities.reduce((s, a) => s + a.cierresReales, 0)
  const totMonto = activities.reduce((s, a) => s + a.montoReal, 0)
  const totExpected = activities.reduce((s, a) => s + a.meetingsExpected, 0)

  // Citas del recetario (misma fórmula que el motor de inteligencia)
  const scenario = scenarioRaw
    ? { monthlyGoal: scenarioRaw.monthly_revenue_goal, avgTicket: scenarioRaw.average_ticket, outboundPct: scenarioRaw.outbound_pct }
    : null
  const outRates = (scenarioRaw?.outbound_rates as number[] | null) ?? []
  const lastOutRate = (outRates[outRates.length - 1] ?? 30) / 100
  const cierresReq = scenario && scenario.avgTicket > 0 ? scenario.monthlyGoal / scenario.avgTicket : 0
  const citasReq = lastOutRate > 0 ? cierresReq / lastOutRate : 0
  const monthClosed = today > monthEnd
  const wdElapsed = workingDaysBetween(monthStart, today)
  const wdTotal = workingDaysBetween(monthStart, monthEnd)
  const citasProy = monthClosed
    ? citasRealesMes
    : (wdElapsed > 0 ? Math.round((citasRealesMes / wdElapsed) * wdTotal) : citasRealesMes)

  return {
    periodStart: monthStart,
    periodEnd: monthEnd,
    periodLabel: label,
    activities,
    totals: {
      reunionesReales: totReuniones,
      cierresReales: totCierres,
      montoReal: totMonto,
      meetingsExpected: totExpected,
      eficienciaCanal: totExpected > 0 ? Math.round((totReuniones / totExpected) * 100) : null,
    },
    citas: {
      requeridas: Math.round(citasReq),
      reales: citasRealesMes,
      proyectadas: citasProy,
      alcanza: citasReq > 0 ? citasProy >= citasReq : false,
    },
    scenario,
  }
}
