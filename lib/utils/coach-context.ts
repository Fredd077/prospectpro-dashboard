import { endOfWeek, endOfMonth, startOfWeek, parseISO, subWeeks, format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { todayISO, toISODate } from '@/lib/utils/dates'
import { calcRealConversions, calcPipelineValue } from '@/lib/calculations/pipeline'

type SbClient = SupabaseClient<Database>

export interface ActivityCompliance {
  name: string
  type: 'OUTBOUND' | 'INBOUND'
  goal: number
  real: number
  pct: number
}

export interface ActivityEffectivenessItem {
  name: string
  type: 'OUTBOUND' | 'INBOUND'
  executions: number
  estimatedMeetings: number
  estimatedCloses: number
  conversionToMeeting: number
  closeProbability: number
}

export interface ActivityPerformance {
  name: string
  type: 'OUTBOUND' | 'INBOUND'
  citasMeta: number
  citasReales: number
  cumplimiento: number
  contribGlobalPct: number
}

export interface WeeklyBucket {
  weekLabel: string
  compliance: number
}

export interface PipelineStageData {
  stage: string
  count: number
  countOutbound: number
  countInbound: number
  amount: number
}

export interface PipelineCoachData {
  byStage: PipelineStageData[]
  conversions: {
    fromStage: string
    toStage: string
    realConversion: number
    plannedConversion: number
    gap: number
  }[]
  openAmount: number
  closedAmount: number
  monthlyGoal: number
  revenuePct: number
}

export interface CoachContext {
  userName: string
  period: 'daily' | 'weekly' | 'monthly'
  periodDate: string         // ISO date — today for daily, Monday for weekly
  recipe: {
    name: string
    monthly_goal: number
    ticket: number
    outbound_pct: number
    funnel_stages: string[]
    activities_needed_daily: number
    activities_needed_weekly: number
    activities_needed_monthly: number
  } | null
  activities: ActivityCompliance[]
  overallCompliance: number   // %
  streak: number              // consecutive days with check-in (daily) or days this week (weekly)
  weakestActivity: { name: string; pct: number } | null
  strongestActivity: { name: string; pct: number } | null
  trend: 'improving' | 'declining' | 'stable'
  isMondayAnalysis?: boolean  // true = analyzing prev week, tone should be Monday-energising
  // Weekly-only
  monthlyProgress?: {
    daysElapsed: number
    totalDays: number
    goalPct: number       // % of month elapsed
    achievedPct: number   // % of monthly goal achieved so far
  }
  weeksBelow70?: number
  // Monthly-only
  monthName?: string
  prevMonthCompliance?: number
  bestWeek?: WeeklyBucket
  worstWeek?: WeeklyBucket
  totalActivitiesDone?: number
  totalActivitiesGoal?: number
  // Pipeline (daily + weekly)
  pipeline?: PipelineCoachData
  // Activity performance (pipeline origin tracking)
  activityPerformance?: ActivityPerformance[]
  // Channel effectiveness (weekly + monthly only)
  activityEffectiveness?: ActivityEffectivenessItem[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toTrend(current: number, previous: number): CoachContext['trend'] {
  if (current > previous + 10) return 'improving'
  if (current < previous - 10) return 'declining'
  return 'stable'
}

// ─── Activity performance helper ─────────────────────────────────────────────

async function _fetchActivityPerformance(
  sb: SbClient,
  periodStart: string,
  periodEnd: string,
  scenario: { monthly_revenue_goal: number; average_ticket: number; outbound_pct: number; outbound_rates: number[] | null; inbound_rates: number[] | null } | null,
  userId?: string,
): Promise<ActivityPerformance[] | undefined> {
  if (!scenario) return undefined

  const activitiesQ = (() => {
    let q = sb.from('activities').select('id,name,type,conversion_rate_pct').eq('status', 'active')
    if (userId) q = q.eq('user_id', userId)
    return q
  })()

  const pipelineQ = (() => {
    let q = sb.from('pipeline_simple')
      .select('origin_activity_id')
      .gte('entry_date', periodStart)
      .lte('entry_date', periodEnd)
      .not('origin_activity_id', 'is', null)
    if (userId) q = q.eq('user_id', userId)
    return q
  })()

  const [{ data: acts }, { data: pipeRows }] = await Promise.all([activitiesQ, pipelineQ])
  if (!acts?.length) return undefined

  // Count citas reales per activity
  const citasMap: Record<string, number> = {}
  for (const row of pipeRows ?? []) {
    if (row.origin_activity_id) {
      citasMap[row.origin_activity_id] = (citasMap[row.origin_activity_id] ?? 0) + 1
    }
  }

  const { monthly_revenue_goal, average_ticket, outbound_pct } = scenario
  const lastOutRate = ((scenario.outbound_rates ?? [])[((scenario.outbound_rates ?? []).length) - 1] ?? 30) / 100
  const cierresReq  = average_ticket > 0 ? monthly_revenue_goal / average_ticket : 0
  const citasReqTotal = lastOutRate > 0 ? cierresReq / lastOutRate : 0
  const citasReqOut = citasReqTotal * (outbound_pct / 100)
  const citasReqIn  = citasReqTotal * (1 - outbound_pct / 100)

  const totalCitasReales = Object.values(citasMap).reduce((s, v) => s + v, 0)

  const outActs = acts.filter((a) => a.type === 'OUTBOUND')
  const inActs  = acts.filter((a) => a.type === 'INBOUND')

  function rowsForGroup(list: NonNullable<typeof acts>, citasReqGroup: number): ActivityPerformance[] {
    const sumRates = list.filter((a) => (a.conversion_rate_pct ?? 0) > 0)
      .reduce((s, a) => s + (a.conversion_rate_pct ?? 0), 0)
    return list.map((a) => {
      const convRate    = a.conversion_rate_pct ?? 0
      const citasMeta   = sumRates > 0 ? citasReqGroup * (convRate / sumRates) : 0
      const citasReales = citasMap[a.id] ?? 0
      return {
        name: a.name,
        type: a.type as 'OUTBOUND' | 'INBOUND',
        citasMeta,
        citasReales,
        cumplimiento: citasMeta > 0 ? Math.round((citasReales / citasMeta) * 100) : 0,
        contribGlobalPct: totalCitasReales > 0 ? Math.round((citasReales / totalCitasReales) * 100) : 0,
      }
    })
  }

  return [...rowsForGroup(outActs, citasReqOut), ...rowsForGroup(inActs, citasReqIn)]
}

// ─── Activity effectiveness helper ───────────────────────────────────────────

export async function _fetchActivityEffectiveness(
  sb: SbClient,
  dateStart: string,
  dateEnd: string,
  userId?: string,
): Promise<ActivityEffectivenessItem[]> {
  const activitiesQ = (() => {
    let q = sb.from('activities').select('id,name,type').eq('status', 'active')
    if (userId) q = q.eq('user_id', userId)
    return q
  })()

  const logsQ = (() => {
    let q = sb.from('activity_logs').select('activity_id,real_executed')
      .gte('log_date', dateStart)
      .lte('log_date', dateEnd)
    if (userId) q = q.eq('user_id', userId)
    return q
  })()

  const pipelineQ = (() => {
    let q = sb.from('pipeline_simple').select('origin_activity_id,prospect_type,stage,status')
      .gte('entry_date', dateStart)
      .lte('entry_date', dateEnd)
    if (userId) q = q.eq('user_id', userId)
    return q
  })()

  const [{ data: activities }, { data: logs }, { data: pipeline }] = await Promise.all([
    activitiesQ, logsQ, pipelineQ,
  ])

  if (!activities?.length) return []

  const execMap: Record<string, number> = {}
  for (const log of logs ?? []) {
    execMap[log.activity_id] = (execMap[log.activity_id] ?? 0) + log.real_executed
  }

  const isOutOrIn = (t: string): t is 'OUTBOUND' | 'INBOUND' => t === 'OUTBOUND' || t === 'INBOUND'

  // ── Camino preciso: si las oportunidades traen origin_activity_id, atribuimos
  //    reuniones y cierres al canal que las originó → conversión REAL por canal
  //    (mismas etapas que el Recetario). Así el reporte distingue, p. ej., un canal
  //    que agenda bien pero cierra mal. ─────────────────────────────────────────
  const REUNION_STAGES = new Set([
    'Primera reu ejecutada/Propuesta en preparación',
    'Propuesta Presentada',
    'Por facturar/cobrar',
  ])
  const hasOrigin = (pipeline ?? []).some((e) => e.origin_activity_id)
  if (hasOrigin) {
    const meetingsByAct: Record<string, number> = {}
    const closesByAct: Record<string, number> = {}
    for (const e of pipeline ?? []) {
      const aid = e.origin_activity_id
      if (!aid) continue
      if (REUNION_STAGES.has(e.stage)) meetingsByAct[aid] = (meetingsByAct[aid] ?? 0) + 1
      // Cierre ganado = etapa 'Por facturar/cobrar' Y estado 'ganado' (ambas condiciones).
      if (e.stage === 'Por facturar/cobrar' && e.status === 'ganado') closesByAct[aid] = (closesByAct[aid] ?? 0) + 1
    }
    return activities
      .filter((a) => isOutOrIn((a.type ?? '').toUpperCase()))
      .map((a) => {
        const t = (a.type ?? '').toUpperCase() as 'OUTBOUND' | 'INBOUND'
        const executions = execMap[a.id] ?? 0
        const meetings   = meetingsByAct[a.id] ?? 0
        const closes     = closesByAct[a.id] ?? 0
        return {
          name: a.name,
          type: t,
          executions,
          estimatedMeetings: meetings,
          estimatedCloses: closes,
          conversionToMeeting: executions > 0 ? Math.round((meetings / executions) * 100) : 0,
          closeProbability: meetings > 0 ? Math.round((closes / meetings) * 100) : 0,
        }
      })
      .filter((a) => a.executions > 0)
      .sort((a, b) => b.conversionToMeeting - a.conversionToMeeting)
  }

  // ── Fallback (sin origin_activity_id): estimación proporcional por ejecución. ──
  const meetingsByType: Record<string, number> = { OUTBOUND: 0, INBOUND: 0 }
  const closesByType: Record<string, number>   = { OUTBOUND: 0, INBOUND: 0 }
  for (const entry of pipeline ?? []) {
    const t = (entry.prospect_type ?? '').toUpperCase()
    if (t !== 'OUTBOUND' && t !== 'INBOUND') continue
    meetingsByType[t] = (meetingsByType[t] ?? 0) + 1
    // Cierre ganado = etapa 'Por facturar/cobrar' Y estado 'ganado' (ambas condiciones).
    if (entry.stage === 'Por facturar/cobrar' && entry.status === 'ganado') closesByType[t] = (closesByType[t] ?? 0) + 1
  }

  const totalExecByType: Record<string, number> = { OUTBOUND: 0, INBOUND: 0 }
  for (const act of activities) {
    const t = (act.type ?? '').toUpperCase()
    if (t !== 'OUTBOUND' && t !== 'INBOUND') continue
    totalExecByType[t] = (totalExecByType[t] ?? 0) + (execMap[act.id] ?? 0)
  }

  return activities
    .filter((a) => {
      const t = (a.type ?? '').toUpperCase()
      return t === 'OUTBOUND' || t === 'INBOUND'
    })
    .map((a) => {
      const t = (a.type ?? '').toUpperCase() as 'OUTBOUND' | 'INBOUND'
      const executions  = execMap[a.id] ?? 0
      const totalExec   = totalExecByType[t] ?? 0
      const share       = totalExec > 0 ? executions / totalExec : 0
      const estMeetings = Math.round(meetingsByType[t] * share * 10) / 10
      const estCloses   = Math.round(closesByType[t] * share * 10) / 10
      return {
        name: a.name,
        type: t,
        executions,
        estimatedMeetings: estMeetings,
        estimatedCloses: estCloses,
        conversionToMeeting: executions > 0 ? Math.round((estMeetings / executions) * 100) : 0,
        closeProbability: estMeetings > 0 ? Math.round((estCloses / estMeetings) * 100) : 0,
      }
    })
    .filter((a) => a.executions > 0)
    .sort((a, b) => b.conversionToMeeting - a.conversionToMeeting)
}

// ─── Pipeline helper ─────────────────────────────────────────────────────────

async function _fetchPipelineData(
  sb: SbClient,
  dateStart: string,
  dateEnd: string,
  activityTotal: number,
  stages: string[],
  outboundRates: number[],
  inboundRates: number[],
  outboundPct: number,
  monthlyGoal: number,
  userId?: string,
): Promise<PipelineCoachData | undefined> {
  let q = sb
    .from('pipeline_entries')
    .select('stage,quantity,amount_usd,prospect_type')
    .gte('entry_date', dateStart)
    .lte('entry_date', dateEnd)
  if (userId) q = q.eq('user_id', userId)
  const { data: entries } = await q
  if (!entries?.length) return undefined

  const combinedRates = outboundRates.map((r, i) => {
    const ob = outboundPct / 100
    return Math.round(r * ob + (inboundRates[i] ?? r) * (1 - ob))
  })

  const conversions  = calcRealConversions(activityTotal, entries, stages, combinedRates)
  const pipelineVal  = calcPipelineValue(entries, stages)
  const revenuePct   = monthlyGoal > 0 ? Math.round((pipelineVal.closed / monthlyGoal) * 100) : 0

  const countMap: Record<string, number> = {}
  const countOutboundMap: Record<string, number> = {}
  const countInboundMap: Record<string, number> = {}
  const amountMap: Record<string, number> = {}
  for (const e of entries) {
    countMap[e.stage]  = (countMap[e.stage] ?? 0) + e.quantity
    amountMap[e.stage] = (amountMap[e.stage] ?? 0) + (e.amount_usd ?? 0)
    if (e.prospect_type === 'OUTBOUND') {
      countOutboundMap[e.stage] = (countOutboundMap[e.stage] ?? 0) + e.quantity
    } else {
      countInboundMap[e.stage] = (countInboundMap[e.stage] ?? 0) + e.quantity
    }
  }

  const byStage: PipelineStageData[] = stages.slice(1).map((s) => ({
    stage: s,
    count: countMap[s] ?? 0,
    countOutbound: countOutboundMap[s] ?? 0,
    countInbound: countInboundMap[s] ?? 0,
    amount: amountMap[s] ?? 0,
  }))

  return {
    byStage,
    conversions: conversions.map((c) => ({
      fromStage: c.fromStage, toStage: c.toStage,
      realConversion: c.realConversion, plannedConversion: c.plannedConversion, gap: c.gap,
    })),
    openAmount:  pipelineVal.open,
    closedAmount: pipelineVal.closed,
    monthlyGoal,
    revenuePct,
  }
}

// ─── Daily ───────────────────────────────────────────────────────────────────

export async function buildDailyContext(date: string): Promise<CoachContext> {
  const sb = await getSupabaseServerClient()

  const [
    { data: profile },
    { data: activities },
    { data: todayLogs },
    { data: activeScenario },
    { data: recentLogs },
  ] = await Promise.all([
    sb.from('profiles').select('full_name').maybeSingle(),
    sb.from('activities').select('id,name,type,daily_goal').eq('status', 'active'),
    sb.from('vw_daily_compliance').select('activity_id,real_executed,day_goal').eq('log_date', date),
    sb
      .from('recipe_scenarios')
      .select('name,monthly_revenue_goal,average_ticket,outbound_pct,funnel_stages,outbound_rates,inbound_rates,activities_needed_daily,activities_needed_weekly,activities_needed_monthly')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from('activity_logs')
      .select('log_date')
      .lte('log_date', date)
      .order('log_date', { ascending: false })
      .limit(60),
  ])

  const userName = profile?.full_name ?? 'Campeón'

  // Real per activity
  const realMap: Record<string, number> = {}
  for (const log of todayLogs ?? []) {
    realMap[log.activity_id] = (realMap[log.activity_id] ?? 0) + log.real_executed
  }

  const actCompliance: ActivityCompliance[] = (activities ?? []).map((a) => {
    const goal = a.daily_goal
    const real = realMap[a.id] ?? 0
    const pct  = goal > 0 ? Math.round((real / goal) * 100) : 0
    return { name: a.name, type: a.type, goal, real, pct }
  })

  const totalGoal = actCompliance.reduce((s, a) => s + a.goal, 0)
  const totalReal = actCompliance.reduce((s, a) => s + a.real, 0)
  const overallCompliance = totalGoal > 0 ? Math.round((totalReal / totalGoal) * 100) : 0

  // Streak — consecutive days backward from date with at least one log
  const logDates = new Set((recentLogs ?? []).map((l) => l.log_date as string))
  let streak = 0
  const cur = new Date(date)
  while (logDates.has(toISODate(cur))) {
    streak++
    cur.setDate(cur.getDate() - 1)
  }

  // Yesterday's compliance for trend
  const yesterday = toISODate(new Date(new Date(date).setDate(new Date(date).getDate() - 1)))
  const { data: yestLogs } = await sb
    .from('vw_daily_compliance')
    .select('real_executed,day_goal')
    .eq('log_date', yesterday)
  const yestGoal = (yestLogs ?? []).reduce((s, l) => s + l.day_goal, 0)
  const yestReal = (yestLogs ?? []).reduce((s, l) => s + l.real_executed, 0)
  const yestPct  = yestGoal > 0 ? Math.round((yestReal / yestGoal) * 100) : 0

  const withGoal = actCompliance.filter((a) => a.goal > 0)
  const weakest  = withGoal.length ? withGoal.reduce((m, a) => a.pct < m.pct ? a : m) : null
  const strongest = withGoal.length ? withGoal.reduce((m, a) => a.pct > m.pct ? a : m) : null

  const recipe = activeScenario ? {
    name:                       activeScenario.name,
    monthly_goal:               activeScenario.monthly_revenue_goal,
    ticket:                     activeScenario.average_ticket,
    outbound_pct:               activeScenario.outbound_pct,
    funnel_stages:              activeScenario.funnel_stages ?? [],
    activities_needed_daily:    activeScenario.activities_needed_daily   ?? 0,
    activities_needed_weekly:   activeScenario.activities_needed_weekly  ?? 0,
    activities_needed_monthly:  activeScenario.activities_needed_monthly ?? 0,
  } : null

  const [pipeline, activityPerformance] = await Promise.all([
    activeScenario ? _fetchPipelineData(
      sb, date, date, totalReal,
      activeScenario.funnel_stages ?? [],
      activeScenario.outbound_rates ?? [],
      activeScenario.inbound_rates  ?? [],
      activeScenario.outbound_pct   ?? 80,
      activeScenario.monthly_revenue_goal,
    ) : Promise.resolve(undefined),
    _fetchActivityPerformance(sb, date, date, activeScenario),
  ])

  return {
    userName,
    period: 'daily',
    periodDate: date,
    recipe,
    activities: actCompliance,
    overallCompliance,
    streak,
    weakestActivity:  weakest   ? { name: weakest.name,   pct: weakest.pct }   : null,
    strongestActivity: strongest ? { name: strongest.name, pct: strongest.pct } : null,
    trend: toTrend(overallCompliance, yestPct),
    pipeline,
    activityPerformance: activityPerformance ?? undefined,
  }
}

// ─── Weekly ──────────────────────────────────────────────────────────────────

export async function buildWeeklyContext(weekStart: string): Promise<CoachContext> {
  const sb  = await getSupabaseServerClient()
  const weekEnd      = toISODate(endOfWeek(parseISO(weekStart), { weekStartsOn: 1 }))
  const prevWeekStart = toISODate(subWeeks(parseISO(weekStart), 1))
  const prevWeekEnd   = toISODate(endOfWeek(parseISO(prevWeekStart), { weekStartsOn: 1 }))

  const today    = todayISO()
  const monthStart = today.slice(0, 8) + '01'
  const daysInMonth = new Date(
    parseInt(today.slice(0, 4)),
    parseInt(today.slice(5, 7)),
    0
  ).getDate()
  const daysElapsed = parseInt(today.slice(8, 10))

  const [
    { data: profile },
    { data: activities },
    { data: weekLogs },
    { data: prevLogs },
    { data: activeScenario },
    { data: monthLogs },
  ] = await Promise.all([
    sb.from('profiles').select('full_name').maybeSingle(),
    sb.from('activities').select('id,name,type,weekly_goal,monthly_goal').eq('status', 'active'),
    sb.from('activity_logs').select('activity_id,real_executed,log_date').gte('log_date', weekStart).lte('log_date', weekEnd),
    sb.from('activity_logs').select('real_executed').gte('log_date', prevWeekStart).lte('log_date', prevWeekEnd),
    sb
      .from('recipe_scenarios')
      .select('name,monthly_revenue_goal,average_ticket,outbound_pct,funnel_stages,outbound_rates,inbound_rates,activities_needed_daily,activities_needed_weekly,activities_needed_monthly')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb.from('activity_logs').select('real_executed').gte('log_date', monthStart).lte('log_date', today),
  ])

  const userName = profile?.full_name ?? 'Campeón'

  const realMap: Record<string, number> = {}
  for (const log of weekLogs ?? []) {
    realMap[log.activity_id] = (realMap[log.activity_id] ?? 0) + log.real_executed
  }

  const actCompliance: ActivityCompliance[] = (activities ?? []).map((a) => {
    const goal = a.weekly_goal
    const real = realMap[a.id] ?? 0
    const pct  = goal > 0 ? Math.round((real / goal) * 100) : 0
    return { name: a.name, type: a.type, goal, real, pct }
  })

  const totalGoal = actCompliance.reduce((s, a) => s + a.goal, 0)
  const totalReal = actCompliance.reduce((s, a) => s + a.real, 0)
  const overallCompliance = totalGoal > 0 ? Math.round((totalReal / totalGoal) * 100) : 0

  const prevRealTotal = (prevLogs ?? []).reduce((s, l) => s + l.real_executed, 0)
  const prevCompliance = totalGoal > 0 ? Math.round((prevRealTotal / totalGoal) * 100) : 0

  // Days this week with at least one log (streak for weekly = days active this week)
  const daysWithLogs = new Set((weekLogs ?? []).map((l) => l.log_date)).size

  const withGoal  = actCompliance.filter((a) => a.goal > 0)
  const weakest   = withGoal.length ? withGoal.reduce((m, a) => a.pct < m.pct ? a : m) : null
  const strongest = withGoal.length ? withGoal.reduce((m, a) => a.pct > m.pct ? a : m) : null

  // Monthly progress
  const monthlyGoalTotal = (activities ?? []).reduce((s, a) => s + (a.monthly_goal ?? 0), 0)
  const monthReal = (monthLogs ?? []).reduce((s, l) => s + l.real_executed, 0)
  const achievedPct = monthlyGoalTotal > 0 ? Math.round((monthReal / monthlyGoalTotal) * 100) : 0

  // Consecutive weeks below 70%
  let weeksBelow70 = 0
  if (overallCompliance < 70) {
    weeksBelow70++
    if (prevCompliance < 70) weeksBelow70++
  }

  const weeklyRecipe = activeScenario ? {
    name:                       activeScenario.name,
    monthly_goal:               activeScenario.monthly_revenue_goal,
    ticket:                     activeScenario.average_ticket,
    outbound_pct:               activeScenario.outbound_pct,
    funnel_stages:              activeScenario.funnel_stages ?? [],
    activities_needed_daily:    activeScenario.activities_needed_daily   ?? 0,
    activities_needed_weekly:   activeScenario.activities_needed_weekly  ?? 0,
    activities_needed_monthly:  activeScenario.activities_needed_monthly ?? 0,
  } : null

  const [weeklyPipeline, weeklyActivityPerformance, weeklyEffectiveness] = await Promise.all([
    activeScenario ? _fetchPipelineData(
      sb, weekStart, weekEnd, totalReal,
      activeScenario.funnel_stages ?? [],
      activeScenario.outbound_rates ?? [],
      activeScenario.inbound_rates  ?? [],
      activeScenario.outbound_pct   ?? 80,
      activeScenario.monthly_revenue_goal,
    ) : Promise.resolve(undefined),
    _fetchActivityPerformance(sb, weekStart, weekEnd, activeScenario),
    _fetchActivityEffectiveness(sb, weekStart, weekEnd),
  ])

  return {
    userName,
    period: 'weekly',
    periodDate: weekStart,
    recipe: weeklyRecipe,
    activities: actCompliance,
    overallCompliance,
    streak: daysWithLogs,
    weakestActivity:   weakest   ? { name: weakest.name,   pct: weakest.pct }   : null,
    strongestActivity: strongest ? { name: strongest.name, pct: strongest.pct } : null,
    trend: toTrend(overallCompliance, prevCompliance),
    monthlyProgress: {
      daysElapsed,
      totalDays:   daysInMonth,
      goalPct:     Math.round((daysElapsed / daysInMonth) * 100),
      achievedPct,
    },
    weeksBelow70,
    pipeline: weeklyPipeline,
    activityPerformance: weeklyActivityPerformance ?? undefined,
    activityEffectiveness: weeklyEffectiveness.length ? weeklyEffectiveness : undefined,
  }
}

// ─── Context → prompt string ──────────────────────────────────────────────────

export function formatContextForPrompt(ctx: CoachContext): string {
  const lines: string[] = [
    `NOMBRE DEL USUARIO: ${ctx.userName}`,
    '',
  ]

  if (ctx.recipe) {
    lines.push(
      `RECETARIO ACTIVO: ${ctx.recipe.name}`,
      `  Meta mensual: $${ctx.recipe.monthly_goal.toLocaleString('es-CO')}`,
      `  Ticket promedio: $${ctx.recipe.ticket.toLocaleString('es-CO')}`,
      `  Actividades necesarias: ${ctx.recipe.activities_needed_daily}/día | ${ctx.recipe.activities_needed_weekly}/sem | ${ctx.recipe.activities_needed_monthly}/mes`,
      '',
    )
  } else {
    lines.push('RECETARIO ACTIVO: Ninguno', '')
  }

  if (ctx.period === 'monthly') {
    lines.push(
      `ANÁLISIS MENSUAL — ${ctx.monthName ?? ctx.periodDate}`,
      `  Cumplimiento del mes: ${ctx.overallCompliance}%`,
      `  Tendencia vs mes anterior: ${ctx.trend}`,
    )
  } else if (ctx.period === 'daily') {
    lines.push(
      `ANÁLISIS DIARIO — ${ctx.periodDate}`,
      `  Cumplimiento general: ${ctx.overallCompliance}%`,
      `  Racha activa: ${ctx.streak} día(s) consecutivo(s)`,
      `  Tendencia vs ayer: ${ctx.trend}`,
    )
  } else {
    if (ctx.isMondayAnalysis) {
      lines.push(
        `TIPO DE ANÁLISIS: LUNES — analiza la semana PASADA y orienta al usuario hacia la semana que empieza. Usa tono energizante.`,
        `SEMANA ANALIZADA: ${ctx.periodDate} a ${ctx.periodDate} (semana anterior completa)`,
      )
    } else {
      lines.push(`ANÁLISIS SEMANAL — semana del ${ctx.periodDate}`)
    }
    lines.push(
      `  Cumplimiento semanal: ${ctx.overallCompliance}%`,
      `  Días activos esta semana: ${ctx.streak}/5`,
      `  Tendencia vs semana anterior: ${ctx.trend}`,
    )
    if (ctx.monthlyProgress) {
      const mp = ctx.monthlyProgress
      const hasBrecha = mp.achievedPct < 50 && mp.goalPct > 50
      lines.push(
        `  Progreso mensual: ${mp.achievedPct}% de meta logrado (${mp.daysElapsed}/${mp.totalDays} días = ${mp.goalPct}% del mes transcurrido)`,
      )
      if (hasBrecha) {
        lines.push(`  INSTRUCCIÓN: hay brecha mensual — enmarca esto como una oportunidad de recuperar, no como un fracaso. Di qué actividad clave puede cerrar esa brecha.`)
      }
    }
    if ((ctx.weeksBelow70 ?? 0) >= 2) {
      lines.push(`  ALERTA: ${ctx.weeksBelow70} semanas consecutivas bajo el 70%`)
    }
  }

  lines.push('')
  lines.push('DESGLOSE POR ACTIVIDAD:')
  for (const a of ctx.activities) {
    lines.push(`  • ${a.name} [${a.type}]: ${a.real}/${a.goal} (${a.pct}%)`)
  }

  if (ctx.weakestActivity) {
    lines.push('', `CANAL MÁS DÉBIL: ${ctx.weakestActivity.name} (${ctx.weakestActivity.pct}%)`)
  }
  if (ctx.strongestActivity) {
    lines.push(`CANAL MÁS FUERTE: ${ctx.strongestActivity.name} (${ctx.strongestActivity.pct}%)`)
  }

  // ── Pipeline section ────────────────────────────────────────────────────────
  if (ctx.pipeline) {
    const p = ctx.pipeline
    const periodStr = ctx.period === 'daily' ? 'Hoy' : 'Esta semana'
    lines.push('')

    // Helper: stage summary line with amount
    function stageLine(s: PipelineStageData, count: number): string {
      return `${s.stage}: ${count}${s.amount > 0 ? ` ($${s.amount.toLocaleString('es-CO')})` : ''}`
    }

    // Conversion tags inline
    function convTag(from: string, to: string): string {
      const c = p.conversions.find((x) => x.fromStage === from && x.toStage === to)
      if (!c) return ''
      const sign = c.gap >= 0 ? '+' : ''
      const marker = c.gap >= 0 ? '✅' : c.gap >= -10 ? '⚠️' : '🔴'
      return ` | Conv. ${from}→${to}: Real ${c.realConversion}% Plan ${c.plannedConversion}% ${sign}${c.gap}% ${marker}`
    }

    lines.push(`PIPELINE OUTBOUND [${periodStr}]:`)
    const obParts = p.byStage.map((s) => stageLine(s, s.countOutbound))
    lines.push('  ' + obParts.join(' | '))

    lines.push(`PIPELINE INBOUND [${periodStr}]:`)
    const ibParts = p.byStage.map((s) => stageLine(s, s.countInbound))
    lines.push('  ' + ibParts.join(' | '))

    // Conversion rates
    if (p.conversions.length) {
      lines.push('  Tasas de conversión:')
      for (const c of p.conversions) {
        const sign = c.gap >= 0 ? '+' : ''
        const marker = c.gap >= 0 ? '✅' : c.gap >= -10 ? '⚠️' : '🔴'
        lines.push(`    ${c.fromStage}→${c.toStage}: Real ${c.realConversion}% | Plan ${c.plannedConversion}% | ${sign}${c.gap}% ${marker}`)
      }
    }

    // Company details (non-quick entries)
    const detailStages = p.byStage.filter((s) => s.amount > 0)
    if (detailStages.length > 0) {
      lines.push('  EMPRESAS CON MONTO:')
      for (const s of detailStages) {
        lines.push(`    ${s.stage}: $${s.amount.toLocaleString('es-CO')}`)
      }
    }

    // Inline conversion annotations per stage pair
    void convTag

    lines.push(`  Pipeline abierto: $${p.openAmount.toLocaleString('es-CO')}`)
    lines.push(`  Cerrado: $${p.closedAmount.toLocaleString('es-CO')} de $${p.monthlyGoal.toLocaleString('es-CO')} meta (${p.revenuePct}%)`)

    const weakConv = p.conversions.filter((c) => c.realConversion > 0).sort((a, b) => a.gap - b.gap)[0]
    if (weakConv) {
      lines.push(`  ETAPA MÁS DÉBIL: ${weakConv.fromStage}→${weakConv.toStage} (brecha: ${weakConv.gap}%)`)
    }
    if (p.monthlyGoal > 0 && p.openAmount > 0) {
      const ticketEst = ctx.recipe?.ticket ?? 0
      if (ticketEst > 0) {
        const prospectsNeeded = Math.ceil((p.monthlyGoal - p.closedAmount) / ticketEst)
        lines.push(`  INSTRUCCIÓN: el pipeline abierto es $${p.openAmount.toLocaleString('es-CO')}. Para cerrar la meta necesita ~${prospectsNeeded} cierres más al ticket promedio.`)
      }
    }
  }

  // ── Activity performance section ────────────────────────────────────────────
  if (ctx.activityPerformance?.length) {
    lines.push('')
    lines.push('RENDIMIENTO POR ACTIVIDAD (pipeline este período):')
    for (const ap of ctx.activityPerformance) {
      const cumTag = ap.cumplimiento >= 100 ? '✅' : ap.cumplimiento >= 70 ? '⚠️' : '🔴'
      lines.push(
        `  • ${ap.name} [${ap.type}]: citas meta ${ap.citasMeta.toFixed(1)} | reales ${ap.citasReales} | cumplimiento ${ap.cumplimiento}% ${cumTag} | contribución global ${ap.contribGlobalPct}%`
      )
    }
  }

  // ── Activity Effectiveness section ─────────────────────────────────────────
  if (ctx.activityEffectiveness && ctx.activityEffectiveness.length >= 2 && ctx.period !== 'daily') {
    const withExec = ctx.activityEffectiveness.filter((a) => a.executions > 0)
    if (withExec.length >= 2) {
      lines.push('', 'EFECTIVIDAD POR CANAL:')
      const byConv     = [...withExec].sort((a, b) => b.conversionToMeeting - a.conversionToMeeting)
      const topConv    = byConv[0]
      const bottomConv = byConv[byConv.length - 1]
      lines.push(`  MEJOR conversión a cita: ${topConv.name} [${topConv.type}] — ${topConv.conversionToMeeting}% (${topConv.executions} ejecuciones → ~${topConv.estimatedMeetings} reuniones)`)
      lines.push(`  PEOR conversión a cita: ${bottomConv.name} [${bottomConv.type}] — ${bottomConv.conversionToMeeting}% (${bottomConv.executions} ejecuciones → ~${bottomConv.estimatedMeetings} reuniones)`)
      const withMeetings = withExec.filter((a) => a.estimatedMeetings > 0)
      if (withMeetings.length >= 2) {
        const byClose     = [...withMeetings].sort((a, b) => b.closeProbability - a.closeProbability)
        const topClose    = byClose[0]
        const bottomClose = byClose[byClose.length - 1]
        lines.push(`  MAYOR probabilidad de cierre: ${topClose.name} [${topClose.type}] — ${topClose.closeProbability}%`)
        lines.push(`  MENOR probabilidad de cierre: ${bottomClose.name} [${bottomClose.type}] — ${bottomClose.closeProbability}%`)
      }
      lines.push(`  NOTA: Atribución estimada — las reuniones/cierres se distribuyen proporcionalmente por ejecuciones dentro de cada tipo.`)
    }
  }

  if (ctx.period === 'monthly') {
    lines.push('')
    if (ctx.bestWeek)  lines.push(`MEJOR SEMANA DEL MES: ${ctx.bestWeek.weekLabel} (${ctx.bestWeek.compliance}%)`)
    if (ctx.worstWeek) lines.push(`PEOR SEMANA DEL MES: ${ctx.worstWeek.weekLabel} (${ctx.worstWeek.compliance}%)`)
    if (ctx.prevMonthCompliance !== undefined)
      lines.push(`CUMPLIMIENTO MES ANTERIOR: ${ctx.prevMonthCompliance}%`)
    if (ctx.totalActivitiesDone !== undefined && ctx.totalActivitiesGoal !== undefined)
      lines.push(`ACTIVIDADES TOTALES: ${ctx.totalActivitiesDone} de ${ctx.totalActivitiesGoal} (${ctx.totalActivitiesGoal > 0 ? Math.round((ctx.totalActivitiesDone / ctx.totalActivitiesGoal) * 100) : 0}%)`)
  }

  return lines.join('\n')
}

// ─── Monthly ─────────────────────────────────────────────────────────────────

export async function buildMonthlyContext(monthStart: string): Promise<CoachContext> {
  const sb = await getSupabaseServerClient()
  return _buildMonthlyContext(monthStart, sb)
}

// ─── Cron variants (accept explicit userId + service client) ─────────────────

export async function buildDailyContextForCron(
  userId: string, date: string, sb: SbClient
): Promise<CoachContext> {
  return _buildDailyContextCron(userId, date, sb)
}

export async function buildWeeklyContextForCron(
  userId: string, weekStart: string, sb: SbClient
): Promise<CoachContext> {
  return _buildWeeklyContextCron(userId, weekStart, sb)
}

export async function buildMonthlyContextForCron(
  userId: string, monthStart: string, sb: SbClient
): Promise<CoachContext> {
  return _buildMonthlyContext(monthStart, sb, userId)
}

// ─── Internal implementations ─────────────────────────────────────────────────

async function _fetchRecipe(sb: SbClient, userId?: string) {
  let q = sb
    .from('recipe_scenarios')
    .select('name,monthly_revenue_goal,average_ticket,outbound_pct,funnel_stages,outbound_rates,inbound_rates,activities_needed_daily,activities_needed_weekly,activities_needed_monthly')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
  if (userId) q = q.eq('user_id', userId)
  const { data } = await q.maybeSingle()
  return data
}

function recipeFromData(d: Awaited<ReturnType<typeof _fetchRecipe>>) {
  if (!d) return null
  return {
    name: d.name,
    monthly_goal: d.monthly_revenue_goal,
    ticket: d.average_ticket,
    outbound_pct: d.outbound_pct,
    funnel_stages: d.funnel_stages ?? [],
    activities_needed_daily:   d.activities_needed_daily   ?? 0,
    activities_needed_weekly:  d.activities_needed_weekly  ?? 0,
    activities_needed_monthly: d.activities_needed_monthly ?? 0,
  }
}

async function _buildDailyContextCron(
  userId: string, date: string, sb: SbClient
): Promise<CoachContext> {
  const [
    { data: profile },
    { data: activities },
    { data: logs },
    { data: recentLogs },
    scenario,
  ] = await Promise.all([
    sb.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
    sb.from('activities').select('id,name,type,daily_goal').eq('user_id', userId).eq('status', 'active'),
    sb.from('activity_logs').select('activity_id,real_executed').eq('user_id', userId).eq('log_date', date),
    sb.from('activity_logs').select('log_date').eq('user_id', userId).lte('log_date', date).order('log_date', { ascending: false }).limit(60),
    _fetchRecipe(sb, userId),
  ])

  const userName = profile?.full_name ?? 'Campeón'
  const realMap: Record<string, number> = {}
  for (const l of logs ?? []) realMap[l.activity_id] = (realMap[l.activity_id] ?? 0) + l.real_executed

  const actCompliance: ActivityCompliance[] = (activities ?? []).map((a) => {
    const goal = a.daily_goal; const real = realMap[a.id] ?? 0
    return { name: a.name, type: a.type, goal, real, pct: goal > 0 ? Math.round((real / goal) * 100) : 0 }
  })
  const totalGoal = actCompliance.reduce((s, a) => s + a.goal, 0)
  const totalReal = actCompliance.reduce((s, a) => s + a.real, 0)
  const overallCompliance = totalGoal > 0 ? Math.round((totalReal / totalGoal) * 100) : 0

  const logDates = new Set((recentLogs ?? []).map((l) => l.log_date as string))
  let streak = 0; const cur = new Date(date)
  while (logDates.has(toISODate(cur))) { streak++; cur.setDate(cur.getDate() - 1) }

  const yesterday = toISODate(new Date(new Date(date).setDate(new Date(date).getDate() - 1)))
  const { data: yLogs } = await sb.from('activity_logs').select('real_executed,day_goal').eq('user_id', userId).eq('log_date', yesterday)
  const yGoal = (yLogs ?? []).reduce((s, l) => s + l.day_goal, 0)
  const yReal = (yLogs ?? []).reduce((s, l) => s + l.real_executed, 0)

  const withGoal = actCompliance.filter((a) => a.goal > 0)
  const [cronDailyPipeline, cronDailyPerformance] = await Promise.all([
    scenario ? _fetchPipelineData(
      sb, date, date, totalReal,
      scenario.funnel_stages ?? [], scenario.outbound_rates ?? [], scenario.inbound_rates ?? [],
      scenario.outbound_pct ?? 80, scenario.monthly_revenue_goal, userId,
    ) : Promise.resolve(undefined),
    _fetchActivityPerformance(sb, date, date, scenario, userId),
  ])
  return {
    userName, period: 'daily', periodDate: date,
    recipe: recipeFromData(scenario),
    activities: actCompliance, overallCompliance, streak,
    weakestActivity:   withGoal.length ? withGoal.reduce((m, a) => a.pct < m.pct ? a : m, withGoal[0]) && { name: withGoal.reduce((m, a) => a.pct < m.pct ? a : m).name, pct: withGoal.reduce((m, a) => a.pct < m.pct ? a : m).pct } : null,
    strongestActivity: withGoal.length ? { name: withGoal.reduce((m, a) => a.pct > m.pct ? a : m).name, pct: withGoal.reduce((m, a) => a.pct > m.pct ? a : m).pct } : null,
    trend: toTrend(overallCompliance, yGoal > 0 ? Math.round((yReal / yGoal) * 100) : 0),
    pipeline: cronDailyPipeline,
    activityPerformance: cronDailyPerformance ?? undefined,
  }
}

async function _buildWeeklyContextCron(
  userId: string, weekStart: string, sb: SbClient
): Promise<CoachContext> {
  const weekEnd      = toISODate(endOfWeek(parseISO(weekStart), { weekStartsOn: 1 }))
  const prevWeekStart = toISODate(subWeeks(parseISO(weekStart), 1))
  const prevWeekEnd   = toISODate(endOfWeek(parseISO(prevWeekStart), { weekStartsOn: 1 }))
  const today       = todayISO()
  const monthStart  = today.slice(0, 8) + '01'
  const daysInMonth = new Date(parseInt(today.slice(0, 4)), parseInt(today.slice(5, 7)), 0).getDate()
  const daysElapsed = parseInt(today.slice(8, 10))

  const [
    { data: profile },
    { data: activities },
    { data: weekLogs },
    { data: prevLogs },
    { data: monthLogs },
    scenario,
  ] = await Promise.all([
    sb.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
    sb.from('activities').select('id,name,type,weekly_goal,monthly_goal').eq('user_id', userId).eq('status', 'active'),
    sb.from('activity_logs').select('activity_id,real_executed,log_date').eq('user_id', userId).gte('log_date', weekStart).lte('log_date', weekEnd),
    sb.from('activity_logs').select('real_executed').eq('user_id', userId).gte('log_date', prevWeekStart).lte('log_date', prevWeekEnd),
    sb.from('activity_logs').select('real_executed').eq('user_id', userId).gte('log_date', monthStart).lte('log_date', today),
    _fetchRecipe(sb, userId),
  ])

  const userName = profile?.full_name ?? 'Campeón'
  const realMap: Record<string, number> = {}
  for (const l of weekLogs ?? []) realMap[l.activity_id] = (realMap[l.activity_id] ?? 0) + l.real_executed

  const actCompliance: ActivityCompliance[] = (activities ?? []).map((a) => {
    const goal = a.weekly_goal; const real = realMap[a.id] ?? 0
    return { name: a.name, type: a.type, goal, real, pct: goal > 0 ? Math.round((real / goal) * 100) : 0 }
  })
  const totalGoal = actCompliance.reduce((s, a) => s + a.goal, 0)
  const totalReal = actCompliance.reduce((s, a) => s + a.real, 0)
  const overallCompliance = totalGoal > 0 ? Math.round((totalReal / totalGoal) * 100) : 0
  const prevReal = (prevLogs ?? []).reduce((s, l) => s + l.real_executed, 0)
  const prevCompliance = totalGoal > 0 ? Math.round((prevReal / totalGoal) * 100) : 0
  const daysWithLogs = new Set((weekLogs ?? []).map((l) => l.log_date)).size
  const monthlyGoalTotal = (activities ?? []).reduce((s, a) => s + (a.monthly_goal ?? 0), 0)
  const monthReal = (monthLogs ?? []).reduce((s, l) => s + l.real_executed, 0)

  const withGoal = actCompliance.filter((a) => a.goal > 0)
  const [cronWeeklyPipeline, cronWeeklyPerformance, cronWeeklyEffectiveness] = await Promise.all([
    scenario ? _fetchPipelineData(
      sb, weekStart, weekEnd, totalReal,
      scenario.funnel_stages ?? [], scenario.outbound_rates ?? [], scenario.inbound_rates ?? [],
      scenario.outbound_pct ?? 80, scenario.monthly_revenue_goal, userId,
    ) : Promise.resolve(undefined),
    _fetchActivityPerformance(sb, weekStart, weekEnd, scenario, userId),
    _fetchActivityEffectiveness(sb, weekStart, weekEnd, userId),
  ])
  return {
    userName, period: 'weekly', periodDate: weekStart,
    recipe: recipeFromData(scenario),
    activities: actCompliance, overallCompliance, streak: daysWithLogs,
    weakestActivity:   withGoal.length ? { name: withGoal.reduce((m, a) => a.pct < m.pct ? a : m).name, pct: withGoal.reduce((m, a) => a.pct < m.pct ? a : m).pct } : null,
    strongestActivity: withGoal.length ? { name: withGoal.reduce((m, a) => a.pct > m.pct ? a : m).name, pct: withGoal.reduce((m, a) => a.pct > m.pct ? a : m).pct } : null,
    trend: toTrend(overallCompliance, prevCompliance),
    monthlyProgress: {
      daysElapsed, totalDays: daysInMonth,
      goalPct: Math.round((daysElapsed / daysInMonth) * 100),
      achievedPct: monthlyGoalTotal > 0 ? Math.round((monthReal / monthlyGoalTotal) * 100) : 0,
    },
    weeksBelow70: overallCompliance < 70 && prevCompliance < 70 ? 2 : overallCompliance < 70 ? 1 : 0,
    pipeline: cronWeeklyPipeline,
    activityPerformance: cronWeeklyPerformance ?? undefined,
    activityEffectiveness: cronWeeklyEffectiveness.length ? cronWeeklyEffectiveness : undefined,
  }
}

async function _buildMonthlyContext(
  monthStart: string, sb: SbClient, userId?: string
): Promise<CoachContext> {
  const monthEnd     = toISODate(endOfMonth(parseISO(monthStart)))
  const prevMonStart = toISODate(new Date(new Date(monthStart).setMonth(new Date(monthStart).getMonth() - 1)))
  const prevMonEnd   = toISODate(endOfMonth(parseISO(prevMonStart)))
  const monthName    = format(parseISO(monthStart), 'MMMM yyyy', { locale: es })

  const profileQ = userId
    ? sb.from('profiles').select('full_name').eq('id', userId).maybeSingle()
    : (sb as Awaited<ReturnType<typeof getSupabaseServerClient>>).from('profiles').select('full_name').maybeSingle()

  const activitiesQ = (() => {
    let q = sb.from('activities').select('id,name,type,monthly_goal').eq('status', 'active')
    if (userId) q = q.eq('user_id', userId)
    return q
  })()

  const logsQ = (() => {
    let q = sb.from('activity_logs').select('activity_id,real_executed,log_date').gte('log_date', monthStart).lte('log_date', monthEnd)
    if (userId) q = q.eq('user_id', userId)
    return q
  })()

  const prevLogsQ = (() => {
    let q = sb.from('activity_logs').select('real_executed').gte('log_date', prevMonStart).lte('log_date', prevMonEnd)
    if (userId) q = q.eq('user_id', userId)
    return q
  })()

  const [
    { data: profile },
    { data: activities },
    { data: logs },
    { data: prevLogs },
    scenario,
  ] = await Promise.all([profileQ, activitiesQ, logsQ, prevLogsQ, _fetchRecipe(sb, userId)])

  const userName = profile?.full_name ?? 'Campeón'
  const realMap: Record<string, number> = {}
  for (const l of logs ?? []) realMap[l.activity_id] = (realMap[l.activity_id] ?? 0) + l.real_executed

  const actCompliance: ActivityCompliance[] = (activities ?? []).map((a) => {
    const goal = a.monthly_goal ?? 0; const real = realMap[a.id] ?? 0
    return { name: a.name, type: a.type, goal, real, pct: goal > 0 ? Math.round((real / goal) * 100) : 0 }
  })
  const totalGoal = actCompliance.reduce((s, a) => s + a.goal, 0)
  const totalReal = actCompliance.reduce((s, a) => s + a.real, 0)
  const overallCompliance = totalGoal > 0 ? Math.round((totalReal / totalGoal) * 100) : 0
  const prevReal = (prevLogs ?? []).reduce((s, l) => s + l.real_executed, 0)
  const prevCompliance = totalGoal > 0 ? Math.round((prevReal / totalGoal) * 100) : 0

  // Weekly buckets within the month
  const weekBuckets: Record<string, { real: number; goal: number }> = {}
  const weeklyGoalTotal = actCompliance.reduce((s, a) => s + Math.ceil(a.goal / 4), 0)
  for (const l of logs ?? []) {
    const d = parseISO(l.log_date)
    const mon = toISODate(startOfWeek(d, { weekStartsOn: 1 }))
    if (!weekBuckets[mon]) weekBuckets[mon] = { real: 0, goal: weeklyGoalTotal }
    weekBuckets[mon].real += l.real_executed
  }
  const weekEntries = Object.entries(weekBuckets).map(([mon, { real, goal }]) => ({
    weekLabel: `Sem. ${format(parseISO(mon), 'd MMM', { locale: es })}`,
    compliance: goal > 0 ? Math.round((real / goal) * 100) : 0,
  }))
  const bestWeek  = weekEntries.length ? weekEntries.reduce((m, w) => w.compliance > m.compliance ? w : m) : undefined
  const worstWeek = weekEntries.length ? weekEntries.reduce((m, w) => w.compliance < m.compliance ? w : m) : undefined

  const withGoal = actCompliance.filter((a) => a.goal > 0)
  const [monthlyPerformance, monthlyEffectiveness] = await Promise.all([
    _fetchActivityPerformance(sb, monthStart, monthEnd, scenario, userId),
    _fetchActivityEffectiveness(sb, monthStart, monthEnd, userId),
  ])
  return {
    userName, period: 'monthly', periodDate: monthStart,
    recipe: recipeFromData(scenario),
    activities: actCompliance, overallCompliance, streak: 0,
    weakestActivity:   withGoal.length ? { name: withGoal.reduce((m, a) => a.pct < m.pct ? a : m).name, pct: withGoal.reduce((m, a) => a.pct < m.pct ? a : m).pct } : null,
    strongestActivity: withGoal.length ? { name: withGoal.reduce((m, a) => a.pct > m.pct ? a : m).name, pct: withGoal.reduce((m, a) => a.pct > m.pct ? a : m).pct } : null,
    trend: toTrend(overallCompliance, prevCompliance),
    monthName, prevMonthCompliance: prevCompliance,
    bestWeek, worstWeek,
    totalActivitiesDone: totalReal, totalActivitiesGoal: totalGoal,
    activityPerformance: monthlyPerformance ?? undefined,
    activityEffectiveness: monthlyEffectiveness.length ? monthlyEffectiveness : undefined,
  }
}
