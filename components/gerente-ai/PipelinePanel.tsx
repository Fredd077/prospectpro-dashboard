'use client'

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ComposedChart, Area, Legend,
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
  { key: 'revenue',  label: 'Ingresos sem.',  icon: TrendingUp  },
  { key: 'stacked',  label: 'Por vendedor',   icon: BarChart2   },
  { key: 'funnel',   label: 'Funnel detalle', icon: LayoutList  },
]

const axisProps = { tick: { fontSize: 9, fill: 'rgba(148,163,184,0.45)' }, tickLine: false, axisLine: false }

const RevenueTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded border border-white/10 bg-[#0d1117] px-3 py-2 text-xs shadow-xl shadow-black/50 space-y-1">
      <p className="font-mono font-bold text-white/50 text-[9px] uppercase tracking-wider">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="flex items-center gap-2" style={{ color: p.color ?? p.fill }}>
          <span className="h-1.5 w-1.5 rounded-full inline-block shrink-0" style={{ background: p.color ?? p.fill }} />
          {p.name}: <span className="font-mono font-bold">{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

export function PipelinePanel({ pipeline }: Props) {
  const [chartType, setChartType] = useState<ChartType>('revenue')

  const repData = pipeline.byRep.map((r) => ({
    name:     r.name.split(' ')[0],
    fullName: r.name,
    ganado:   r.wonValue,
    abierto:  r.openValue,
    perdido:  r.lostCount * r.avgDealSize,
  }))

  const totalWon  = pipeline.byRep.reduce((s, r) => s + r.wonValue, 0)
  const totalOpen = pipeline.byRep.reduce((s, r) => s + r.openValue, 0)
  const totalDeals= pipeline.byRep.reduce((s, r) => s + r.openCount, 0)

  return (
    <div className="space-y-4 p-5 bg-[#080b12]">

      {/* Methodology note */}
      <div className="flex items-start gap-2 rounded border border-cyan-500/15 bg-cyan-500/[0.04] px-3 py-2 text-[10px] text-cyan-400/70">
        <Info className="h-3 w-3 shrink-0 mt-0.5" />
        <span>
          <strong className="text-cyan-400">Ganado (real)</strong>: solo Cierres confirmados ·
          <strong className="text-cyan-400"> Abierto (est.)</strong>: usa ticket promedio para deals sin monto ·
          Win rate = ganados / (ganados+perdidos), diferente a la tasa de conversión por stage de Mi Pipeline.
        </span>
      </div>

      {/* Executive KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'GANADO REAL', value: fmt(totalWon), sub: `${pipeline.teamWinRate}% win rate`, accent: '#34d399' },
          { label: 'PIPELINE ABIERTO', value: fmt(totalOpen), sub: `${totalDeals} deals estimados`, accent: '#22d3ee' },
          { label: 'WIN RATE', value: `${pipeline.teamWinRate}%`, sub: `ticket prom. ${fmt(pipeline.teamAvgDealSize)}`, accent: '#a78bfa' },
          { label: 'DÍAS A CIERRE', value: `${pipeline.avgDaysToClose}`, sub: 'promedio histórico', accent: '#fbbf24' },
        ].map(({ label, value, sub, accent }) => (
          <div key={label} className="rounded-lg bg-[#0d1117] border border-white/[0.06] p-4 relative overflow-hidden"
            style={{ borderLeft: `2px solid ${accent}40`, boxShadow: `inset 2px 0 16px ${accent}06` }}>
            <p className="text-[8px] font-bold uppercase tracking-[0.15em] text-white/30 mb-2">{label}</p>
            <p className="text-2xl font-black font-mono" style={{ color: accent }}>{value}</p>
            <p className="text-[9px] text-white/25 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Per-rep KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {pipeline.byRep.slice(0, 4).map((rep) => (
          <div key={rep.userId} className="rounded-lg bg-[#0d1117] border border-white/[0.06] p-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/35 truncate mb-2">
              {rep.name.split(' ')[0]}
            </p>
            <p className="text-xl font-black font-mono text-emerald-400">{fmt(rep.wonValue)}</p>
            <p className="text-[8px] text-white/25 mt-0.5">
              {rep.wonCount} ganado{rep.wonCount !== 1 ? 's' : ''} · {rep.openCount} abiertos
            </p>
            <div className="mt-2 h-[2px] rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, rep.winRate)}%`, opacity: 0.8 }} />
            </div>
            <p className="text-[8px] text-white/25 font-mono mt-1">Win rate {rep.winRate}%</p>
          </div>
        ))}
      </div>

      {/* Chart type selector */}
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] font-bold text-white/30 uppercase tracking-[0.12em] mr-2">Vista</span>
        {CHART_OPTS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setChartType(key)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all border',
              chartType === key
                ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
                : 'border-white/[0.08] text-white/30 hover:border-white/20 hover:text-white/60'
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Charts */}
      {chartType === 'revenue' && (
        <div className="rounded-lg bg-[#0d1117] border border-white/[0.06] p-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="h-[3px] w-4 rounded-full bg-amber-400 inline-block" />
            <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">
              Ingresos semanales · ganados + pipeline abierto
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={pipeline.weeklyRevenueTrend} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
              <defs>
                <linearGradient id="wonAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#34d399" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="openAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22d3ee" stopOpacity={0.18}/>
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={fmt} />
              <Tooltip content={<RevenueTooltip />} />
              <Area dataKey="open" name="Abierto" stroke="#22d3ee" strokeWidth={1.5} fill="url(#openAreaGrad)" strokeDasharray="4 2" dot={false} />
              <Area dataKey="won"  name="Ganado"  stroke="#34d399" strokeWidth={2}   fill="url(#wonAreaGrad)"  dot={false} activeDot={{ r: 3 }} />
              <Bar  dataKey="lost" name="Perdido" fill="#f87171" fillOpacity={0.4} radius={[2,2,0,0]} maxBarSize={12} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 9, paddingTop: 8, opacity: 0.6 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {chartType === 'stacked' && (
        <div className="rounded-lg bg-[#0d1117] border border-white/[0.06] p-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="h-[3px] w-4 rounded-full bg-violet-400 inline-block" />
            <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">
              Valor de pipeline por vendedor
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={repData} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={fmt} />
              <Tooltip content={<RevenueTooltip />} />
              <Bar dataKey="ganado"  name="Ganado"  stackId="a" fill="#34d399" fillOpacity={0.85} radius={[0,0,0,0]} />
              <Bar dataKey="abierto" name="Abierto" stackId="a" fill="#22d3ee" fillOpacity={0.45} radius={[0,0,0,0]} />
              <Bar dataKey="perdido" name="Perdido" stackId="a" fill="#f87171" fillOpacity={0.45} radius={[2,2,0,0]} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 9, paddingTop: 8, opacity: 0.6 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {chartType === 'funnel' && (
        <div className="rounded-lg bg-[#0d1117] border border-white/[0.06] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] bg-[#080b12] flex items-center gap-3">
            <span className="h-[3px] w-4 rounded-full bg-cyan-400 inline-block" />
            <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">
              Detalle funnel por etapa y vendedor
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] bg-[#0a0e17]">
                  <th className="text-left px-4 py-2.5 text-[9px] font-bold text-white/30 uppercase tracking-[0.12em]">Vendedor</th>
                  {['Reunión','Propuesta','Cierre'].map((s) => (
                    <th key={s} colSpan={3} className="px-3 py-2.5 text-[9px] font-bold text-white/30 uppercase tracking-wider text-center border-l border-white/[0.06]">
                      {s}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-[9px] font-bold text-white/30 uppercase tracking-wider text-center border-l border-white/[0.06]">
                    Win rate
                  </th>
                </tr>
                <tr className="border-b border-white/[0.04]">
                  <th className="px-4 py-1.5" />
                  {['Reunión','Propuesta','Cierre'].map((s) => (
                    <>
                      <th key={`${s}-o`} className="px-2 py-1.5 text-[8px] text-cyan-400/50 text-center border-l border-white/[0.04]">Abier.</th>
                      <th key={`${s}-w`} className="px-2 py-1.5 text-[8px] text-emerald-400/50 text-center">Gan.</th>
                      <th key={`${s}-l`} className="px-2 py-1.5 text-[8px] text-red-400/50 text-center">Perd.</th>
                    </>
                  ))}
                  <th className="px-3 py-1.5 border-l border-white/[0.04]" />
                </tr>
              </thead>
              <tbody>
                {pipeline.byRep.map((rep, i) => (
                  <tr key={rep.userId} className={cn('border-b border-white/[0.04]', i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.015]')}>
                    <td className="px-4 py-2.5 font-bold text-white/60 text-[10px]">{rep.name.split(' ')[0]}</td>
                    {rep.stages.map((stage) => (
                      <>
                        <td key={`${stage.stage}-o`} className="px-2 py-2.5 text-center text-cyan-400 font-mono text-[10px] border-l border-white/[0.04]">
                          {stage.open || <span className="text-white/15">—</span>}
                        </td>
                        <td key={`${stage.stage}-w`} className="px-2 py-2.5 text-center text-emerald-400 font-mono font-bold text-[10px]">
                          {stage.won || <span className="text-white/15">—</span>}
                        </td>
                        <td key={`${stage.stage}-l`} className="px-2 py-2.5 text-center text-red-400/60 font-mono text-[10px]">
                          {stage.lost || <span className="text-white/15">—</span>}
                        </td>
                      </>
                    ))}
                    <td className="px-3 py-2.5 text-center border-l border-white/[0.04]">
                      <span className={cn('font-black font-mono text-[10px]',
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
