'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, FlaskConical } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RecipeValidation } from '@/lib/utils/recipe-validation'
import { STATUS_LABEL, STATUS_BG, STATUS_BAR } from '@/lib/utils/recipe-validation'

interface RecipeValidationCardProps {
  validation: RecipeValidation
}

interface BarRowProps {
  label: string
  plan: number
  recipe: number
  status: 'above' | 'close' | 'below'
}

function BarRow({ label, plan, recipe, status }: BarRowProps) {
  const pct = recipe > 0 ? Math.min((plan / recipe) * 100, 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums text-foreground font-medium">
          {Math.round(pct)}%
          <span className="ml-1.5 font-normal text-muted-foreground">({plan}/{recipe})</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', STATUS_BAR[status])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function RecipeValidationCard({ validation }: RecipeValidationCardProps) {
  const [expanded, setExpanded] = useState(false)
  const isAligned = validation.status.total !== 'below'

  return (
    <div className={cn(
      'rounded-lg border bg-card overflow-hidden',
      isAligned ? 'border-emerald-400/20' : 'border-amber-400/20',
    )}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FlaskConical className={cn('h-4 w-4', isAligned ? 'text-emerald-400' : 'text-amber-400')} />
          <span className="text-sm font-semibold">Plan vs Recetario</span>
          {isAligned ? (
            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-emerald-400/10 text-emerald-400">
              ✓ Alineado
            </span>
          ) : (
            <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', STATUS_BG[validation.status.total])}>
              {STATUS_LABEL[validation.status.total]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-[11px]">{validation.scenario.name}</span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Progress bars — always visible */}
      <div className="px-4 pb-3 space-y-2.5">
        <BarRow label="Total"    plan={validation.plan.total}    recipe={validation.recipe.total}    status={validation.status.total} />
        <BarRow label="Outbound" plan={validation.plan.outbound} recipe={validation.recipe.outbound} status={validation.status.outbound} />
        <BarRow label="Inbound"  plan={validation.plan.inbound}  recipe={validation.recipe.inbound}  status={validation.status.inbound} />
        <p className="text-[10px] text-muted-foreground pt-0.5">
          Actividades planeadas / mes vs las que necesita el Recetario
        </p>
      </div>

      {/* Expanded detail table */}
      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-x-4 pb-1.5 border-b border-border/50">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground w-20" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-right">Planeadas</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-right">Recetario</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-right">Gap</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground w-24 text-right">Estado</span>
          </div>
          {([
            { label: 'Total',    plan: validation.plan.total,    recipe: validation.recipe.total,    gap: validation.gaps.total,    status: validation.status.total },
            { label: 'Outbound', plan: validation.plan.outbound, recipe: validation.recipe.outbound, gap: validation.gaps.outbound, status: validation.status.outbound },
            { label: 'Inbound',  plan: validation.plan.inbound,  recipe: validation.recipe.inbound,  gap: validation.gaps.inbound,  status: validation.status.inbound },
          ] as const).map((row, i) => (
            <div key={row.label} className={cn(
              'grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-x-4 items-center py-1',
              i < 2 ? 'border-b border-border/30' : '',
            )}>
              <span className="text-xs w-20 text-muted-foreground">{row.label}</span>
              <span className="text-xs tabular-nums text-right text-foreground">{row.plan}</span>
              <span className="text-xs tabular-nums text-right text-muted-foreground">{row.recipe}</span>
              <span className={cn('text-xs tabular-nums font-semibold text-right', row.gap >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {row.gap >= 0 ? '+' : ''}{row.gap}
              </span>
              <div className="w-24 text-right">
                <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', STATUS_BG[row.status])}>
                  {STATUS_LABEL[row.status]}
                </span>
              </div>
            </div>
          ))}
          <Link href="/recipe" className="block text-center text-[11px] text-muted-foreground hover:text-foreground pt-1 transition-colors">
            Ver Recetario →
          </Link>
        </div>
      )}
    </div>
  )
}
