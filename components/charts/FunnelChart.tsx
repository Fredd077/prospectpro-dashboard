'use client'

import { cn } from '@/lib/utils'

export interface FunnelStage {
  label: string
  planned: number
  actual?: number
}

interface FunnelChartProps {
  stages: FunnelStage[]
}

function semColor(actual: number, planned: number): string {
  if (planned === 0) return 'bg-muted'
  const pct = (actual / planned) * 100
  if (pct >= 100) return 'bg-emerald-400'
  if (pct >= 70)  return 'bg-amber-400'
  return 'bg-red-400/70'
}

function semTextColor(actual: number, planned: number): string {
  if (planned === 0) return 'text-muted-foreground'
  const pct = (actual / planned) * 100
  if (pct >= 100) return 'text-emerald-400'
  if (pct >= 70)  return 'text-amber-400'
  return 'text-red-400'
}

export function FunnelChart({ stages }: FunnelChartProps) {
  if (stages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <p className="text-sm text-muted-foreground">Sin datos de funnel</p>
        <p className="text-xs text-muted-foreground/60 max-w-xs">
          Crea un escenario activo en el Recetario para ver el funnel de conversión.
        </p>
      </div>
    )
  }

  const maxPlanned = Math.max(...stages.map((s) => s.planned), 1)

  return (
    <div className="space-y-3 py-2 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1 mb-4">
        <span className="font-medium uppercase tracking-widest">Etapa</span>
        <div className="flex items-center gap-6">
          <span>Plan</span>
          <span>Real</span>
          <span className="w-24 text-right">% Cumpl.</span>
        </div>
      </div>

      {stages.map((stage, i) => {
        const plannedPct = (stage.planned / maxPlanned) * 100
        const hasActual  = stage.actual !== undefined
        const actualPct  = hasActual ? Math.min((stage.actual! / Math.max(stage.planned, 1)) * 100, 150) : null
        const barActualPct = hasActual
          ? Math.min((stage.actual! / maxPlanned) * 100, plannedPct)
          : null

        return (
          <div key={i} className="space-y-1.5">
            {/* Labels row */}
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-medium text-foreground">{stage.label}</span>
              <div className="flex items-center gap-6 tabular-nums">
                <span className="text-muted-foreground">{stage.planned}</span>
                {hasActual ? (
                  <span className={semTextColor(stage.actual!, stage.planned)}>
                    {stage.actual}
                  </span>
                ) : (
                  <span className="text-muted-foreground/40">—</span>
                )}
                <span className="w-24 text-right">
                  {actualPct !== null ? (
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-xs font-medium',
                        actualPct >= 100
                          ? 'bg-emerald-400/10 text-emerald-400'
                          : actualPct >= 70
                          ? 'bg-amber-400/10 text-amber-400'
                          : 'bg-red-400/10 text-red-400'
                      )}
                    >
                      {actualPct.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground/40 text-xs">—</span>
                  )}
                </span>
              </div>
            </div>

            {/* Bar */}
            <div className="relative h-7 rounded-md bg-muted/30 overflow-hidden">
              {/* Planned track */}
              <div
                className="absolute inset-y-0 left-0 rounded-md bg-blue-400/15 border border-blue-400/20 transition-all duration-500"
                style={{ width: `${plannedPct}%` }}
              />
              {/* Actual fill */}
              {barActualPct !== null && (
                <div
                  className={cn(
                    'absolute inset-y-1 left-0 rounded transition-all duration-700',
                    semColor(stage.actual!, stage.planned)
                  )}
                  style={{ width: `${barActualPct}%`, opacity: 0.85 }}
                />
              )}
              {/* Stage number label inside bar */}
              <div className="absolute inset-0 flex items-center px-2.5">
                <span className="text-xs font-semibold text-foreground/40 select-none">
                  {i + 1}
                </span>
              </div>
            </div>

            {/* Conversion rate to next stage */}
            {i < stages.length - 1 && stages[i + 1].planned > 0 && stage.planned > 0 && (
              <div className="flex justify-end pr-2">
                <span className="text-[10px] text-muted-foreground/50">
                  → {((stages[i + 1].planned / stage.planned) * 100).toFixed(1)}% conversión
                </span>
              </div>
            )}
          </div>
        )
      })}

      {/* Legend */}
      <div className="flex items-center gap-4 pt-4 text-xs text-muted-foreground border-t border-border">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-7 rounded-sm bg-blue-400/25 border border-blue-400/30" />
          Plan
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-7 rounded-sm bg-emerald-400" />
          Real ≥100%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-7 rounded-sm bg-amber-400" />
          70–99%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-7 rounded-sm bg-red-400/70" />
          &lt;70%
        </span>
      </div>
    </div>
  )
}
