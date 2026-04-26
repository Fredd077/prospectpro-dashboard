'use client'

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ComposedChart, Area, Line, Legend,
} from 'recharts'
import type { TeamPipelineAnalytics } from '@/lib/utils/gerente-pipeline'
import { DollarSign, TrendingUp, BarChart2, LayoutList, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

type ChartType = 'revenue' | 'stacked' | 'funnel'

interface Props {
  pipeline: TeamPipelineAnalytics
}

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

const CHART_OPTS: { key: ChartType; label: string; icon: typeof BarChart2 }[] = [
  { key: 'revenue',  label: 'Ingresos sem.',  icon: TrendingUp   },
  { key: 'stacked',  label: 'Por vendedor',   icon: BarChart2    },
  { key: 'funnel',   label: 'Funnel detalle', icon: LayoutList   },
]

const RevenueTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg space-y-1">
      <p className="font-semibold text-foreground">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color ?? p.fill }}>
          {p.name}: <span className="font-bold">{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

export function PipelinePanel({ pipeline }: Props) {
  const [chartType, setChartType] = useState<ChartType>('revenue')

  // Stacked bar per rep data
  const repData = pipeline.byRep.map((r) => ({
    name:     r.name.split(' ')[0],
    fullName: r.name,
    ganado:   r.wonValue,
    abierto:  r.openValue,
    perdido:  r.lostCount * r.avgDealSize,
  }))

  return (
    <div className="space-y-6 p-6">

      {/* Methodology note */}
      <div className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-[11px] text-blue-400/90">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>
          <strong>Ganado (real)</strong>: solo montos confirmados en deals cerrados. <strong>Abierto (estimado)</strong>: usa ticket promedio del recetario para deals sin monto. El win rate aquí es ganados/cerrados — diferente a la tasa de conversión por stage de Mi Pipeline.
        </span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {pipeline.byRep.slice(0, 4).map((rep) => (
          <div key={rep.userId} className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{rep.name.split(' ')[0]}</p>
            <p className="mt-1.5 text-xl font-bold font-mono text-foreground">{fmt(rep.wonValue)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {rep.wonCount} ganado{rep.wonCount !== 1 ? 's' : ''} (real) · {rep.openCount} abiertos (est.)
            </p>
            <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{ width: `${Math.min(100, rep.winRate)}%` }}
              />
            </div>
            <p className="text-[9px] text-muted-foreground mt-1">Win rate {rep.winRate}%</p>
          </div>
        ))}
      </div>

      {/* Chart type selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">Vista</span>
        {CHART_OPTS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setChartType(key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-all',
              chartType === key
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Chart */}
      {chartType === 'revenue' && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-cyan-400" />
            Ingresos semanales del equipo (ganados + pipeline abierto)
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={pipeline.weeklyRevenueTrend} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
              <defs>
                <linearGradient id="wonAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#34d399" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="openAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22d3ee" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'rgba(148,163,184,0.7)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'rgba(148,163,184,0.7)' }} tickLine={false} axisLine={false} tickFormatter={fmt} />
              <Tooltip content={<RevenueTooltip />} />
              <Area dataKey="open"   name="Abierto"  stroke="#22d3ee" strokeWidth={1.5} fill="url(#openAreaGrad)" strokeDasharray="4 2" dot={false} />
              <Area dataKey="won"    name="Ganado"   stroke="#34d399" strokeWidth={2}   fill="url(#wonAreaGrad)"  dot={false} activeDot={{ r: 4 }} />
              <Bar  dataKey="lost"   name="Perdido"  fill="#f87171" fillOpacity={0.4} radius={[2,2,0,0]} maxBarSize={14} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {chartType === 'stacked' && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-primary" />
            Valor de pipeline por vendedor (ganado + abierto + perdido)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={repData} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'rgba(148,163,184,0.7)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'rgba(148,163,184,0.7)' }} tickLine={false} axisLine={false} tickFormatter={fmt} />
              <Tooltip content={<RevenueTooltip />} />
              <Bar dataKey="ganado"  name="Ganado"  stackId="a" fill="#34d399" fillOpacity={0.9} radius={[0,0,0,0]} />
              <Bar dataKey="abierto" name="Abierto" stackId="a" fill="#22d3ee" fillOpacity={0.5} radius={[0,0,0,0]} />
              <Bar dataKey="perdido" name="Perdido" stackId="a" fill="#f87171" fillOpacity={0.5} radius={[4,4,0,0]} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {chartType === 'funnel' && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-5 flex items-center gap-2">
            <LayoutList className="h-4 w-4 text-violet-400" />
            Detalle del funnel por etapa y vendedor
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Vendedor</th>
                  {['Reunión','Propuesta','Cierre'].map((s) => (
                    <th key={s} colSpan={3} className="px-3 py-2.5 text-[10px] font-semibold text-muted-foreground text-center border-l border-border/50">
                      {s}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-[10px] font-semibold text-muted-foreground text-center border-l border-border/50">Win rate</th>
                </tr>
                <tr className="border-b border-border/50 bg-muted/10">
                  <th className="px-4 py-1.5"/>
                  {['Reunión','Propuesta','Cierre'].map((s) => (
                    <>
                      <th key={`${s}-o`} className="px-2 py-1.5 text-[9px] text-cyan-400/70 text-center border-l border-border/30">Abierto</th>
                      <th key={`${s}-w`} className="px-2 py-1.5 text-[9px] text-emerald-400/70 text-center">Ganado</th>
                      <th key={`${s}-l`} className="px-2 py-1.5 text-[9px] text-red-400/70 text-center">Perdido</th>
                    </>
                  ))}
                  <th className="px-3 py-1.5 border-l border-border/30"/>
                </tr>
              </thead>
              <tbody>
                {pipeline.byRep.map((rep, i) => (
                  <tr key={rep.userId} className={cn('border-b border-border/50', i % 2 === 0 ? '' : 'bg-muted/10')}>
                    <td className="px-4 py-2.5 font-medium text-foreground">{rep.name.split(' ')[0]}</td>
                    {rep.stages.map((stage) => (
                      <>
                        <td key={`${stage.stage}-o`} className="px-2 py-2.5 text-center text-cyan-400 font-mono border-l border-border/30">{stage.open || '—'}</td>
                        <td key={`${stage.stage}-w`} className="px-2 py-2.5 text-center text-emerald-400 font-mono">{stage.won || '—'}</td>
                        <td key={`${stage.stage}-l`} className="px-2 py-2.5 text-center text-red-400/70 font-mono">{stage.lost || '—'}</td>
                      </>
                    ))}
                    <td className="px-3 py-2.5 text-center border-l border-border/30">
                      <span className={cn(
                        'font-bold font-mono text-xs',
                        rep.winRate >= 60 ? 'text-emerald-400' : rep.winRate >= 30 ? 'text-amber-400' : 'text-red-400'
                      )}>
                        {rep.winRate}%
                      </span>
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
