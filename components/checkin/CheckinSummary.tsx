import { CheckCircle2, AlertTriangle, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { semaphoreBgClass } from '@/lib/utils/colors'
import { calcCompliance } from '@/lib/calculations/compliance'
import { calcRecipeValidation } from '@/lib/utils/recipe-validation'
import { RecipePaceWidget } from './RecipePaceWidget'
import type { Activity, RecipeScenario } from '@/lib/types/database'

interface CheckinSummaryProps {
  date: string
  activities: Activity[]
  values: Record<string, number>              // today's submitted values
  weeklyDisplayValues: Record<string, number> // full week (including today)
  isRetroactive: boolean
  activeScenario?: RecipeScenario | null
}

export function CheckinSummary({
  date,
  activities,
  values,
  weeklyDisplayValues,
  isRetroactive,
  activeScenario,
}: CheckinSummaryProps) {
  // Weekly real split by type for pace widget
  const weeklyOutbound = activities
    .filter((a) => a.type === 'OUTBOUND')
    .reduce((s, a) => s + (weeklyDisplayValues[a.id] ?? 0), 0)
  const weeklyInbound = activities
    .filter((a) => a.type === 'INBOUND')
    .reduce((s, a) => s + (weeklyDisplayValues[a.id] ?? 0), 0)

  const paceValidation = activeScenario
    ? calcRecipeValidation(activeScenario, activities)
    : null
  const dailyActivities = activities.filter((a) => a.daily_goal >= 1)
  const weeklyActivities = activities.filter((a) => a.daily_goal < 1)

  // --- Summary card stats ---
  const dailyGoalTotal = dailyActivities.reduce((s, a) => s + a.daily_goal, 0)
  const dailyRealTotal = dailyActivities.reduce((s, a) => s + (values[a.id] ?? 0), 0)
  const dailyCompliance = calcCompliance(dailyRealTotal, dailyGoalTotal)

  const weeklyGoalTotal = activities.reduce((s, a) => s + a.weekly_goal, 0)
  const weeklyRealTotal = activities.reduce((s, a) => s + (weeklyDisplayValues[a.id] ?? 0), 0)
  const weeklyCompliance = calcCompliance(weeklyRealTotal, weeklyGoalTotal)

  const completedToday = activities.filter((a) => {
    const real = values[a.id] ?? 0
    return a.daily_goal >= 1 ? real >= a.daily_goal : real > 0
  }).length

  // Overall semaphore for header (blend daily + weekly)
  const overallSem = dailyCompliance.semaphore !== 'no_goal'
    ? dailyCompliance.semaphore
    : weeklyCompliance.semaphore

  const icon =
    overallSem === 'green' ? (
      <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
    ) : overallSem === 'yellow' ? (
      <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
    ) : (
      <TrendingDown className="h-5 w-5 text-red-400 shrink-0" />
    )

  const borderColor =
    overallSem === 'green'
      ? 'border-emerald-400/20 bg-emerald-400/5'
      : overallSem === 'yellow'
      ? 'border-amber-400/20 bg-amber-400/5'
      : 'border-red-400/20 bg-red-400/5'

  const headerColor =
    overallSem === 'green'
      ? 'text-emerald-400'
      : overallSem === 'yellow'
      ? 'text-amber-400'
      : 'text-red-400'

  const outbound = activities.filter((a) => a.type === 'OUTBOUND')
  const inbound = activities.filter((a) => a.type === 'INBOUND')

  return (
    <div className={cn('rounded-lg border p-4 space-y-4', borderColor)}>
      {/* Header */}
      <div className="flex items-start gap-3">
        {icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className={cn('text-sm font-semibold', headerColor)}>
              {overallSem === 'green'
                ? '¡Excelente día de prospección!'
                : overallSem === 'yellow'
                ? 'Progreso aceptable'
                : 'Por debajo de la meta'}
            </p>
            <span className="text-xs text-muted-foreground">
              {isRetroactive ? `Retroactivo — ${date}` : 'Hoy'}
            </span>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {/* Daily compliance */}
        {dailyActivities.length > 0 && (
          <div className="rounded-md bg-muted/40 p-2.5 text-center">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Cumpl. diario</p>
            <span className={cn('text-lg font-bold tabular-nums', semaphoreBgClass(dailyCompliance.semaphore).split(' ')[1])}>
              {dailyCompliance.pct.toFixed(0)}%
            </span>
            <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
              {dailyRealTotal}/{dailyGoalTotal}
            </p>
          </div>
        )}

        {/* Weekly compliance */}
        <div className="rounded-md bg-muted/40 p-2.5 text-center">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Cumpl. semanal</p>
          <span className={cn('text-lg font-bold tabular-nums', semaphoreBgClass(weeklyCompliance.semaphore).split(' ')[1])}>
            {weeklyCompliance.pct.toFixed(0)}%
          </span>
          <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
            {weeklyRealTotal}/{weeklyGoalTotal}
          </p>
        </div>

        {/* Completed today */}
        <div className="rounded-md bg-muted/40 p-2.5 text-center">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Completadas hoy</p>
          <span className="text-lg font-bold tabular-nums text-foreground">{completedToday}</span>
          <p className="text-[10px] text-muted-foreground mt-0.5">de {activities.length}</p>
        </div>

        {/* Week total */}
        <div className="rounded-md bg-muted/40 p-2.5 text-center">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Semana actual</p>
          <span className="text-lg font-bold tabular-nums text-foreground">{weeklyRealTotal}</span>
          <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">de {weeklyGoalTotal}</p>
        </div>
      </div>

      {/* Weekly progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Progreso semanal</span>
          <span className="text-[10px] tabular-nums text-muted-foreground">{weeklyCompliance.pct.toFixed(1)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              weeklyCompliance.semaphore === 'green'
                ? 'bg-emerald-400'
                : weeklyCompliance.semaphore === 'yellow'
                ? 'bg-amber-400'
                : 'bg-red-400'
            )}
            style={{ width: `${Math.min(weeklyCompliance.pct, 100)}%` }}
          />
        </div>
      </div>

      {/* Per-activity breakdown */}
      <div className="space-y-3">
        {[
          { label: 'OUTBOUND', items: outbound },
          { label: 'INBOUND', items: inbound },
        ]
          .filter(({ items }) => items.length > 0)
          .map(({ label, items }) => (
            <div key={label}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                {label}
              </p>
              <div className="space-y-2">
                {items.map((a) => {
                  const isWeekly = a.daily_goal < 1
                  const todayReal = values[a.id] ?? 0
                  const weekReal = weeklyDisplayValues[a.id] ?? 0
                  const weekGoal = a.weekly_goal
                  const weekPct = weekGoal > 0 ? Math.min((weekReal / weekGoal) * 100, 100) : 0
                  const weekSem = calcCompliance(weekReal, weekGoal).semaphore

                  return (
                    <div key={a.id} className="rounded-md border border-border/50 bg-muted/20 p-2.5 space-y-1.5">
                      {/* Name + badge */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium truncate flex-1 min-w-0">{a.name}</span>
                        <span className={cn(
                          'shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                          isWeekly ? 'bg-muted text-muted-foreground' : 'bg-blue-400/10 text-blue-400'
                        )}>
                          {isWeekly ? 'SEMANAL' : 'DIARIA'}
                        </span>
                      </div>

                      {/* Row 1: Hoy */}
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground w-10 shrink-0">Hoy:</span>
                        <span className="tabular-nums font-medium">
                          {todayReal}
                        </span>
                        <span className="text-muted-foreground">de</span>
                        <span className="tabular-nums">
                          {isWeekly ? '—' : a.daily_goal}
                        </span>
                        {!isWeekly && (
                          <span className={cn(
                            'ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
                            semaphoreBgClass(calcCompliance(todayReal, a.daily_goal).semaphore)
                          )}>
                            {a.daily_goal > 0 ? `${Math.round((todayReal / a.daily_goal) * 100)}%` : '—'}
                          </span>
                        )}
                      </div>

                      {/* Row 2: Semana */}
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground w-10 shrink-0">Semana:</span>
                        <span className="tabular-nums font-medium">{weekReal}</span>
                        <span className="text-muted-foreground">de</span>
                        <span className="tabular-nums">{weekGoal}</span>
                        <span className={cn(
                          'ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
                          semaphoreBgClass(weekSem)
                        )}>
                          {weekPct.toFixed(0)}%
                        </span>
                      </div>

                      {/* Weekly mini bar */}
                      <div className="h-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            weekSem === 'green' ? 'bg-emerald-400' : weekSem === 'yellow' ? 'bg-amber-400' : weekReal > 0 ? 'bg-red-400/60' : 'bg-muted'
                          )}
                          style={{ width: `${weekPct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
      </div>

      {/* Recipe pace widget — shown when an active scenario exists */}
      {paceValidation && (
        <RecipePaceWidget
          validation={paceValidation}
          weeklyOutbound={weeklyOutbound}
          weeklyInbound={weeklyInbound}
        />
      )}
    </div>
  )
}
