'use client'

import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DeviationAlertProps {
  totalReal: number
  totalGoal: number
  periodLabel: string
}

export function DeviationAlert({ totalReal, totalGoal, periodLabel }: DeviationAlertProps) {
  if (totalGoal === 0) return null

  const deviation = totalReal - totalGoal
  const pct = (totalReal / totalGoal) * 100
  const behind = deviation < 0
  const onTrack = pct >= 70

  if (pct >= 100) return null // No alert needed when on track

  return (
    <div
      className={cn(
        'rounded-lg border p-4 flex items-start gap-3',
        behind && !onTrack
          ? 'border-red-400/30 bg-red-400/5'
          : 'border-amber-400/30 bg-amber-400/5'
      )}
    >
      <div className={cn(
        'mt-0.5 shrink-0',
        behind && !onTrack ? 'text-red-400' : 'text-amber-400'
      )}>
        {behind && !onTrack ? (
          <TrendingDown className="h-4 w-4" />
        ) : (
          <AlertTriangle className="h-4 w-4" />
        )}
      </div>
      <div>
        <p className={cn(
          'text-sm font-medium',
          behind && !onTrack ? 'text-red-400' : 'text-amber-400'
        )}>
          {behind && !onTrack ? 'Por debajo de la meta' : 'Progreso moderado'}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {periodLabel}: {totalReal} de {totalGoal} actividades completadas (
          {pct.toFixed(1)}%). Desviación: {deviation >= 0 ? '+' : ''}{deviation} actividades.
        </p>
      </div>
    </div>
  )
}
