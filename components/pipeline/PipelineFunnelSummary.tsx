'use client'

import type { ConversionResult } from '@/lib/calculations/pipeline'
import { fmtUSD } from '@/lib/calculations/pipeline'
import { cn } from '@/lib/utils'

export interface StageStat {
  stage: string
  real: number
  planned: number
  realOutbound?: number  // present when showing combined (no type filter)
  realInbound?: number
}

interface PipelineFunnelSummaryProps {
  stages: string[]
  stageStats: StageStat[]
  conversions: ConversionResult[]
  openAmount: number
  closedAmount: number
  monthlyGoal: number
  periodLabel: string
  typeFilter?: 'OUTBOUND' | 'INBOUND' | null
}

function semClass(gap: number) {
  if (gap >= 0)    return 'text-emerald-400'
  if (gap >= -10)  return 'text-amber-400'
  return 'text-red-400'
}

function semBg(gap: number) {
  if (gap >= 0)    return 'bg-emerald-400/10 border-emerald-400/20 text-emerald-400'
  if (gap >= -10)  return 'bg-amber-400/10 border-amber-400/20 text-amber-400'
  return 'bg-red-400/10 border-red-400/20 text-red-400'
}

function semEmoji(gap: number) {
  if (gap >= 0)   return '🟢'
  if (gap >= -10) return '🟡'
  return '🔴'
}

export function PipelineFunnelSummary({
  stages,
  stageStats,
  conversions,
  openAmount,
  closedAmount,
  monthlyGoal,
  periodLabel,
  typeFilter,
}: PipelineFunnelSummaryProps) {
  const revenuePct = monthlyGoal > 0 ? Math.round((closedAmount / monthlyGoal) * 100) : 0

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          Funnel Real vs Recetario — <span className="text-muted-foreground font-normal capitalize">{periodLabel}</span>
        </h2>
        {/* Legend — only for combined view */}
        {!typeFilter && (
          <div className="flex items-center gap-3 shrink-0">
            <span className="flex items-center gap-1 text-[10px] text-cyan-400">
              <span className="inline-block h-1.5 w-3 rounded-full bg-cyan-400" /> OUTBOUND
            </span>
            <span className="flex items-center gap-1 text-[10px] text-purple-400">
              <span className="inline-block h-1.5 w-3 rounded-full bg-purple-400" /> INBOUND
            </span>
          </div>
        )}
        {typeFilter && (
          <span className={cn(
            'text-[10px] font-bold px-2 py-0.5 rounded border',
            typeFilter === 'OUTBOUND' ? 'bg-cyan-400/10 text-cyan-400 border-cyan-400/20' : 'bg-purple-400/10 text-purple-400 border-purple-400/20'
          )}>
            {typeFilter}
          </span>
        )}
      </div>

      {/* Stage rows */}
      <div className="space-y-3">
        {stageStats.map((stat, i) => {
          const pct = stat.planned > 0 ? Math.round((stat.real / stat.planned) * 100) : 0
          const gap = stat.planned > 0 ? pct - 100 : 0
          const barPct = Math.min(100, pct)
          const conv = conversions[i - 1] // conversion INTO this stage (from previous)

          return (
            <div key={stat.stage}>
              {/* Conversion arrow between stages */}
              {i > 0 && conv && (
                <div className="flex items-center gap-2 py-1 pl-2">
                  <span className="text-muted-foreground/40 text-xs">↓</span>
                  <span className="text-xs text-muted-foreground">
                    Conv. real: <span className={cn('font-semibold', semClass(conv.gap))}>{conv.realConversion}%</span>
                    {' '}|{' '}
                    Plan: <span className="text-muted-foreground/70">{conv.plannedConversion}%</span>
                    {' '}
                    <span className={cn('font-semibold', semClass(conv.gap))}>
                      {conv.gap >= 0 ? `+${conv.gap}%` : `${conv.gap}%`} {semEmoji(conv.gap)}
                    </span>
                  </span>
                </div>
              )}

              {/* Stage row */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{stat.stage}</span>
                  <div className="flex items-center gap-2">
                    {!typeFilter && stat.realOutbound !== undefined && stat.realInbound !== undefined ? (
                      <span className="tabular-nums text-foreground font-semibold flex items-center gap-1">
                        <span className="text-cyan-400">{stat.realOutbound.toLocaleString('es-CO')}</span>
                        <span className="text-muted-foreground/40">+</span>
                        <span className="text-purple-400">{stat.realInbound.toLocaleString('es-CO')}</span>
                        <span className="text-muted-foreground/60">/{stat.planned.toLocaleString('es-CO')}</span>
                      </span>
                    ) : (
                      <span className="tabular-nums text-foreground font-semibold">
                        {stat.real.toLocaleString('es-CO')}/{stat.planned.toLocaleString('es-CO')}
                      </span>
                    )}
                    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', semBg(gap))}>
                      {pct}% {semEmoji(gap)}
                    </span>
                  </div>
                </div>
                {/* Progress bar(s) */}
                {!typeFilter && stat.realOutbound !== undefined && stat.realInbound !== undefined ? (
                  <div className="space-y-0.5">
                    <div className="h-1 w-full rounded-full bg-muted/40">
                      <div className="h-full rounded-full bg-cyan-400 transition-all"
                        style={{ width: `${Math.min(100, stat.planned > 0 ? Math.round((stat.realOutbound / stat.planned) * 100) : 0)}%` }} />
                    </div>
                    <div className="h-1 w-full rounded-full bg-muted/40">
                      <div className="h-full rounded-full bg-purple-400 transition-all"
                        style={{ width: `${Math.min(100, stat.planned > 0 ? Math.round((stat.realInbound / stat.planned) * 100) : 0)}%` }} />
                    </div>
                  </div>
                ) : (
                <div className="h-1.5 w-full rounded-full bg-muted/40">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      typeFilter === 'OUTBOUND' ? 'bg-cyan-400'
                      : typeFilter === 'INBOUND' ? 'bg-purple-400'
                      : pct >= 100 ? 'bg-emerald-400' : pct >= 70 ? 'bg-amber-400' : 'bg-red-400'
                    )}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Pipeline value summary */}
      <div className="border-t border-border/50 pt-4 grid grid-cols-2 gap-3">
        <div className="rounded-md bg-muted/20 border border-border/50 px-3 py-2.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">💰 Pipeline abierto</p>
          <p className="text-sm font-bold text-foreground mt-0.5">{fmtUSD(openAmount)}</p>
        </div>
        <div className={cn(
          'rounded-md border px-3 py-2.5',
          revenuePct >= 100
            ? 'bg-emerald-400/10 border-emerald-400/20'
            : revenuePct >= 50
            ? 'bg-amber-400/10 border-amber-400/20'
            : 'bg-muted/20 border-border/50'
        )}>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">✅ Cerrado</p>
          <p className="text-sm font-bold text-foreground mt-0.5">
            {fmtUSD(closedAmount)}
            {monthlyGoal > 0 && (
              <span className="text-[10px] font-normal text-muted-foreground ml-1">
                / {fmtUSD(monthlyGoal)} ({revenuePct}%)
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Conversion rate table */}
      {conversions.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Tasas de conversión por etapa
          </p>
          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Transición</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Real</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Plan</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Δ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {conversions.map((c) => (
                  <tr key={`${c.fromStage}-${c.toStage}`} className="hover:bg-muted/10">
                    <td className="px-3 py-2 text-foreground/80">
                      {c.fromStage} → {c.toStage}
                    </td>
                    <td className={cn('px-3 py-2 text-right font-semibold tabular-nums', semClass(c.gap))}>
                      {c.fromCount > 0 ? `${c.realConversion}%` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                      {c.plannedConversion}%
                    </td>
                    <td className={cn('px-3 py-2 text-right font-semibold tabular-nums', semClass(c.gap))}>
                      {c.fromCount > 0 ? (c.gap >= 0 ? `+${c.gap}%` : `${c.gap}%`) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
