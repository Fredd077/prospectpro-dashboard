import type { Metadata } from 'next'
import { Suspense } from 'react'
import { TopBar } from '@/components/layout/TopBar'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Vista general de tu prospección comercial',
}
import { PeriodSelector } from '@/components/dashboard/PeriodSelector'
import { DateNavigator } from '@/components/dashboard/DateNavigator'
import { HistoricalBanner } from '@/components/dashboard/HistoricalBanner'
import { FilterBar } from '@/components/dashboard/FilterBar'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { ChartSwitcher } from '@/components/charts/ChartSwitcher'
import { ActivityBreakdownTable } from '@/components/dashboard/ActivityBreakdownTable'
import type { ActivityBreakdownRow } from '@/components/dashboard/ActivityBreakdownTable'
import { TodayWidget } from '@/components/dashboard/TodayWidget'
import { RecipeValidationCard } from '@/components/dashboard/RecipeValidationCard'
import { WeeklyCoachMessage } from '@/components/dashboard/WeeklyCoachMessage'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getPeriodRange, todayISO, datesInRange, toISODate } from '@/lib/utils/dates'
import { startOfWeek, endOfWeek, subWeeks, parseISO, isValid, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { calcCompliance } from '@/lib/calculations/compliance'
import { calcProjection } from '@/lib/calculations/projection'
import { formatPercent } from '@/lib/utils/formatters'
import { getSemaphoreColor } from '@/lib/utils/colors'
import { getActivityGoal, getDailyImpliedGoal } from '@/lib/utils/goals'
import { calcRecipeValidation } from '@/lib/utils/recipe-validation'
import { calcRecipe, DEFAULT_FUNNEL_STAGES, DEFAULT_OUTBOUND_RATES, DEFAULT_INBOUND_RATES } from '@/lib/calculations/recipe'
import type { PeriodType, ActivityType } from '@/lib/types/common'
import type { DailyCompliance } from '@/lib/types/database'
import { Activity, BarChart2, TrendingUp, Target } from 'lucide-react'
import { PipelineMiniCard } from '@/components/dashboard/PipelineMiniCard'

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
  const params = await searchParams
  const period = (['daily', 'weekly', 'monthly', 'quarterly'].includes(params.period ?? '')
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
  const anchorDate = parseISO(refDate)

  const { start, end } = getPeriodRange(period, anchorDate)

  // Detect historical view
  const currentPeriodStart = getPeriodRange(period, parseISO(today)).start
  const isHistorical = start < currentPeriodStart

  const sb = await getSupabaseServerClient()

  let query = sb
    .from('vw_daily_compliance')
    .select('*')
    .gte('log_date', start)
    .lte('log_date', end)

  if (typeFilter !== 'ALL') query = query.eq('type', typeFilter)
  if (channelFilter) query = query.eq('channel', channelFilter)

  // Today's data for the widget (independent of period filter)
  const todayLogsQuery = sb
    .from('vw_daily_compliance')
    .select('real_executed,day_goal')
    .eq('log_date', today)

  const [
    { data: logs },
    { data: activities },
    { data: activeScenario },
    { data: todayLogs },
  ] = await Promise.all([
    query,
    sb.from('activities').select('id,name,channel,type,daily_goal,weekly_goal,monthly_goal,status').eq('status', 'active'),
    sb
      .from('recipe_scenarios')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    todayLogsQuery,
  ])

  const channels = [...new Set(activities?.map((a) => a.channel) ?? [])].sort()
  const allLogs: DailyCompliance[] = logs ?? []

  type ActivityWithGoals = { id: string; name: string; type: 'OUTBOUND' | 'INBOUND'; channel: string; daily_goal: number; weekly_goal: number; monthly_goal: number }
  const allActivities: ActivityWithGoals[] = activities ?? []

  // Real per activity aggregated from logs
  const realByActivity: Record<string, number> = {}
  for (const log of allLogs) {
    realByActivity[log.activity_id] = (realByActivity[log.activity_id] ?? 0) + log.real_executed
  }

  // --- KPIs (period-correct goals from activities table) ---
  const totalReal = allLogs.reduce((s, l) => s + l.real_executed, 0)
  const totalGoal = allActivities.reduce((s, a) => s + getActivityGoal(a, period), 0)
  const compliance = calcCompliance(totalReal, totalGoal)
  const projection = calcProjection(totalReal, totalGoal, start, end)
  const deviation = totalReal - totalGoal

  // --- Horizontal Bar data ---
  const barData = allActivities.map((a) => ({
    name: a.name,
    goal: getActivityGoal(a, period),
    real: realByActivity[a.id] ?? 0,
  }))

  // --- ActivityBreakdownTable rows ---
  const breakdownRows: ActivityBreakdownRow[] = allActivities.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    channel: a.channel,
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
  let cumMeta = 0, cumOut = 0, cumIn = 0
  const trendData = allDates.map((date) => {
    const day = dayRealMap[date] ?? { outbound: 0, inbound: 0 }
    cumMeta += dailyMetaShare
    cumOut  += day.outbound
    cumIn   += day.inbound
    return { date, meta: Math.round(cumMeta), outbound: cumOut, inbound: cumIn }
  })

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

  // --- Weekly coach message ---
  const todayDate         = parseISO(today)
  const isMonday          = todayDate.getDay() === 1
  const thisMonday        = toISODate(startOfWeek(todayDate, { weekStartsOn: 1 }))
  const lastMonday        = toISODate(subWeeks(parseISO(thisMonday), 1))
  // The week being analyzed: on Mondays show last week (just ended); other days show current week
  const analyzedWeekStart = isMonday ? lastMonday : thisMonday
  const analyzedWeekEnd   = toISODate(endOfWeek(parseISO(analyzedWeekStart), { weekStartsOn: 1 }))
  const weekLabel = `${format(parseISO(analyzedWeekStart), 'd MMM', { locale: es })} – ${format(parseISO(analyzedWeekEnd), 'd MMM yyyy', { locale: es })}`

  // Look up the cached message for the analyzed week (period_date = analyzed week's Monday)
  const { data: weeklyCoach } = await sb
    .from('coach_messages').select('id,message').eq('type', 'weekly').eq('period_date', analyzedWeekStart).maybeSingle()

  // Monthly progress for the weekly coach footer
  const monthStart2 = today.slice(0, 8) + '01'
  const { data: monthlyCoachLogs } = await sb
    .from('activity_logs')
    .select('real_executed')
    .gte('log_date', monthStart2)
    .lte('log_date', today)
  const monthlyRealForCoach = (monthlyCoachLogs ?? []).reduce((s, l) => s + l.real_executed, 0)
  const monthlyGoalForCoach = allActivities.reduce((s, a) => s + a.monthly_goal, 0)
  const monthlyPctForCoach  = monthlyGoalForCoach > 0 ? Math.round((monthlyRealForCoach / monthlyGoalForCoach) * 100) : 0

  const shownCoach    = weeklyCoach ?? null
  const isLastWeekMsg = isMonday  // On Mondays we always analyze last week

  // --- Plan vs Recipe validation ---
  const recipeValidation = activeScenario && allActivities.length > 0
    ? calcRecipeValidation(activeScenario, allActivities as Parameters<typeof calcRecipeValidation>[1])
    : null

  // --- Funnel stages from active recipe scenario ---
  type FunnelStage = { label: string; planned: number; actual?: number }
  const funnelStages: FunnelStage[] = []

  if (activeScenario) {
    const s = activeScenario
    const days = s.working_days_per_month ?? 22

    // Scale planned values to the selected period
    function scalePlan(monthly: number | null): number {
      if (!monthly) return 0
      if (period === 'monthly')   return Math.ceil(monthly)
      if (period === 'weekly')    return Math.ceil(monthly / (days / 5))
      if (period === 'quarterly') return Math.ceil(monthly * 3)
      // daily
      return Math.ceil(monthly / days)
    }

    const recipeResult = calcRecipe({
      monthly_revenue_goal:   s.monthly_revenue_goal,
      average_ticket:         s.average_ticket,
      outbound_pct:           s.outbound_pct,
      working_days_per_month: s.working_days_per_month,
      funnel_stages:  s.funnel_stages  ?? DEFAULT_FUNNEL_STAGES,
      outbound_rates: s.outbound_rates ?? DEFAULT_OUTBOUND_RATES,
      inbound_rates:  s.inbound_rates  ?? DEFAULT_INBOUND_RATES,
    })

    const stageNames = s.funnel_stages ?? DEFAULT_FUNNEL_STAGES
    stageNames.forEach((stageName, i) => {
      const planMonthly = (recipeResult.outbound.stage_values[i] ?? 0) + (recipeResult.inbound.stage_values[i] ?? 0)
      funnelStages.push({
        label:   stageName,
        planned: scalePlan(planMonthly),
        actual:  i === 0 ? totalReal : undefined,
      })
    })
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

        <div className="p-8 space-y-8">
          {/* Today's status widget */}
          <TodayWidget
            today={today}
            totalReal={(todayLogs ?? []).reduce((s, l) => s + l.real_executed, 0)}
            totalGoal={(todayLogs ?? []).reduce((s, l) => s + l.day_goal, 0)}
            hasActivities={(activities?.length ?? 0) > 0}
          />

          {/* Weekly AI coach — shown when cached message exists or today is Monday */}
          {(shownCoach || isMonday) && (
            <WeeklyCoachMessage
              isMonday={isMonday}
              weekLabel={weekLabel}
              monthlyPct={monthlyPctForCoach}
              cachedMessage={shownCoach?.message}
              cachedId={shownCoach?.id}
              isLastWeek={isLastWeekMsg}
            />
          )}

          {/* KPI Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Cumplimiento"
              value={formatPercent(compliance.pct)}
              semaphore={compliance.semaphore}
              description={`${totalReal} de ${totalGoal} actividades`}
              icon={<BarChart2 className="h-4 w-4" />}
            />
            <KpiCard
              label="Actividades"
              value={totalReal}
              subValue={`/ ${totalGoal}`}
              semaphore={compliance.semaphore}
              description="Realizadas vs meta"
              icon={<Activity className="h-4 w-4" />}
            />
            <KpiCard
              label="Desviación acumulada"
              value={deviation >= 0 ? `+${deviation}` : String(deviation)}
              semaphore={getSemaphoreColor(compliance.pct)}
              description="Real menos meta del período"
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <KpiCard
              label="Proyección al cierre"
              value={formatPercent(projection.projectedPct)}
              semaphore={getSemaphoreColor(projection.projectedPct)}
              description={`~${projection.projected} actividades proyectadas`}
              icon={<Target className="h-4 w-4" />}
            />
          </div>

          {/* Plan vs Recipe validation card */}
          {recipeValidation && (
            <RecipeValidationCard validation={recipeValidation} />
          )}

          {/* Funnel Real — pipeline mini card (fetches its own data) */}
          <PipelineMiniCard />

          {/* Per-activity breakdown table */}
          {breakdownRows.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-foreground">Desglose por actividad</h2>
              <ActivityBreakdownTable rows={breakdownRows} />
            </div>
          )}

          {/* Charts */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-1 text-sm font-semibold text-foreground">Visualizaciones</h2>
            {!activeScenario && (
              <p className="mb-4 text-xs text-muted-foreground">
                Para ver el Funnel crea un escenario activo en{' '}
                <a href="/recipe" className="underline underline-offset-2 hover:text-foreground">Recetario</a>.
              </p>
            )}
            <ChartSwitcher
              barData={barData}
              trendData={trendData}
              radarData={radarData}
              heatmapData={heatmapData}
              tableRows={tableRows}
              funnelStages={funnelStages}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
