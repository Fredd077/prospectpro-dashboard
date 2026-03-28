import Link from 'next/link'
import { FlaskConical, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RecipeValidation } from '@/lib/utils/recipe-validation'
import { STATUS_LABEL, STATUS_BG } from '@/lib/utils/recipe-validation'

interface RecipePlanBannerProps {
  validation: RecipeValidation
  showScenarioName?: boolean
}

function GapSign({ gap }: { gap: number }) {
  return (
    <span className={cn('font-data tabular-nums font-semibold', gap >= 0 ? 'text-emerald-400' : 'text-red-400')}>
      {gap >= 0 ? '+' : ''}{gap}
    </span>
  )
}

export function RecipePlanBanner({ validation, showScenarioName = false }: RecipePlanBannerProps) {
  const rows = [
    { label: 'Total',    plan: validation.plan.total,    recipe: validation.recipe.total,    gap: validation.gaps.total,    status: validation.status.total },
    { label: 'Outbound', plan: validation.plan.outbound, recipe: validation.recipe.outbound, gap: validation.gaps.outbound, status: validation.status.outbound },
    { label: 'Inbound',  plan: validation.plan.inbound,  recipe: validation.recipe.inbound,  gap: validation.gaps.inbound,  status: validation.status.inbound },
  ]

  const hasBelow = Object.values(validation.status).some((s) => s === 'below')
  const isAligned = validation.status.total !== 'below'

  return (
    <div className={cn(
      'rounded-lg border bg-card overflow-hidden',
      isAligned ? 'border-emerald-400/20' : 'border-amber-400/20',
    )}>
      {/* Header */}
      <div className={cn(
        'flex items-center justify-between px-4 py-2.5 border-b',
        isAligned ? 'bg-emerald-400/5 border-emerald-400/10' : 'bg-amber-400/5 border-amber-400/10',
      )}>
        <div className="flex items-center gap-2">
          <FlaskConical className={cn('h-4 w-4', isAligned ? 'text-emerald-400' : 'text-amber-400')} />
          <span className="text-sm font-semibold">Tu plan vs Recetario</span>
          {showScenarioName && (
            <span className="text-xs text-muted-foreground">— {validation.scenario.name}</span>
          )}
        </div>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
          Actividades / mes
        </span>
      </div>

      {/* Table */}
      <div className="px-4 py-3">
        {/* Column headers */}
        <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-x-4 pb-1.5 mb-1 border-b border-border/50">
          <span className="w-20 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50" />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50 text-right">Planeadas</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50 text-right">Recetario</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50 text-right">Gap</span>
          <span className="w-24 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50 text-right">Estado</span>
        </div>

        {rows.map((row, i) => (
          <div
            key={row.label}
            className={cn(
              'grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-x-4 items-center py-1.5',
              i < rows.length - 1 ? 'border-b border-border/30' : '',
              i === 0 ? 'font-semibold' : '',
            )}
          >
            <span className={cn('w-20 text-sm', i === 0 ? 'text-foreground' : 'text-muted-foreground')}>
              {row.label}
            </span>
            <span className="font-data text-sm tabular-nums text-right text-foreground">{row.plan}</span>
            <span className="font-data text-sm tabular-nums text-right text-muted-foreground">{row.recipe}</span>
            <div className="text-right">
              <GapSign gap={row.gap} />
            </div>
            <div className="w-24 text-right">
              <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', STATUS_BG[row.status])}>
                {STATUS_LABEL[row.status]}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Context message */}
      <div className={cn(
        'flex items-center justify-between gap-4 px-4 py-2.5 border-t',
        hasBelow ? 'border-amber-400/10 bg-amber-400/5' : 'border-emerald-400/10 bg-emerald-400/5',
      )}>
        {hasBelow ? (
          <>
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="text-xs">
                Ajusta tus metas de actividades para alinearte con este escenario
              </span>
            </div>
            <Link
              href="/activities"
              className="shrink-0 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-400 hover:bg-amber-400/20 transition-colors"
            >
              Ir a Actividades
            </Link>
          </>
        ) : (
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span className="text-xs">
              Tu plan de actividades está alineado con este recetario
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
