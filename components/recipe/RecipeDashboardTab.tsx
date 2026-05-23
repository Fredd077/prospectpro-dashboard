'use client'

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceArea, ReferenceLine,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line,
  PieChart, Pie, Cell,
  RadialBarChart, RadialBar,
} from 'recharts'
import type { PieLabelRenderProps } from 'recharts'
import { usePerformanceData } from '@/lib/hooks/use-performance-data'
import type { RecipeScenario } from '@/lib/types/database'
import type { ActivityForSupervision } from './SupervisionPanel'

interface RecipeDashboardTabProps {
  scenario: RecipeScenario
  activities: ActivityForSupervision[]
}

// ── Design tokens ──────────────────────────────────────────────────────────────
const CYAN   = '#00D9FF'
const VIOLET = '#8b5cf6'
const GREEN  = '#1D9E75'
const AMBER  = '#EF9F27'
const RED    = '#E24B4A'

const C2_COLORS = ['#55555599', '#1D9E7599', '#EF9F2799']

const TOOLTIP_STYLE = {
  backgroundColor: '#0e0e15',
  border: '1px solid rgba(0,217,255,0.4)',
  borderRadius: 8,
  fontSize: 13,
  color: '#f4f4f5',
  padding: '8px 12px',
}
const TOOLTIP_LABEL_STYLE = {
  color: CYAN,
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 4,
  letterSpacing: '0.05em',
}
const TOOLTIP_ITEM_STYLE = {
  color: '#f4f4f5',
  fontSize: 13,
  fontWeight: 500,
  padding: '1px 0',
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtCop(n: number): string {
  const s = Math.round(Math.abs(n)).toString()
  const formatted = s.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return (n < 0 ? '-$' : '$') + formatted
}

function fmtK(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`
  return fmtCop(n)
}

function effColor(v: number): string {
  return v >= 100 ? GREEN : v >= 70 ? AMBER : RED
}

// ── Section label ──────────────────────────────────────────────────────────────
function SectionLabel({ text }: { text: string }) {
  return (
    <p
      className="uppercase font-semibold tracking-widest mb-1.5"
      style={{ fontSize: 9, letterSpacing: '0.12em', color: '#333' }}
    >
      {text}
    </p>
  )
}

// ── Activity KPI card ──────────────────────────────────────────────────────────
function ActivityKpiCard({
  label, value, sub, valueColor = '#fff',
}: {
  label: string; value: string; sub?: string; valueColor?: string
}) {
  return (
    <div
      className="rounded-lg px-4 py-3"
      style={{ background: '#111118', border: '0.5px solid rgba(0,217,255,0.2)', borderRadius: 8 }}
    >
      <p className="uppercase font-semibold mb-1.5" style={{ fontSize: 10, color: CYAN, letterSpacing: '0.1em' }}>
        {label}
      </p>
      <p className="font-mono leading-none" style={{ fontSize: 22, fontWeight: 600, color: valueColor }}>
        {value}
      </p>
      {sub && <p className="mt-1" style={{ fontSize: 10, color: '#444' }}>{sub}</p>}
    </div>
  )
}

// ── Income KPI card ────────────────────────────────────────────────────────────
function IncomeKpiCard({
  label, value, sub, delta, deltaColor, valueColor = '#fff',
  borderColor = 'rgba(0,217,255,0.2)', labelColor = CYAN,
}: {
  label: string; value: string; sub?: string
  delta?: string; deltaColor?: string
  valueColor?: string; borderColor?: string; labelColor?: string
}) {
  return (
    <div
      className="rounded-lg px-4 py-3"
      style={{ background: '#111118', border: `0.5px solid ${borderColor}`, borderRadius: 8 }}
    >
      <p className="uppercase font-semibold mb-1.5" style={{ fontSize: 10, color: labelColor, letterSpacing: '0.1em' }}>
        {label}
      </p>
      <p className="font-mono leading-none" style={{ fontSize: 22, fontWeight: 600, color: valueColor }}>
        {value}
      </p>
      {sub && <p className="mt-1" style={{ fontSize: 10, color: '#444' }}>{sub}</p>}
      {delta && (
        <p className="mt-1 font-mono font-medium" style={{ fontSize: 10, color: deltaColor }}>
          {delta}
        </p>
      )}
    </div>
  )
}

// ── Alignment card ─────────────────────────────────────────────────────────────
function AlignmentCard({
  title, titleColor, bg, borderColor,
  citasProyectadas, citasRequeridas, ingresoProy, desviacionPct,
}: {
  title: string; titleColor: string; bg: string; borderColor: string
  citasProyectadas: number; citasRequeridas: number | null
  ingresoProy: number; desviacionPct: number | null
}) {
  const diff = citasRequeridas !== null ? citasProyectadas - Math.round(citasRequeridas) : null
  const isSurplus = diff !== null && diff >= 0

  return (
    <div
      className="rounded-lg px-4 py-3"
      style={{ background: bg, border: `0.5px solid ${borderColor}`, borderRadius: 8 }}
    >
      <p className="uppercase font-semibold mb-2" style={{ fontSize: 10, color: titleColor, letterSpacing: '0.1em' }}>
        {title}
      </p>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-zinc-500" style={{ fontSize: 10 }}>Citas proyectadas</span>
          <span className="font-mono font-semibold text-zinc-200" style={{ fontSize: 14 }}>{citasProyectadas}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-zinc-500" style={{ fontSize: 10 }}>Citas requeridas</span>
          <span className="font-mono font-semibold text-zinc-200" style={{ fontSize: 14 }}>
            {citasRequeridas !== null ? Math.round(citasRequeridas) : '—'}
          </span>
        </div>
        {diff !== null && (
          <div className="mt-0.5">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full font-semibold"
              style={{
                fontSize: 10,
                background: isSurplus ? 'rgba(29,158,117,0.12)' : 'rgba(226,75,74,0.12)',
                color: isSurplus ? GREEN : RED,
                border: `0.5px solid ${isSurplus ? 'rgba(29,158,117,0.3)' : 'rgba(226,75,74,0.3)'}`,
              }}
            >
              {isSurplus ? `Excedente: +${diff}` : `Brecha: ${diff}`}
            </span>
          </div>
        )}
        <div className="mt-2 pt-2" style={{ borderTop: '0.5px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-baseline justify-between">
            <span className="text-zinc-600" style={{ fontSize: 10 }}>Ingreso proyectado</span>
            <span className="font-mono text-zinc-300" style={{ fontSize: 11 }}>{fmtCop(ingresoProy)}</span>
          </div>
          {desviacionPct !== null && (
            <div className="flex items-baseline justify-between mt-0.5">
              <span className="text-zinc-600" style={{ fontSize: 10 }}>Desviación vs meta</span>
              <span
                className="font-mono font-medium"
                style={{ fontSize: 10, color: desviacionPct >= 0 ? GREEN : RED }}
              >
                {desviacionPct >= 0 ? '+' : ''}{desviacionPct.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Chart card wrapper ─────────────────────────────────────────────────────────
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
      className="rounded-lg p-3"
      style={{ background: '#111118', border: '0.5px solid rgba(0,217,255,0.12)', borderRadius: 8 }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="uppercase font-semibold" style={{ fontSize: 10, color: CYAN, letterSpacing: '0.1em' }}>
          {title}
        </p>
        <select
          value={chartType}
          onChange={(e) => onTypeChange(e.target.value as T)}
          className="rounded-full outline-none cursor-pointer px-2.5 py-1"
          style={{ fontSize: 10, color: CYAN, background: '#0d1a1a', border: '0.5px solid rgba(0,217,255,0.25)' }}
        >
          {typeOptions.map((o) => (
            <option key={o.value} value={o.value} style={{ background: '#111118', color: '#e4e4e7' }}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="rounded-md overflow-hidden" style={{ height: contentHeight, background: '#0a0a0f' }}>
        {children}
      </div>
    </div>
  )
}

function EmptyChart({ msg }: { msg: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <p style={{ fontSize: 11, color: '#333' }}>{msg}</p>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export function RecipeDashboardTab({ scenario, activities }: RecipeDashboardTabProps) {
  const {
    monthOptions, selectedMonth, setSelectedMonth, isCurrentMonth, loading,
    outRows, inRows, allRows,
    outTotals, inTotals, allTotals,
    avgTicket, monthlyGoal, metaOut, metaIn,
  } = usePerformanceData(activities, scenario)

  type C1 = 'bar' | 'barh' | 'radar' | 'line'
  type C2 = 'bar' | 'donut' | 'radar' | 'polar'
  type C3 = 'bar' | 'radar' | 'line' | 'polar'
  type C4 = 'radar' | 'bar' | 'donut' | 'polar'

  const [c1Type, setC1Type] = useState<C1>('bar')
  const [c2Type, setC2Type] = useState<C2>('bar')
  const [c3Type, setC3Type] = useState<C3>('bar')
  const [c4Type, setC4Type] = useState<C4>('radar')

  // ── Section 1 ─────────────────────────────────────────────────────────────
  const reunEsperadas = allTotals.meetingsExpected
  const reunReales    = allTotals.reunionesReales
  const eficiencia    = allTotals.eficienciaCanal

  // ── Section 2 ─────────────────────────────────────────────────────────────
  // Projected income = sum(meetingsExpected × convRate% × avgTicket)
  const ingresoProyectado = allRows.reduce(
    (s, r) => s + r.meetingsExpected * (r.convRate / 100) * avgTicket, 0,
  )
  const ingresoReal = allTotals.cierresReales * avgTicket

  const deltaProyVsMeta = monthlyGoal > 0 ? ((ingresoProyectado - monthlyGoal) / monthlyGoal) * 100 : null
  const deltaRealVsMeta = monthlyGoal > 0 ? ((ingresoReal - monthlyGoal) / monthlyGoal) * 100 : null

  // ── Section 3 ─────────────────────────────────────────────────────────────
  function citasReq(metaGroup: number, avgConvRate: number | null): number | null {
    if (!avgConvRate || avgConvRate <= 0 || avgTicket <= 0) return null
    return (metaGroup / avgTicket) / (avgConvRate / 100)
  }

  const outIngresoProy = outRows.reduce((s, r) => s + r.meetingsExpected * (r.convRate / 100) * avgTicket, 0)
  const inIngresoProy  = inRows.reduce((s, r) => s + r.meetingsExpected * (r.convRate / 100) * avgTicket, 0)

  const outDesvPct = metaOut > 0 ? ((outIngresoProy - metaOut) / metaOut) * 100 : null
  const inDesvPct  = metaIn  > 0 ? ((inIngresoProy  - metaIn)  / metaIn)  * 100 : null
  const allDesvPct = monthlyGoal > 0 ? ((ingresoProyectado - monthlyGoal) / monthlyGoal) * 100 : null

  // ── Section 4 ─────────────────────────────────────────────────────────────
  const top3Reuniones = [...allRows]
    .sort((a, b) => b.reunionesReales - a.reunionesReales)
    .slice(0, 3)
    .filter((r) => r.reunionesReales > 0)
  const maxReuniones = top3Reuniones[0]?.reunionesReales ?? 1

  const top3Cierres = [...allRows]
    .sort((a, b) => b.cierresReales - a.cierresReales)
    .slice(0, 3)
    .filter((r) => r.cierresReales > 0)
  const maxCierres = top3Cierres[0]?.cierresReales ?? 1

  const sinResultados = allRows.filter((r) => r.reunionesReales === 0 && r.meetingsExpected > 0)
  const mayorBrecha = sinResultados.length > 0
    ? sinResultados.reduce((p, c) => c.meetingsExpected > p.meetingsExpected ? c : p)
    : null

  // ── Section 5: chart data ──────────────────────────────────────────────────
  const outActive = outRows.filter((r) => r.meetingsExpected > 0 || r.reunionesReales > 0)
  const inActive  = inRows.filter((r)  => r.meetingsExpected > 0 || r.reunionesReales > 0)

  type C1Row = { name: string; esperadas: number | null; reales: number | null; group?: string }
  const c1Data: C1Row[] = [
    ...outActive.map((r) => ({
      name: r.name.length > 12 ? r.name.slice(0, 11) + '…' : r.name,
      esperadas: r.meetingsExpected, reales: r.reunionesReales, group: 'out',
    })),
    ...(outActive.length > 0 && inActive.length > 0
      ? [{ name: '— IN', esperadas: null, reales: null, group: 'sep' } as C1Row]
      : []),
    ...inActive.map((r) => ({
      name: r.name.length > 12 ? r.name.slice(0, 11) + '…' : r.name,
      esperadas: r.meetingsExpected, reales: r.reunionesReales, group: 'in',
    })),
  ]
  const c1NonSep = c1Data.filter((r) => r.group !== 'sep')
  const firstInLabel = c1Data.find((r) => r.group === 'in')?.name

  const c2BarData = [
    { name: 'Meta',       value: monthlyGoal      },
    { name: 'Proyectado', value: ingresoProyectado },
    { name: 'Real',       value: ingresoReal       },
  ]

  const c3Data = allRows
    .filter((r) => r.meetingsExpected > 0)
    .map((r) => ({
      name:       r.name.length > 13 ? r.name.slice(0, 12) + '…' : r.name,
      eficiencia: parseFloat((r.eficienciaCanal ?? 0).toFixed(1)),
      fill:       effColor(r.eficienciaCanal ?? 0),
    }))

  const c4Data = allRows
    .filter((r) => r.meetingsExpected > 0)
    .map((r) => ({
      name:       r.name.length > 11 ? r.name.slice(0, 10) + '…' : r.name,
      eficiencia: parseFloat((r.eficienciaCanal ?? 0).toFixed(1)),
      meta:       100,
    }))

  // ── Rank color arrays ──────────────────────────────────────────────────────
  const rankCyan  = [CYAN, 'rgba(0,217,255,0.65)', 'rgba(0,217,255,0.4)']
  const rankGreen = [GREEN, 'rgba(29,158,117,0.65)', 'rgba(29,158,117,0.4)']

  // ── Chart renderers ────────────────────────────────────────────────────────
  function renderC1() {
    if (c1NonSep.length === 0) return <EmptyChart msg="Sin datos este período" />

    if (c1Type === 'barh') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={c1NonSep} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 9, fill: '#555' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#555' }} width={56} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} cursor={{ fill: 'rgba(0,217,255,0.06)' }} />
            <Legend wrapperStyle={{ fontSize: 10, color: '#555' }} />
            <Bar dataKey="esperadas" name="Esperadas" fill={`${CYAN}88`} radius={[0, 2, 2, 0]} />
            <Bar dataKey="reales"    name="Reales"    fill={`${VIOLET}88`} radius={[0, 2, 2, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )
    }
    if (c1Type === 'radar') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={c1NonSep} margin={{ top: 12, right: 24, bottom: 12, left: 24 }}>
            <PolarGrid stroke="rgba(255,255,255,0.07)" />
            <PolarAngleAxis dataKey="name" tick={{ fontSize: 9, fill: '#555' }} />
            <PolarRadiusAxis tick={{ fontSize: 8, fill: '#333' }} />
            <Radar name="Esperadas" dataKey="esperadas" stroke={CYAN}   fill={CYAN}   fillOpacity={0.12} strokeWidth={1.5} />
            <Radar name="Reales"    dataKey="reales"    stroke={VIOLET} fill={VIOLET} fillOpacity={0.12} strokeWidth={1.5} />
            <Legend wrapperStyle={{ fontSize: 10, color: '#555' }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
          </RadarChart>
        </ResponsiveContainer>
      )
    }
    if (c1Type === 'line') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={c1NonSep} margin={{ top: 8, right: 12, bottom: 44, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#555' }} angle={-30} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#555' }} width={26} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
            <Legend wrapperStyle={{ fontSize: 10, color: '#555', paddingTop: 4 }} />
            <Line type="monotone" dataKey="esperadas" name="Esperadas" stroke={CYAN}   dot={{ fill: CYAN,   r: 3 }} strokeWidth={2} connectNulls={false} />
            <Line type="monotone" dataKey="reales"    name="Reales"    stroke={VIOLET} dot={{ fill: VIOLET, r: 3 }} strokeWidth={2} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      )
    }
    // bar (default)
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={c1Data} margin={{ top: 8, right: 12, bottom: 44, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#555' }} angle={-30} textAnchor="end" interval={0} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: '#555' }} width={26} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} cursor={{ fill: 'rgba(0,217,255,0.06)' }} />
          <Legend wrapperStyle={{ fontSize: 10, color: '#555', paddingTop: 4 }} />
          {firstInLabel && (
            <ReferenceArea x1={firstInLabel} x2={c1Data[c1Data.length - 1]?.name} fill="rgba(139,92,246,0.05)" stroke="none" />
          )}
          <Bar dataKey="esperadas" name="Esperadas" fill={`${CYAN}88`}   radius={[2, 2, 0, 0]} />
          <Bar dataKey="reales"    name="Reales"    fill={`${VIOLET}88`} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  function renderC2() {
    if (c2Type === 'donut') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={c2BarData} cx="50%" cy="50%"
              innerRadius="38%" outerRadius="60%"
              dataKey="value" nameKey="name"
              stroke="none" label={false}
            >
              {c2BarData.map((_, i) => <Cell key={i} fill={C2_COLORS[i] ?? '#555'} />)}
            </Pie>
            <Legend wrapperStyle={{ fontSize: 10, color: '#555' }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} formatter={(v: unknown) => fmtCop(Number(v))} />
          </PieChart>
        </ResponsiveContainer>
      )
    }
    if (c2Type === 'radar') {
      const radarData = [
        { metric: 'Meta',       value: monthlyGoal      },
        { metric: 'Proyectado', value: ingresoProyectado },
        { metric: 'Real',       value: ingresoReal       },
      ]
      return (
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
            <PolarGrid stroke="rgba(255,255,255,0.07)" />
            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: '#555' }} />
            <PolarRadiusAxis tick={{ fontSize: 8, fill: '#333' }} tickFormatter={(v: number) => fmtK(v)} />
            <Radar name="Valor" dataKey="value" stroke={GREEN} fill={GREEN} fillOpacity={0.15} strokeWidth={1.5} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} formatter={(v: unknown) => fmtCop(Number(v))} />
          </RadarChart>
        </ResponsiveContainer>
      )
    }
    if (c2Type === 'polar') {
      const polarData = [
        { name: 'Real',       value: Math.max(ingresoReal, 1),        fill: AMBER  },
        { name: 'Proyectado', value: Math.max(ingresoProyectado, 1),  fill: GREEN  },
        { name: 'Meta',       value: Math.max(monthlyGoal, 1),        fill: '#777' },
      ]
      return (
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart data={polarData} innerRadius="20%" outerRadius="90%" cx="50%" cy="50%">
            <RadialBar dataKey="value" background={{ fill: '#1a1a1f' }} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 10, color: '#555' }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} formatter={(v: unknown) => fmtCop(Number(v))} />
          </RadialBarChart>
        </ResponsiveContainer>
      )
    }
    // bar (default)
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={c2BarData} margin={{ top: 8, right: 16, bottom: 16, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#555' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: '#555' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtK(v)} width={44} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} formatter={(v: unknown) => fmtCop(Number(v))} />
          <Bar dataKey="value" name="Valor" radius={[3, 3, 0, 0]}>
            {c2BarData.map((_, i) => <Cell key={i} fill={C2_COLORS[i] ?? '#555'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  function renderC3() {
    if (c3Data.length === 0) return <EmptyChart msg="Sin reuniones esperadas configuradas" />

    if (c3Type === 'radar') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={c3Data} margin={{ top: 12, right: 24, bottom: 12, left: 24 }}>
            <PolarGrid stroke="rgba(255,255,255,0.07)" />
            <PolarAngleAxis dataKey="name" tick={{ fontSize: 9, fill: '#555' }} />
            <PolarRadiusAxis tick={{ fontSize: 8, fill: '#333' }} unit="%" domain={[0, 120]} />
            <Radar name="Eficiencia %" dataKey="eficiencia" stroke={CYAN} fill={CYAN} fillOpacity={0.15} strokeWidth={1.5} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
          </RadarChart>
        </ResponsiveContainer>
      )
    }
    if (c3Type === 'line') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={c3Data} margin={{ top: 8, right: 16, bottom: 44, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#555' }} angle={-30} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#555' }} width={36} unit="%" domain={[0, 120]} axisLine={false} tickLine={false} />
            <ReferenceLine y={100} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 3" />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
            <Line type="monotone" dataKey="eficiencia" name="Eficiencia %" stroke={CYAN} dot={{ fill: CYAN, r: 3 }} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      )
    }
    if (c3Type === 'polar') {
      const polarC3 = c3Data.map((r) => ({ ...r, value: r.eficiencia }))
      return (
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart data={polarC3} innerRadius="15%" outerRadius="90%" cx="50%" cy="50%">
            <RadialBar dataKey="value" background={{ fill: '#1a1a1f' }} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 10, color: '#555' }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
          </RadialBarChart>
        </ResponsiveContainer>
      )
    }
    // bar (default)
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={c3Data} margin={{ top: 8, right: 16, bottom: 44, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#555' }} angle={-30} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: '#555' }} width={36} unit="%" domain={[0, 120]} axisLine={false} tickLine={false} />
          <ReferenceLine y={100} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 3" />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
          <Bar dataKey="eficiencia" name="Eficiencia %" radius={[2, 2, 0, 0]}>
            {c3Data.map((r, i) => <Cell key={i} fill={r.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  function renderC4() {
    if (c4Data.length === 0) return <EmptyChart msg="Sin reuniones esperadas configuradas" />

    if (c4Type === 'bar') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={c4Data} margin={{ top: 8, right: 12, bottom: 44, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#555' }} angle={-30} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#555' }} width={36} unit="%" domain={[0, 150]} axisLine={false} tickLine={false} />
            <ReferenceLine y={100} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 3" />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
            <Bar dataKey="eficiencia" name="Eficiencia %" radius={[2, 2, 0, 0]}>
              {c4Data.map((r, i) => <Cell key={i} fill={effColor(r.eficiencia)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )
    }
    if (c4Type === 'donut') {
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
              {donutData.map((r, i) => <Cell key={i} fill={effColor(r.value)} />)}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
            <Legend wrapperStyle={{ fontSize: 10, color: '#555' }} />
          </PieChart>
        </ResponsiveContainer>
      )
    }
    if (c4Type === 'polar') {
      const polarC4 = c4Data.map((r) => ({ ...r, value: r.eficiencia, fill: effColor(r.eficiencia) }))
      return (
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart data={polarC4} innerRadius="15%" outerRadius="90%" cx="50%" cy="50%">
            <RadialBar dataKey="value" background={{ fill: '#1a1a1f' }} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 10, color: '#555' }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
          </RadialBarChart>
        </ResponsiveContainer>
      )
    }
    // radar (default)
    return (
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={c4Data} margin={{ top: 16, right: 28, bottom: 16, left: 28 }}>
          <PolarGrid stroke="rgba(255,255,255,0.08)" />
          <PolarAngleAxis dataKey="name" tick={{ fontSize: 8, fill: '#555' }} />
          <PolarRadiusAxis tick={{ fontSize: 8, fill: '#333' }} unit="%" domain={[0, 150]} tickCount={4} />
          <Radar name="Meta (100%)" dataKey="meta"       stroke="rgba(255,255,255,0.12)" fill="none"                        strokeDasharray="5 3" strokeWidth={1} />
          <Radar name="Eficiencia %" dataKey="eficiencia" stroke={CYAN}                  fill="rgba(0,217,255,0.12)"        strokeWidth={2} />
          <Legend wrapperStyle={{ fontSize: 10, color: '#555' }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
        </RadarChart>
      </ResponsiveContainer>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col" style={{ gap: 10 }}>

      {/* Period selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2"
          style={{ background: '#111118', border: '0.5px solid rgba(0,217,255,0.2)' }}
        >
          <span className="uppercase font-semibold" style={{ fontSize: 10, color: CYAN, letterSpacing: '0.1em' }}>
            Período
          </span>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-transparent outline-none cursor-pointer font-medium text-zinc-200"
            style={{ fontSize: 13 }}
          >
            {monthOptions.map((o) => (
              <option key={o.value} value={o.value} style={{ background: '#111118' }}>{o.label}</option>
            ))}
          </select>
        </div>
        {!isCurrentMonth && (
          <span
            className="px-2.5 py-1 rounded-full font-semibold"
            style={{ fontSize: 10, color: AMBER, background: 'rgba(239,159,39,0.1)', border: '0.5px solid rgba(239,159,39,0.3)' }}
          >
            Vista histórica
          </span>
        )}
        {loading && <span className="animate-pulse" style={{ fontSize: 10, color: '#333' }}>Cargando…</span>}
      </div>

      {/* ── SECCIÓN 1: KPIs de actividad ─────────────────────────────────── */}
      <div>
        <SectionLabel text="Actividad del período" />
        <div className="grid grid-cols-3 gap-2">
          <ActivityKpiCard
            label="Reuniones esperadas"
            value={String(reunEsperadas)}
            sub="plan del período"
          />
          <ActivityKpiCard
            label="Reuniones reales"
            value={String(reunReales)}
            sub="registradas en pipeline"
            valueColor={CYAN}
          />
          <ActivityKpiCard
            label="Eficiencia global"
            value={eficiencia !== null ? `${eficiencia.toFixed(1)}%` : '—'}
            sub="reales / esperadas × 100"
            valueColor={
              eficiencia === null ? '#555'
              : eficiencia >= 100  ? GREEN
              : eficiencia >= 70   ? AMBER
              : RED
            }
          />
        </div>
      </div>

      {/* ── SECCIÓN 2: KPIs de ingresos ───────────────────────────────────── */}
      <div>
        <SectionLabel text="Ingresos del período" />
        <div className="grid grid-cols-3 gap-2">
          <IncomeKpiCard
            label="Meta mensual"
            value={fmtCop(monthlyGoal)}
            sub="objetivo del recetario"
            borderColor="rgba(29,158,117,0.3)"
            labelColor={GREEN}
          />
          <IncomeKpiCard
            label="Ingreso proyectado"
            value={fmtCop(ingresoProyectado)}
            sub="cierres proyectados × ticket"
            valueColor={GREEN}
            delta={
              deltaProyVsMeta !== null
                ? `${deltaProyVsMeta >= 0 ? '+' : ''}${fmtCop(ingresoProyectado - monthlyGoal)} (${deltaProyVsMeta.toFixed(1)}%)`
                : undefined
            }
            deltaColor={deltaProyVsMeta !== null && deltaProyVsMeta >= 0 ? GREEN : RED}
          />
          <IncomeKpiCard
            label="Ingreso real"
            value={fmtCop(ingresoReal)}
            sub="cierres ganados × ticket"
            valueColor={AMBER}
            delta={
              deltaRealVsMeta !== null
                ? `${deltaRealVsMeta >= 0 ? '+' : ''}${fmtCop(ingresoReal - monthlyGoal)} (${deltaRealVsMeta.toFixed(1)}%)`
                : undefined
            }
            deltaColor={deltaRealVsMeta !== null && deltaRealVsMeta >= 0 ? GREEN : RED}
          />
        </div>
      </div>

      {/* ── SECCIÓN 3: Alineación ─────────────────────────────────────────── */}
      <div>
        <SectionLabel text="Alineación con el recetario" />
        <div className="grid grid-cols-3 gap-2">
          <AlignmentCard
            title="Outbound"
            titleColor={CYAN}
            bg="#0d1a1a"
            borderColor="rgba(0,217,255,0.25)"
            citasProyectadas={outTotals.meetingsExpected}
            citasRequeridas={citasReq(metaOut, outTotals.avgConvRate)}
            ingresoProy={outIngresoProy}
            desviacionPct={outDesvPct}
          />
          <AlignmentCard
            title="Inbound"
            titleColor={VIOLET}
            bg="#120d1a"
            borderColor="rgba(139,92,246,0.25)"
            citasProyectadas={inTotals.meetingsExpected}
            citasRequeridas={citasReq(metaIn, inTotals.avgConvRate)}
            ingresoProy={inIngresoProy}
            desviacionPct={inDesvPct}
          />
          <AlignmentCard
            title="Total"
            titleColor="#888"
            bg="#111118"
            borderColor="rgba(255,255,255,0.1)"
            citasProyectadas={allTotals.meetingsExpected}
            citasRequeridas={citasReq(monthlyGoal, allTotals.avgConvRate)}
            ingresoProy={ingresoProyectado}
            desviacionPct={allDesvPct}
          />
        </div>
      </div>

      {/* ── SECCIÓN 4: Análisis de actividades ───────────────────────────── */}
      <div>
        <SectionLabel text="Análisis de actividades" />
        <div className="grid grid-cols-2 gap-2">

          {/* Panel 1 — Top 3 citas */}
          <div className="rounded-lg p-3" style={{ background: '#111118', border: '0.5px solid rgba(0,217,255,0.2)', borderRadius: 8 }}>
            <p className="uppercase font-semibold mb-3" style={{ fontSize: 10, color: CYAN, letterSpacing: '0.1em' }}>
              Ranking de las 3 actividades que más citas me están generando
            </p>
            {top3Reuniones.length === 0 ? (
              <p style={{ fontSize: 11, color: '#333' }}>Sin reuniones este período</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {top3Reuniones.map((r, i) => (
                  <div key={r.id} className="flex items-center gap-2">
                    <div
                      className="flex items-center justify-center rounded-full shrink-0 font-bold"
                      style={{ width: 20, height: 20, fontSize: 10, background: rankCyan[i], color: '#000' }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-zinc-300 truncate" style={{ fontSize: 11 }}>{r.name}</span>
                        <span
                          className="shrink-0 px-1 rounded"
                          style={{
                            fontSize: 8,
                            background: r.type === 'OUTBOUND' ? 'rgba(0,217,255,0.1)' : 'rgba(139,92,246,0.1)',
                            color:      r.type === 'OUTBOUND' ? CYAN : VIOLET,
                          }}
                        >
                          {r.type === 'OUTBOUND' ? 'OUT' : 'IN'}
                        </span>
                      </div>
                      <div className="relative h-1 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{ width: `${(r.reunionesReales / Math.max(maxReuniones, 1)) * 100}%`, background: rankCyan[i] }}
                        />
                      </div>
                    </div>
                    <span className="font-mono font-bold shrink-0" style={{ fontSize: 15, color: rankCyan[i] }}>
                      {r.reunionesReales}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Panel 2 — Top 3 cierres */}
          <div className="rounded-lg p-3" style={{ background: '#111118', border: '0.5px solid rgba(29,158,117,0.2)', borderRadius: 8 }}>
            <p className="uppercase font-semibold mb-3" style={{ fontSize: 10, color: GREEN, letterSpacing: '0.1em' }}>
              Ranking de las 3 actividades que más cierres me están generando
            </p>
            {top3Cierres.length === 0 ? (
              <p style={{ fontSize: 11, color: '#333' }}>Sin cierres este período</p>
            ) : (
              <>
                <div className="flex flex-col gap-2.5">
                  {top3Cierres.map((r, i) => (
                    <div key={r.id} className="flex items-center gap-2">
                      <div
                        className="flex items-center justify-center rounded-full shrink-0 font-bold"
                        style={{ width: 20, height: 20, fontSize: 10, background: rankGreen[i], color: '#000' }}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-zinc-300 truncate" style={{ fontSize: 11 }}>{r.name}</span>
                          <span
                            className="shrink-0 px-1 rounded"
                            style={{
                              fontSize: 8,
                              background: r.type === 'OUTBOUND' ? 'rgba(0,217,255,0.1)' : 'rgba(139,92,246,0.1)',
                              color:      r.type === 'OUTBOUND' ? CYAN : VIOLET,
                            }}
                          >
                            {r.type === 'OUTBOUND' ? 'OUT' : 'IN'}
                          </span>
                        </div>
                        <div className="relative h-1 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full"
                            style={{ width: `${(r.cierresReales / Math.max(maxCierres, 1)) * 100}%`, background: rankGreen[i] }}
                          />
                        </div>
                        <p className="mt-1 font-mono font-semibold" style={{ fontSize: 14, fontWeight: 600, color: GREEN }}>
                          {fmtCop(r.cierresReales * avgTicket)}
                        </p>
                      </div>
                      <span className="font-mono font-bold shrink-0" style={{ fontSize: 15, color: rankGreen[i] }}>
                        {r.cierresReales}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: '0.5px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: 12, color: '#aaa' }}>Total: {allTotals.cierresReales} cierres</span>
                  <span className="font-mono font-bold" style={{ fontSize: 18, fontWeight: 700, color: GREEN }}>{fmtCop(ingresoReal)}</span>
                </div>
              </>
            )}
          </div>

          {/* Panel 3 — Sin resultados (full width) */}
          <div className="col-span-2 rounded-lg p-3" style={{ background: '#111118', border: '0.5px solid rgba(226,75,74,0.2)', borderRadius: 8 }}>
            <p className="uppercase font-semibold mb-3" style={{ fontSize: 10, color: RED, letterSpacing: '0.1em' }}>
              Actividades sin resultados
            </p>
            {sinResultados.length === 0 ? (
              <p style={{ fontSize: 11, color: '#333' }}>
                {allRows.some((r) => r.meetingsExpected > 0)
                  ? '✓ Todas las actividades tienen resultados este período'
                  : 'Sin actividades con reuniones esperadas configuradas'}
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mb-3">
                  {sinResultados.map((r) => (
                    <div key={r.id} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: RED }} />
                      <span className="text-zinc-400 truncate flex-1" style={{ fontSize: 11 }}>{r.name}</span>
                      <span className="font-mono shrink-0" style={{ fontSize: 10, color: '#555' }}>
                        0 / {r.meetingsExpected} esp.
                      </span>
                    </div>
                  ))}
                </div>
                {mayorBrecha && (
                  <div
                    className="flex items-center gap-2 rounded px-3 py-2"
                    style={{ background: 'rgba(226,75,74,0.07)', border: '0.5px solid rgba(226,75,74,0.2)' }}
                  >
                    <span style={{ fontSize: 13, color: RED }}>⚠</span>
                    <p style={{ fontSize: 11, color: '#d4a0a0' }}>
                      Mayor brecha:{' '}
                      <strong style={{ color: '#e4b4b4' }}>{mayorBrecha.name}</strong>
                      {' '}— {mayorBrecha.meetingsExpected} reuniones esperadas sin resultado
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

        </div>
      </div>

      {/* ── SECCIÓN 5: Gráficas ───────────────────────────────────────────── */}
      <div>
        <SectionLabel text="Gráficas" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">

          <ChartCard
            title="Reuniones esperadas vs reales"
            typeOptions={[
              { value: 'bar'   as const, label: 'Barras'        },
              { value: 'barh'  as const, label: 'Barras horiz.' },
              { value: 'radar' as const, label: 'Telaraña'      },
              { value: 'line'  as const, label: 'Tendencia'     },
            ]}
            chartType={c1Type}
            onTypeChange={setC1Type}
          >
            {renderC1()}
          </ChartCard>

          <ChartCard
            title="Meta vs proyectado vs real ($)"
            typeOptions={[
              { value: 'bar'   as const, label: 'Barras'   },
              { value: 'donut' as const, label: 'Dona'     },
              { value: 'radar' as const, label: 'Telaraña' },
              { value: 'polar' as const, label: 'Polar'    },
            ]}
            chartType={c2Type}
            onTypeChange={setC2Type}
          >
            {renderC2()}
          </ChartCard>

          <ChartCard
            title="Eficiencia por canal"
            typeOptions={[
              { value: 'bar'   as const, label: 'Barras'   },
              { value: 'radar' as const, label: 'Telaraña' },
              { value: 'line'  as const, label: 'Tendencia'},
              { value: 'polar' as const, label: 'Polar'    },
            ]}
            chartType={c3Type}
            onTypeChange={setC3Type}
          >
            {renderC3()}
          </ChartCard>

          <ChartCard
            title="Semáforo general"
            typeOptions={[
              { value: 'radar' as const, label: 'Telaraña' },
              { value: 'bar'   as const, label: 'Barras'   },
              { value: 'donut' as const, label: 'Dona'     },
              { value: 'polar' as const, label: 'Polar'    },
            ]}
            chartType={c4Type}
            onTypeChange={setC4Type}
          >
            {renderC4()}
          </ChartCard>

        </div>
      </div>

    </div>
  )
}
