import type { SupabaseClient } from '@supabase/supabase-js'
import { parseISO, format, startOfWeek, endOfWeek, addWeeks, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import type { RepAnalytics } from './gerente-ai'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PipelineDeal {
  id: string
  userId: string
  stage: 'Reunión' | 'Propuesta' | 'Cierre'
  status: 'abierto' | 'perdido' | 'ganado'
  prospectType: 'inbound' | 'outbound'
  entryDate: string
  amount: number | null
  companyName: string | null
}

export interface StageBreakdown {
  stage: string
  open: number
  /** Estimated: uses avgTicket for null amounts */
  openValue: number
  won: number
  /** Actual confirmed revenue only — null amounts counted as 0 */
  wonValue: number
  lost: number
  winRate: number
}

export interface WeeklyRevenuePoint {
  label: string
  weekStart: string
  /** Actual amounts only */
  won: number
  /** Actual amounts only */
  lost: number
  /** Estimated (avgTicket fallback) */
  open: number
}

export interface ForecastPoint {
  label: string
  actual: number | null
  forecast: number
  lower: number
  upper: number
}

export interface RepPipelineStats {
  userId: string
  name: string
  email: string
  openCount: number
  /** Estimated pipeline value (avgTicket fallback for nulls) */
  openValue: number
  wonCount: number
  /** Actual confirmed revenue — no fallback */
  wonValue: number
  lostCount: number
  winRate: number
  /** Avg of closed deals with actual amounts; fallback to recipe avgTicket */
  avgDealSize: number
  stages: StageBreakdown[]
  momentumScore: number
  riskLevel: 'low' | 'medium' | 'high'
  /** Per-week actual won amounts — indexed same as teamWeeklyRevenueTrend */
  weeklyWon: number[]
  /** Per-week estimated open value — indexed same as teamWeeklyRevenueTrend */
  weeklyOpen: number[]
  /** Per-week actual lost amounts — indexed same as teamWeeklyRevenueTrend */
  weeklyLost: number[]
}

export interface TeamPipelineAnalytics {
  byRep: RepPipelineStats[]
  teamStages: StageBreakdown[]
  teamOpenValue: number
  teamWonValue: number
  teamWinRate: number
  teamAvgDealSize: number
  weeklyRevenueTrend: WeeklyRevenuePoint[]
  projectedRevenue: number
  revenueGoal: number | null
  forecastWeeks: ForecastPoint[]
  atRiskRepIds: string[]
  avgDaysToClose: number
  scatterData: { repName: string; compliance: number; wonValue: number; openValue: number }[]
  inboundVsOutbound: { type: string; won: number; lost: number; open: number; winRate: number }[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function lsPredict(values: number[], x: number): number {
  const n = values.length
  if (n === 0) return 0
  if (n === 1) return values[0]
  const sumX  = values.reduce((s, _, i) => s + i, 0)
  const sumY  = values.reduce((s, v) => s + v, 0)
  const sumXY = values.reduce((s, v, i) => s + i * v, 0)
  const sumX2 = values.reduce((s, _, i) => s + i * i, 0)
  const denom = n * sumX2 - sumX * sumX
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom
  return Math.max(0, (sumY - slope * sumX) / n + slope * x)
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1))
}

function computeStages(deals: PipelineDeal[], avgTicket: number): StageBreakdown[] {
  return (['Reunión', 'Propuesta', 'Cierre'] as const).map((stage) => {
    const sd    = deals.filter((d) => d.stage === stage)
    const open  = sd.filter((d) => d.status === 'abierto')
    const won   = sd.filter((d) => d.status === 'ganado')
    const lost  = sd.filter((d) => d.status === 'perdido')
    // won/lost: actual amounts only (null → 0)
    const wonValue  = won.reduce((s, d) => s + (d.amount ?? 0), 0)
    // open: estimated (avgTicket fallback)
    const openValue = open.reduce((s, d) => s + (d.amount ?? avgTicket), 0)
    const closed = won.length + lost.length
    return {
      stage, open: open.length, openValue,
      won: won.length, wonValue, lost: lost.length,
      winRate: closed > 0 ? Math.round((won.length / closed) * 100) : 0,
    }
  })
}

function projectRevenue(openDeals: PipelineDeal[], stages: StageBreakdown[], avgTicket: number): number {
  const rateMap = Object.fromEntries(stages.map((s) => [s.stage, s.winRate / 100]))
  const stageProb: Record<string, number> = {
    'Reunión':   (rateMap['Reunión']  || 0.3) * (rateMap['Propuesta'] || 0.5) * (rateMap['Cierre'] || 0.6),
    'Propuesta': (rateMap['Propuesta']|| 0.5) * (rateMap['Cierre']    || 0.6),
    'Cierre':    (rateMap['Cierre']   || 0.6),
  }
  return openDeals.reduce((sum, d) => sum + (d.amount ?? avgTicket) * (stageProb[d.stage] ?? 0.3), 0)
}

function momentumScore(rep: RepAnalytics, p: { wonCount: number; openCount: number; winRate: number }): number {
  const actScore  = Math.min(100, rep.avgCompliance)
  const pipeScore = Math.min(100, p.winRate)
  const trend     = rep.weeklyTrend
  const recent    = trend.length >= 2 ? trend.slice(-2).reduce((s, w) => s + w.pct, 0) / 2 : rep.avgCompliance
  const early     = trend.length >= 2 ? trend.slice(0, 2).reduce((s, w) => s + w.pct, 0) / 2 : rep.avgCompliance
  const trendScore = Math.min(100, Math.max(0, 50 + (recent - early)))
  return Math.round(actScore * 0.40 + pipeScore * 0.35 + trendScore * 0.25)
}

function riskLevel(score: number): 'low' | 'medium' | 'high' {
  return score >= 65 ? 'low' : score >= 40 ? 'medium' : 'high'
}

// ── Build week boundaries ─────────────────────────────────────────────────────

function buildWeekBuckets(startISO: string, endISO: string) {
  const start   = parseISO(startISO)
  const end     = parseISO(endISO)
  const buckets: { label: string; start: string; end: string }[] = []
  let cursor = startOfWeek(start, { weekStartsOn: 1 })
  while (cursor <= end) {
    const wEnd = endOfWeek(cursor, { weekStartsOn: 1 })
    buckets.push({ label: format(cursor, 'd MMM', { locale: es }), start: toISO(cursor), end: toISO(wEnd) })
    cursor = addWeeks(cursor, 1)
  }
  return buckets
}

// ── Main fetch ────────────────────────────────────────────────────────────────

export async function fetchTeamPipeline(
  service: SupabaseClient,
  userIds: string[],
  activityReps: RepAnalytics[],
  startISO: string,
  endISO: string,
): Promise<TeamPipelineAnalytics> {
  if (userIds.length === 0) return emptyPipeline()

  const [dealsRes, scenariosRes, profilesRes] = await Promise.all([
    service.from('pipeline_simple')
      .select('id,user_id,stage,status,prospect_type,entry_date,amount_usd,company_name')
      .in('user_id', userIds)
      .gte('entry_date', startISO)
      .lte('entry_date', endISO),
    service.from('recipe_scenarios')
      .select('user_id,monthly_revenue_goal,average_ticket')
      .eq('is_active', true)
      .in('user_id', userIds),
    service.from('profiles')
      .select('id,full_name,email')
      .in('id', userIds),
  ])

  const rawDeals  = dealsRes.data     ?? []
  const scenarios = scenariosRes.data ?? []
  const profiles  = profilesRes.data  ?? []

  const deals: PipelineDeal[] = rawDeals.map((d) => ({
    id: d.id, userId: d.user_id,
    stage: d.stage as PipelineDeal['stage'],
    status: d.status as PipelineDeal['status'],
    prospectType: d.prospect_type as PipelineDeal['prospectType'],
    entryDate: d.entry_date, amount: d.amount_usd, companyName: d.company_name,
  }))

  const ticketByUser      = Object.fromEntries(scenarios.map((s) => [s.user_id, s.average_ticket ?? 10000]))
  const teamAvgTicket     = scenarios.length > 0
    ? scenarios.reduce((s, sc) => s + (sc.average_ticket ?? 10000), 0) / scenarios.length
    : 10000
  const teamRevenueGoal   = scenarios.length > 0
    ? scenarios.reduce((s, sc) => s + (sc.monthly_revenue_goal ?? 0), 0)
    : null

  const actRepMap  = Object.fromEntries(activityReps.map((r) => [r.userId, r]))
  const weekBuckets = buildWeekBuckets(startISO, endISO)

  // ── Per-rep stats ─────────────────────────────────────────────────────────
  const byRep: RepPipelineStats[] = profiles.map((p) => {
    const repDeals  = deals.filter((d) => d.userId === p.id)
    const avgTicket = ticketByUser[p.id] ?? teamAvgTicket

    const open  = repDeals.filter((d) => d.status === 'abierto')
    const won   = repDeals.filter((d) => d.status === 'ganado')
    const lost  = repDeals.filter((d) => d.status === 'perdido')

    // Actual revenue (no fallback for confirmed deals)
    const wonValue  = won.reduce((s, d) => s + (d.amount ?? 0), 0)
    // Estimated pipeline value
    const openValue = open.reduce((s, d) => s + (d.amount ?? avgTicket), 0)

    const closed  = won.length + lost.length
    const winRate = closed > 0 ? Math.round((won.length / closed) * 100) : 0

    // avgDealSize: from closed deals that have actual amounts; fallback to recipe
    const closedWithAmt = [...won, ...lost].filter((d) => d.amount !== null)
    const avgDealSize = closedWithAmt.length > 0
      ? Math.round(closedWithAmt.reduce((s, d) => s + d.amount!, 0) / closedWithAmt.length)
      : Math.round(avgTicket)

    const stages = computeStages(repDeals, avgTicket)

    // Per-week breakdown (actual amounts only for won/lost)
    const weeklyWon  = weekBuckets.map(({ start, end }) =>
      won.filter((d) => d.entryDate >= start && d.entryDate <= end).reduce((s, d) => s + (d.amount ?? 0), 0)
    )
    const weeklyLost = weekBuckets.map(({ start, end }) =>
      lost.filter((d) => d.entryDate >= start && d.entryDate <= end).reduce((s, d) => s + (d.amount ?? 0), 0)
    )
    const weeklyOpen = weekBuckets.map(({ start, end }) =>
      open.filter((d) => d.entryDate >= start && d.entryDate <= end).reduce((s, d) => s + (d.amount ?? avgTicket), 0)
    )

    const actRep = actRepMap[p.id]
    const mScore = actRep
      ? momentumScore(actRep, { wonCount: won.length, openCount: open.length, winRate })
      : Math.min(100, Math.round(winRate * 0.5))

    return {
      userId: p.id, name: p.full_name ?? p.email, email: p.email,
      openCount: open.length, openValue,
      wonCount: won.length, wonValue,
      lostCount: lost.length,
      winRate, avgDealSize, stages,
      momentumScore: mScore, riskLevel: riskLevel(mScore),
      weeklyWon, weeklyLost, weeklyOpen,
    }
  })

  byRep.sort((a, b) => b.momentumScore - a.momentumScore)

  // ── Team aggregates ───────────────────────────────────────────────────────
  const teamStages    = computeStages(deals, teamAvgTicket)
  const teamOpenValue = byRep.reduce((s, r) => s + r.openValue, 0)
  const teamWonValue  = byRep.reduce((s, r) => s + r.wonValue, 0)

  const teamClosed  = deals.filter((d) => d.status !== 'abierto').length
  const teamWon     = deals.filter((d) => d.status === 'ganado').length
  const teamWinRate = teamClosed > 0 ? Math.round((teamWon / teamClosed) * 100) : 0

  const teamClosedWithAmt = deals.filter((d) => d.status !== 'abierto' && d.amount !== null)
  const teamAvgDealSize   = teamClosedWithAmt.length > 0
    ? Math.round(teamClosedWithAmt.reduce((s, d) => s + d.amount!, 0) / teamClosedWithAmt.length)
    : Math.round(teamAvgTicket)

  // ── Weekly revenue trend (from per-rep data, so filters can rebuild it) ──
  const weeklyRevenueTrend: WeeklyRevenuePoint[] = weekBuckets.map(({ label, start, end }, i) => ({
    label,
    weekStart: start,
    won:  Math.round(byRep.reduce((s, r) => s + (r.weeklyWon[i]  ?? 0), 0)),
    lost: Math.round(byRep.reduce((s, r) => s + (r.weeklyLost[i] ?? 0), 0)),
    open: Math.round(byRep.reduce((s, r) => s + (r.weeklyOpen[i] ?? 0), 0)),
  }))

  // ── Revenue projection ────────────────────────────────────────────────────
  const openDeals   = deals.filter((d) => d.status === 'abierto')
  const projected   = teamWonValue + Math.round(projectRevenue(openDeals, teamStages, teamAvgTicket))

  // ── Forecast (historical + 4 predicted weeks) ─────────────────────────────
  const wonPerWeek    = weeklyRevenueTrend.map((w) => w.won)
  const sd            = stddev(wonPerWeek)
  const forecastWeeks: ForecastPoint[] = weeklyRevenueTrend.map((w) => ({
    label: w.label, actual: w.won, forecast: w.won,
    lower: Math.max(0, w.won - sd), upper: w.won + sd,
  }))
  const lastWeekEnd = parseISO(endISO)
  for (let i = 0; i < 4; i++) {
    const futureMonday = addWeeks(startOfWeek(lastWeekEnd, { weekStartsOn: 1 }), i + 1)
    const x    = wonPerWeek.length + i
    const pred = Math.round(lsPredict(wonPerWeek, x))
    forecastWeeks.push({
      label:    format(futureMonday, 'd MMM', { locale: es }),
      actual:   null,
      forecast: pred,
      lower:    Math.max(0, pred - sd * 1.2),
      upper:    pred + sd * 1.2,
    })
  }

  // ── At-risk reps ──────────────────────────────────────────────────────────
  const atRiskRepIds = byRep
    .filter((r) => r.riskLevel === 'high' || (r.riskLevel === 'medium' && r.openCount === 0))
    .map((r) => r.userId)

  // ── Avg days to close ─────────────────────────────────────────────────────
  const closedDeals    = deals.filter((d) => d.status !== 'abierto')
  const avgDaysToClose = closedDeals.length > 0
    ? Math.round(closedDeals.reduce((s, d) => s + Math.abs(differenceInDays(parseISO(endISO), parseISO(d.entryDate))), 0) / closedDeals.length)
    : 0

  // ── Scatter data ──────────────────────────────────────────────────────────
  const scatterData = byRep.map((r) => ({
    repName:    r.name.split(' ')[0],
    compliance: actRepMap[r.userId]?.avgCompliance ?? 0,
    wonValue:   r.wonValue,
    openValue:  r.openValue,
  }))

  // ── Inbound vs outbound ───────────────────────────────────────────────────
  const inboundVsOutbound = ['inbound', 'outbound'].map((type) => {
    const td  = deals.filter((d) => d.prospectType === type)
    const tW  = td.filter((d) => d.status === 'ganado').length
    const tL  = td.filter((d) => d.status === 'perdido').length
    const tO  = td.filter((d) => d.status === 'abierto').length
    const cl  = tW + tL
    return {
      type: type === 'inbound' ? 'Inbound' : 'Outbound',
      won: tW, lost: tL, open: tO,
      winRate: cl > 0 ? Math.round((tW / cl) * 100) : 0,
    }
  })

  return {
    byRep, teamStages, teamOpenValue, teamWonValue, teamWinRate, teamAvgDealSize,
    weeklyRevenueTrend, projectedRevenue: projected, revenueGoal: teamRevenueGoal,
    forecastWeeks, atRiskRepIds, avgDaysToClose, scatterData, inboundVsOutbound,
  }
}

// ── Recompute team aggregates from a filtered subset of reps ──────────────────
/** Use this in client components when selectedRepIds changes, to avoid a server round-trip */
export function filterPipeline(
  full: TeamPipelineAnalytics,
  selectedRepIds: string[],
): TeamPipelineAnalytics {
  if (selectedRepIds.length === 0) return full

  const byRep = full.byRep.filter((r) => selectedRepIds.includes(r.userId))
  if (byRep.length === 0) return { ...full, byRep: [] }

  const teamOpenValue = byRep.reduce((s, r) => s + r.openValue, 0)
  const teamWonValue  = byRep.reduce((s, r) => s + r.wonValue, 0)

  const totalWon    = byRep.reduce((s, r) => s + r.wonCount, 0)
  const totalClosed = byRep.reduce((s, r) => s + r.wonCount + r.lostCount, 0)
  const teamWinRate = totalClosed > 0 ? Math.round((totalWon / totalClosed) * 100) : 0

  const repsWithAvg      = byRep.filter((r) => r.avgDealSize > 0)
  const teamAvgDealSize  = repsWithAvg.length > 0
    ? Math.round(repsWithAvg.reduce((s, r) => s + r.avgDealSize, 0) / repsWithAvg.length)
    : full.teamAvgDealSize

  // Rebuild weekly trend from per-rep weekly arrays
  const weeklyRevenueTrend: WeeklyRevenuePoint[] = full.weeklyRevenueTrend.map((week, i) => ({
    label:     week.label,
    weekStart: week.weekStart,
    won:  Math.round(byRep.reduce((s, r) => s + (r.weeklyWon[i]  ?? 0), 0)),
    lost: Math.round(byRep.reduce((s, r) => s + (r.weeklyLost[i] ?? 0), 0)),
    open: Math.round(byRep.reduce((s, r) => s + (r.weeklyOpen[i] ?? 0), 0)),
  }))

  // Rebuild forecast from filtered weekly trend
  const wonPerWeek = weeklyRevenueTrend.map((w) => w.won)
  const sd         = stddev(wonPerWeek)
  const lastLabel  = full.forecastWeeks.find((f) => f.actual === null)
  const forecastWeeks: ForecastPoint[] = [
    ...weeklyRevenueTrend.map((w) => ({
      label: w.label, actual: w.won, forecast: w.won,
      lower: Math.max(0, w.won - sd), upper: w.won + sd,
    })),
    ...full.forecastWeeks.filter((f) => f.actual === null).map((f, i) => {
      const pred = Math.round(lsPredict(wonPerWeek, wonPerWeek.length + i))
      return { label: f.label, actual: null, forecast: pred, lower: Math.max(0, pred - sd * 1.2), upper: pred + sd * 1.2 }
    }),
  ]

  // Rebuild inbound/outbound from filtered reps' stages (approximate from byRep totals)
  const projectedRevenue = teamWonValue + byRep.reduce((s, r) => {
    const openVal = r.openValue
    const stageWR = r.stages.map((st) => st.winRate / 100)
    const avgProb = stageWR.length > 0 ? stageWR.reduce((a, b) => a + b, 0) / stageWR.length : 0.3
    return s + openVal * avgProb
  }, 0)

  const atRiskRepIds = byRep
    .filter((r) => r.riskLevel === 'high' || (r.riskLevel === 'medium' && r.openCount === 0))
    .map((r) => r.userId)

  const scatterData = full.scatterData.filter((d) =>
    byRep.some((r) => r.name.startsWith(d.repName) || d.repName.startsWith(r.name.split(' ')[0]))
  )

  return {
    ...full,
    byRep, teamOpenValue, teamWonValue, teamWinRate, teamAvgDealSize,
    weeklyRevenueTrend, forecastWeeks,
    projectedRevenue: Math.round(projectedRevenue),
    atRiskRepIds, scatterData,
  }
}

function emptyPipeline(): TeamPipelineAnalytics {
  return {
    byRep: [], teamStages: [], teamOpenValue: 0, teamWonValue: 0,
    teamWinRate: 0, teamAvgDealSize: 0, weeklyRevenueTrend: [],
    projectedRevenue: 0, revenueGoal: null, forecastWeeks: [],
    atRiskRepIds: [], avgDaysToClose: 0, scatterData: [], inboundVsOutbound: [],
  }
}

export function buildPipelineContext(p: TeamPipelineAnalytics): string {
  const lines = [
    `=== PIPELINE DEL EQUIPO ===`,
    `Valor abierto estimado: $${p.teamOpenValue.toLocaleString()}`,
    `Ingresos reales ganados: $${p.teamWonValue.toLocaleString()}`,
    `Tasa de cierre: ${p.teamWinRate}%`,
    `Ticket promedio (cierres reales): $${p.teamAvgDealSize.toLocaleString()}`,
    `Días promedio a cierre: ${p.avgDaysToClose}`,
    p.revenueGoal ? `Meta de ingresos: $${p.revenueGoal.toLocaleString()}` : '',
    `Proyección (ganado + pipeline × tasa): $${p.projectedRevenue.toLocaleString()}`,
    ``,
    `=== ETAPAS ===`,
    ...p.teamStages.map((s) =>
      `${s.stage}: ${s.open} abiertos (~$${s.openValue.toLocaleString()}), ${s.won} ganados ($${s.wonValue.toLocaleString()} real), ${s.lost} perdidos, win rate ${s.winRate}%`
    ),
    ``,
    `=== INBOUND VS OUTBOUND ===`,
    ...p.inboundVsOutbound.map((t) =>
      `${t.type}: ${t.open} abiertos, ${t.won} ganados, ${t.lost} perdidos, win rate ${t.winRate}%`
    ),
    ``,
    `=== POR VENDEDOR (Momentum / Pipeline) ===`,
    ...p.byRep.map((r) =>
      `${r.name}: Momentum ${r.momentumScore}/100 (${r.riskLevel}), ${r.openCount} abiertos (~$${r.openValue.toLocaleString()}), ${r.wonCount} ganados ($${r.wonValue.toLocaleString()} real), win rate ${r.winRate}%`
    ),
  ]
  return lines.filter(Boolean).join('\n')
}
