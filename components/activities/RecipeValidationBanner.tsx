import Link from 'next/link'
import { FlaskConical, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RecipeValidation } from '@/lib/utils/recipe-validation'
import { STATUS_LABEL, STATUS_BG } from '@/lib/utils/recipe-validation'

interface RecipeValidationBannerProps {
  validation: RecipeValidation | null
}

function GapSign({ gap }: { gap: number }) {
  return (
    <span className={cn('tabular-nums font-semibold', gap >= 0 ? 'text-emerald-400' : 'text-red-400')}>
      {gap >= 0 ? '+' : ''}{gap}
    </span>
  )
}

export function RecipeValidationBanner({ validation }: RecipeValidationBannerProps) {
  if (!validation) {
    return (
      <Link
        href="/recipe"
        className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-card px-4 py-3 text-sm text-muted-foreground hover:border-border/80 hover:text-foreground transition-colors"
      >
        <FlaskConical className="h-4 w-4 shrink-0" />
        <span>Configura tu Recetario para ver si tu plan de actividades alcanza tu meta de ventas</span>
        <ArrowRight className="h-4 w-4 ml-auto shrink-0" />
      </Link>
    )
  }

  const rows = [
    { label: 'Total',    plan: validation.plan.total,    recipe: validation.recipe.total,    gap: validation.gaps.total,    status: validation.status.total },
    { label: 'Outbound', plan: validation.plan.outbound, recipe: validation.recipe.outbound, gap: validation.gaps.outbound, status: validation.status.outbound },
    { label: 'Inbound',  plan: validation.plan.inbound,  recipe: validation.recipe.inbound,  gap: validation.gaps.inbound,  status: validation.status.inbound },
  ]

  const isAligned = validation.status.total !== 'below'

  return (
    <Link href="/recipe" className="block group">
      <div className={cn(
        'rounded-lg border bg-card overflow-hidden transition-colors group-hover:border-border/80',
        isAligned ? 'border-emerald-400/20' : 'border-red-400/20',
      )}>
        {/* Header */}
        <div className={cn(
          'flex items-center justify-between px-4 py-2.5 border-b',
          isAligned ? 'bg-emerald-400/5 border-emerald-400/10' : 'bg-red-400/5 border-red-400/10',
        )}>
          <div className="flex items-center gap-2">
            <FlaskConical className={cn('h-4 w-4', isAligned ? 'text-emerald-400' : 'text-red-400')} />
            <span className="text-sm font-semibold">Tu plan vs Recetario</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{validation.scenario.name}</span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>

        {/* Table */}
        <div className="px-4 py-3 space-y-0">
          {/* Column headers */}
          <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-x-4 pb-1.5 mb-1.5 border-b border-border/50">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground w-20" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-right">Planeadas</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-right">Recetario</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-right">Gap</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground w-24 text-right">Estado</span>
          </div>

          {rows.map((row, i) => (
            <div
              key={row.label}
              className={cn(
                'grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-x-4 items-center py-1.5',
                i < rows.length - 1 ? 'border-b border-border/30' : '',
                i === 0 ? 'font-semibold' : 'font-normal',
              )}
            >
              <span className={cn('text-sm w-20', i === 0 ? 'text-foreground' : 'text-muted-foreground')}>
                {row.label}
              </span>
              <span className="text-sm tabular-nums text-right text-foreground">{row.plan}</span>
              <span className="text-sm tabular-nums text-right text-muted-foreground">{row.recipe}</span>
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
      </div>
    </Link>
  )
}
