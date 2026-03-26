import Link from 'next/link'
import { CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDisplayDate } from '@/lib/utils/dates'
import { calcCompliance } from '@/lib/calculations/compliance'
import { semaphoreBgClass } from '@/lib/utils/colors'

interface TodayWidgetProps {
  today: string
  totalReal: number
  totalGoal: number
  hasActivities: boolean
}

export function TodayWidget({ today, totalReal, totalGoal, hasActivities }: TodayWidgetProps) {
  const done = totalGoal > 0 && totalReal > 0
  const compliance = calcCompliance(totalReal, totalGoal)
  const checkinDone = done && compliance.pct >= 50

  if (!hasActivities) return null

  return (
    <div className={cn(
      'rounded-lg border p-4 flex items-center gap-4',
      checkinDone
        ? 'border-emerald-400/20 bg-emerald-400/5'
        : 'border-amber-400/20 bg-amber-400/5'
    )}>
      {/* Icon */}
      <div className="shrink-0">
        {checkinDone
          ? <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          : <AlertCircle className="h-5 w-5 text-amber-400" />
        }
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{formatDisplayDate(today)}</p>
        <p className="text-sm font-medium text-foreground mt-0.5">
          {checkinDone
            ? 'Check-in registrado'
            : totalReal === 0
            ? 'Check-in pendiente para hoy'
            : 'Check-in en progreso'
          }
        </p>
        {totalGoal > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
            {totalReal} de {totalGoal} actividades
            {' '}
            <span className={cn(
              'font-semibold',
              compliance.semaphore === 'green' ? 'text-emerald-400'
              : compliance.semaphore === 'yellow' ? 'text-amber-400'
              : 'text-red-400'
            )}>
              ({compliance.pct.toFixed(0)}%)
            </span>
          </p>
        )}
      </div>

      {/* Progress bar */}
      {totalGoal > 0 && (
        <div className="hidden sm:block w-24 shrink-0">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                compliance.semaphore === 'green' ? 'bg-emerald-400'
                : compliance.semaphore === 'yellow' ? 'bg-amber-400'
                : 'bg-red-400'
              )}
              style={{ width: `${Math.min(compliance.pct, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* CTA */}
      {!checkinDone && (
        <Link
          href="/checkin"
          className="shrink-0 flex items-center gap-1 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-400/20"
        >
          Ir al check-in
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  )
}
