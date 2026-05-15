'use client'

import { useState, useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { format, parseISO, startOfWeek, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import type { PipelineSimple } from '@/lib/types/database'

type ActiveScenario = {
  funnel_stages: string[]
  outbound_rates: number[]
  inbound_rates: number[]
  working_days_per_month: number
} | null

interface Props {
  entries: PipelineSimple[]
  period: string
  activeScenario: ActiveScenario
}

type TabType = 'embudo' | 'conversion' | 'tendencia'

// ── Helpers ────────────────────────────────────────────────────────────────────

function groupByBucket(entries: PipelineSimple[], period: string): Record<string, PipelineSimple[]> {
  const buckets: Record<string, PipelineSimple[]> = {}
  for (const e of entries) {
    let key: string
    if (period === 'daily') {
      key = e.entry_date
    } else if (period === 'weekly' || period === 'monthly') {
      const d = parseISO(e.entry_date)
      if (period === 'weekly') {
        key = format(d, 'd MMM', { locale: es })
      } else {
        const wStart = startOfWeek(d, { weekStartsOn: 1 })
        key = format(wStart, 'd MMM', { locale: es })
      }
    } else {
      const d = parseISO(e.entry_date)
      const mStart = startOfMonth(d)
      key = format(mStart, 'MMM yy', { locale: es })
    }
    if (!buckets[key]) buckets[key] = []
    buckets[key].push(e)
  }
  return buckets
}

const TAB_LABELS: { value: TabType; label: string }[] = [
  { value: 'embudo',     label: 'Embudo'     },
  { value: 'conversion', label: 'Conversión' },
  { value: 'tendencia',  label: 'Tendencia'  },
]

// ── Sub-components ─────────────────────────────────────────────────────────────

function FunnelChart({ entries }: { entries: PipelineSimple[] }) {
  const counts = [
    entries.filter(e => e.stage === 'Cita agendada').length,
    entries.filter(e => e.stage === 'Reagendar').length,
    entries.filter(e => e.stage === 'Primera reu ejecutada/Propuesta en preparación').length,
    entries.filter(e => e.stage === 'Propuesta Presentada').length,
    entries.filter(e => e.stage === 'Por facturar/cobrar').length,
  ]
  const maxCount = Math.max(...counts, 1)

  const bars = [
    { label: 'Cita agenda.', count: counts[0], color: 'bg-blue-500/70',    text: 'text-blue-400'    },
    { label: 'Reagendar',    count: counts[1], color: 'bg-rose-500/70',    text: 'text-rose-400'    },
    { label: 'Reuniones',    count: counts[2], color: 'bg-cyan-500/70',    text: 'text-cyan-400'    },
    { label: 'Propuestas',   count: counts[3], color: 'bg-amber-500/70',   text: 'text-amber-400'   },
    { label: 'Cierres',      count: counts[4], color: 'bg-emerald-500/70', text: 'text-emerald-400' },
  ]

  const total = counts.reduce((s, c) => s + c, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-2 py-4">
        {bars.map((b, i) => {
          const pct = b.count === maxCount ? 100 : Math.round(b.count / maxCount * 100)
          const nextCount = i < bars.length - 1 ? counts[i + 1] : null
          const convVal = b.count > 0 && nextCount !== null ? Math.round(nextCount / b.count * 100) : null
          const convColor = convVal !== null ? (convVal >= 50 ? 'text-emerald-400' : convVal >= 25 ? 'text-amber-400' : 'text-red-400') : ''
          return (
            <div key={b.label} className="w-full max-w-md">
              <div className="flex justify-between mb-1 px-1">
                <span className={`text-xs font-bold tracking-widest uppercase ${b.text}`}>{b.label}</span>
                <span className={`text-sm font-bold tabular-nums ${b.text}`}>{b.count}</span>
              </div>
              <div className="flex justify-center">
                <div className={`h-6 rounded ${b.color} transition-all`} style={{ width: `${pct}%` }} />
              </div>
              {convVal !== null && (
                <div className="flex justify-center mt-0.5">
                  <span className={`text-xs font-semibold ${convColor}`}>↓ {convVal}% conv.</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {total === 0 && (
        <p className="text-center text-xs text-muted-foreground py-8">Sin datos para el período seleccionado</p>
      )}
    </div>
  )
}

function ConversionChart({ entries, activeScenario }: { entries: PipelineSimple[]; activeScenario: ActiveScenario }) {
  const countR = entries.filter(e => e.stage === 'Primera reu ejecutada/Propuesta en preparación').length
  const countP = entries.filter(e => e.stage === 'Propuesta Presentada').length
  const countC = entries.filter(e => e.stage === 'Por facturar/cobrar').length
  // Note: Cita agendada and Reagendar use same rates as reunion for scenario projection

  let metaR = 0, metaP = 0, metaC = 0
  if (activeScenario) {
    const { outbound_rates, inbound_rates } = activeScenario
    const r1 = outbound_rates[1] ?? 0
    const r2 = outbound_rates[2] ?? 0
    const i1 = inbound_rates[1] ?? r1
    const i2 = inbound_rates[2] ?? r2
    metaR = countR
    metaP = Math.round(countR * ((r1 + i1) / 2 / 100))
    metaC = Math.round(metaP * ((r2 + i2) / 2 / 100))
  }

  const data = [
    { etapa: '1ra Reunión', real: countR, ...(activeScenario ? { meta: metaR } : {}) },
    { etapa: 'Propuestas',  real: countP, ...(activeScenario ? { meta: metaP } : {}) },
    { etapa: 'Cierres',     real: countC, ...(activeScenario ? { meta: metaC } : {}) },
  ]

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="etapa" tick={{ fontSize: 10, fill: '#6b7280' }} />
        <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: '#0a0a0a', border: '1px solid #1f2937', borderRadius: 6, fontSize: 11 }}
          labelStyle={{ color: '#e5e7eb' }}
        />
        {activeScenario && <Legend wrapperStyle={{ fontSize: 10 }} />}
        <Bar dataKey="real" name="Real" fill="#00D9FF" fillOpacity={0.8} radius={[3,3,0,0]} />
        {activeScenario && <Bar dataKey="meta" name="Meta" fill="#374151" radius={[3,3,0,0]} />}
      </BarChart>
    </ResponsiveContainer>
  )
}

function TrendChart({ entries, period }: { entries: PipelineSimple[]; period: string }) {
  const buckets = useMemo(() => groupByBucket(entries, period), [entries, period])
  const keys = Object.keys(buckets).sort()

  const data = keys.map(k => {
    const group = buckets[k]!
    return {
      fecha:      k,
      Citas:      group.filter(e => e.stage === 'Cita agendada').length,
      Reagendar:  group.filter(e => e.stage === 'Reagendar').length,
      Reuniones:  group.filter(e => e.stage === 'Primera reu ejecutada/Propuesta en preparación').length,
      Propuestas: group.filter(e => e.stage === 'Propuesta Presentada').length,
      Cierres:    group.filter(e => e.stage === 'Por facturar/cobrar').length,
    }
  })

  if (data.length === 0) {
    return <p className="text-center text-xs text-muted-foreground py-12">Sin datos para el período seleccionado</p>
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#6b7280' }} />
        <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: '#0a0a0a', border: '1px solid #1f2937', borderRadius: 6, fontSize: 11 }}
          labelStyle={{ color: '#e5e7eb' }}
        />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        <Line type="monotone" dataKey="Citas"      stroke="#60a5fa" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
        <Line type="monotone" dataKey="Reagendar"  stroke="#fb7185" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
        <Line type="monotone" dataKey="Reuniones"  stroke="#22d3ee" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Propuestas" stroke="#f59e0b" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Cierres"    stroke="#34d399" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function PipelineSimpleCharts({ entries, period, activeScenario }: Props) {
  const [tab, setTab] = useState<TabType>('embudo')

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Análisis Visual</h3>
        <div className="flex rounded-md border border-border overflow-hidden">
          {TAB_LABELS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`px-3 py-1 text-[10px] font-semibold transition-colors border-r border-border last:border-r-0 ${
                tab === value ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'embudo'     && <FunnelChart entries={entries} />}
      {tab === 'conversion' && <ConversionChart entries={entries} activeScenario={activeScenario} />}
      {tab === 'tendencia'  && <TrendChart entries={entries} period={period} />}
    </div>
  )
}
