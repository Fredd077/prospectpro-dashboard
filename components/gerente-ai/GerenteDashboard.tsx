'use client'

import { useState, useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts'
import type { GerenteAnalytics, RepAnalytics } from '@/lib/utils/gerente-ai'
import { GerenteChat } from './GerenteChat'
import { TrendingUp, Users, Target, AlertTriangle, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  analytics: GerenteAnalytics
  allReps: { id: string; name: string; email: string }[]
  startISO: string
  endISO: string
  company?: string
}

function compColor(pct: number) {
  if (pct >= 70) return '#34d399'
  if (pct >= 40) return '#fbbf24'
  return '#f87171'
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color ?? p.fill }}>
          {p.name}: <span className="font-bold">{p.value}%</span>
        </p>
      ))}
    </div>
  )
}

// Determine a reasonable XAxis tick interval based on number of data points
function xInterval(count: number): number {
  if (count <= 8)  return 0
  if (count <= 16) return 1
  if (count <= 32) return 3
  return Math.ceil(count / 12) - 1
}

export function GerenteDashboard({ analytics, allReps, startISO, endISO, company }: Props) {
  const [selectedRepIds, setSelectedRepIds] = useState<string[]>([])
  const [activeTab, setActiveTab]           = useState<'charts' | 'matrix'>('charts')

  const { summary, reps, teamTrend } = analytics

  const visibleReps: RepAnalytics[] = useMemo(() => {
    if (selectedRepIds.length === 0) return reps
    return reps.filter((r) => selectedRepIds.includes(r.userId))
  }, [reps, selectedRepIds])

  function toggleRep(id: string) {
    setSelectedRepIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
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
    name:     r.name.split(' ')[0],
    fullName: r.name,
    pct:      r.avgCompliance,
  }))

  // Weekly trend line chart — team avg + up to 3 highlighted reps
  const trendLineData = teamTrend.map((t, i) => {
    const point: Record<string, any> = { label: t.label, 'Equipo': t.avgPct }
    const highlighted = selectedRepIds.length > 0 ? visibleReps.slice(0, 3) : []
    for (const rep of highlighted) {
      point[rep.name.split(' ')[0]] = rep.weeklyTrend[i]?.pct ?? 0
    }
    return point
  })

  const repLineColors = ['#22d3ee', '#a78bfa', '#fb923c', '#34d399']
  const tickInterval  = xInterval(teamTrend.length)

  return (
    <div className="flex flex-col h-full">
      {/* Rep filter bar */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-2.5 border-b border-border bg-muted/10 shrink-0">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Vendedor</span>
        {allReps.map((rep) => {
          const active = selectedRepIds.includes(rep.id)
          return (
            <button
              key={rep.id}
              onClick={() => toggleRep(rep.id)}
              className={cn(
                'px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all border',
                active
                  ? 'border-violet-400 bg-violet-400/10 text-violet-300'
                  : 'border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
              )}
            >
              {rep.name.split(' ')[0]}
            </button>
          )
        })}
        {selectedRepIds.length > 0 && (
          <button
            onClick={() => setSelectedRepIds([])}
            className="text-[10px] text-muted-foreground hover:text-foreground underline"
          >
            limpiar
          </button>
        )}
      </div>

      {/* Main body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: analytics */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Users,         label: 'Vendedores',         value: `${summary.totalReps}`,       sub: 'en el equipo',   accent: 'border-t-primary/50'     },
              { icon: TrendingUp,    label: 'Cumplimiento prom.',  value: `${summary.avgCompliance}%`,  sub: 'en el período',  accent: 'border-t-cyan-500/50'    },
              { icon: Target,        label: 'En meta',             value: `${summary.onTrackCount}`,    sub: '≥ 70%',         accent: 'border-t-emerald-500/50' },
              { icon: AlertTriangle, label: 'Críticos',            value: `${summary.criticalCount}`,   sub: '< 40%',         accent: 'border-t-red-500/50'     },
            ].map(({ icon: Icon, label, value, sub, accent }) => (
              <div key={label} className={`rounded-xl border bg-card p-4 border-t-2 ${accent}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className="mt-1.5 text-2xl font-bold font-mono text-foreground">{value}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>
                  </div>
                  <Icon className="h-4 w-4 text-muted-foreground/40 mt-0.5" />
                </div>
              </div>
            ))}
          </div>

          {/* Tab toggle */}
          <div className="flex gap-1 rounded-lg bg-muted/30 p-1 w-fit">
            {(['charts', 'matrix'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-4 py-1.5 rounded-md text-xs font-semibold transition-all',
                  activeTab === tab
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab === 'charts' ? 'Gráficas' : 'Matriz de actividades'}
              </button>
            ))}
          </div>

          {activeTab === 'charts' ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Trend line chart */}
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-cyan-400" />
                  Tendencia semanal de cumplimiento
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trendLineData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: 'rgba(148,163,184,0.7)' }}
                      tickLine={false}
                      axisLine={false}
                      interval={tickInterval}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: 'rgba(148,163,184,0.7)' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line dataKey="Equipo" stroke="#22d3ee" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    {selectedRepIds.length > 0 && visibleReps.slice(0, 3).map((rep, i) => (
                      <Line
                        key={rep.userId}
                        dataKey={rep.name.split(' ')[0]}
                        stroke={repLineColors[i + 1]}
                        strokeWidth={1.5}
                        strokeDasharray="4 2"
                        dot={false}
                        activeDot={{ r: 3 }}
                      />
                    ))}
                    <Legend iconType="line" iconSize={12} wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Rep bar chart */}
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Ranking de cumplimiento por vendedor
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={repBarData} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: 'rgba(148,163,184,0.7)' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 10, fill: 'rgba(148,163,184,0.7)' }}
                      tickLine={false}
                      axisLine={false}
                      width={52}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="pct" name="Cumplimiento" radius={[0, 4, 4, 0]} maxBarSize={20}>
                      {repBarData.map((entry, i) => (
                        <Cell key={i} fill={compColor(entry.pct)} fillOpacity={0.9} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Rep detail cards */}
              <div className="xl:col-span-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {visibleReps.map((rep) => (
                  <div key={rep.userId} className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{rep.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{rep.email}</p>
                      </div>
                      <span
                        className="text-lg font-bold font-mono shrink-0"
                        style={{ color: compColor(rep.avgCompliance) }}
                      >
                        {rep.avgCompliance}%
                      </span>
                    </div>

                    {/* Mini sparkline */}
                    <div className="flex items-end gap-0.5 h-8">
                      {rep.weeklyTrend.slice(-12).map((w, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-sm min-w-[3px]"
                          style={{
                            height: `${Math.max(4, (w.pct / 100) * 32)}px`,
                            backgroundColor: compColor(w.pct),
                            opacity: 0.7,
                          }}
                          title={`${w.weekStart}: ${w.pct}%`}
                        />
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      {rep.bestActivity && (
                        <div className="rounded-md bg-emerald-500/5 border border-emerald-500/20 px-2 py-1.5">
                          <p className="text-emerald-400 font-semibold mb-0.5">Más fácil</p>
                          <p className="text-foreground truncate">{rep.bestActivity.name}</p>
                          <p className="text-emerald-400 font-mono font-bold">{rep.bestActivity.pct}%</p>
                        </div>
                      )}
                      {rep.worstActivity && rep.worstActivity.activityId !== rep.bestActivity?.activityId && (
                        <div className="rounded-md bg-red-500/5 border border-red-500/20 px-2 py-1.5">
                          <p className="text-red-400 font-semibold mb-0.5">Más difícil</p>
                          <p className="text-foreground truncate">{rep.worstActivity.name}</p>
                          <p className="text-red-400 font-mono font-bold">{rep.worstActivity.pct}%</p>
                        </div>
                      )}
                    </div>

                    <p className="text-[10px] text-muted-foreground">
                      {rep.totalCheckIns} check-ins · último: {rep.lastCheckIn ?? 'nunca'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Activity matrix */
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Matriz actividad × vendedor</h3>
                <span className="text-[10px] text-muted-foreground ml-1">% cumplimiento por actividad</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-40 sticky left-0 bg-card z-10">
                        Actividad
                      </th>
                      {visibleReps.map((rep) => (
                        <th key={rep.userId} className="px-3 py-2.5 text-[10px] font-semibold text-muted-foreground text-center min-w-[80px]">
                          {rep.name.split(' ')[0]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allActivities.map(({ id, name }, i) => (
                      <tr key={id} className={cn('border-b border-border/50', i % 2 === 0 ? '' : 'bg-muted/10')}>
                        <td className="px-4 py-2 text-foreground font-medium sticky left-0 bg-card z-10" style={{ background: 'inherit' }}>
                          <span className="truncate block max-w-[140px]" title={name}>{name}</span>
                        </td>
                        {visibleReps.map((rep) => {
                          const actPerf = rep.activities.find((a) => a.activityId === id)
                          const pct = actPerf?.pct ?? null
                          return (
                            <td key={rep.userId} className="px-3 py-2 text-center">
                              {pct !== null ? (
                                <span
                                  className="inline-block px-2 py-0.5 rounded text-[11px] font-bold font-mono"
                                  style={{
                                    color: compColor(pct),
                                    backgroundColor: `${compColor(pct)}18`,
                                  }}
                                >
                                  {pct}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground/30">—</span>
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
          )}
        </div>

        {/* Right: chat panel */}
        <div className="hidden xl:flex w-[380px] flex-col border-l border-border shrink-0">
          <GerenteChat
            userIds={selectedRepIds.length > 0 ? selectedRepIds : allReps.map((r) => r.id)}
            startISO={startISO}
            endISO={endISO}
          />
        </div>
      </div>

      {/* Mobile chat */}
      <div className="xl:hidden border-t border-border p-3 shrink-0">
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
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary/10 border border-primary/30 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/15 transition-colors"
      >
        <span>💬</span> Hablar con Gerente AI
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 h-[75vh] rounded-t-2xl border-t border-border bg-background flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold">Gerente AI</span>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground text-lg">×</button>
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
