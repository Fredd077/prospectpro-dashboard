'use client'

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line,
  PieChart, Pie, Cell,
} from 'recharts'
import type { PieLabelRenderProps } from 'recharts'
import { usePerformanceData } from '@/lib/hooks/use-performance-data'
import type { RecipeScenario } from '@/lib/types/database'
import type { ActivityForSupervision } from './SupervisionPanel'

interface RecipeDashboardTabProps {
  scenario: RecipeScenario
  activities: ActivityForSupervision[]
}

// ── Colour palette ─────────────────────────────────────────────────────────────
const CYAN    = '#00D9FF'
const VIOLET  = '#8b5cf6'
const EMERALD = '#10b981'
const AMBER   = '#f59e0b'
const RED     = '#ef4444'
const PIE_COLORS = [CYAN, VIOLET, EMERALD, AMBER, RED, '#06b6d4', '#a855f7', '#22c55e', '#fb923c', '#f43f5e']

const TOOLTIP_STYLE = {
  backgroundColor: '#18181b',
  border: '1px solid #3f3f46',
  borderRadius: 6,
  fontSize: 11,
  color: '#e4e4e7',
}

// ── KPI card ───────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent = CYAN }: { label: string; value: string; sub: string; accent?: string }) {
  return (
    <div className="flex-1 min-w-0 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">{label}</p>
      <p className="text-2xl font-mono font-bold leading-none" style={{ color: accent }}>{value}</p>
      <p className="text-[10px] text-zinc-600 mt-1">{sub}</p>
    </div>
  )
}

// ── Chart card wrapper ──────────────────────────────────────────────────────────
function ChartCard<T extends string>({
  title, typeOptions, chartType, onTypeChange, children,
}: {
  title: string
  typeOptions: { value: T; label: string }[]
  chartType: T
  onTypeChange: (v: T) => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border bg-zinc-900 p-4" style={{ borderColor: `${CYAN}33` }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: CYAN }}>{title}</p>
        <select
          value={chartType}
          onChange={(e) => onTypeChange(e.target.value as T)}
          className="text-[10px] bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300 outline-none cursor-pointer hover:border-zinc-600"
        >
          {typeOptions.map((o) => (
            <option key={o.value} value={o.value} className="bg-zinc-900">{o.label}</option>
          ))}
        </select>
      </div>
      <div style={{ height: 260 }}>{children}</div>
    </div>
  )
}

// ── Gauge mini (half-donut) ─────────────────────────────────────────────────────
function GaugeMini({ value, name }: { value: number; name: string }) {
  const maxVal = 150
  const clamp  = Math.min(Math.max(value, 0), maxVal)
  const color  = clamp >= 100 ? EMERALD : clamp >= 70 ? AMBER : RED
  const pct    = clamp / maxVal

  const gaugeData = [
    { value: pct * 100 },
    { value: (1 - pct) * 100 },
  ]

  return (
    <div className="flex flex-col items-center">
      {/* overflow:hidden clips bottom half → shows only the top semicircle */}
      <div style={{ width: 110, height: 60, overflow: 'hidden' }}>
        <PieChart width={110} height={110}>
          {/* Track */}
          <Pie data={[{ value: 100 }]} cx={55} cy={88} startAngle={180} endAngle={0}
            innerRadius={34} outerRadius={50} dataKey="value" stroke="none"
            fill="#3f3f46" isAnimationActive={false} />
          {/* Value arc */}
          <Pie data={gaugeData} cx={55} cy={88} startAngle={180} endAngle={0}
            innerRadius={34} outerRadius={50} dataKey="value" stroke="none"
            isAnimationActive={false}>
            <Cell fill={color} />
            <Cell fill="transparent" />
          </Pie>
        </PieChart>
      </div>
      <p className="font-mono text-xs font-bold mt-0.5" style={{ color }}>{value.toFixed(0)}%</p>
      <p className="text-[9px] text-zinc-500 text-center leading-tight mt-0.5 max-w-[100px]">
        {name.length > 14 ? name.slice(0, 13) + '…' : name}
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export function RecipeDashboardTab({ scenario, activities }: RecipeDashboardTabProps) {
  const {
    monthOptions, selectedMonth, setSelectedMonth, isCurrentMonth, loading,
    allRows, outTotals, inTotals, allTotals, avgTicket,
  } = usePerformanceData(activities, scenario)

  // ── Chart type selectors ───────────────────────────────────────────────────
  type C1 = 'bar' | 'radar' | 'line'
  type C2 = 'donut' | 'bar' | 'radar'
  type C3 = 'gauge' | 'bar' | 'radar'
  type C4 = 'radar' | 'bar' | 'donut'

  const [c1Type, setC1Type] = useState<C1>('bar')
  const [c2Type, setC2Type] = useState<C2>('donut')
  const [c3Type, setC3Type] = useState<C3>('gauge')
  const [c4Type, setC4Type] = useState<C4>('radar')

  // ── KPI values ─────────────────────────────────────────────────────────────
  const reunEsperadas = allTotals.meetingsExpected
  const reunReales    = allTotals.reunionesReales
  const eficiencia    = allTotals.eficienciaCanal
  const ingresoProy   = allTotals.cierresReales * avgTicket

  const fmtUsd = (n: number) => '$' + Math.round(n).toLocaleString('es')
  const fmtNum = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 1 })

  // ── Chart data ─────────────────────────────────────────────────────────────

  // Chart 1 — Reuniones Esperadas vs Reales
  const c1Data = allRows
    .filter((r) => r.meetingsExpected > 0 || r.reunionesReales > 0)
    .map((r) => ({
      name:      r.name.length > 12 ? r.name.slice(0, 11) + '…' : r.name,
      fullName:  r.name,
      esperadas: r.meetingsExpected,
      reales:    r.reunionesReales,
    }))

  // Chart 2 — Contribución por actividad
  const c2Data = allRows
    .filter((r) => r.cierresReales > 0)
    .map((r) => ({
      name:  r.name.length > 16 ? r.name.slice(0, 15) + '…' : r.name,
      value: parseFloat(r.contribGlobalPct.toFixed(1)),
    }))

  // Chart 3 — Eficiencia por canal (top 6 by meetingsExpected)
  const c3Data = allRows
    .filter((r) => r.meetingsExpected > 0)
    .sort((a, b) => b.meetingsExpected - a.meetingsExpected)
    .slice(0, 6)
    .map((r) => ({
      name:        r.name.length > 12 ? r.name.slice(0, 11) + '…' : r.name,
      fullName:    r.name,
      eficiencia:  parseFloat((r.eficienciaCanal ?? 0).toFixed(1)),
      esperadas:   r.meetingsExpected,
    }))

  // Chart 4 — Semáforo general (radar)
  const c4Data = allRows
    .filter((r) => r.meetingsExpected > 0)
    .map((r) => ({
      name:       r.name.length > 12 ? r.name.slice(0, 11) + '…' : r.name,
      eficiencia: parseFloat((r.eficienciaCanal ?? 0).toFixed(1)),
      meta:       100,
    }))

  // ── Render helpers ─────────────────────────────────────────────────────────

  function renderC1() {
    if (c1Data.length === 0) return <EmptyChart msg="Sin datos este período" />
    if (c1Type === 'bar') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={c1Data} margin={{ top: 5, right: 10, bottom: 45, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#71717a' }} angle={-30} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 9, fill: '#71717a' }} width={28} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
            <Bar dataKey="esperadas" name="Esperadas" fill={CYAN} opacity={0.8} radius={[2, 2, 0, 0]} />
            <Bar dataKey="reales"    name="Reales"    fill={VIOLET} opacity={0.8} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )
    }
    if (c1Type === 'radar') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={c1Data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
            <PolarGrid stroke="#3f3f46" />
            <PolarAngleAxis dataKey="name" tick={{ fontSize: 9, fill: '#71717a' }} />
            <PolarRadiusAxis tick={{ fontSize: 8, fill: '#52525b' }} />
            <Radar name="Esperadas" dataKey="esperadas" stroke={CYAN}   fill={CYAN}   fillOpacity={0.2} />
            <Radar name="Reales"    dataKey="reales"    stroke={VIOLET} fill={VIOLET} fillOpacity={0.2} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
          </RadarChart>
        </ResponsiveContainer>
      )
    }
    // line
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={c1Data} margin={{ top: 5, right: 10, bottom: 45, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#71717a' }} angle={-30} textAnchor="end" interval={0} />
          <YAxis tick={{ fontSize: 9, fill: '#71717a' }} width={28} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
          <Line type="monotone" dataKey="esperadas" name="Esperadas" stroke={CYAN}   dot={{ fill: CYAN,   r: 3 }} strokeWidth={2} />
          <Line type="monotone" dataKey="reales"    name="Reales"    stroke={VIOLET} dot={{ fill: VIOLET, r: 3 }} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  function renderC2() {
    if (c2Data.length === 0) return <EmptyChart msg="Sin cierres registrados este período" />
    if (c2Type === 'donut') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={c2Data} cx="50%" cy="50%" innerRadius="38%" outerRadius="60%"
              dataKey="value" nameKey="name" label={(p: PieLabelRenderProps) => `${Number(p.value).toFixed(1)}%`}
              labelLine={false}>
              {c2Data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
          </PieChart>
        </ResponsiveContainer>
      )
    }
    if (c2Type === 'bar') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={c2Data} margin={{ top: 5, right: 10, bottom: 45, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#71717a' }} angle={-30} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 9, fill: '#71717a' }} width={32} unit="%" />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
            <Bar dataKey="value" name="Contrib. Global %" radius={[2, 2, 0, 0]}>
              {c2Data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )
    }
    // radar
    return (
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={c2Data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
          <PolarGrid stroke="#3f3f46" />
          <PolarAngleAxis dataKey="name" tick={{ fontSize: 9, fill: '#71717a' }} />
          <PolarRadiusAxis tick={{ fontSize: 8, fill: '#52525b' }} unit="%" />
          <Radar name="Contrib. Global %" dataKey="value" stroke={CYAN} fill={CYAN} fillOpacity={0.3} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
        </RadarChart>
      </ResponsiveContainer>
    )
  }

  function renderC3() {
    if (c3Data.length === 0) return <EmptyChart msg="Sin reuniones esperadas configuradas" />
    if (c3Type === 'gauge') {
      return (
        <div className="grid grid-cols-3 gap-x-2 gap-y-4 p-2 content-center h-full items-center">
          {c3Data.map((r) => (
            <GaugeMini key={r.name} value={r.eficiencia} name={r.fullName} />
          ))}
        </div>
      )
    }
    if (c3Type === 'bar') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={c3Data} margin={{ top: 5, right: 10, bottom: 45, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#71717a' }} angle={-30} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 9, fill: '#71717a' }} width={36} unit="%" domain={[0, 150]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
            <Bar dataKey="eficiencia" name="Eficiencia %" radius={[2, 2, 0, 0]}>
              {c3Data.map((r, i) => (
                <Cell key={i} fill={r.eficiencia >= 100 ? EMERALD : r.eficiencia >= 70 ? AMBER : RED} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )
    }
    // radar
    return (
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={c3Data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
          <PolarGrid stroke="#3f3f46" />
          <PolarAngleAxis dataKey="name" tick={{ fontSize: 9, fill: '#71717a' }} />
          <PolarRadiusAxis tick={{ fontSize: 8, fill: '#52525b' }} unit="%" domain={[0, 150]} />
          <Radar name="Eficiencia %" dataKey="eficiencia" stroke={CYAN} fill={CYAN} fillOpacity={0.3} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
        </RadarChart>
      </ResponsiveContainer>
    )
  }

  function renderC4() {
    if (c4Data.length === 0) return <EmptyChart msg="Sin reuniones esperadas configuradas" />
    if (c4Type === 'radar') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={c4Data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
            <PolarGrid stroke="#3f3f46" />
            <PolarAngleAxis dataKey="name" tick={{ fontSize: 9, fill: '#71717a' }} />
            <PolarRadiusAxis tick={{ fontSize: 8, fill: '#52525b' }} unit="%" domain={[0, 150]} />
            <Radar name="Eficiencia %" dataKey="eficiencia" stroke={CYAN}    fill={CYAN}    fillOpacity={0.3} strokeWidth={2} />
            <Radar name="Meta (100%)" dataKey="meta"       stroke={EMERALD} fill="none"    strokeDasharray="4 4" />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
          </RadarChart>
        </ResponsiveContainer>
      )
    }
    if (c4Type === 'bar') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={c4Data} margin={{ top: 5, right: 10, bottom: 45, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#71717a' }} angle={-30} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 9, fill: '#71717a' }} width={36} unit="%" domain={[0, 150]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
            <Bar dataKey="eficiencia" name="Eficiencia %" radius={[2, 2, 0, 0]}>
              {c4Data.map((r, i) => (
                <Cell key={i} fill={r.eficiencia >= 100 ? EMERALD : r.eficiencia >= 70 ? AMBER : RED} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )
    }
    // donut
    const donutData = c4Data.map((r) => ({ name: r.name, value: parseFloat((r.eficiencia || 0.1).toFixed(1)) }))
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={donutData} cx="50%" cy="50%" innerRadius="38%" outerRadius="60%"
            dataKey="value" nameKey="name"
            label={(p: PieLabelRenderProps) => `${Number(p.value).toFixed(1)}%`}
            labelLine={false}>
            {donutData.map((r, i) => (
              <Cell key={i} fill={r.value >= 100 ? EMERALD : r.value >= 70 ? AMBER : RED} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  // ── Empty chart placeholder ────────────────────────────────────────────────
  function EmptyChart({ msg }: { msg: string }) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-zinc-600">{msg}</p>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Month filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Período</span>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-transparent text-sm font-medium text-zinc-200 outline-none cursor-pointer pr-1"
          >
            {monthOptions.map((o) => (
              <option key={o.value} value={o.value} className="bg-zinc-900 text-zinc-200">{o.label}</option>
            ))}
          </select>
        </div>
        {!isCurrentMonth && (
          <span className="text-[10px] font-semibold px-2.5 py-1.5 rounded-full border border-amber-500/30 bg-amber-400/10 text-amber-400">
            Vista histórica
          </span>
        )}
        {loading && <span className="text-[10px] text-zinc-500 animate-pulse">Cargando…</span>}
      </div>

      {/* KPI cards */}
      <div className="flex gap-3 flex-wrap">
        <KpiCard
          label="Reuniones esperadas"
          value={fmtNum(reunEsperadas)}
          sub="total global del período"
        />
        <KpiCard
          label="Reuniones reales"
          value={fmtNum(reunReales)}
          sub="registradas en pipeline"
          accent={reunReales >= reunEsperadas * 0.95 ? EMERALD : reunReales >= reunEsperadas * 0.70 ? AMBER : RED}
        />
        <KpiCard
          label="Eficiencia global %"
          value={eficiencia !== null ? `${eficiencia.toFixed(1)}%` : '—'}
          sub="reales / esperadas × 100"
          accent={eficiencia === null ? CYAN : eficiencia >= 100 ? EMERALD : eficiencia >= 70 ? AMBER : RED}
        />
        <KpiCard
          label="Ingreso proyectado"
          value={fmtUsd(ingresoProy)}
          sub="cierres reales × ticket prom."
          accent={ingresoProy >= scenario.monthly_revenue_goal * 0.95 ? EMERALD : ingresoProy >= scenario.monthly_revenue_goal * 0.70 ? AMBER : RED}
        />
      </div>

      {/* 2×2 chart grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Chart 1 — Esperadas vs Reales */}
        <ChartCard
          title="Reuniones esperadas vs reales"
          typeOptions={[
            { value: 'bar'   as const, label: 'Barras'    },
            { value: 'radar' as const, label: 'Telaraña'  },
            { value: 'line'  as const, label: 'Tendencia' },
          ]}
          chartType={c1Type}
          onTypeChange={setC1Type}
        >
          {renderC1()}
        </ChartCard>

        {/* Chart 2 — Contribución por actividad */}
        <ChartCard
          title="Contribución por actividad"
          typeOptions={[
            { value: 'donut' as const, label: 'Dona'     },
            { value: 'bar'   as const, label: 'Barras'   },
            { value: 'radar' as const, label: 'Telaraña' },
          ]}
          chartType={c2Type}
          onTypeChange={setC2Type}
        >
          {renderC2()}
        </ChartCard>

        {/* Chart 3 — Eficiencia por canal */}
        <ChartCard
          title="Eficiencia por canal"
          typeOptions={[
            { value: 'gauge' as const, label: 'Tacómetro' },
            { value: 'bar'   as const, label: 'Barras'    },
            { value: 'radar' as const, label: 'Telaraña'  },
          ]}
          chartType={c3Type}
          onTypeChange={setC3Type}
        >
          {renderC3()}
        </ChartCard>

        {/* Chart 4 — Semáforo general */}
        <ChartCard
          title="Semáforo general"
          typeOptions={[
            { value: 'radar' as const, label: 'Telaraña' },
            { value: 'bar'   as const, label: 'Barras'   },
            { value: 'donut' as const, label: 'Dona'     },
          ]}
          chartType={c4Type}
          onTypeChange={setC4Type}
        >
          {renderC4()}
        </ChartCard>

      </div>
    </div>
  )
}
