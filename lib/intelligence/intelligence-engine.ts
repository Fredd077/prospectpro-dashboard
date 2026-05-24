import { differenceInDays, getDaysInMonth, endOfMonth, parseISO } from 'date-fns'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { hashReportData } from '@/lib/utils/intelligence-hash'
import { getCachedReport, saveReport } from '@/lib/queries/intelligence-reports'
import { runAgentDiagnostico, runAgentDiagnosticoGerente, type DiagnosticoInput, type DiagnosticoGerenteInput } from './agent-diagnostico'
import { runAgentPrediccion, runAgentPrediccionGerente, type PrediccionInput, type PrediccionGerenteInput } from './agent-prediccion'
import { runAgentRedactor, runAgentRedactorGerente, type RedactorInput, type RedactorGerenteInput } from './agent-redactor'
import type { IntelligenceReport, Json } from '@/lib/types/database'
import { toISODate } from '@/lib/utils/dates'

export interface VendedorReportParams {
  userId: string
  periodType: 'daily' | 'weekly' | 'monthly'
  periodStart: string
  periodEnd: string
}

async function gatherData(params: VendedorReportParams) {
  const { userId, periodType, periodStart, periodEnd } = params
  const sb = getSupabaseServiceClient()

  const monthStart = periodStart.slice(0, 8) + '01'
  const monthEnd = toISODate(endOfMonth(parseISO(monthStart)))

  const [
    { data: profile },
    { data: activities },
    { data: logs },
    { data: pipelineRows },
    { data: scenario },
  ] = await Promise.all([
    sb.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
    sb.from('activities').select('id,name,type,daily_goal,weekly_goal,monthly_goal').eq('user_id', userId).eq('status', 'active'),
    sb.from('activity_logs').select('activity_id,real_executed').eq('user_id', userId).gte('log_date', periodStart).lte('log_date', periodEnd),
    sb.from('pipeline_simple').select('stage,status,amount_usd').eq('user_id', userId).gte('entry_date', monthStart).lte('entry_date', monthEnd),
    sb.from('recipe_scenarios').select('name,monthly_revenue_goal,average_ticket,outbound_pct,funnel_stages').eq('user_id', userId).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  const userName = profile?.full_name ?? 'Vendedor'

  const realMap: Record<string, number> = {}
  for (const log of logs ?? []) {
    realMap[log.activity_id] = (realMap[log.activity_id] ?? 0) + log.real_executed
  }

  const activityData = (activities ?? []).map((a) => {
    const goal =
      periodType === 'daily' ? (a.daily_goal ?? 0) :
      periodType === 'weekly' ? (a.weekly_goal ?? (a.daily_goal ?? 0) * 5) :
      (a.monthly_goal ?? (a.daily_goal ?? 0) * 22)
    const real = realMap[a.id] ?? 0
    return {
      name: a.name,
      type: a.type as 'OUTBOUND' | 'INBOUND',
      goal,
      real,
      compliance_pct: goal > 0 ? Math.round((real / goal) * 100) : 0,
    }
  })

  const totalGoal = activityData.reduce((s, a) => s + a.goal, 0)
  const totalReal = activityData.reduce((s, a) => s + a.real, 0)
  const overall_compliance = totalGoal > 0 ? Math.round((totalReal / totalGoal) * 100) : 0

  const stageMap: Record<string, { count: number; amount: number }> = {}
  let open_amount = 0
  let closed_amount = 0
  let won_count = 0
  let lost_count = 0

  for (const row of pipelineRows ?? []) {
    if (!stageMap[row.stage]) stageMap[row.stage] = { count: 0, amount: 0 }
    stageMap[row.stage].count++
    stageMap[row.stage].amount += row.amount_usd ?? 0
    if (row.status === 'ganado') {
      won_count++
      closed_amount += row.amount_usd ?? 0
    } else if (row.status === 'perdido') {
      lost_count++
    } else {
      open_amount += row.amount_usd ?? 0
    }
  }

  const by_stage = Object.entries(stageMap).map(([stage, { count, amount }]) => ({ stage, count, amount }))

  return {
    userName,
    activities: activityData,
    overall_compliance,
    pipeline: { open_amount, closed_amount, won_count, lost_count, by_stage },
    recipe: scenario ? {
      name: scenario.name,
      monthly_goal: scenario.monthly_revenue_goal,
      avg_ticket: scenario.average_ticket,
      outbound_pct: scenario.outbound_pct,
      funnel_stages: (scenario.funnel_stages ?? []) as string[],
    } : null,
  }
}

function periodLabel(periodType: string, periodStart: string, periodEnd: string): string {
  if (periodType === 'daily') return periodStart
  if (periodType === 'weekly') return `Semana del ${periodStart} al ${periodEnd}`
  const [year, month] = periodStart.split('-')
  const names = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return `${names[parseInt(month) - 1]} ${year}`
}

export async function generateVendedorReport(params: VendedorReportParams): Promise<IntelligenceReport> {
  const { userId, periodType, periodStart, periodEnd } = params

  const data = await gatherData(params)
  const dataHash = hashReportData({ ...data, periodType, periodStart, periodEnd })

  const cached = await getCachedReport(userId, 'vendedor', periodType, periodStart, periodEnd, dataHash)
  if (cached) return cached

  const label = periodLabel(periodType, periodStart, periodEnd)
  const now = new Date()
  const monthStart = parseISO(periodStart.slice(0, 8) + '01')
  const daysElapsed = Math.min(differenceInDays(now, monthStart) + 1, getDaysInMonth(monthStart))
  const totalDaysInPeriod = getDaysInMonth(monthStart)

  const diagnosticoInput: DiagnosticoInput = {
    userName: data.userName,
    periodLabel: label,
    recipe: data.recipe,
    activities: data.activities,
    pipeline: data.pipeline,
    overall_compliance: data.overall_compliance,
  }
  const diagnostico = await runAgentDiagnostico(diagnosticoInput)

  const prediccionInput: PrediccionInput = {
    diagnostico,
    periodType,
    periodStart,
    periodEnd,
    daysElapsed,
    totalDaysInPeriod,
    monthly_goal: data.recipe?.monthly_goal ?? 0,
    closed_amount: data.pipeline.closed_amount,
    open_amount: data.pipeline.open_amount,
    avg_ticket: data.recipe?.avg_ticket ?? 0,
  }
  const prediccion = await runAgentPrediccion(prediccionInput)

  const redactorInput: RedactorInput = {
    userName: data.userName,
    periodLabel: label,
    diagnostico,
    prediccion,
  }
  const reportContent = await runAgentRedactor(redactorInput)

  const confidence_level: 'inicial' | 'parcial' | 'completo' =
    daysElapsed <= 5 ? 'inicial' :
    daysElapsed <= 20 ? 'parcial' : 'completo'

  return saveReport({
    user_id: userId,
    report_audience: 'vendedor',
    period_type: periodType,
    period_start: periodStart,
    period_end: periodEnd,
    data_hash: dataHash,
    report_content: reportContent as unknown as Json,
    agent_diagnostico: diagnostico as unknown as Json,
    agent_prediccion: prediccion as unknown as Json,
    confidence_level,
    periods_analyzed: 1,
  })
}

// ── Gerente report ────────────────────────────────────────────────────────────

export interface GerenteReportParams {
  managerUserId: string
  periodType: 'daily' | 'weekly' | 'monthly'
  periodStart: string
  periodEnd: string
}

interface TeamMemberRow {
  userId: string
  userName: string
  activities: { name: string; type: string; goal: number; real: number; compliance_pct: number }[]
  overall_compliance: number
  pipeline: { open_amount: number; closed_amount: number; won_count: number; lost_count: number }
  monthly_goal: number
}

async function gatherTeamData(
  managerUserId: string,
  periodType: VendedorReportParams['periodType'],
  periodStart: string,
) {
  const sb = getSupabaseServiceClient()
  const monthStart = periodStart.slice(0, 8) + '01'
  const monthEnd = toISODate(endOfMonth(parseISO(monthStart)))

  const { data: manager } = await sb
    .from('profiles')
    .select('full_name, company, is_player_coach')
    .eq('id', managerUserId)
    .single()

  if (!manager?.company) throw new Error('Manager has no company set')

  const { data: allTeam } = await sb
    .from('profiles')
    .select('id, full_name')
    .eq('company', manager.company)
    .in('role', ['active', 'admin'])

  let members = (allTeam ?? []) as { id: string; full_name: string | null }[]
  if (!manager.is_player_coach) {
    members = members.filter((m) => m.id !== managerUserId)
  } else if (!members.some((m) => m.id === managerUserId)) {
    members = [...members, { id: managerUserId, full_name: manager.full_name }]
  }

  if (!members.length) throw new Error(`No team members found for company: ${manager.company}`)

  const memberIds = members.map((m) => m.id)

  const [
    { data: allActivities },
    { data: allLogs },
    { data: allPipeline },
    { data: allScenarios },
  ] = await Promise.all([
    sb.from('activities').select('id,user_id,name,type,daily_goal,weekly_goal,monthly_goal').in('user_id', memberIds).eq('status', 'active'),
    sb.from('activity_logs').select('user_id,activity_id,real_executed').in('user_id', memberIds).gte('log_date', periodStart).lte('log_date', monthEnd),
    sb.from('pipeline_simple').select('user_id,status,amount_usd').in('user_id', memberIds).gte('entry_date', monthStart).lte('entry_date', monthEnd),
    sb.from('recipe_scenarios').select('user_id,monthly_revenue_goal').in('user_id', memberIds).eq('is_active', true),
  ])

  const memberRows: TeamMemberRow[] = members.map((member) => {
    const uid = member.id
    const activities = (allActivities ?? []).filter((a) => a.user_id === uid)
    const logs = (allLogs ?? []).filter((l) => l.user_id === uid)
    const pipeline = (allPipeline ?? []).filter((p) => p.user_id === uid)
    const scenario = (allScenarios ?? []).find((s) => s.user_id === uid)

    const realMap: Record<string, number> = {}
    for (const log of logs) {
      realMap[log.activity_id] = (realMap[log.activity_id] ?? 0) + log.real_executed
    }

    const activityData = activities.map((a) => {
      const goal = periodType === 'daily' ? (a.daily_goal ?? 0)
        : periodType === 'weekly' ? (a.weekly_goal ?? (a.daily_goal ?? 0) * 5)
        : (a.monthly_goal ?? (a.daily_goal ?? 0) * 22)
      const real = realMap[a.id] ?? 0
      return { name: a.name, type: a.type as string, goal, real, compliance_pct: goal > 0 ? Math.round((real / goal) * 100) : 0 }
    })

    const totalGoal = activityData.reduce((s, a) => s + a.goal, 0)
    const totalReal = activityData.reduce((s, a) => s + a.real, 0)

    let open_amount = 0, closed_amount = 0, won_count = 0, lost_count = 0
    for (const row of pipeline) {
      if (row.status === 'ganado') { won_count++; closed_amount += row.amount_usd ?? 0 }
      else if (row.status === 'perdido') { lost_count++ }
      else { open_amount += row.amount_usd ?? 0 }
    }

    return {
      userId: uid,
      userName: member.full_name ?? 'Vendedor',
      activities: activityData,
      overall_compliance: totalGoal > 0 ? Math.round((totalReal / totalGoal) * 100) : 0,
      pipeline: { open_amount, closed_amount, won_count, lost_count },
      monthly_goal: scenario?.monthly_revenue_goal ?? 0,
    }
  })

  return {
    managerName: manager.full_name ?? 'Gerente',
    members: memberRows,
    monthly_goal_total: memberRows.reduce((s, m) => s + m.monthly_goal, 0),
  }
}

export async function generateGerenteReport(params: GerenteReportParams): Promise<IntelligenceReport> {
  const { managerUserId, periodType, periodStart, periodEnd } = params

  const teamData = await gatherTeamData(managerUserId, periodType, periodStart)
  const dataHash = hashReportData({ ...teamData, periodType, periodStart, periodEnd })

  const cached = await getCachedReport(managerUserId, 'gerente', periodType, periodStart, periodEnd, dataHash)
  if (cached) return cached

  const label = periodLabel(periodType, periodStart, periodEnd)
  const { members } = teamData
  const avg_compliance = members.length > 0
    ? Math.round(members.reduce((s, m) => s + m.overall_compliance, 0) / members.length)
    : 0
  const total_closed = members.reduce((s, m) => s + m.pipeline.closed_amount, 0)
  const total_open = members.reduce((s, m) => s + m.pipeline.open_amount, 0)

  const diagnosticoInput: DiagnosticoGerenteInput = {
    managerName: teamData.managerName,
    periodLabel: label,
    teamSize: members.length,
    members: members.map((m) => ({
      userName: m.userName,
      overall_compliance: m.overall_compliance,
      activities: m.activities,
      pipeline: m.pipeline,
    })),
    teamAggregates: {
      avg_compliance,
      total_closed_amount: total_closed,
      total_open_amount: total_open,
      members_at_risk: members.filter((m) => m.overall_compliance < 70).length,
      members_on_track: members.filter((m) => m.overall_compliance >= 70).length,
      monthly_goal_total: teamData.monthly_goal_total,
    },
  }
  const diagnostico = await runAgentDiagnosticoGerente(diagnosticoInput)

  const now = new Date()
  const monthBase = parseISO(periodStart.slice(0, 8) + '01')
  const daysElapsed = Math.min(differenceInDays(now, monthBase) + 1, getDaysInMonth(monthBase))

  const prediccionInput: PrediccionGerenteInput = {
    diagnostico,
    periodType,
    monthly_goal_total: teamData.monthly_goal_total,
    closed_amount_total: total_closed,
    open_amount_total: total_open,
    daysElapsed,
    totalDaysInPeriod: getDaysInMonth(monthBase),
    teamSize: members.length,
  }
  const prediccion = await runAgentPrediccionGerente(prediccionInput)

  const redactorInput: RedactorGerenteInput = {
    managerName: teamData.managerName,
    periodLabel: label,
    diagnostico,
    prediccion,
    members: members.map((m) => ({ userName: m.userName, overall_compliance: m.overall_compliance })),
  }
  const reportContent = await runAgentRedactorGerente(redactorInput)

  const confidence_level: 'inicial' | 'parcial' | 'completo' =
    daysElapsed <= 5 ? 'inicial' : daysElapsed <= 20 ? 'parcial' : 'completo'

  return saveReport({
    user_id: managerUserId,
    report_audience: 'gerente',
    period_type: periodType,
    period_start: periodStart,
    period_end: periodEnd,
    data_hash: dataHash,
    report_content: reportContent as unknown as Json,
    agent_diagnostico: diagnostico as unknown as Json,
    agent_prediccion: prediccion as unknown as Json,
    confidence_level,
    periods_analyzed: members.length,
  })
}
