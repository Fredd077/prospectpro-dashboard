'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, FlaskConical } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RecipeValidation } from '@/lib/utils/recipe-validation'
import { STATUS_LABEL, STATUS_BG, STATUS_BAR } from '@/lib/utils/recipe-validation'
import type { PeriodType } from '@/lib/types/common'

interface RecetarioFunnelCardProps {
  validation: RecipeValidation
  period: PeriodType
  actualOutbound: number
  actualInbound: number
  pipelineByStage: Record<string, number>
}

const PERIOD_MULTIPLIER: Record<PeriodType, number> = {
  daily:     0.2,
  weekly:    1,
  monthly:   4.33,
  quarterly: 13,
  yearly:    52,
}

const PERIOD_LABEL: Record<PeriodType, string> = {
  daily:     'hoy',
  weekly:    'esta semana',
  monthly:   'este mes',
  quarterly: 'este trimestre',
  yearly:    'este año',
}

const PIPELINE_STAGES = [
  { key: 'Cita agendada',                                          label: 'Citas' },
  { key: 'Reagendar',                                              label: 'Reagendar' },
  { key: 'Primera reu ejecutada/Propuesta en preparación',         label: '1ra Reunión' },
  { key: 'Propuesta Presentada',                                   label: 'Propuesta' },
  { key: 'Por facturar/cobrar',                                    label: 'Cierre' },
]

function ActivityRow({ label, actual, target }: { label: string; actual: number; target: number }) {
  const pct = target > 0 ? Math.min((actual / target) * 100, 100) : 0
  const status = pct >= 100 ? 'above' : pct >= 70 ? 'close' : 'below'
  const barColor = STATUS_BAR[status]
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium text-foreground">
          {actual}
          <span className="ml-1 font-normal text-muted-foreground">/ {target}</span>
          <span className={cn('ml-1.5 text-[10px]', pct >= 100 ? 'text-emerald-400' : pct >= 70 ? 'text-amber-400' : 'text-red-400')}>
            {Math.round(pct)}%
          </span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function PlanBarRow({ label, plan, recipe, status }: {
  label: string; plan: number; recipe: number; status: 'above' | 'close' | 'below'
}) {
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
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', STATUS_BAR[status])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function RecetarioFunnelCard({
  validation,
  period,
  actualOutbound,
  actualInbound,
  pipelineByStage,
}: RecetarioFunnelCardProps) {
  const [planCollapsed, setPlanCollapsed] = useState(true)

  const mult       = PERIOD_MULTIPLIER[period]
  const targetOut  = Math.max(1, Math.round(validation.weeklyRecipe.outbound * mult))
  const targetIn   = Math.max(1, Math.round(validation.weeklyRecipe.inbound  * mult))
  const targetTotal = targetOut + targetIn
  const actualTotal = actualOutbound + actualInbound

  const isAligned = validation.status.total !== 'below'
  const hasPipeline = Object.values(pipelineByStage).some(v => v > 0)

  return (
    <div className={cn(
      'rounded-lg border bg-card overflow-hidden h-full flex flex-col',
      isAligned ? 'border-emerald-400/20' : 'border-amber-400/20',
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50">
        <FlaskConical className={cn('h-4 w-4 shrink-0', isAligned ? 'text-emerald-400' : 'text-amber-400')} />
        <span className="text-xs font-semibold text-foreground">Recetario</span>
        <span className="text-[11px] text-muted-foreground truncate">{validation.scenario.name}</span>
        <Link href="/recipe" className="ml-auto text-[10px] text-primary hover:text-primary/80 transition-colors shrink-0">
          Ver →
        </Link>
      </div>

      <div className="flex-1 p-4 space-y-5">
        {/* Section A: Actividades del período vs target del recetario */}
        <div className="space-y-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Actividades {PERIOD_LABEL[period]}
          </p>
          <ActivityRow label="Outbound" actual={actualOutbound} target={targetOut} />
          <ActivityRow label="Inbound"  actual={actualInbound}  target={targetIn} />
          <ActivityRow label="Total"    actual={actualTotal}     target={targetTotal} />
          <p className="text-[10px] text-muted-foreground/60">
            vs target semanal del recetario ×{mult === 1 ? '' : ` ${mult}`}
          </p>
        </div>

        {/* Section B: Pipeline del período */}
        {hasPipeline && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Pipeline del período
            </p>
            <div className="grid grid-cols-5 gap-1 text-center">
              {PIPELINE_STAGES.map(s => (
                <div key={s.key} className="space-y-0.5">
                  <p className="text-sm font-bold tabular-nums text-foreground">
                    {pipelineByStage[s.key] ?? 0}
                  </p>
                  <p className="text-[9px] text-muted-foreground leading-tight">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section C: Plan vs Recetario (collapsible) */}
        <div className="border border-border/50 rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => setPlanCollapsed(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">Plan vs Escenario (mensual)</span>
              {isAligned ? (
                <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-emerald-400/10 text-emerald-400">✓ Alineado</span>
              ) : (
                <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', STATUS_BG[validation.status.total])}>
                  {STATUS_LABEL[validation.status.total]}
                </span>
              )}
            </div>
            <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 shrink-0', !planCollapsed && 'rotate-180')} />
          </button>
          {!planCollapsed && (
            <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border/50">
              <PlanBarRow label="Total"    plan={validation.plan.total}    recipe={validation.recipe.total}    status={validation.status.total} />
              <PlanBarRow label="Outbound" plan={validation.plan.outbound} recipe={validation.recipe.outbound} status={validation.status.outbound} />
              <PlanBarRow label="Inbound"  plan={validation.plan.inbound}  recipe={validation.recipe.inbound}  status={validation.status.inbound} />
              <p className="text-[10px] text-muted-foreground/60">Actividades planeadas / mes vs las que necesita el Recetario</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
