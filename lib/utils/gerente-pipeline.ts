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
  openValue: number
  won: number
  wonValue: number
  lost: number
  winRate: number   // won / (won + lost) * 100, 0 if no closed
}

export interface RepPipelineStats {
  userId: string
  name: string
  email: string
  openCount: number
  openValue: number
  wonCount: number
  wonValue: number
  lostCount: number
  winRate: number         // % overall (won / (won+lost))
  avgDealSize: number
  stages: StageBreakdown[]
  momentumScore: number   // 0–100 composite
  riskLevel: 'low' | 'medium' | 'high'
}

export interface WeeklyRevenuePoint {
  label: string
  won: number
  lost: number
  open: number
}

export interface ForecastPoint {
  label: string
  actual: number | null
  forecast: number
  lower: number   // confidence lower bound
  upper: number   // confidence upper bound
}

export interface TeamPipelineAnalytics {
  byRep: RepPipelineStats[]
  teamStages: StageBreakdown[]
  teamOpenValue: number
  teamWonValue: number
  teamWinRate: number
  teamAvgDealSize: number
  weeklyRevenueTrend: WeeklyRevenuePoint[]
  // Predictions
  projectedRevenue: number
  revenueGoal: number | null
  forecastWeeks: ForecastPoint[]       // 8-week combined actual+forecast chart
  atRiskRepIds: string[]
  avgDaysToClose: number
  scatterData: { repName: string; compliance: number; wonValue: number; openValue: number }[]
  inboundVsOutbound: { type: string; won: number; lost: number; open: number; winRate: number }[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function safeDiv(a: number, b: number) {
  return b === 0 ? 0 : a / b
}

/** Simple ordinary-least-squares linear regression. Returns predicted value at position `x`. */
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
  const intercept = (sumY - slope * sumX) / n
  return Math.max(0, intercept + slope * x)
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1))
}

// ── Stage breakdown helper ────────────────────────────────────────────────────

function computeStages(deals: PipelineDeal[], avgTicket: number): StageBreakdown[] {
  const STAGES = ['Reunión', 'Propuesta', 'Cierre'] as const
  return STAGES.map((stage) => {
    const stagDeals = deals.filter((d) => d.stage === stage)
    const open  = stagDeals.filter((d) => d.status === 'abierto')
    const won   = stagDeals.filter((d) => d.status === 'ganado')
    const lost  = stagDeals.filter((d) => d.status === 'perdido')
    const wonValue  = won.reduce((s, d) => s + (d.amount ?? avgTicket), 0)
    const openValue = open.reduce((s, d) => s + (d.amount ?? avgTicket), 0)
    const closed = won.length + lost.length
    return {
      stage,
      open:      open.length,
      openValue,
      won:       won.length,
      wonValue,
      lost:      lost.length,
      winRate:   closed > 0 ? Math.round((won.length / closed) * 100) : 0,
    }
  })
}

// ── Projected revenue from open deals using per-stage win rates ──────────────

function projectRevenue(openDeals: PipelineDeal[], stages: StageBreakdown[], avgTicket: number): number {
  const rateMap = Object.fromEntries(stages.map((s) => [s.stage, s.winRate / 100]))

  // Compound probability: deal at Reunión must pass Propuesta then Cierre
  const stageProb: Record<string, number> = {
    'Reunión':  (rateMap['Reunión']  || 0.3) * (rateMap['Propuesta'] || 0.5) * (rateMap['Cierre'] || 0.6),
    'Propuesta':(rateMap['Propuesta']|| 0.5) * (rateMap['Cierre']    || 0.6),
    'Cierre':   (rateMap['Cierre']   || 0.6),
  }

  return openDeals.reduce((sum, d) => {
    const prob = stageProb[d.stage] ?? 0.3
    return sum + (d.amount ?? avgTicket) * prob
  }, 0)
}

// ── Momentum score (0–100) per rep ───────────────────────────────────────────

function momentumScore(rep: RepAnalytics, pipeline: { wonCount: number; openCount: number; winRate: number }): number {
  // Activity component (40%): avg compliance over the period
  const actScore = Math.min(100, rep.avgCompliance)

  // Pipeline health (35%): win rate
  const pipeScore = Math.min(100, pipeline.winRate)

  // Activity trend (25%): is the last 2 weeks better than the first 2?
  const trend = rep.weeklyTrend
  const recent = trend.slice(-2).reduce((s, w) => s + w.pct, 0) / 2
  const early  = trend.slice(0, 2).reduce((s, w) => s + w.pct, 0) / 2
  const trendScore = Math.min(100, Math.max(0, 50 + (recent - early)))

  return Math.round(actScore * 0.40 + pipeScore * 0.35 + trendScore * 0.25)
}

function riskLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 65) return 'low'
  if (score >= 40) return 'medium'
  return 'high'
}

// ── Main fetch ────────────────────────────────────────────────────────────────

export async function fetchTeamPipeline(
  service: SupabaseClient,
  userIds: string[],
  activityReps: RepAnalytics[],
  startISO: string,
  endISO: string,
): Promise<TeamPipelineAnalytics> {
  if (userIds.length === 0) {
    return emptyPipeline()
  }

  // Fetch pipeline deals + recipe scenarios (for revenue goals + avg ticket)
  const [dealsRes, scenariosRes, profilesRes] = await Promise.all([
    service.from('pipeline_simple')
      .select('id,user_id,stage,status,prospect_type,entry_date,amount_usd,company_name')
      .in('user_id', userIds)
      .gte('entry_date', startISO)
      .lte('entry_date', endISO),
    service.from('recipe_scenarios')
      .select('user_id,monthly_revenue_goal,average_ticket,funnel_stages,outbound_rates,inbound_rates')
      .eq('is_active', true)
      .in('user_id', userIds),
    service.from('profiles')
      .select('id,full_name,email')
      .in('id', userIds),
  ])

  const rawDeals   = dealsRes.data     ?? []
  const scenarios  = scenariosRes.data ?? []
  const profiles   = profilesRes.data  ?? []

  const deals: PipelineDeal[] = rawDeals.map((d) => ({
    id:          d.id,
    userId:      d.user_id,
    stage:       d.stage as PipelineDeal['stage'],
    status:      d.status as PipelineDeal['status'],
    prospectType:d.prospect_type as PipelineDeal['prospectType'],
    entryDate:   d.entry_date,
    amount:      d.amount_usd,
    companyName: d.company_name,
  }))

  // Per-user avg ticket (fallback to team avg or 10 000)
  const ticketByUser = Object.fromEntries(scenarios.map((s) => [s.user_id, s.average_ticket ?? 10000]))
  const revenueGoalByUser = Object.fromEntries(scenarios.map((s) => [s.user_id, s.monthly_revenue_goal ?? 0]))
  const teamAvgTicket = scenarios.length > 0
    ? scenarios.reduce((s, sc) => s + (sc.average_ticket ?? 10000), 0) / scenarios.length
    : 10000
  const teamRevenueGoal = scenarios.length > 0
    ? scenarios.reduce((s, sc) => s + (sc.monthly_revenue_goal ?? 0), 0)
    : null

  // Build activity rep map for momentum scoring
  const actRepMap = Object.fromEntries(activityReps.map((r) => [r.userId, r]))

  // ── Per-rep stats ────────────────────────────────────────────────────────
  const byRep: RepPipelineStats[] = profiles.map((p) => {
    const repDeals  = deals.filter((d) => d.userId === p.id)
    const avgTicket = ticketByUser[p.id] ?? teamAvgTicket

    const open  = repDeals.filter((d) => d.status === 'abierto')
    const won   = repDeals.filter((d) => d.status === 'ganado')
    const lost  = repDeals.filter((d) => d.status === 'perdido')

    const openValue = open.reduce((s, d) => s + (d.amount ?? avgTicket), 0)
    const wonValue  = won.reduce((s, d) => s + (d.amount ?? avgTicket), 0)

    const closed  = won.length + lost.length
    const winRate = closed > 0 ? Math.round((won.length / closed) * 100) : 0

    const allClosed = [...won, ...lost]
    const avgDealSize = allClosed.length > 0
      ? allClosed.reduce((s, d) => s + (d.amount ?? avgTicket), 0) / allClosed.length
      : avgTicket

    const stages = computeStages(repDeals, avgTicket)

    const actRep = actRepMap[p.id]
    const mScore = actRep
      ? momentumScore(actRep, { wonCount: won.length, openCount: open.length, winRate })
      : Math.min(100, Math.round(winRate * 0.5))

    return {
      userId:     p.id,
      name:       p.full_name ?? p.email,
      email:      p.email,
      openCount:  open.length,
      openValue,
      wonCount:   won.length,
      wonValue,
      lostCount:  lost.length,
      winRate,
      avgDealSize: Math.round(avgDealSize),
      stages,
      momentumScore: mScore,
      riskLevel: riskLevel(mScore),
    }
  })

  byRep.sort((a, b) => b.momentumScore - a.momentumScore)

  // ── Team aggregates ──────────────────────────────────────────────────────
  const teamStages = computeStages(deals, teamAvgTicket)
  const teamOpenValue = byRep.reduce((s, r) => s + r.openValue, 0)
  const teamWonValue  = byRep.reduce((s, r) => s + r.wonValue, 0)

  const teamClosed = deals.filter((d) => d.status !== 'abierto').length
  const teamWon    = deals.filter((d) => d.status === 'ganado').length
  const teamWinRate = teamClosed > 0 ? Math.round((teamWon / teamClosed) * 100) : 0

  const teamClosedDeals = deals.filter((d) => d.status !== 'abierto')
  const teamAvgDealSize = teamClosedDeals.length > 0
    ? Math.round(teamClosedDeals.reduce((s, d) => s + (d.amount ?? teamAvgTicket), 0) / teamClosedDeals.length)
    : Math.round(teamAvgTicket)

  // ── Weekly revenue trend ────────────────────────────────────────────────
  const start   = parseISO(startISO)
  const end     = parseISO(endISO)
  const weeklyRevenueTrend: WeeklyRevenuePoint[] = []
  let cursor = startOfWeek(start, { weekStartsOn: 1 })
  while (cursor <= end) {
    const wEnd = endOfWeek(cursor, { weekStartsOn: 1 })
    const label = format(cursor, "d MMM", { locale: es })
    const inRange = (d: PipelineDeal) => d.entryDate >= toISO(cursor) && d.entryDate <= toISO(wEnd)
    const wWon  = deals.filter((d) => d.status === 'ganado'   && inRange(d)).reduce((s, d) => s + (d.amount ?? teamAvgTicket), 0)
    const wLost = deals.filter((d) => d.status === 'perdido'  && inRange(d)).reduce((s, d) => s + (d.amount ?? teamAvgTicket), 0)
    const wOpen = deals.filter((d) => d.status === 'abierto'  && inRange(d)).reduce((s, d) => s + (d.amount ?? teamAvgTicket), 0)
    weeklyRevenueTrend.push({ label, won: Math.round(wWon), lost: Math.round(wLost), open: Math.round(wOpen) })
    cursor = addWeeks(cursor, 1)
  }

  // ── Revenue projection ──────────────────────────────────────────────────
  const openDeals = deals.filter((d) => d.status === 'abierto')
  const projected = teamWonValue + Math.round(projectRevenue(openDeals, teamStages, teamAvgTicket))

  // ── 8-week forecast (4 historical + 4 predicted) ────────────────────────
  const wonPerWeek = weeklyRevenueTrend.map((w) => w.won)
  const sd = stddev(wonPerWeek)

  const forecastWeeks: ForecastPoint[] = weeklyRevenueTrend.map((w, i) => ({
    label:    w.label,
    actual:   w.won,
    forecast: w.won,
    lower:    Math.max(0, w.won - sd),
    upper:    w.won + sd,
  }))

  // Add 4 predicted weeks beyond endISO
  for (let i = 0; i < 4; i++) {
    const futureMonday = addWeeks(startOfWeek(end, { weekStartsOn: 1 }), i + 1)
    const label  = format(futureMonday, "d MMM", { locale: es })
    const x      = wonPerWeek.length + i
    const pred   = Math.round(lsPredict(wonPerWeek, x))
    forecastWeeks.push({
      label,
      actual:   null,
      forecast: pred,
      lower:    Math.max(0, pred - sd * 1.2),
      upper:    pred + sd * 1.2,
    })
  }

  // ── At-risk reps (low momentum + low pipeline) ──────────────────────────
  const atRiskRepIds = byRep
    .filter((r) => r.riskLevel === 'high' || (r.riskLevel === 'medium' && r.openCount === 0))
    .map((r) => r.userId)

  // ── Avg days to close ───────────────────────────────────────────────────
  const closedDealsWithDates = deals.filter((d) => d.status !== 'abierto')
  const avgDaysToClose = closedDealsWithDates.length > 0
    ? Math.round(closedDealsWithDates.reduce((s, d) => s + Math.abs(differenceInDays(parseISO(endISO), parseISO(d.entryDate))), 0) / closedDealsWithDates.length)
    : 0

  // ── Scatter data: activity compliance vs won value ──────────────────────
  const scatterData = byRep.map((r) => {
    const actRep = actRepMap[r.userId]
    return {
      repName:    r.name.split(' ')[0],
      compliance: actRep?.avgCompliance ?? 0,
      wonValue:   r.wonValue,
      openValue:  r.openValue,
    }
  })

  // ── Inbound vs outbound breakdown ───────────────────────────────────────
  const inboundVsOutbound = ['inbound', 'outbound'].map((type) => {
    const typeDeals = deals.filter((d) => d.prospectType === type)
    const tWon  = typeDeals.filter((d) => d.status === 'ganado').length
    const tLost = typeDeals.filter((d) => d.status === 'perdido').length
    const tOpen = typeDeals.filter((d) => d.status === 'abierto').length
    const closed = tWon + tLost
    return {
      type: type === 'inbound' ? 'Inbound' : 'Outbound',
      won:    tWon,
      lost:   tLost,
      open:   tOpen,
      winRate: closed > 0 ? Math.round((tWon / closed) * 100) : 0,
    }
  })

  return {
    byRep,
    teamStages,
    teamOpenValue,
    teamWonValue,
    teamWinRate,
    teamAvgDealSize,
    weeklyRevenueTrend,
    projectedRevenue: projected,
    revenueGoal:      teamRevenueGoal,
    forecastWeeks,
    atRiskRepIds,
    avgDaysToClose,
    scatterData,
    inboundVsOutbound,
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

// ── Build context for AI prompt ───────────────────────────────────────────────

export function buildPipelineContext(p: TeamPipelineAnalytics): string {
  const lines: string[] = [
    `=== PIPELINE DEL EQUIPO ===`,
    `Valor total en pipeline abierto: $${p.teamOpenValue.toLocaleString()}`,
    `Ingresos ganados en el período: $${p.teamWonValue.toLocaleString()}`,
    `Tasa de cierre del equipo: ${p.teamWinRate}%`,
    `Ticket promedio: $${p.teamAvgDealSize.toLocaleString()}`,
    `Días promedio a cierre: ${p.avgDaysToClose}`,
    p.revenueGoal ? `Meta de ingresos: $${p.revenueGoal.toLocaleString()}` : '',
    `Proyección de ingresos (basada en pipeline actual): $${p.projectedRevenue.toLocaleString()}`,
    ``,
    `=== ETAPAS DEL FUNNEL ===`,
    ...p.teamStages.map((s) =>
      `${s.stage}: ${s.open} abiertos ($${s.openValue.toLocaleString()}), ${s.won} ganados ($${s.wonValue.toLocaleString()}), ${s.lost} perdidos, tasa cierre ${s.winRate}%`
    ),
    ``,
    `=== INBOUND VS OUTBOUND ===`,
    ...p.inboundVsOutbound.map((t) =>
      `${t.type}: ${t.open} abiertos, ${t.won} ganados, ${t.lost} perdidos, win rate ${t.winRate}%`
    ),
    ``,
    `=== PIPELINE POR VENDEDOR ===`,
    ...p.byRep.map((r) =>
      `${r.name}: Momentum ${r.momentumScore}/100 (${r.riskLevel}), ${r.openCount} deals abiertos ($${r.openValue.toLocaleString()}), ${r.wonCount} ganados ($${r.wonValue.toLocaleString()}), win rate ${r.winRate}%`
    ),
  ]
  return lines.filter(Boolean).join('\n')
}
