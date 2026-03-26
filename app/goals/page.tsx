import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Target } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { GoalPeriodGrid } from '@/components/goals/GoalPeriodGrid'
import { DeviationAlert } from '@/components/goals/DeviationAlert'

export const metadata: Metadata = {
  title: 'Metas',
  description: 'Define y monitorea tus metas de prospección por período',
}
import { NewGoalDialog } from '@/components/goals/NewGoalDialog'
import { QuarterlyTable } from '@/components/goals/QuarterlyTable'
import type { QuarterlyActivityRow, QuarterlyMonth } from '@/components/goals/QuarterlyTable'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import {
  getPeriodRange,
  todayISO,
  elapsedDays,
  totalDays,
  toISODate,
  formatDisplayDate,
} from '@/lib/utils/dates'
import {
  startOfMonth,
  endOfMonth,
  addMonths,
  parseISO,
  format,
} from 'date-fns'
import { es } from 'date-fns/locale'
import type { PeriodType } from '@/lib/types/common'
import type { Goal } from '@/lib/types/database'

interface PageProps {
  searchParams: Promise<{ period?: string; filter?: string }>
}

type PeriodTab = PeriodType | 'all'

const PERIOD_OPTIONS: Array<{ value: PeriodTab; label: string }> = [
  { value: 'all',       label: 'Todas' },
  { value: 'daily',     label: 'Diarias' },
  { value: 'weekly',    label: 'Semanales' },
  { value: 'monthly',   label: 'Mensuales' },
  { value: 'quarterly', label: 'Trimestral' },
]

const PERIOD_TYPE_LABELS: Record<string, string> = {
  daily: 'Metas Diarias',
  weekly: 'Metas Semanales',
  monthly: 'Metas Mensuales',
  quarterly: 'Metas Trimestrales',
}

export default async function GoalsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const period: PeriodTab = (['all', 'daily', 'weekly', 'monthly', 'quarterly'].includes(params.period ?? '')
    ? params.period
    : 'all') as PeriodTab
  const filterAtRisk = params.filter === 'at-risk'

  const today = todayISO()
  const sb = await getSupabaseServerClient()

  const [{ data: goals }, { data: activities }, { data: allLogs }] = await Promise.all([
    sb.from('goals').select('*').order('period_start', { ascending: false }),
    sb.from('activities').select('id,name,type,channel,daily_goal,monthly_goal').eq('status', 'active'),
    // Fetch all logs — we'll filter per-goal in JS (goals cover narrow date ranges)
    sb.from('vw_daily_compliance')
      .select('activity_id,real_executed,day_goal,log_date')
      .lte('log_date', today),
  ])

  const activityList = (activities ?? []).map((a) => ({ id: a.id, name: a.name }))

  // Build real per activity per date for efficient per-goal lookups
  const logsByActivityDate: Record<string, Record<string, { real: number; goal: number }>> = {}
  for (const log of allLogs ?? []) {
    if (!logsByActivityDate[log.activity_id]) logsByActivityDate[log.activity_id] = {}
    logsByActivityDate[log.activity_id][log.log_date] = {
      real: log.real_executed,
      goal: log.day_goal,
    }
  }

  // Compute real for a given activity (null = all) + date range
  function computeReal(activityId: string | null, start: string, end: string): number {
    let total = 0
    for (const [actId, dateMap] of Object.entries(logsByActivityDate)) {
      if (activityId && actId !== activityId) continue
      for (const [date, { real }] of Object.entries(dateMap)) {
        if (date >= start && date <= end) total += real
      }
    }
    return total
  }

  // Attach real to each goal using its own period dates
  const goalsWithProgress = (goals ?? []).map((g: Goal) => ({
    ...g,
    real: computeReal(g.activity_id, g.period_start, g.period_end),
  }))

  // Filter by period tab
  let filteredGoals = period === 'all'
    ? goalsWithProgress
    : goalsWithProgress.filter((g) => g.period_type === period)

  // Filter at-risk (for badge link navigation)
  if (filterAtRisk) {
    filteredGoals = filteredGoals.filter((g) => {
      const elapsed = elapsedDays(g.period_start, g.period_end)
      const total = totalDays(g.period_start, g.period_end)
      const pctElapsed = (elapsed / total) * 100
      const pct = g.target_value > 0 ? ((g.real ?? 0) / g.target_value) * 100 : 100
      return pctElapsed >= 50 && pct < 70
    })
  }

  // Current period stats for the deviation alert
  const currentRange = period === 'all' ? getPeriodRange('weekly', new Date()) : getPeriodRange(period as PeriodType, new Date())
  const currentPeriodReal = period === 'all' ? 0 : computeReal(null, currentRange.start, currentRange.end)
  const currentPeriodGoal = period === 'all' ? 0 : (allLogs ?? [])
    .filter((l) => l.log_date >= currentRange.start && l.log_date <= currentRange.end)
    .reduce((s, l) => s + l.day_goal, 0)

  // --- Quarterly table data ---
  let quarterlyMonths: [QuarterlyMonth, QuarterlyMonth, QuarterlyMonth] | null = null
  let quarterlyRows: QuarterlyActivityRow[] = []

  if (period === 'quarterly') {
    const { start: qStart } = getPeriodRange('quarterly', new Date())
    const qStartDate = parseISO(qStart)

    quarterlyMonths = [0, 1, 2].map((offset) => {
      const monthDate = addMonths(qStartDate, offset)
      return {
        label: format(monthDate, 'MMMM', { locale: es }).charAt(0).toUpperCase() +
               format(monthDate, 'MMMM', { locale: es }).slice(1),
        start: toISODate(startOfMonth(monthDate)),
        end: toISODate(endOfMonth(monthDate)),
      }
    }) as [QuarterlyMonth, QuarterlyMonth, QuarterlyMonth]

    quarterlyRows = (activities ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type as 'OUTBOUND' | 'INBOUND',
      months: quarterlyMonths!.map((m) => ({
        // monthly goal: use activity.monthly_goal if available, else daily_goal * ~22
        goal: a.monthly_goal ?? a.daily_goal * 22,
        real: computeReal(a.id, m.start, m.end),
      })),
    })).filter((r) => r.months.some((m) => m.real > 0 || m.goal > 0))
  }

  // Group by period type for "all" view
  const goalsByType: Record<string, typeof filteredGoals> = {}
  if (period === 'all') {
    for (const g of filteredGoals) {
      if (!goalsByType[g.period_type]) goalsByType[g.period_type] = []
      goalsByType[g.period_type].push(g)
    }
  }

  const currentRange2 = period !== 'all' ? getPeriodRange(period as PeriodType, new Date()) : null

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Metas y Planificación"
        description="Define y monitorea tus metas por período"
        action={
          <Suspense>
            <NewGoalDialog activities={activityList} />
          </Suspense>
        }
      />
      <div className="flex-1 overflow-y-auto p-8 space-y-8">

        {/* Period filter tabs */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1 w-fit flex-wrap">
          {PERIOD_OPTIONS.map(({ value, label }) => (
            <a
              key={value}
              href={`?period=${value}`}
              className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
                period === value
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </a>
          ))}
        </div>

        {/* At-risk filter active indicator */}
        {filterAtRisk && (
          <div className="flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-400/5 px-4 py-2">
            <span className="text-xs text-red-400 font-medium">
              Mostrando solo metas en riesgo (≥50% del período transcurrido, &lt;70% cumplimiento)
            </span>
            <a href={`?period=${period}`} className="ml-auto text-xs text-muted-foreground underline">
              Ver todas
            </a>
          </div>
        )}

        {/* Deviation alert for non-all views */}
        {period !== 'all' && currentPeriodGoal > 0 && (
          <DeviationAlert
            totalReal={currentPeriodReal}
            totalGoal={currentPeriodGoal}
            periodLabel={currentRange2 ? `${currentRange2.start} → ${currentRange2.end}` : ''}
          />
        )}

        {/* Quarterly table (special view) */}
        {period === 'quarterly' && quarterlyMonths && (
          <QuarterlyTable
            months={quarterlyMonths}
            rows={quarterlyRows}
            quarterLabel={`Q${Math.ceil((parseISO(currentRange2!.start).getMonth() + 1) / 3)} ${parseISO(currentRange2!.start).getFullYear()}`}
          />
        )}

        {/* All goals grouped by type */}
        {period === 'all' && (
          <div className="space-y-10">
            {filteredGoals.length === 0 ? (
              <EmptyGoalsState />
            ) : (
              (['quarterly', 'monthly', 'weekly', 'daily'] as const).map((type) => {
                const typeGoals = goalsByType[type] ?? []
                if (typeGoals.length === 0) return null
                return (
                  <section key={type}>
                    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
                      {PERIOD_TYPE_LABELS[type]}
                    </h2>
                    <GoalPeriodGrid goals={typeGoals} activities={activityList} />
                  </section>
                )
              })
            )}
          </div>
        )}

        {/* Filtered by period type */}
        {period !== 'all' && period !== 'quarterly' && (
          filteredGoals.length === 0 ? (
            <EmptyGoalsState />
          ) : (
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
                {PERIOD_TYPE_LABELS[period as string] ?? period}
              </h2>
              <GoalPeriodGrid goals={filteredGoals} activities={activityList} />
            </section>
          )
        )}

      </div>
    </div>
  )
}

function EmptyGoalsState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-20 gap-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Target className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="text-center space-y-1">
        <p className="font-medium text-foreground">No hay metas definidas</p>
        <p className="text-sm text-muted-foreground">
          Crea tu primera meta con el botón &ldquo;Nueva meta&rdquo; de arriba.
        </p>
      </div>
    </div>
  )
}
