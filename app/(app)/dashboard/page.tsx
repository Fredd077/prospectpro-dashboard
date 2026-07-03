import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { startOfWeek, parseISO, isValid, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Activity, BarChart2, TrendingUp, Target } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { PeriodSelector } from '@/components/dashboard/PeriodSelector'
import { DateNavigator } from '@/components/dashboard/DateNavigator'
import { HistoricalBanner } from '@/components/dashboard/HistoricalBanner'
import { FilterBar } from '@/components/dashboard/FilterBar'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { ChartSwitcher } from '@/components/charts/ChartSwitcher'
import { TodayWidget } from '@/components/dashboard/TodayWidget'
import { CoachProCard } from '@/components/dashboard/CoachProCard'
import { PipelineMiniCard } from '@/components/dashboard/PipelineMiniCard'
import type { PipelineMiniRow } from '@/components/dashboard/PipelineMiniCard'
import { RecetarioFunnelCard } from '@/components/dashboard/RecetarioFunnelCard'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getRecipePerformance } from '@/lib/queries/recipe-performance'
import { getPeriodRange, todayISO, datesInRange, toISODate } from '@/lib/utils/dates'
import { calcCompliance } from '@/lib/calculations/compliance'
import { calcProjection } from '@/lib/calculations/projection'
import { formatPercent } from '@/lib/utils/formatters'
import { getSemaphoreColor } from '@/lib/utils/colors'
import { getActivityGoal, getDailyImpliedGoal } from '@/lib/utils/goals'
import { calcRecipeValidation } from '@/lib/utils/recipe-validation'
import { calcCierresRequeridos, calcCitasRequeridas } from '@/lib/calculations/recipe-supervision'
import { ActivityPerformanceSummary } from '@/components/dashboard/ActivityPerformanceSummary'
import type { ActivityPerfRow } from '@/components/dashboard/ActivityPerformanceSummary'
import type { PeriodType, ActivityType } from '@/lib/types/common'
import type { DailyCompliance } from '@/lib/types/database'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Vista general de tu prospección comercial',
}

interface PageProps {
  searchParams: Promise<{
    period?: string
    type?: string
    channel?: string
    refDate?: string
  }>
}

const CHANNEL_LABELS: Record<string, string> = {
  cold_call: 'Llamada fría',
  cold_message: 'Mensaje frío',
  linkedin_dm: 'DM LinkedIn',
  linkedin_post: 'Post LinkedIn',
  linkedin_comment: 'Comentario LinkedIn',
  networking_event: 'Networking',
  networking_lead: 'Lead Net.',
  referral: 'Referido',
  mkt_lead: 'Lead MKT',
  vsl_lead: 'Lead VSL',
  other: 'Otro',
}

export default async function DashboardPage({ searchParams }: PageProps) {
  // ── Auth + admin redirect (must run before any other logic)
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (myProfile?.role === 'admin') redirect('/admin')

  const params = await searchParams
  const period = (['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].includes(params.period ?? '')
    ? params.period
    : 'weekly') as PeriodType
  const typeFilter = (['OUTBOUND', 'INBOUND'].includes(params.type ?? '')
    ? params.type
    : 'ALL') as ActivityType
  const channelFilter = params.channel ?? null

  const today = todayISO()

  // Resolve refDate: use param if valid ISO, otherwise fall back to today
  const rawRefDate = params.refDate ?? ''
  const parsedRef = /^\d{4}-\d{2}-\d{2}$/.test(rawRefDate) ? parseISO(rawRefDate) : null
  const refDate = (parsedRef && isValid(parsedRef)) ? rawRefDate : today
  // parseISO('YYYY-MM-DD') gives UTC midnight which toISODate() shifts back to
  // the previous day when the server is ahead of Bogota (UTC-5). Use addDays
  // on a known anchor instead: build the date as noon UTC to stay safely within
  // the calendar day regardless of the server's timezone offset.
  const [ry, rm, rd] = refDate.split('-').map(Number)
  const anchorDate = new Date(Date.UTC(ry, rm - 1, rd, 12, 0, 0))

  const { start, end } = getPeriodRange(period, anchorDate)

  // Detect historical view — same UTC-noon trick to avoid timezone shift
  const [ty, tm, tday] = today.split('-').map(Number)
  const todayAnchor = new Date(Date.UTC(ty, tm - 1, tday, 12, 0, 0))
  const currentPeriodStart = getPeriodRange(period, todayAnchor).start
  const isHistorical = start < currentPeriodStart

  // sb is already initialized above for the auth/redirect check — reuse it

  let query = sb
    .from('vw_daily_compliance')
    .select('*')
    .eq('user_id', user.id)
    .gte('log_date', start)
    .lte('log_date', end)

  if (typeFilter !== 'ALL') query = query.eq('type', typeFilter)
  if (channelFilter) query = query.eq('channel', channelFilter)

  // Today's data for the widget (independent of period filter)
  const todayLogsQuery = sb
    .from('vw_daily_compliance')
    .select('real_executed,day_goal')
    .eq('user_id', user.id)
    .eq('log_date', today)

  const [
    { data: logs },
    { data: activities },
    { data: activeScenario },
    { data: todayLogs },
    { data: pipelineRows },
    recipePerf,
  ] = await Promise.all([
    query,
    sb.from('activities').select('id,name,channel,type,daily_goal,weekly_goal,monthly_goal,weight,status,conversion_rate_pct,meetings_expected').eq('status', 'active'),
    sb
      .from('recipe_scenarios')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    todayLogsQuery,
    sb
      .from('pipeline_simple')
      .select('stage, amount_usd, status, origin_activity_id, prospect_type')
      .eq('user_id', user.id)
      .gte('entry_date', start)
      .lte('entry_date', end),
    // Rendimiento de actividades (LOGRO): fuente central única, mes del período que
    // se está viendo (refDate). OJO: NO usar `today`, que se calcula en el servidor
    // (reloj de Vercel) y caería en un mes sin datos, dando reuniones/cierres en cero.
    getRecipePerformance(sb, refDate),
  ])

  const channels = [...new Set(activities?.map((a) => a.channel) ?? [])].sort()
  const allLogs: DailyCompliance[] = logs ?? []

  type ActivityWithGoals = { id: string; name: string; type: 'OUTBOUND' | 'INBOUND'; channel: string; daily_goal: number; weekly_goal: number; monthly_goal: number; weight: number | null; conversion_rate_pct: number | null; meetings_expected: number | null }
  const allActivities: ActivityWithGoals[] = activities ?? []

  // Real per activity aggregated from logs
  const realByActivity: Record<string, number> = {}
  for (const log of allLogs) {
    realByActivity[log.activity_id] = (realByActivity[log.activity_id] ?? 0) + log.real_executed
  }

  // --- KPIs ponderados por peso ---
  const totalReal = allLogs.reduce((s, l) => s + l.real_executed, 0)
  const totalGoal = allActivities.reduce((s, a) => s + getActivityGoal(a, period), 0)

  let weightedReal = 0
  let weightedGoal = 0
  for (const a of allActivities) {
    const goal = getActivityGoal(a, period)
    const real = realByActivity[a.id] ?? 0
    const weight = a.weight ?? 0
    if (goal > 0 && weight > 0) {
      weightedGoal += weight
      weightedReal += Math.min(real, goal) * (weight / goal)
    }
  }
  const weightedPct = weightedGoal > 0 ? (weightedReal / weightedGoal) * 100 : 0

  const compliance = calcCompliance(weightedPct, 100)
  const deviation = totalReal - totalGoal
  const projection = calcProjection(weightedPct, 100, start, end)

  // --- Horizontal Bar data ---
  const barData = allActivities.map((a) => ({
    name: a.name,
    goal: getActivityGoal(a, period),
    real: realByActivity[a.id] ?? 0,
  }))


  // --- Trend line — cumulative real (OUTBOUND/INBOUND) + linear meta target ---
  // Meta target = totalGoal spread evenly across all days in the period
  const allDates = datesInRange(start, end)
  const dailyMetaShare = allDates.length > 0 ? totalGoal / allDates.length : 0

  const dayRealMap: Record<string, { outbound: number; inbound: number }> = {}
  for (const d of allDates) dayRealMap[d] = { outbound: 0, inbound: 0 }
  for (const log of allLogs) {
    if (!dayRealMap[log.log_date]) continue
    if (log.type === 'OUTBOUND') dayRealMap[log.log_date].outbound += log.real_executed
    else                         dayRealMap[log.log_date].inbound  += log.real_executed
  }
  const trendData: { date: string; meta: number; outbound: number; inbound: number }[] = []
  let cumMeta = 0, cumOut = 0, cumIn = 0
  for (const date of allDates) {
    const day = dayRealMap[date] ?? { outbound: 0, inbound: 0 }
    cumMeta += dailyMetaShare
    cumOut  += day.outbound
    cumIn   += day.inbound
    trendData.push({ date, meta: Math.round(cumMeta), outbound: cumOut, inbound: cumIn })
  }

  // --- Radar data (by channel) ---
  // Both goal and real are derived from allActivities so the radar is
  // always consistent with the ActivityBreakdownTable. Iterating allLogs
  // directly would include logs for inactive/deleted activities that are
  // absent from allActivities, causing non-zero radar reals while the
  // breakdown table shows 0.
  const channelGoal: Record<string, number> = {}
  const channelReal: Record<string, number> = {}
  for (const a of allActivities) {
    const ch = CHANNEL_LABELS[a.channel] ?? a.channel
    channelGoal[ch] = (channelGoal[ch] ?? 0) + getActivityGoal(a, period)
    channelReal[ch] = (channelReal[ch] ?? 0) + (realByActivity[a.id] ?? 0)
  }
  const radarData = Object.keys(channelGoal).map((ch) => {
    const goal = channelGoal[ch] ?? 0
    const real = channelReal[ch] ?? 0
    return { channel: ch, real, goal, pct: goal > 0 ? Math.round((real / goal) * 100) : 0 }
  })

  // --- Heatmap data — each cell is one day, always use implied daily goal ---
  // (heatmap is period-independent: cells represent individual days)
  const impliedDailyGoal = allActivities.reduce((s, a) => s + getDailyImpliedGoal(a), 0)
  const heatByDate: Record<string, number> = {}
  for (const log of allLogs) {
    heatByDate[log.log_date] = (heatByDate[log.log_date] ?? 0) + log.real_executed
  }
  const heatmapData = Object.entries(heatByDate).map(([date, real]) => ({
    date,
    compliancePct: impliedDailyGoal > 0 ? (real / impliedDailyGoal) * 100 : null,
  }))

  // --- Detail table (weekly buckets) — weekly_goal per bucket ---
  const weeklyGoalPerBucket = allActivities.reduce((s, a) => s + a.weekly_goal, 0)
  const weekBuckets: Record<string, number> = {}
  for (const log of allLogs) {
    const d = new Date(log.log_date)
    const mon = new Date(d)
    mon.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    const key = toISODate(mon)
    weekBuckets[key] = (weekBuckets[key] ?? 0) + log.real_executed
  }
  const tableRows = Object.entries(weekBuckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, real]) => {
      const goal = weeklyGoalPerBucket
      const pct = goal > 0 ? (real / goal) * 100 : 0
      return {
        period: `Sem. ${date}`,
        goal,
        real,
        deviation: real - goal,
        compliancePct: Math.round(pct * 10) / 10,
      }
    })

  // --- Weekly coach card (link to /coach) ---
  // todayAnchor already built at noon UTC above — reuse it
  const rawMonday = startOfWeek(todayAnchor, { weekStartsOn: 1 })
  const mondayNoon = new Date(Date.UTC(
    rawMonday.getUTCFullYear(),
    rawMonday.getUTCMonth(),
    rawMonday.getUTCDate(),
    12, 0, 0,
  ))
  const thisMonday = toISODate(mondayNoon)

  // Friday = Monday + 4 days
  const [wy, wm, wd] = thisMonday.split('-').map(Number)
  const thisMondayNoon = new Date(Date.UTC(wy, wm - 1, wd, 12, 0, 0))
  const thisFridayNoon = new Date(thisMondayNoon.getTime() + 4 * 24 * 60 * 60 * 1000)
  const thisFriday = toISODate(thisFridayNoon)

  const weekLabel = `Semana ${format(parseISO(thisMonday), 'd')} - ${format(parseISO(thisFriday), "d 'de' MMM yyyy", { locale: es })}`

  // Check if a weekly coach message already exists for this week
  const { data: weeklyCoach } = await sb
    .from('coach_messages')
    .select('id')
    .eq('type', 'weekly')
    .eq('period_date', thisMonday)
    .maybeSingle()

  // --- Plan vs Recipe validation ---
  const recipeValidation = activeScenario && allActivities.length > 0
    ? calcRecipeValidation(activeScenario, allActivities as Parameters<typeof calcRecipeValidation>[1])
    : null

  // --- Actual OUTB/INB for RecetarioFunnelCard ---
  const actualOutbound = allActivities
    .filter(a => a.type === 'OUTBOUND')
    .reduce((s, a) => s + (realByActivity[a.id] ?? 0), 0)
  const actualInbound = allActivities
    .filter(a => a.type === 'INBOUND')
    .reduce((s, a) => s + (realByActivity[a.id] ?? 0), 0)

  // --- Pipeline data for the selected period ---
  const allPipelineRows: PipelineMiniRow[] = pipelineRows ?? []
  const pipelineByStage: Record<string, number> = {}
  for (const row of allPipelineRows) {
    pipelineByStage[row.stage] = (pipelineByStage[row.stage] ?? 0) + 1
  }

  // --- Period label for PipelineMiniCard ---
  const pipelinePeriodLabel = period === 'daily'
    ? 'hoy'
    : period === 'weekly'
    ? 'esta semana'
    : period === 'monthly'
    ? 'este mes'
    : period === 'quarterly'
    ? 'este trimestre'
    : 'este año'

  // --- Rendimiento de actividades (LOGRO): fuente central única, mes en curso ---
  // Reuniones/cierres reales desde pipeline_simple con la definición correcta,
  // idénticos a los de la pestaña Rendimiento del Recetario (misma función).
  const activityPerfRows: ActivityPerfRow[] = recipePerf.activities.map(a => ({
    id: a.id,
    name: a.name,
    type: a.type,
    meetingsExpected: a.meetingsExpected,
    conversionRatePct: a.conversionRatePct,
    reunionesReales: a.reunionesReales,
    cierresReales: a.cierresReales,
    montoReal: a.montoReal,
  }))

  // --- Citas alignment for RecetarioFunnelCard ---
  const citasProyectadas = activityPerfRows.reduce((s, r) => s + r.meetingsExpected, 0)
  let citasRequeridas = 0
  if (activeScenario) {
    const rates = (activeScenario.outbound_rates as number[] | null) ?? [30]
    const lastRate = rates[rates.length - 1] ?? 30
    const cierresReq = calcCierresRequeridos(activeScenario.monthly_revenue_goal, activeScenario.average_ticket)
    citasRequeridas = calcCitasRequeridas(cierresReq, lastRate)
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Dashboard"
        description="Vista general de tu prospección comercial"
      />
      <div className="flex-1 overflow-y-auto">
        {/* Controls bar */}
        <div className="flex items-center gap-4 flex-wrap border-b border-border bg-background px-8 py-3">
          <Suspense>
            <PeriodSelector current={period} />
          </Suspense>
          <div className="h-4 w-px bg-border" />
          <Suspense>
            <DateNavigator period={period} refDate={refDate} />
          </Suspense>
          <Suspense>
            <FilterBar
              currentType={typeFilter}
              currentChannel={channelFilter}
              channels={channels}
            />
          </Suspense>
        </div>

        {/* Historical period banner */}
        <Suspense>
          <HistoricalBanner isHistorical={isHistorical} />
        </Suspense>

        <div className="p-8 space-y-6">
          {/* Row 1: Estado del día + Coach — lado a lado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TodayWidget
              today={today}
              totalReal={(todayLogs ?? []).reduce((s, l) => s + l.real_executed, 0)}
              totalGoal={(todayLogs ?? []).reduce((s, l) => s + l.day_goal, 0)}
              hasActivities={(activities?.length ?? 0) > 0}
            />
            <CoachProCard
              weekLabel={weekLabel}
              hasMessage={!!weeklyCoach}
              compliancePct={compliance.pct}
            />
          </div>

          {/* Row 2: KPI Grid */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              label="Cumplimiento"
              value={formatPercent(compliance.pct)}
              semaphore={compliance.semaphore}
              description="Porcentaje de cumplimiento teniendo en cuenta el peso asignado a cada actividad"
              icon={<BarChart2 className="h-4 w-4" />}
            />
            <KpiCard
              label="Actividades"
              value={totalReal}
              subValue={`/ ${totalGoal}`}
              semaphore={compliance.semaphore}
              description="Conteo total sin ponderar · todas las actividades valen igual"
              icon={<Activity className="h-4 w-4" />}
            />
            <KpiCard
              label="Desviación acumulada"
              value={deviation >= 0 ? `+${deviation}` : String(deviation)}
              semaphore={getSemaphoreColor(compliance.pct)}
              description="Actividades realizadas menos meta del período"
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <KpiCard
              label="Proyección al cierre"
              value={formatPercent(projection.projectedPct)}
              semaphore={getSemaphoreColor(projection.projectedPct)}
              description="Proyección de cierre del período según ritmo ponderado actual"
              icon={<Target className="h-4 w-4" />}
            />
          </div>

          {/* Row 3: Recetario + Pipeline — lado a lado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {recipeValidation && (
              <RecetarioFunnelCard
                validation={recipeValidation}
                period={period}
                actualOutbound={actualOutbound}
                actualInbound={actualInbound}
                pipelineByStage={pipelineByStage}
                citasProyectadas={citasProyectadas}
                citasRequeridas={citasRequeridas}
              />
            )}
            <PipelineMiniCard
              rows={allPipelineRows}
              periodLabel={pipelinePeriodLabel}
              monthlyRevenueGoal={activeScenario?.monthly_revenue_goal ?? 0}
            />
          </div>

          {/* Row 4: Rendimiento de actividades + Visualizaciones — lado a lado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <ActivityPerformanceSummary
              rows={activityPerfRows}
              scenario={activeScenario ? {
                monthly_revenue_goal: activeScenario.monthly_revenue_goal,
                average_ticket: activeScenario.average_ticket,
                outbound_pct: activeScenario.outbound_pct,
              } : null}
            />
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="mb-1 text-sm font-semibold text-foreground">Visualizaciones</h2>
              <ChartSwitcher
                barData={barData}
                trendData={trendData}
                radarData={radarData}
                heatmapData={heatmapData}
                tableRows={tableRows}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
