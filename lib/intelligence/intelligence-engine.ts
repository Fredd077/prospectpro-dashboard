import { differenceInDays, getDaysInMonth, endOfMonth, parseISO } from 'date-fns'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { hashReportData } from '@/lib/utils/intelligence-hash'
import { getCachedReport, saveReport } from '@/lib/queries/intelligence-reports'
import { runAgentDiagnostico, runAgentDiagnosticoGerente, type DiagnosticoInput, type DiagnosticoGerenteInput } from './agent-diagnostico'
import { runAgentPrediccion, runAgentPrediccionGerente, type PrediccionInput, type PrediccionGerenteInput } from './agent-prediccion'
import { runAgentRedactor, runAgentRedactorGerente, type RedactorInput, type RedactorGerenteInput } from './agent-redactor'
import type { IntelligenceReport, Json } from '@/lib/types/database'
import { toISODate, todayISO } from '@/lib/utils/dates'
import { getAiConfig } from '@/lib/utils/ai-config'
import { _fetchActivityEffectiveness, type ActivityEffectivenessItem } from '@/lib/utils/coach-context'

/** Count working days (Mon-Fri) from startISO to endISO inclusive. Pure UTC arithmetic. */
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

/** Compute period status and working-day breakdown relative to today (Colombia time). */
function computePeriodContext(periodStart: string, periodEnd: string, periodType: 'daily' | 'weekly' | 'monthly') {
  const today = todayISO()
  const period_status: 'en_curso' | 'cerrado' = today <= periodEnd ? 'en_curso' : 'cerrado'

  // Compute total calendar days in period
  let totalDaysInPeriod: number
  let daysElapsed: number
  if (periodType === 'daily') {
    totalDaysInPeriod = 1
    daysElapsed = 1
  } else if (periodType === 'weekly') {
    totalDaysInPeriod = differenceInDays(parseISO(periodEnd), parseISO(periodStart)) + 1
    const cap = period_status === 'en_curso' ? today : periodEnd
    daysElapsed = Math.min(differenceInDays(parseISO(cap), parseISO(periodStart)) + 1, totalDaysInPeriod)
  } else {
    const monthBase = parseISO(periodStart.slice(0, 8) + '01')
    totalDaysInPeriod = getDaysInMonth(monthBase)
    if (period_status === 'cerrado') {
      daysElapsed = totalDaysInPeriod
    } else {
      daysElapsed = Math.min(differenceInDays(parseISO(today), monthBase) + 1, totalDaysInPeriod)
    }
  }

  // Working-day breakdown
  const effectiveEnd = period_status === 'en_curso' ? today : periodEnd
  const dias_habiles_transcurridos = workingDaysBetween(periodStart, effectiveEnd)
  const dias_habiles_totales = workingDaysBetween(periodStart, periodEnd)

  // Tomorrow in Bogota (UTC-safe noon)
  const [ty, tm, td] = today.split('-').map(Number)
  const tomorrow = toISODate(new Date(Date.UTC(ty, tm - 1, td + 1, 12)))
  const dias_habiles_restantes =
    period_status === 'en_curso' && tomorrow <= periodEnd
      ? workingDaysBetween(tomorrow, periodEnd)
      : 0

  return { today, period_status, totalDaysInPeriod, daysElapsed, dias_habiles_transcurridos, dias_habiles_restantes, dias_habiles_totales }
}

class NoDataError extends Error {
  code = 'NO_DATA'
  constructor(msg: string) { super(msg) }
}

// ── Métricas deterministas de citas y canales (no IA) ─────────────────────────
// El protagonista del nuevo reporte: ¿alcanzaremos las citas requeridas para la
// meta?, y ¿qué canales convierten mejor actividad en citas/cierres?

export interface CitasMetrics {
  requeridas: number   // citas necesarias para la meta (cierres/última tasa del funnel)
  reales: number       // citas generadas hasta la fecha (origen real en pipeline)
  proyectadas: number  // proyección al cierre del mes al ritmo actual (días hábiles)
  alcanza: boolean     // proyectadas >= requeridas
}
export interface ChannelItem { canal: string; conversion: number; cierre: number }
export interface ChannelsMetrics { fortalezas: ChannelItem[]; debilidades: ChannelItem[] }

// Etapas donde la reunión ya se ejecutó (= "cita real"), igual que el Recetario.
const REUNION_STAGES = new Set([
  'Primera reu ejecutada/Propuesta en preparación',
  'Propuesta Presentada',
  'Por facturar/cobrar',
])

function lastRatePct(outboundRates: number[] | null | undefined): number {
  const arr = outboundRates ?? []
  return (arr[arr.length - 1] ?? 30) / 100
}

/** Citas requeridas para la meta mensual = (meta / ticket) / última tasa de cierre. */
function citasRequeridas(monthlyGoal: number, avgTicket: number, outboundRates: number[] | null | undefined): number {
  const last = lastRatePct(outboundRates)
  const cierresReq = avgTicket > 0 ? monthlyGoal / avgTicket : 0
  return last > 0 ? cierresReq / last : 0
}

/** Proyección lineal de citas al cierre del mes por días hábiles (sin IA). */
function projectCitas(citasReales: number, monthStart: string, monthEnd: string, today: string): number {
  if (today > monthEnd) return Math.round(citasReales) // mes cerrado: sin extrapolar
  const wdElapsed = workingDaysBetween(monthStart, today)
  const wdTotal = workingDaysBetween(monthStart, monthEnd)
  return wdElapsed > 0 ? Math.round((citasReales / wdElapsed) * wdTotal) : Math.round(citasReales)
}

/** Top-2 canales por conversión a cita (fortalezas) y bottom-2 (debilidades). */
function buildChannels(eff: ActivityEffectivenessItem[]): ChannelsMetrics {
  const byConv = eff.filter((e) => e.executions > 0).sort((a, b) => b.conversionToMeeting - a.conversionToMeeting)
  const fortalezas = byConv.slice(0, 2).map((e) => ({ canal: e.name, conversion: e.conversionToMeeting, cierre: e.closeProbability }))
  const fortNames = new Set(fortalezas.map((f) => f.canal))
  const debilidades = [...byConv].reverse().filter((e) => !fortNames.has(e.name)).slice(0, 2)
    .map((e) => ({ canal: e.name, conversion: e.conversionToMeeting, cierre: e.closeProbability }))
  return { fortalezas, debilidades }
}

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
    sb.from('recipe_scenarios').select('name,monthly_revenue_goal,average_ticket,outbound_pct,funnel_stages,outbound_rates').eq('user_id', userId).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
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

  const activityEffectiveness = await _fetchActivityEffectiveness(
    sb as Parameters<typeof _fetchActivityEffectiveness>[0],
    periodStart, periodEnd, userId,
  )

  // ── Métricas protagonistas: citas (requeridas/reales/proyectadas) y canales ──
  const nowISO = todayISO()
  const citasReq = scenario
    ? citasRequeridas(scenario.monthly_revenue_goal, scenario.average_ticket, scenario.outbound_rates as number[] | null)
    : 0
  // citas reales del MES (reunión ejecutada), coherente con citasReq mensual,
  // independiente del tipo de período del reporte.
  const citasReales = by_stage.filter((s) => REUNION_STAGES.has(s.stage)).reduce((acc, s) => acc + s.count, 0)
  const citasProy = projectCitas(citasReales, monthStart, monthEnd, nowISO)
  const citas: CitasMetrics = {
    requeridas: Math.round(citasReq),
    reales: Math.round(citasReales),
    proyectadas: citasProy,
    alcanza: citasReq > 0 ? citasProy >= citasReq : false,
  }
  const channels = buildChannels(activityEffectiveness)

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
    activityEffectiveness,
    citas,
    channels,
  }
}

function periodLabel(periodType: string, periodStart: string, periodEnd: string): string {
  if (periodType === 'daily') return periodStart
  if (periodType === 'weekly') return `Semana del ${periodStart} al ${periodEnd}`
  const [year, month] = periodStart.split('-')
  const names = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return `${names[parseInt(month) - 1]} ${year}`
}

const VENDEDOR_CONFIG_DEFAULTS = { tone: 'motivacional', maxTokens: 1500, extraInstructions: '' }
const GERENTE_CONFIG_DEFAULTS  = { tone: 'analítico',    maxTokens: 2000, extraInstructions: '' }

export async function generateVendedorReport(params: VendedorReportParams): Promise<IntelligenceReport> {
  const { userId, periodType, periodStart, periodEnd } = params
  console.log('[generateVendedorReport] start', { userId, periodType, periodStart })

  const [data, rawConfig] = await Promise.all([
    gatherData(params),
    getAiConfig('intelligence_vendedor', getSupabaseServiceClient()).catch((err: unknown) => {
      console.warn('[generateVendedorReport] getAiConfig failed, using defaults:', (err as Error)?.message)
      return null
    }),
  ])
  const aiConfig = rawConfig ?? VENDEDOR_CONFIG_DEFAULTS
  console.log('[generateVendedorReport] config loaded', { tone: aiConfig.tone, maxTokens: aiConfig.maxTokens })

  // No-data guard — don't call agents if period has no meaningful data
  const totalActivity = data.activities.reduce((s, a) => s + a.real, 0)
  const totalPipeline = data.pipeline.closed_amount + data.pipeline.open_amount
  if (totalActivity === 0 && totalPipeline === 0) {
    throw new NoDataError('No hay datos registrados en este período. Selecciona otro período o registra actividad.')
  }

  const ctx = computePeriodContext(periodStart, periodEnd, periodType)
  const { today, period_status, totalDaysInPeriod, daysElapsed, dias_habiles_transcurridos, dias_habiles_restantes, dias_habiles_totales } = ctx

  const dataHash = hashReportData({
    ...data, periodType, periodStart, periodEnd,
    configTone: aiConfig.tone, configMaxTokens: aiConfig.maxTokens,
    ...(period_status === 'en_curso' ? { generation_date: today } : {}),
  })

  const cached = await getCachedReport(userId, 'vendedor', periodType, periodStart, periodEnd, dataHash)
  if (cached) return cached

  const label = periodLabel(periodType, periodStart, periodEnd)

  const diagnosticoInput: DiagnosticoInput = {
    userName: data.userName,
    periodLabel: label,
    recipe: data.recipe,
    activities: data.activities,
    pipeline: data.pipeline,
    overall_compliance: data.overall_compliance,
  }
  console.log('[generateVendedorReport] running diagnostico agent')
  const diagnostico = await runAgentDiagnostico(diagnosticoInput)

  const prediccionInput: PrediccionInput = {
    diagnostico,
    periodType,
    periodStart,
    periodEnd,
    period_status,
    daysElapsed,
    totalDaysInPeriod,
    dias_habiles_transcurridos,
    dias_habiles_restantes,
    dias_habiles_totales,
    monthly_goal: data.recipe?.monthly_goal ?? 0,
    closed_amount: data.pipeline.closed_amount,
    open_amount: data.pipeline.open_amount,
    avg_ticket: data.recipe?.avg_ticket ?? 0,
  }
  console.log('[generateVendedorReport] running prediccion agent')
  const prediccion = await runAgentPrediccion(prediccionInput)

  const redactorInput: RedactorInput = {
    userName: data.userName,
    periodLabel: label,
    period_status,
    dias_habiles_restantes,
    dias_habiles_totales,
    diagnostico,
    prediccion,
    citas: data.citas,
    channels: data.channels,
    activityEffectiveness: data.activityEffectiveness.length ? data.activityEffectiveness : undefined,
  }
  console.log('[generateVendedorReport] running redactor agent')
  const reportContent = await runAgentRedactor(redactorInput, {
    tone: aiConfig.tone,
    maxTokens: aiConfig.maxTokens,
    extraInstructions: aiConfig.extraInstructions,
  })
  // Inyecta los números deterministas (no IA) para que sean exactos en la tarjeta.
  reportContent.citas = data.citas
  reportContent.canales = data.channels

  const confidence_level: 'inicial' | 'parcial' | 'completo' =
    period_status === 'cerrado' ? 'completo' :
    daysElapsed <= 5 ? 'inicial' :
    daysElapsed <= 20 ? 'parcial' : 'completo'

  console.log('[generateVendedorReport] saving report')
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

/** Efectividad por canal agregada del equipo (suma por nombre de actividad entre miembros). */
async function fetchTeamChannels(
  sb: ReturnType<typeof getSupabaseServiceClient>,
  memberIds: string[],
  start: string,
  end: string,
): Promise<ActivityEffectivenessItem[]> {
  const perMember = await Promise.all(
    memberIds.map((id) => _fetchActivityEffectiveness(sb as Parameters<typeof _fetchActivityEffectiveness>[0], start, end, id)),
  )
  const agg: Record<string, { type: 'OUTBOUND' | 'INBOUND'; exec: number; meet: number; close: number }> = {}
  for (const list of perMember) {
    for (const e of list) {
      const cur = agg[e.name] ?? { type: e.type, exec: 0, meet: 0, close: 0 }
      cur.exec += e.executions
      cur.meet += e.estimatedMeetings
      cur.close += e.estimatedCloses
      agg[e.name] = cur
    }
  }
  return Object.entries(agg)
    .map(([name, v]) => ({
      name, type: v.type, executions: v.exec, estimatedMeetings: v.meet, estimatedCloses: v.close,
      conversionToMeeting: v.exec > 0 ? Math.round((v.meet / v.exec) * 100) : 0,
      closeProbability: v.meet > 0 ? Math.round((v.close / v.meet) * 100) : 0,
    }))
    .filter((i) => i.executions > 0)
    .sort((a, b) => b.conversionToMeeting - a.conversionToMeeting)
}

async function gatherTeamData(
  managerUserId: string,
  periodType: VendedorReportParams['periodType'],
  periodStart: string,
  periodEnd: string,
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
    sb.from('activity_logs').select('user_id,activity_id,real_executed').in('user_id', memberIds).gte('log_date', periodStart).lte('log_date', periodEnd),
    sb.from('pipeline_simple').select('user_id,status,amount_usd').in('user_id', memberIds).gte('entry_date', monthStart).lte('entry_date', monthEnd),
    sb.from('recipe_scenarios').select('user_id,monthly_revenue_goal,average_ticket,outbound_rates').in('user_id', memberIds).eq('is_active', true),
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

  // ── Métricas protagonistas del equipo: canales agregados + citas ──
  const nowISO = todayISO()
  const teamChannelItems = await fetchTeamChannels(sb, memberIds, monthStart, nowISO)
  const channels = buildChannels(teamChannelItems)
  const citasReqTotal = (allScenarios ?? []).reduce(
    (s, sc) => s + citasRequeridas(sc.monthly_revenue_goal, sc.average_ticket, sc.outbound_rates as number[] | null), 0,
  )
  const citasReales = teamChannelItems.reduce((s, e) => s + e.estimatedMeetings, 0)
  const citasProy = projectCitas(citasReales, monthStart, monthEnd, nowISO)
  const citas: CitasMetrics = {
    requeridas: Math.round(citasReqTotal),
    reales: Math.round(citasReales),
    proyectadas: citasProy,
    alcanza: citasReqTotal > 0 ? citasProy >= citasReqTotal : false,
  }

  return {
    managerName: manager.full_name ?? 'Gerente',
    members: memberRows,
    monthly_goal_total: memberRows.reduce((s, m) => s + m.monthly_goal, 0),
    citas,
    channels,
  }
}

export async function generateGerenteReport(params: GerenteReportParams): Promise<IntelligenceReport> {
  const { managerUserId, periodType, periodStart, periodEnd } = params
  console.log('[generateGerenteReport] start', { managerUserId, periodType, periodStart })

  const [teamData, rawConfig] = await Promise.all([
    gatherTeamData(managerUserId, periodType, periodStart, periodEnd),
    getAiConfig('intelligence_gerente', getSupabaseServiceClient()).catch((err: unknown) => {
      console.warn('[generateGerenteReport] getAiConfig failed, using defaults:', (err as Error)?.message)
      return null
    }),
  ])
  const aiConfig = rawConfig ?? GERENTE_CONFIG_DEFAULTS
  console.log('[generateGerenteReport] config loaded', { tone: aiConfig.tone, maxTokens: aiConfig.maxTokens })

  // No-data guard — don't call agents if team has no meaningful data for the period
  const totalTeamActivity = teamData.members.reduce(
    (s, m) => s + m.activities.reduce((as, a) => as + a.real, 0), 0
  )
  const totalTeamPipeline = teamData.members.reduce(
    (s, m) => s + m.pipeline.closed_amount + m.pipeline.open_amount, 0
  )
  if (totalTeamActivity === 0 && totalTeamPipeline === 0) {
    throw new NoDataError('No hay datos registrados en este período para el equipo. Selecciona otro período o registra actividad.')
  }

  const ctx = computePeriodContext(periodStart, periodEnd, periodType)
  const { today, period_status, totalDaysInPeriod, daysElapsed, dias_habiles_transcurridos, dias_habiles_restantes, dias_habiles_totales } = ctx

  const dataHash = hashReportData({
    ...teamData, periodType, periodStart, periodEnd,
    configTone: aiConfig.tone, configMaxTokens: aiConfig.maxTokens,
    ...(period_status === 'en_curso' ? { generation_date: today } : {}),
  })

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

  const prediccionInput: PrediccionGerenteInput = {
    diagnostico,
    periodType,
    period_status,
    monthly_goal_total: teamData.monthly_goal_total,
    closed_amount_total: total_closed,
    open_amount_total: total_open,
    daysElapsed,
    totalDaysInPeriod,
    dias_habiles_transcurridos,
    dias_habiles_restantes,
    dias_habiles_totales,
    teamSize: members.length,
  }
  const prediccion = await runAgentPrediccionGerente(prediccionInput)

  const redactorInput: RedactorGerenteInput = {
    managerName: teamData.managerName,
    periodLabel: label,
    period_status,
    dias_habiles_restantes,
    dias_habiles_totales,
    diagnostico,
    prediccion,
    citas: teamData.citas,
    channels: teamData.channels,
    members: members.map((m) => ({ userName: m.userName, overall_compliance: m.overall_compliance })),
  }
  const reportContent = await runAgentRedactorGerente(redactorInput, {
    tone: aiConfig.tone,
    maxTokens: aiConfig.maxTokens,
    extraInstructions: aiConfig.extraInstructions,
  })
  // Inyecta los números deterministas (no IA) para que sean exactos en la tarjeta.
  reportContent.citas = teamData.citas
  reportContent.canales = teamData.channels

  const confidence_level: 'inicial' | 'parcial' | 'completo' =
    period_status === 'cerrado' ? 'completo' :
    daysElapsed <= 5 ? 'inicial' :
    daysElapsed <= 20 ? 'parcial' : 'completo'

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
