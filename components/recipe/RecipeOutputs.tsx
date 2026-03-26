'use client'

import { formatDecimal, formatCurrency } from '@/lib/utils/formatters'
import type { RecipeOutputs as RecipeOutputsType, ChannelFunnel } from '@/lib/calculations/recipe'

interface RecipeOutputsProps {
  outputs: RecipeOutputsType
  monthlyRevenueGoal: number
  averageTicket: number
}

function FunnelColumn({
  funnel,
  label,
  color,
}: {
  funnel: ChannelFunnel
  label: string
  color: 'blue' | 'violet'
}) {
  const borderColor = color === 'blue' ? 'border-blue-400/30' : 'border-violet-400/30'
  const bgColor     = color === 'blue' ? 'bg-blue-400/5'      : 'bg-violet-400/5'
  const textColor   = color === 'blue' ? 'text-blue-400'      : 'text-violet-400'
  const barColor    = color === 'blue' ? '#60a5fa'             : '#a78bfa'

  const stages = [
    { label: 'Actividades / mes', value: funnel.activities_monthly },
    { label: 'Discursos',         value: funnel.speeches_needed },
    { label: 'Reuniones',         value: funnel.meetings_needed },
    { label: 'Propuestas',        value: funnel.proposals_needed },
    { label: 'Cierres',           value: funnel.closes_needed },
  ]
  const max = stages[0].value || 1

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} overflow-hidden`}>
      {/* Header */}
      <div className={`px-4 py-3 border-b ${borderColor}`}>
        <p className={`text-xs font-semibold uppercase tracking-wider ${textColor}`}>{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Meta: {formatCurrency(funnel.revenue_goal)}
        </p>
      </div>

      {/* Key numbers */}
      <div className="grid grid-cols-3 divide-x divide-border border-b border-border/40">
        <div className="px-3 py-2 text-center">
          <p className="text-[10px] text-muted-foreground">día</p>
          <p className={`text-base font-bold ${textColor}`}>{formatDecimal(funnel.activities_daily)}</p>
          <p className="text-[10px] text-muted-foreground">activ.</p>
        </div>
        <div className="px-3 py-2 text-center">
          <p className="text-[10px] text-muted-foreground">semana</p>
          <p className={`text-base font-bold ${textColor}`}>{formatDecimal(funnel.activities_weekly)}</p>
          <p className="text-[10px] text-muted-foreground">activ.</p>
        </div>
        <div className="px-3 py-2 text-center">
          <p className="text-[10px] text-muted-foreground">cierres</p>
          <p className={`text-base font-bold ${textColor}`}>{formatDecimal(funnel.closes_needed)}</p>
          <p className="text-[10px] text-muted-foreground">/ mes</p>
        </div>
      </div>

      {/* Funnel visual */}
      <div className="px-4 py-3 space-y-2">
        {stages.map((s, i) => {
          const pct = (s.value / max) * 100
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-24 text-right shrink-0 leading-tight">
                {s.label}
              </span>
              <div className="flex-1 h-4 relative">
                <div
                  className="absolute left-0 top-0 h-full rounded-sm transition-all"
                  style={{ width: `${pct}%`, background: barColor, opacity: 0.7 - i * 0.08 }}
                />
              </div>
              <span className="text-xs tabular-nums text-foreground w-12 shrink-0 text-right">
                {formatDecimal(s.value)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function RecipeOutputs({ outputs, monthlyRevenueGoal, averageTicket }: RecipeOutputsProps) {
  return (
    <div className="space-y-4">
      {/* Total summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Meta total</p>
          <p className="text-sm font-semibold text-foreground">{formatCurrency(monthlyRevenueGoal)}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total activ./día</p>
          <p className="text-sm font-semibold text-foreground">{formatDecimal(outputs.activities_needed_daily)}</p>
        </div>
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/5 p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total cierres</p>
          <p className="text-sm font-semibold text-emerald-400">{formatDecimal(outputs.closes_needed_monthly)}</p>
        </div>
      </div>

      {/* Two independent funnels */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FunnelColumn funnel={outputs.outbound} label="Outbound" color="blue" />
        <FunnelColumn funnel={outputs.inbound}  label="Inbound"  color="violet" />
      </div>
    </div>
  )
}
