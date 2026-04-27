'use client'

import { useState, useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts'
import type { GerenteAnalytics, RepAnalytics } from '@/lib/utils/gerente-ai'
import type { TeamPipelineAnalytics } from '@/lib/utils/gerente-pipeline'
import { filterPipeline } from '@/lib/utils/gerente-pipeline'
import { GerenteChat } from './GerenteChat'
import { PipelinePanel } from './PipelinePanel'
import { PredictivePanel } from './PredictivePanel'
import {
  TrendingUp, Users, Target, AlertTriangle, Activity,
  BarChart2, LineChart as LineIcon, AreaChart as AreaIcon,
  BrainCircuit, DollarSign, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type DashTab   = 'activity' | 'pipeline' | 'predictions' | 'matrix'
type ChartType = 'line' | 'area' | 'bar'

interface Props {
  analytics: GerenteAnalytics
  pipeline:  TeamPipelineAnalytics
  allReps:   { id: string; name: string; email: string }[]
  startISO:  string
  endISO:    string
  company?:  string
}

function compColor(pct: number) {
  if (pct >= 70) return '#34d399'
  if (pct >= 40) return '#fbbf24'
  return '#f87171'
}

function xInterval(count: number) {
  if (count <= 8)  return 0
  if (count <= 16) return 1
  if (count <= 32) return 3
  return Math.ceil(count / 12) - 1
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

const AVATAR_COLORS = [
  'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  'bg-violet-500/20 text-violet-300 border-violet-500/40',
  'bg-amber-500/20 text-amber-300 border-amber-500/40',
  'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  'bg-pink-500/20 text-pink-300 border-pink-500/40',
]

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded border border-white/10 bg-[#0d1117] px-3 py-2 text-xs shadow-xl shadow-black/50">
      <p className="font-mono font-bold text-white/80 mb-1 text-[10px] uppercase tracking-wider">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="flex items-center gap-2" style={{ color: p.color ?? p.fill ?? p.stroke }}>
          <span className="h-1.5 w-1.5 rounded-full inline-block" style={{ background: p.color ?? p.fill ?? p.stroke }} />
          {p.name}: <span className="font-mono font-bold">{p.value}%</span>
        </p>
      ))}
    </div>
  )
}

const TABS: { key: DashTab; label: string; icon: typeof Activity; accent: string }[] = [
  { key: 'activity',    label: 'Actividad',      icon: Activity,    accent: 'text-cyan-400'   },
  { key: 'pipeline',   label: 'Pipeline',        icon: DollarSign,  accent: 'text-amber-400'  },
  { key: 'predictions',label: 'Proyecciones IA', icon: BrainCircuit,accent: 'text-violet-400' },
  { key: 'matrix',     label: 'Matriz',          icon: BarChart2,   accent: 'text-emerald-400'},
]

const CHART_TYPES: { key: ChartType; label: string; icon: typeof LineIcon }[] = [
  { key: 'line', label: 'Línea', icon: LineIcon  },
  { key: 'area', label: 'Área',  icon: AreaIcon  },
  { key: 'bar',  label: 'Barra', icon: BarChart2 },
]

export function GerenteDashboard({ analytics, pipeline, allReps, startISO, endISO, company }: Props) {
  const [activeTab,      setActiveTab]      = useState<DashTab>('activity')
  const [selectedRepIds, setSelectedRepIds] = useState<string[]>([])
  const [chartType,      setChartType]      = useState<ChartType>('line')

  const { summary, reps, teamTrend } = analytics

  const visibleReps: RepAnalytics[] = useMemo(
    () => selectedRepIds.length === 0 ? reps : reps.filter((r) => selectedRepIds.includes(r.userId)),
    [reps, selectedRepIds],
  )

  const filteredPipeline = useMemo(
    () => filterPipeline(pipeline, selectedRepIds),
    [pipeline, selectedRepIds],
  )

  function toggleRep(id: string) {
    setSelectedRepIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const allActivities = useMemo(() => {
    const map = new Map<string, string>()
    for (const rep of visibleReps) {
      for (const act of rep.activities) {
        if (!map.has(act.activityId)) map.set(act.activityId, act.name)
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [visibleReps])

  const repBarData = visibleReps.map((r) => ({
    name: r.name.split(' ')[0], fullName: r.name, pct: r.avgCompliance,
  }))

  const trendData = teamTrend.map((t, i) => {
    const pt: Record<string, any> = { label: t.label, 'Equipo': t.avgPct }
    if (selectedRepIds.length > 0) {
      visibleReps.slice(0, 3).forEach((rep) => {
        pt[rep.name.split(' ')[0]] = rep.weeklyTrend[i]?.pct ?? 0
      })
    }
    return pt
  })

  const repLineColors = ['#22d3ee', '#a78bfa', '#fb923c', '#34d399']
  const tickInterval  = xInterval(teamTrend.length)

  const axisProps = { tick: { fontSize: 9, fill: 'rgba(148,163,184,0.5)' }, tickLine: false, axisLine: false }
  const commonXAxis = <XAxis dataKey="label" {...axisProps} interval={tickInterval} />
  const commonYAxis = <YAxis domain={[0, 100]} {...axisProps} tickFormatter={(v) => `${v}%`} />
  const commonGrid  = <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />

  function renderTrendChart() {
    const shared = { data: trendData, margin: { top: 4, right: 8, bottom: 0, left: -16 } }
    if (chartType === 'bar') {
      const barData = teamTrend.map((t) => ({ label: t.label, 'Equipo': t.avgPct }))
      return (
        <BarChart data={barData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
          {commonGrid}{commonXAxis}{commonYAxis}
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="Equipo" name="Equipo" radius={[2,2,0,0]} maxBarSize={18}>
            {barData.map((entry, i) => <Cell key={i} fill={compColor(entry['Equipo'])} fillOpacity={0.9} />)}
          </Bar>
        </BarChart>
      )
    }
    const ChartComp = chartType === 'area' ? AreaChart : LineChart
    return (
      <ChartComp {...shared}>
        {commonGrid}{commonXAxis}{commonYAxis}
        <Tooltip content={<ChartTooltip />} />
        {chartType === 'area'
          ? <Area dataKey="Equipo" stroke="#22d3ee" strokeWidth={2} fill="rgba(34,211,238,0.08)" dot={false} activeDot={{ r: 3 }} />
          : <Line  dataKey="Equipo" stroke="#22d3ee" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
        }
        {selectedRepIds.length > 0 && visibleReps.slice(0, 3).map((rep, i) =>
          chartType === 'area'
            ? <Area key={rep.userId} dataKey={rep.name.split(' ')[0]} stroke={repLineColors[i+1]} strokeWidth={1.5} fill={`${repLineColors[i+1]}08`} strokeDasharray="4 2" dot={false} />
            : <Line key={rep.userId} dataKey={rep.name.split(' ')[0]} stroke={repLineColors[i+1]} strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
        )}
        <Legend iconType="line" iconSize={10} wrapperStyle={{ fontSize: 9, paddingTop: 8, opacity: 0.7 }} />
      </ChartComp>
    )
  }

  const activeTabMeta = TABS.find(t => t.key === activeTab)!

  return (
    <div className="flex flex-col h-full bg-[#080b12]">

      {/* ── Rep filter bar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-white/[0.06] bg-[#0a0e17] shrink-0">
        <span className="text-[9px] font-bold text-white/30 uppercase tracking-[0.15em] mr-1">Filtrar vendedor</span>
        {allReps.map((rep, idx) => {
          const active = selectedRepIds.includes(rep.id)
          const colorClass = AVATAR_COLORS[idx % AVATAR_COLORS.length]
          return (
            <button key={rep.id} onClick={() => toggleRep(rep.id)}
              className={cn(
                'flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border',
                active
                  ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.15)]'
                  : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/70 bg-white/[0.03]'
              )}
            >
              <span className={cn('h-5 w-5 rounded-full border text-[9px] font-bold flex items-center justify-center shrink-0', active ? 'bg-cyan-400/20 border-cyan-400/50 text-cyan-300' : colorClass)}>
                {initials(rep.name)}
              </span>
              {rep.name.split(' ')[0]}
            </button>
          )
        })}
        {selectedRepIds.length > 0 && (
          <button onClick={() => setSelectedRepIds([])}
            className="text-[9px] font-bold text-white/30 hover:text-white/60 uppercase tracking-wider ml-1 transition-colors">
            × limpiar
          </button>
        )}
      </div>

      {/* ── Main body ──────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Content area */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Tab bar */}
          <div className="flex border-b border-white/[0.06] bg-[#080b12] shrink-0 overflow-x-auto">
            {TABS.map(({ key, label, icon: Icon, accent }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  'relative flex items-center gap-2 px-5 py-3 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-all',
                  activeTab === key
                    ? 'bg-white/[0.05] text-white'
                    : 'text-white/30 hover:text-white/60 hover:bg-white/[0.03]'
                )}
              >
                <Icon className={cn('h-3.5 w-3.5', activeTab === key ? accent : '')} />
                {label}
                {activeTab === key && (
                  <span className={cn('absolute bottom-0 left-0 right-0 h-[2px]',
                    key === 'activity' ? 'bg-cyan-400' :
                    key === 'pipeline' ? 'bg-amber-400' :
                    key === 'predictions' ? 'bg-violet-400' : 'bg-emerald-400'
                  )} />
                )}
                {key === 'predictions' && pipeline.atRiskRepIds.length > 0 && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500/90 text-[8px] font-black text-white shadow-[0_0_8px_rgba(239,68,68,0.5)]">
                    {pipeline.atRiskRepIds.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">

            {/* ── ACTIVITY TAB ─────────────────────────────────────── */}
            {activeTab === 'activity' && (
              <div className="p-5 space-y-5">

                {/* Executive KPI strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    {
                      icon: Users, label: 'VENDEDORES', value: `${summary.totalReps}`,
                      sub: 'en el equipo', glow: 'shadow-[inset_0_0_0_1px_rgba(34,211,238,0.12)]', bar: 'bg-cyan-400', barW: 100,
                      valColor: 'text-cyan-400',
                    },
                    {
                      icon: TrendingUp, label: 'CUMPLIMIENTO', value: `${summary.avgCompliance}%`,
                      sub: 'promedio del período', glow: 'shadow-[inset_0_0_0_1px_rgba(99,102,241,0.12)]', bar: 'bg-indigo-400',
                      barW: summary.avgCompliance,
                      valColor: summary.avgCompliance >= 70 ? 'text-emerald-400' : summary.avgCompliance >= 40 ? 'text-amber-400' : 'text-red-400',
                    },
                    {
                      icon: Target, label: 'EN META', value: `${summary.onTrackCount}`,
                      sub: '≥ 70% cumplimiento', glow: 'shadow-[inset_0_0_0_1px_rgba(52,211,153,0.12)]', bar: 'bg-emerald-400',
                      barW: summary.totalReps > 0 ? Math.round((summary.onTrackCount / summary.totalReps) * 100) : 0,
                      valColor: 'text-emerald-400',
                    },
                    {
                      icon: AlertTriangle, label: 'CRÍTICOS', value: `${summary.criticalCount}`,
                      sub: '< 40% cumplimiento', glow: 'shadow-[inset_0_0_0_1px_rgba(248,113,113,0.12)]', bar: 'bg-red-400',
                      barW: summary.totalReps > 0 ? Math.round((summary.criticalCount / summary.totalReps) * 100) : 0,
                      valColor: summary.criticalCount > 0 ? 'text-red-400' : 'text-white/40',
                    },
                  ].map(({ icon: Icon, label, value, sub, glow, bar, barW, valColor }) => (
                    <div key={label} className={`relative rounded-lg bg-[#0d1117] border border-white/[0.06] p-4 overflow-hidden ${glow}`}>
                      <div className="flex items-start justify-between mb-3">
                        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/40">{label}</p>
                        <Icon className="h-3 w-3 text-white/20" />
                      </div>
                      <p className={`text-3xl font-black font-mono leading-none ${valColor}`}>{value}</p>
                      <p className="text-[9px] text-white/30 mt-1.5">{sub}</p>
                      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.04]">
                        <div className={`h-full ${bar} transition-all duration-700`} style={{ width: `${barW}%`, opacity: 0.7 }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Chart type selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold text-white/30 uppercase tracking-[0.12em] mr-2">Vista</span>
                  {CHART_TYPES.map(({ key, label, icon: Icon }) => (
                    <button key={key} onClick={() => setChartType(key)}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all border',
                        chartType === key
                          ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300'
                          : 'border-white/[0.08] text-white/30 hover:border-white/20 hover:text-white/60 bg-transparent'
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {/* Trend chart */}
                  <div className="rounded-lg bg-[#0d1117] border border-white/[0.06] p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="h-[3px] w-4 rounded-full bg-cyan-400 inline-block" />
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">
                        Tendencia semanal · cumplimiento
                      </h3>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      {renderTrendChart()}
                    </ResponsiveContainer>
                  </div>

                  {/* Rep ranking bar */}
                  <div className="rounded-lg bg-[#0d1117] border border-white/[0.06] p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="h-[3px] w-4 rounded-full bg-violet-400 inline-block" />
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">
                        Ranking por vendedor
                      </h3>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={repBarData} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="2 4" horizontal={false} stroke="rgba(255,255,255,0.04)" />
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9, fill: 'rgba(148,163,184,0.5)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: 'rgba(148,163,184,0.5)' }} tickLine={false} axisLine={false} width={48} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="pct" name="Cumplimiento" radius={[0, 2, 2, 0]} maxBarSize={16}>
                          {repBarData.map((entry, i) => <Cell key={i} fill={compColor(entry.pct)} fillOpacity={0.85} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Rep cards */}
                  <div className="xl:col-span-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {visibleReps.map((rep, idx) => {
                      const color = compColor(rep.avgCompliance)
                      return (
                        <div key={rep.userId}
                          className="rounded-lg bg-[#0d1117] border border-white/[0.06] p-4 space-y-3"
                          style={{ borderLeft: `2px solid ${color}40`, boxShadow: `inset 2px 0 12px ${color}08` }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className={cn('h-7 w-7 rounded-full border text-[10px] font-black flex items-center justify-center shrink-0', AVATAR_COLORS[idx % AVATAR_COLORS.length])}>
                                {initials(rep.name)}
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-white/80 truncate">{rep.name}</p>
                                <p className="text-[9px] text-white/30 truncate">{rep.email}</p>
                              </div>
                            </div>
                            <span className="text-xl font-black font-mono shrink-0" style={{ color }}>
                              {rep.avgCompliance}%
                            </span>
                          </div>
                          {/* Sparkline */}
                          <div className="flex items-end gap-[2px] h-7">
                            {rep.weeklyTrend.slice(-12).map((w, i) => (
                              <div key={i} className="flex-1 rounded-sm min-w-[2px] transition-all"
                                style={{ height: `${Math.max(3, (w.pct / 100) * 28)}px`, backgroundColor: compColor(w.pct), opacity: 0.65 }}
                                title={`${w.weekStart}: ${w.pct}%`}
                              />
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[9px]">
                            {rep.bestActivity && (
                              <div className="rounded bg-emerald-500/[0.07] border border-emerald-500/20 px-2 py-1.5">
                                <p className="text-emerald-400 font-bold mb-0.5 uppercase tracking-wider text-[8px]">Más fácil</p>
                                <p className="text-white/60 truncate">{rep.bestActivity.name}</p>
                                <p className="text-emerald-400 font-mono font-black">{rep.bestActivity.pct}%</p>
                              </div>
                            )}
                            {rep.worstActivity && rep.worstActivity.activityId !== rep.bestActivity?.activityId && (
                              <div className="rounded bg-red-500/[0.07] border border-red-500/20 px-2 py-1.5">
                                <p className="text-red-400 font-bold mb-0.5 uppercase tracking-wider text-[8px]">Más difícil</p>
                                <p className="text-white/60 truncate">{rep.worstActivity.name}</p>
                                <p className="text-red-400 font-mono font-black">{rep.worstActivity.pct}%</p>
                              </div>
                            )}
                          </div>
                          <p className="text-[9px] text-white/25 font-mono">
                            {rep.totalCheckIns} check-ins · último: {rep.lastCheckIn ?? 'nunca'}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── PIPELINE TAB ─────────────────────────────────────── */}
            {activeTab === 'pipeline' && <PipelinePanel pipeline={filteredPipeline} />}

            {/* ── PREDICTIONS TAB ──────────────────────────────────── */}
            {activeTab === 'predictions' && <PredictivePanel pipeline={filteredPipeline} activity={analytics} visibleReps={visibleReps} />}

            {/* ── MATRIX TAB ───────────────────────────────────────── */}
            {activeTab === 'matrix' && (
              <div className="p-5">
                <div className="rounded-lg bg-[#0d1117] border border-white/[0.06] overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-3 bg-[#080b12]">
                    <span className="h-[3px] w-4 rounded-full bg-emerald-400 inline-block" />
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">
                      Matriz actividad × vendedor
                    </h3>
                    <span className="text-[9px] text-white/25 ml-1">% cumplimiento por actividad</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/[0.06] bg-[#080b12]">
                          <th className="text-left px-4 py-2.5 text-[9px] font-bold text-white/30 uppercase tracking-[0.12em] w-40 sticky left-0 bg-[#080b12] z-10">
                            Actividad
                          </th>
                          {visibleReps.map((rep) => (
                            <th key={rep.userId} className="px-3 py-2.5 text-[9px] font-bold text-white/30 uppercase tracking-wider text-center min-w-[80px]">
                              {rep.name.split(' ')[0]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {allActivities.map(({ id, name }, i) => (
                          <tr key={id} className={cn('border-b border-white/[0.04]', i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.015]')}>
                            <td className="px-4 py-2.5 text-white/50 font-medium sticky left-0 z-10 text-[10px]" style={{ background: i % 2 === 0 ? '#0d1117' : '#0f1420' }}>
                              <span className="truncate block max-w-[140px]" title={name}>{name}</span>
                            </td>
                            {visibleReps.map((rep) => {
                              const actPerf = rep.activities.find((a) => a.activityId === id)
                              const pct = actPerf?.pct ?? null
                              return (
                                <td key={rep.userId} className="px-3 py-2.5 text-center">
                                  {pct !== null ? (
                                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black font-mono"
                                      style={{ color: compColor(pct), backgroundColor: `${compColor(pct)}15` }}>
                                      {pct}%
                                    </span>
                                  ) : (
                                    <span className="text-white/15 text-[10px]">—</span>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Chat panel ───────────────────────────────────────────── */}
        <div className="hidden xl:flex w-[340px] flex-col border-l border-white/[0.06] shrink-0 bg-[#0a0e17]">
          <GerenteChat
            userIds={selectedRepIds.length > 0 ? selectedRepIds : allReps.map((r) => r.id)}
            startISO={startISO}
            endISO={endISO}
          />
        </div>
      </div>

      {/* Mobile chat */}
      <div className="xl:hidden border-t border-white/[0.06] p-3 shrink-0 bg-[#0a0e17]">
        <MobileChatDrawer
          userIds={selectedRepIds.length > 0 ? selectedRepIds : allReps.map((r) => r.id)}
          startISO={startISO}
          endISO={endISO}
        />
      </div>
    </div>
  )
}

function MobileChatDrawer({ userIds, startISO, endISO }: { userIds: string[]; startISO: string; endISO: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-cyan-400/10 border border-cyan-400/20 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-cyan-300 hover:bg-cyan-400/15 transition-colors"
      >
        <BrainCircuit className="h-4 w-4" /> Hablar con Gerente AI
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="absolute bottom-0 left-0 right-0 h-[75vh] rounded-t-2xl border-t border-white/[0.08] bg-[#080b12] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <span className="text-xs font-bold uppercase tracking-wider text-white/60">Gerente AI</span>
              <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white/70 text-xl font-light">×</button>
            </div>
            <div className="flex-1 overflow-hidden">
              <GerenteChat userIds={userIds} startISO={startISO} endISO={endISO} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
