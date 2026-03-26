import { CheckCircle2, AlertTriangle, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { semaphoreBgClass } from '@/lib/utils/colors'
import { calcCompliance } from '@/lib/calculations/compliance'
import type { Activity } from '@/lib/types/database'

interface CheckinSummaryProps {
  date: string
  activities: Activity[]
  values: Record<string, number>
  isRetroactive: boolean
}

export function CheckinSummary({ date, activities, values, isRetroactive }: CheckinSummaryProps) {
  const totalGoal = activities.reduce((s, a) => s + a.daily_goal, 0)
  const totalReal = activities.reduce((s, a) => s + (values[a.id] ?? 0), 0)
  const { pct, semaphore, deviation } = calcCompliance(totalReal, totalGoal)

  const icon =
    semaphore === 'green' ? (
      <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
    ) : semaphore === 'yellow' ? (
      <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
    ) : (
      <TrendingDown className="h-5 w-5 text-red-400 shrink-0" />
    )

  const borderColor =
    semaphore === 'green'
      ? 'border-emerald-400/20 bg-emerald-400/5'
      : semaphore === 'yellow'
      ? 'border-amber-400/20 bg-amber-400/5'
      : 'border-red-400/20 bg-red-400/5'

  const headerColor =
    semaphore === 'green'
      ? 'text-emerald-400'
      : semaphore === 'yellow'
      ? 'text-amber-400'
      : 'text-red-400'

  const outbound = activities.filter((a) => a.type === 'OUTBOUND')
  const inbound  = activities.filter((a) => a.type === 'INBOUND')

  return (
    <div className={cn('rounded-lg border p-4 space-y-4', borderColor)}>
      {/* Header */}
      <div className="flex items-start gap-3">
        {icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className={cn('text-sm font-semibold', headerColor)}>
              {semaphore === 'green'
                ? '¡Meta del día completada!'
                : semaphore === 'yellow'
                ? 'Progreso aceptable'
                : 'Por debajo de la meta'}
            </p>
            <span className={cn('rounded px-2 py-0.5 text-xs font-medium tabular-nums', semaphoreBgClass(semaphore))}>
              {pct.toFixed(1)}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {isRetroactive ? `Entrada retroactiva — ${date}` : 'Hoy'}
            {' · '}
            <span className="tabular-nums">{totalReal}</span> de{' '}
            <span className="tabular-nums">{totalGoal}</span> actividades
            {deviation !== 0 && (
              <span className={deviation >= 0 ? ' text-emerald-400' : ' text-red-400'}>
                {' '}({deviation >= 0 ? '+' : ''}{deviation})
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700',
            semaphore === 'green' ? 'bg-emerald-400' : semaphore === 'yellow' ? 'bg-amber-400' : 'bg-red-400'
          )}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
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
              <div className="space-y-1">
                {items.map((a) => {
                  const real = values[a.id] ?? 0
                  const { semaphore: sem } = calcCompliance(real, a.daily_goal)
                  const rowPct = a.daily_goal > 0 ? Math.min((real / a.daily_goal) * 100, 100) : 0
                  return (
                    <div key={a.id} className="flex items-center gap-2 text-xs">
                      <span className="truncate text-muted-foreground flex-1 min-w-0">{a.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              sem === 'green' ? 'bg-emerald-400' : sem === 'yellow' ? 'bg-amber-400' : real > 0 ? 'bg-red-400/60' : 'bg-muted'
                            )}
                            style={{ width: `${rowPct}%` }}
                          />
                        </div>
                        <span className={cn(
                          'tabular-nums font-medium w-12 text-right',
                          sem === 'green' ? 'text-emerald-400' : sem === 'yellow' ? 'text-amber-400' : real > 0 ? 'text-red-400' : 'text-muted-foreground'
                        )}>
                          {real}/{a.daily_goal}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}
