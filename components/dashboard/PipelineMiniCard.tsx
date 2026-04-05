import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { todayISO } from '@/lib/utils/dates'
import {
  calcRealConversions,
  calcPipelineValue,
  fmtUSD,
} from '@/lib/calculations/pipeline'
import { calcRecipe, DEFAULT_FUNNEL_STAGES, DEFAULT_OUTBOUND_RATES, DEFAULT_INBOUND_RATES } from '@/lib/calculations/recipe'
import { cn } from '@/lib/utils'

function semClass(gap: number) {
  if (gap >= 0)    return 'text-emerald-400'
  if (gap >= -10)  return 'text-amber-400'
  return 'text-red-400'
}

function semEmoji(gap: number) {
  if (gap >= 0)   return '🟢'
  if (gap >= -10) return '🟡'
  return '🔴'
}

export async function PipelineMiniCard() {
  const sb      = await getSupabaseServerClient()
  const today   = todayISO()
  const monthStart = today.slice(0, 8) + '01'

  const [{ data: scenario }, { data: entries }, { data: actLogs }] = await Promise.all([
    sb.from('recipe_scenarios').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('pipeline_entries').select('stage,quantity,amount_usd').gte('entry_date', monthStart).lte('entry_date', today),
    sb.from('activity_logs').select('real_executed').gte('log_date', monthStart).lte('log_date', today),
  ])

  if (!scenario || (!entries?.length && !actLogs?.length)) return null

  const stages       = scenario.funnel_stages ?? DEFAULT_FUNNEL_STAGES
  const outboundRates = scenario.outbound_rates ?? DEFAULT_OUTBOUND_RATES
  const inboundRates  = scenario.inbound_rates  ?? DEFAULT_INBOUND_RATES
  const activityTotal = (actLogs ?? []).reduce((s, l) => s + l.real_executed, 0)

  // Combined planned rates: average of outbound+inbound weighted by outbound_pct
  const combinedRates = outboundRates.map((r, i) => {
    const ob = (scenario.outbound_pct ?? 80) / 100
    return Math.round(r * ob + (inboundRates[i] ?? r) * (1 - ob))
  })

  const conversions  = calcRealConversions(activityTotal, entries ?? [], stages, combinedRates)
  const pipelineValue = calcPipelineValue(entries ?? [], stages)

  // Planned stage counts for this month
  const recipeResult = calcRecipe({
    monthly_revenue_goal:   scenario.monthly_revenue_goal,
    average_ticket:         scenario.average_ticket,
    outbound_pct:           scenario.outbound_pct,
    working_days_per_month: scenario.working_days_per_month,
    funnel_stages:  stages,
    outbound_rates: outboundRates,
    inbound_rates:  inboundRates,
  })

  const countByStage: Record<string, number> = {}
  for (const e of entries ?? []) {
    countByStage[e.stage] = (countByStage[e.stage] ?? 0) + e.quantity
  }

  // Mini-funnel: activities + first 4 pipeline stages max
  const displayStages = stages.slice(0, 5)

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Funnel Real — este mes</h2>
        <Link
          href="/pipeline"
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          Ver pipeline completo <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Horizontal mini-funnel */}
      <div className="flex items-end gap-1 overflow-x-auto pb-1">
        {displayStages.map((stage, i) => {
          const real    = i === 0 ? activityTotal : (countByStage[stage] ?? 0)
          const planned = Math.ceil(
            (recipeResult.outbound.stage_values[i] ?? 0) + (recipeResult.inbound.stage_values[i] ?? 0)
          )
          const pct  = planned > 0 ? Math.round((real / planned) * 100) : 0
          const gap  = pct - 100

          return (
            <div key={stage} className="flex-1 min-w-0 text-center space-y-1">
              {i > 0 && (
                <div className="flex items-center justify-start mb-1">
                  <span className="text-muted-foreground/40 text-xs">→</span>
                </div>
              )}
              <p className="text-[9px] text-muted-foreground truncate px-0.5" title={stage}>{stage}</p>
              <p className="text-xs font-bold tabular-nums text-foreground">
                {real.toLocaleString('es-CO')}<span className="text-muted-foreground/60">/{planned.toLocaleString('es-CO')}</span>
              </p>
              <span className={cn('text-[10px] font-semibold', semClass(gap))}>
                {semEmoji(gap)} {pct}%
              </span>
            </div>
          )
        })}
      </div>

      {/* Pipeline value row */}
      <div className="flex items-center gap-3 text-xs border-t border-border/50 pt-3">
        <span className="text-muted-foreground">💰 Pipeline:</span>
        <span className="font-semibold text-foreground">{fmtUSD(pipelineValue.open)}</span>
        <span className="text-muted-foreground/50">|</span>
        <span className="text-muted-foreground">Cerrado:</span>
        <span className="font-semibold text-emerald-400">{fmtUSD(pipelineValue.closed)}</span>
      </div>

      {/* Conversion rate comparison table */}
      {conversions.some((c) => c.fromCount > 0) && (
        <div className="rounded border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="px-2 py-1.5 text-left text-[9px] uppercase tracking-wider text-muted-foreground">Transición</th>
                <th className="px-2 py-1.5 text-right text-[9px] uppercase tracking-wider text-muted-foreground">Real</th>
                <th className="px-2 py-1.5 text-right text-[9px] uppercase tracking-wider text-muted-foreground">Plan</th>
                <th className="px-2 py-1.5 text-right text-[9px] uppercase tracking-wider text-muted-foreground">Δ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {conversions.map((c) => (
                <tr key={`${c.fromStage}-${c.toStage}`}>
                  <td className="px-2 py-1.5 text-foreground/70">{c.fromStage.slice(0, 4)}→{c.toStage.slice(0, 4)}</td>
                  <td className={cn('px-2 py-1.5 text-right font-semibold tabular-nums', semClass(c.gap))}>
                    {c.fromCount > 0 ? `${c.realConversion}%` : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-right text-muted-foreground tabular-nums">{c.plannedConversion}%</td>
                  <td className={cn('px-2 py-1.5 text-right font-semibold tabular-nums', semClass(c.gap))}>
                    {c.fromCount > 0 ? (c.gap >= 0 ? `+${c.gap}%` : `${c.gap}%`) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
