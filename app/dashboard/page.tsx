import type { Metadata } from 'next'
import { Suspense } from 'react'
import { TopBar } from '@/components/layout/TopBar'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Vista general de tu prospección comercial',
}
import { PeriodSelector } from '@/components/dashboard/PeriodSelector'
import { FilterBar } from '@/components/dashboard/FilterBar'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { ChartSwitcher } from '@/components/charts/ChartSwitcher'
import { ActivityBreakdownTable } from '@/components/dashboard/ActivityBreakdownTable'
import type { ActivityBreakdownRow } from '@/components/dashboard/ActivityBreakdownTable'
import { TodayWidget } from '@/components/dashboard/TodayWidget'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getPeriodRange, todayISO, datesInRange, localISODate } from '@/lib/utils/dates'
import { calcCompliance } from '@/lib/calculations/compliance'
import { calcProjection } from '@/lib/calculations/projection'
import { formatPercent } from '@/lib/utils/formatters'
import { getSemaphoreColor } from '@/lib/utils/colors'
import type { PeriodType, ActivityType } from '@/lib/types/common'
import type { DailyCompliance } from '@/lib/types/database'
import { Activity, BarChart2, TrendingUp, Target } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{
    period?: string
    type?: string
    channel?: string
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
  const { start, end } = getPeriodRange(period, new Date())

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
    sb.from('activities').select('id,name,channel,type').eq('status', 'active'),
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

  // --- KPIs ---
  const totalReal = allLogs.reduce((s, l) => s + l.real_executed, 0)
  const totalGoal = allLogs.reduce((s, l) => s + l.day_goal, 0)
  const compliance = calcCompliance(totalReal, totalGoal)
  const projection = calcProjection(totalReal, totalGoal, start, end)
  const deviation = totalReal - totalGoal

  // --- Horizontal Bar data (by activity) ---
  const byActivity: Record<string, { name: string; type: 'OUTBOUND' | 'INBOUND'; channel: string; goal: number; real: number }> = {}
  for (const log of allLogs) {
    if (!byActivity[log.activity_id]) {
      byActivity[log.activity_id] = { name: log.activity_name, type: log.type, channel: log.channel, goal: 0, real: 0 }
    }
    byActivity[log.activity_id].goal += log.day_goal
    byActivity[log.activity_id].real += log.real_executed
  }
  const barData = Object.values(byActivity).map(({ name, goal, real }) => ({ name, goal, real }))

  const breakdownRows: ActivityBreakdownRow[] = Object.entries(byActivity).map(([id, v]) => ({
    id,
    name: v.name,
    type: v.type,
    channel: v.channel,
    goal: v.goal,
    real: v.real,
  }))

  // --- Trend line data — cumulative by day, split OUTBOUND / INBOUND ---
  const allDates = datesInRange(start, end)
  // Day-level aggregations
  const dayMap: Record<string, { meta: number; outbound: number; inbound: number }> = {}
  for (const d of allDates) dayMap[d] = { meta: 0, outbound: 0, inbound: 0 }
  for (const log of allLogs) {
    if (!dayMap[log.log_date]) continue
    dayMap[log.log_date].meta     += log.day_goal
    if (log.type === 'OUTBOUND') dayMap[log.log_date].outbound += log.real_executed
    else                         dayMap[log.log_date].inbound  += log.real_executed
  }
  // Build cumulative series
  let cumMeta = 0, cumOut = 0, cumIn = 0
  const trendData = allDates.map((date) => {
    const day = dayMap[date] ?? { meta: 0, outbound: 0, inbound: 0 }
    cumMeta += day.meta
    cumOut  += day.outbound
    cumIn   += day.inbound
    return {
      date,
      meta:     cumMeta,
      outbound: cumOut,
      inbound:  cumIn,
    }
  })

  // --- Radar data (by channel) ---
  const byChannel: Record<string, { real: number; goal: number }> = {}
  for (const log of allLogs) {
    const ch = CHANNEL_LABELS[log.channel] ?? log.channel
    if (!byChannel[ch]) byChannel[ch] = { real: 0, goal: 0 }
    byChannel[ch].real += log.real_executed
    byChannel[ch].goal += log.day_goal
  }
  const radarData = Object.entries(byChannel).map(([channel, { real, goal }]) => ({
    channel,
    real,
    goal,
    pct: goal > 0 ? Math.round((real / goal) * 100) : 0,
  }))

  // --- Heatmap data ---
  const heatByDate: Record<string, { real: number; goal: number }> = {}
  for (const log of allLogs) {
    if (!heatByDate[log.log_date]) heatByDate[log.log_date] = { real: 0, goal: 0 }
    heatByDate[log.log_date].real += log.real_executed
    heatByDate[log.log_date].goal += log.day_goal
  }
  const heatmapData = Object.entries(heatByDate).map(([date, { real, goal }]) => ({
    date,
    compliancePct: goal > 0 ? (real / goal) * 100 : null,
  }))

  // --- Detail table (weekly buckets) ---
  const weekBuckets: Record<string, { goal: number; real: number }> = {}
  for (const log of allLogs) {
    const d = new Date(log.log_date)
    const mon = new Date(d)
    mon.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    const key = localISODate(mon)
    if (!weekBuckets[key]) weekBuckets[key] = { goal: 0, real: 0 }
    weekBuckets[key].goal += log.day_goal
    weekBuckets[key].real += log.real_executed
  }
  const tableRows = Object.entries(weekBuckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { goal, real }]) => {
      const pct = goal > 0 ? (real / goal) * 100 : 0
      return {
        period: `Sem. ${date}`,
        goal,
        real,
        deviation: real - goal,
        compliancePct: Math.round(pct * 10) / 10,
      }
    })

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

    funnelStages.push(
      { label: 'Actividades', planned: scalePlan(s.activities_needed_monthly), actual: totalReal },
      { label: 'Discursos',   planned: scalePlan(s.speeches_needed_monthly)   },
      { label: 'Reuniones',   planned: scalePlan(s.meetings_needed_monthly)   },
      { label: 'Propuestas',  planned: scalePlan(s.proposals_needed_monthly)  },
      { label: 'Cierres',     planned: scalePlan(s.closes_needed_monthly)     },
    )
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
          <Suspense>
            <FilterBar
              currentType={typeFilter}
              currentChannel={channelFilter}
              channels={channels}
            />
          </Suspense>
        </div>

        <div className="p-8 space-y-8">
          {/* Today's status widget */}
          <TodayWidget
            today={today}
            totalReal={(todayLogs ?? []).reduce((s, l) => s + l.real_executed, 0)}
            totalGoal={(todayLogs ?? []).reduce((s, l) => s + l.day_goal, 0)}
            hasActivities={(activities?.length ?? 0) > 0}
          />

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
