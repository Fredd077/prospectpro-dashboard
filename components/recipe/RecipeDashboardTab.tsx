'use client'

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceArea,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line,
  PieChart, Pie, Cell,
} from 'recharts'
import type { PieLabelRenderProps } from 'recharts'
import { TrendingUp } from 'lucide-react'
import { usePerformanceData } from '@/lib/hooks/use-performance-data'
import type { RecipeScenario } from '@/lib/types/database'
import type { ActivityForSupervision } from './SupervisionPanel'

interface RecipeDashboardTabProps {
  scenario: RecipeScenario
  activities: ActivityForSupervision[]
}

// ── Design tokens ──────────────────────────────────────────────────────────────
const CYAN       = '#00D9FF'
const VIOLET     = '#8b5cf6'
const G_RED      = '#E24B4A'
const G_AMBER    = '#BA7517'
const G_GREEN    = '#1D9E75'
const PIE_COLORS = [CYAN, VIOLET, '#0d9488', '#d97706', '#e05a4e', '#06b6d4', '#a855f7', '#16a34a']

const TOOLTIP_STYLE = {
  backgroundColor: '#27272a',
  border: '1px solid rgba(0,217,255,0.15)',
  borderRadius: 6,
  fontSize: 11,
  color: '#e4e4e7',
}

function gaugeColor(v: number) {
  return v >= 100 ? G_GREEN : v >= 70 ? G_AMBER : G_RED
}

// ── KPI card ───────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, valueColor = '#ffffff',
}: {
  label: string; value: string; sub: string; valueColor?: string
}) {
  return (
    <div
      className="flex-1 min-w-0 rounded-lg bg-zinc-900 px-4 py-3"
      style={{ border: '0.5px solid rgba(0,217,255,0.2)' }}
    >
      <p
        className="uppercase font-semibold tracking-widest mb-2"
        style={{ fontSize: 10, color: CYAN, letterSpacing: '0.1em' }}
      >
        {label}
      </p>
      <p
        className="font-mono leading-none"
        style={{ fontSize: 28, fontWeight: 600, color: valueColor }}
      >
        {value}
      </p>
      <p className="mt-1.5 text-zinc-500" style={{ fontSize: 11 }}>{sub}</p>
    </div>
  )
}

// ── Chart card wrapper ──────────────────────────────────────────────────────────
function ChartCard<T extends string>({
  title, typeOptions, chartType, onTypeChange, contentHeight = 260, children,
}: {
  title: string
  typeOptions: { value: T; label: string }[]
  chartType: T
  onTypeChange: (v: T) => void
  contentHeight?: number
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-lg bg-zinc-900 p-4"
      style={{
        border:    '0.5px solid rgba(0,217,255,0.15)',
        borderRadius: 8,
        boxShadow: '0 0 20px rgba(0,217,255,0.03)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <p
          className="font-semibold uppercase tracking-widest"
          style={{ fontSize: 11, color: CYAN, letterSpacing: '0.1em' }}
        >
          {title}
        </p>
        {/* Pill selector */}
        <select
          value={chartType}
          onChange={(e) => onTypeChange(e.target.value as T)}
          className="rounded-full outline-none cursor-pointer px-2.5 py-1 transition-colors"
          style={{
            fontSize:        11,
            color:           CYAN,
            background:      'rgba(0,217,255,0.1)',
            border:          '0.5px solid rgba(0,217,255,0.3)',
          }}
          onMouseEnter={(e) => { (e.target as HTMLSelectElement).style.background = 'rgba(0,217,255,0.2)' }}
          onMouseLeave={(e) => { (e.target as HTMLSelectElement).style.background = 'rgba(0,217,255,0.1)' }}
        >
          {typeOptions.map((o) => (
            <option key={o.value} value={o.value} style={{ background: '#18181b', color: '#e4e4e7' }}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div
        className="rounded-md bg-zinc-950 overflow-hidden"
        style={{ height: contentHeight }}
      >
        {children}
      </div>
    </div>
  )
}

// ── Gauge card (half-donut) ────────────────────────────────────────────────────
function GaugeCard({ value, name }: { value: number; name: string }) {
  const maxVal = 150
  const clamp  = Math.min(Math.max(value, 0), maxVal)
  const color  = gaugeColor(clamp)
  const pct    = clamp / maxVal

  const gaugeData = [{ value: pct * 100 }, { value: (1 - pct) * 100 }]

  return (
    <div
      className="flex flex-col items-center rounded-lg bg-zinc-900 p-3"
      style={{ border: '0.5px solid rgba(0,217,255,0.1)' }}
    >
      {/* Half-donut — overflow:hidden clips the bottom semicircle */}
      <div style={{ width: 160, height: 82, overflow: 'hidden', flexShrink: 0 }}>
        <PieChart width={160} height={160}>
          {/* Track */}
          <Pie
            data={[{ value: 100 }]} cx={80} cy={128}
            startAngle={180} endAngle={0}
            innerRadius={50} outerRadius={68}
            dataKey="value" stroke="none" fill="#3f3f46"
            isAnimationActive={false}
          />
          {/* Value arc */}
          <Pie
            data={gaugeData} cx={80} cy={128}
            startAngle={180} endAngle={0}
            innerRadius={50} outerRadius={68}
            dataKey="value" stroke="none"
            isAnimationActive={false}
          >
            <Cell fill={color} />
            <Cell fill="transparent" />
          </Pie>
        </PieChart>
      </div>
      {/* Value */}
      <p className="font-mono font-bold mt-[-4px]" style={{ fontSize: 20, color }}>
        {value.toFixed(0)}%
      </p>
      {/* Label */}
      <p className="text-center leading-tight mt-1 text-zinc-400" style={{ fontSize: 11, maxWidth: 140 }}>
        {name.length > 15 ? name.slice(0, 14) + '…' : name}
      </p>
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyChart({ msg, icon = false }: { msg: string; icon?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2">
      {icon && <TrendingUp className="h-8 w-8 text-zinc-700" />}
      <p className="text-sm text-zinc-600">{msg}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export function RecipeDashboardTab({ scenario, activities }: RecipeDashboardTabProps) {
  const {
    monthOptions, selectedMonth, setSelectedMonth, isCurrentMonth, loading,
    allRows, outRows, inRows, allTotals, avgTicket,
  } = usePerformanceData(activities, scenario)

  // ── Chart type state ───────────────────────────────────────────────────────
  type C1 = 'bar' | 'radar' | 'line'
  type C2 = 'donut' | 'bar' | 'radar'
  type C3 = 'gauge' | 'bar' | 'radar'
  type C4 = 'radar' | 'bar' | 'donut'

  const [c1Type, setC1Type] = useState<C1>('bar')
  const [c2Type, setC2Type] = useState<C2>('donut')
  const [c3Type, setC3Type] = useState<C3>('gauge')
  const [c4Type, setC4Type] = useState<C4>('radar')

  // ── KPI values ─────────────────────────────────────────────────────────────
  const reunEsperadas  = allTotals.meetingsExpected
  const reunReales     = allTotals.reunionesReales
  const eficiencia     = allTotals.eficienciaCanal
  const totalCierres   = allTotals.cierresReales
  const ingresoProy    = totalCierres * avgTicket
  const monthlyGoal    = scenario.monthly_revenue_goal

  const fmtUsd = (n: number) => '$' + Math.round(n).toLocaleString('es')

  // ── Chart 1 data: OUTBOUND then separator then INBOUND ─────────────────────
  type C1Row = { name: string; esperadas: number | null; reales: number | null; group?: string }
  const outFiltered = outRows.filter((r) => r.meetingsExpected > 0 || r.reunionesReales > 0)
  const inFiltered  = inRows.filter((r)  => r.meetingsExpected > 0 || r.reunionesReales > 0)

  const c1Data: C1Row[] = [
    ...outFiltered.map((r) => ({
      name: r.name.length > 11 ? r.name.slice(0, 10) + '…' : r.name,
      esperadas: r.meetingsExpected,
      reales:    r.reunionesReales,
      group:     'out',
    })),
    ...(outFiltered.length > 0 && inFiltered.length > 0
      ? [{ name: '— INBOUND', esperadas: null, reales: null, group: 'sep' }]
      : []),
    ...inFiltered.map((r) => ({
      name: r.name.length > 11 ? r.name.slice(0, 10) + '…' : r.name,
      esperadas: r.meetingsExpected,
      reales:    r.reunionesReales,
      group:     'in',
    })),
  ]

  // First inbound label in c1Data (for ReferenceArea)
  const firstInLabel = c1Data.find((r) => r.group === 'in')?.name

  // ── Chart 2 data ───────────────────────────────────────────────────────────
  const c2Data = allRows
    .filter((r) => r.cierresReales > 0)
    .map((r) => ({
      name:  r.name.length > 14 ? r.name.slice(0, 13) + '…' : r.name,
      value: parseFloat(r.contribGlobalPct.toFixed(1)),
    }))

  // ── Chart 3 data ───────────────────────────────────────────────────────────
  const c3Data = allRows
    .filter((r) => r.meetingsExpected > 0)
    .sort((a, b) => b.meetingsExpected - a.meetingsExpected)
    .slice(0, 6)
    .map((r) => ({
      name:       r.name,
      shortName:  r.name.length > 12 ? r.name.slice(0, 11) + '…' : r.name,
      eficiencia: parseFloat((r.eficienciaCanal ?? 0).toFixed(1)),
    }))

  // ── Chart 4 data ───────────────────────────────────────────────────────────
  const c4Data = allRows
    .filter((r) => r.meetingsExpected > 0)
    .map((r) => ({
      name:       r.name.length > 11 ? r.name.slice(0, 10) + '…' : r.name,
      eficiencia: parseFloat((r.eficienciaCanal ?? 0).toFixed(1)),
      meta:       100,
    }))

  // ── Chart renderers ────────────────────────────────────────────────────────

  function renderC1() {
    if (c1Data.filter((r) => r.group !== 'sep').length === 0) {
      return <EmptyChart msg="Sin datos este período" />
    }
    if (c1Type === 'bar') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={c1Data} margin={{ top: 8, right: 12, bottom: 48, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: '#52525b' }}
              angle={-30} textAnchor="end" interval={0}
              axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#52525b' }}
              width={28}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Legend
              wrapperStyle={{ fontSize: 10, paddingTop: 4, color: '#71717a' }}
            />
            {/* INBOUND section highlight */}
            {firstInLabel && (
              <ReferenceArea
                x1={firstInLabel}
                x2={c1Data[c1Data.length - 1]?.name}
                fill="rgba(139,92,246,0.06)"
                stroke="none"
              />
            )}
            <Bar
              dataKey="esperadas" name="Esperadas"
              fill={CYAN} fillOpacity={0.7}
              radius={[2, 2, 0, 0]}
            />
            <Bar
              dataKey="reales" name="Reales"
              fill={VIOLET}
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )
    }
    if (c1Type === 'radar') {
      const radarData = c1Data.filter((r) => r.group !== 'sep')
      return (
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} margin={{ top: 12, right: 24, bottom: 12, left: 24 }}>
            <PolarGrid stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis dataKey="name" tick={{ fontSize: 9, fill: '#71717a' }} />
            <PolarRadiusAxis tick={{ fontSize: 8, fill: '#3f3f46' }} />
            <Radar name="Esperadas" dataKey="esperadas" stroke={CYAN}   fill={CYAN}   fillOpacity={0.15} strokeWidth={1.5} />
            <Radar name="Reales"    dataKey="reales"    stroke={VIOLET} fill={VIOLET} fillOpacity={0.15} strokeWidth={1.5} />
            <Legend wrapperStyle={{ fontSize: 10, color: '#71717a' }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
          </RadarChart>
        </ResponsiveContainer>
      )
    }
    // line
    const lineData = c1Data.filter((r) => r.group !== 'sep')
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={lineData} margin={{ top: 8, right: 12, bottom: 48, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="name" tick={{ fontSize: 10, fill: '#52525b' }}
            angle={-30} textAnchor="end" interval={0}
            axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false}
          />
          <YAxis tick={{ fontSize: 10, fill: '#52525b' }} width={28} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 10, color: '#71717a', paddingTop: 4 }} />
          <Line type="monotone" dataKey="esperadas" name="Esperadas" stroke={CYAN}   dot={{ fill: CYAN,   r: 3 }} strokeWidth={2} connectNulls={false} />
          <Line type="monotone" dataKey="reales"    name="Reales"    stroke={VIOLET} dot={{ fill: VIOLET, r: 3 }} strokeWidth={2} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  function renderC2() {
    if (c2Data.length === 0) {
      return <EmptyChart msg="Sin cierres este mes" icon />
    }
    if (c2Type === 'donut') {
      return (
        <div className="flex h-full">
          {/* Donut + center overlay */}
          <div className="relative" style={{ flex: '1 1 0', minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={c2Data} cx="50%" cy="48%"
                  innerRadius="38%" outerRadius="62%"
                  dataKey="value" nameKey="name"
                  stroke="none"
                  label={(p: PieLabelRenderProps) => `${Number(p.value).toFixed(0)}%`}
                  labelLine={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 0.5 }}
                >
                  {c2Data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: unknown) => `${Number(v).toFixed(1)}%`}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
              style={{ paddingBottom: '10%' }}
            >
              <p className="text-zinc-600" style={{ fontSize: 9 }}>cierres</p>
              <p className="font-mono font-bold" style={{ fontSize: 22, color: CYAN }}>{totalCierres}</p>
            </div>
          </div>
          {/* Custom legend */}
          <div className="flex flex-col gap-1.5 py-3 pl-2 overflow-y-auto" style={{ width: 120 }}>
            {c2Data.map((entry, i) => (
              <div key={i} className="flex items-start gap-1.5 min-w-0">
                <div
                  className="mt-0.5 shrink-0 rounded-sm"
                  style={{ width: 8, height: 8, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                />
                <div className="min-w-0">
                  <p className="text-zinc-300 leading-tight truncate" style={{ fontSize: 10 }}>{entry.name}</p>
                  <p className="font-mono text-zinc-500" style={{ fontSize: 10 }}>{entry.value}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    }
    if (c2Type === 'bar') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={c2Data} margin={{ top: 8, right: 12, bottom: 48, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#52525b' }} angle={-30} textAnchor="end" interval={0} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#52525b' }} width={32} unit="%" axisLine={false} tickLine={false} />
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
        <RadarChart data={c2Data} margin={{ top: 12, right: 24, bottom: 12, left: 24 }}>
          <PolarGrid stroke="rgba(255,255,255,0.08)" />
          <PolarAngleAxis dataKey="name" tick={{ fontSize: 9, fill: '#71717a' }} />
          <PolarRadiusAxis tick={{ fontSize: 8, fill: '#3f3f46' }} unit="%" />
          <Radar name="Contrib. Global %" dataKey="value" stroke={CYAN} fill={CYAN} fillOpacity={0.2} strokeWidth={1.5} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
        </RadarChart>
      </ResponsiveContainer>
    )
  }

  function renderC3() {
    if (c3Data.length === 0) return <EmptyChart msg="Sin reuniones esperadas configuradas" />
    if (c3Type === 'gauge') {
      return (
        <div className="grid grid-cols-3 gap-3 p-3 overflow-y-auto h-full content-start">
          {c3Data.map((r) => (
            <GaugeCard key={r.name} value={r.eficiencia} name={r.name} />
          ))}
        </div>
      )
    }
    if (c3Type === 'bar') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={c3Data.map(r => ({ ...r, name: r.shortName }))} margin={{ top: 8, right: 12, bottom: 48, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#52525b' }} angle={-30} textAnchor="end" interval={0} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#52525b' }} width={36} unit="%" domain={[0, 150]} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
            <Bar dataKey="eficiencia" name="Eficiencia %" radius={[2, 2, 0, 0]}>
              {c3Data.map((r, i) => <Cell key={i} fill={gaugeColor(r.eficiencia)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )
    }
    // radar
    return (
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={c3Data.map(r => ({ ...r, name: r.shortName }))} margin={{ top: 12, right: 24, bottom: 12, left: 24 }}>
          <PolarGrid stroke="rgba(255,255,255,0.08)" />
          <PolarAngleAxis dataKey="name" tick={{ fontSize: 9, fill: '#71717a' }} />
          <PolarRadiusAxis tick={{ fontSize: 8, fill: '#3f3f46' }} unit="%" domain={[0, 150]} />
          <Radar name="Eficiencia %" dataKey="eficiencia" stroke={CYAN} fill={CYAN} fillOpacity={0.2} strokeWidth={1.5} />
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
          <RadarChart data={c4Data} margin={{ top: 16, right: 28, bottom: 16, left: 28 }}>
            <PolarGrid stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.75)', fontWeight: 500 }}
            />
            <PolarRadiusAxis
              tick={{ fontSize: 8, fill: '#3f3f46' }}
              unit="%" domain={[0, 150]}
              tickCount={4}
            />
            {/* Meta reference line at 100% */}
            <Radar
              name="Meta (100%)" dataKey="meta"
              stroke="rgba(255,255,255,0.25)"
              fill="none"
              strokeDasharray="5 3"
              strokeWidth={1}
            />
            {/* Eficiencia fill */}
            <Radar
              name="Eficiencia %"  dataKey="eficiencia"
              stroke={CYAN}
              fill="rgba(0,217,255,0.15)"
              strokeWidth={2}
            />
            <Legend wrapperStyle={{ fontSize: 10, color: '#71717a' }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
          </RadarChart>
        </ResponsiveContainer>
      )
    }
    if (c4Type === 'bar') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={c4Data} margin={{ top: 8, right: 12, bottom: 48, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#52525b' }} angle={-30} textAnchor="end" interval={0} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#52525b' }} width={36} unit="%" domain={[0, 150]} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
            <Bar dataKey="eficiencia" name="Eficiencia %" radius={[2, 2, 0, 0]}>
              {c4Data.map((r, i) => <Cell key={i} fill={gaugeColor(r.eficiencia)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )
    }
    // donut
    const donutData = c4Data.map((r) => ({ name: r.name, value: Math.max(r.eficiencia, 0.1) }))
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={donutData} cx="50%" cy="50%"
            innerRadius="35%" outerRadius="58%"
            dataKey="value" nameKey="name"
            label={(p: PieLabelRenderProps) => `${Number(p.value).toFixed(0)}%`}
            labelLine={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 0.5 }}
            stroke="none"
          >
            {donutData.map((r, i) => (
              <Cell key={i} fill={gaugeColor(r.value)} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
          <Legend wrapperStyle={{ fontSize: 10, color: '#71717a' }} />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Period selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2"
          style={{
            background: '#18181b',
            border:     '0.5px solid rgba(0,217,255,0.2)',
          }}
        >
          <span
            className="uppercase font-semibold tracking-widest"
            style={{ fontSize: 10, color: CYAN, letterSpacing: '0.1em' }}
          >
            Período
          </span>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-transparent outline-none cursor-pointer font-medium text-zinc-200 text-sm"
          >
            {monthOptions.map((o) => (
              <option key={o.value} value={o.value} style={{ background: '#18181b' }}>{o.label}</option>
            ))}
          </select>
        </div>
        {!isCurrentMonth && (
          <span
            className="px-2.5 py-1 rounded-full font-semibold"
            style={{
              fontSize:   10,
              color:      '#d97706',
              background: 'rgba(217,119,6,0.1)',
              border:     '0.5px solid rgba(217,119,6,0.3)',
            }}
          >
            Vista histórica
          </span>
        )}
        {loading && (
          <span className="text-zinc-600 animate-pulse" style={{ fontSize: 10 }}>Cargando…</span>
        )}
      </div>

      {/* KPI row */}
      <div className="flex gap-3 flex-wrap">
        <KpiCard
          label="Reuniones esperadas"
          value={String(reunEsperadas)}
          sub="total global del período"
          valueColor="#ffffff"
        />
        <KpiCard
          label="Reuniones reales"
          value={String(reunReales)}
          sub="registradas en pipeline"
          valueColor={CYAN}
        />
        <KpiCard
          label="Eficiencia global"
          value={eficiencia !== null ? `${eficiencia.toFixed(1)}%` : '—'}
          sub="reales / esperadas × 100"
          valueColor={
            eficiencia === null ? '#71717a'
            : eficiencia >= 100 ? G_GREEN
            : eficiencia >= 70  ? G_AMBER
            : G_RED
          }
        />
        <KpiCard
          label="Ingreso proyectado"
          value={fmtUsd(ingresoProy)}
          sub={`meta: ${fmtUsd(monthlyGoal)}`}
          valueColor={
            ingresoProy >= monthlyGoal * 0.95 ? G_GREEN
            : ingresoProy >= monthlyGoal * 0.70 ? G_AMBER
            : CYAN
          }
        />
      </div>

      {/* 2×2 grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

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

        <ChartCard
          title="Eficiencia por canal"
          typeOptions={[
            { value: 'gauge' as const, label: 'Tacómetro' },
            { value: 'bar'   as const, label: 'Barras'    },
            { value: 'radar' as const, label: 'Telaraña'  },
          ]}
          chartType={c3Type}
          onTypeChange={setC3Type}
          contentHeight={300}
        >
          {renderC3()}
        </ChartCard>

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
