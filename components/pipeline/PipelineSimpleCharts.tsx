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
  const countR = entries.filter(e => e.stage === 'Reunión').length
  const countP = entries.filter(e => e.stage === 'Propuesta').length
  const countC = entries.filter(e => e.stage === 'Cierre').length
  const maxCount = Math.max(countR, countP, countC, 1)

  const bars = [
    { label: 'Reuniones',  count: countR, pct: countR === maxCount ? 100 : Math.round(countR / maxCount * 100), color: 'bg-cyan-500/70',    text: 'text-cyan-400'    },
    { label: 'Propuestas', count: countP, pct: countP === maxCount ? 100 : Math.round(countP / maxCount * 100), color: 'bg-amber-500/70',   text: 'text-amber-400'   },
    { label: 'Cierres',    count: countC, pct: countC === maxCount ? 100 : Math.round(countC / maxCount * 100), color: 'bg-emerald-500/70', text: 'text-emerald-400' },
  ]

  const convRP = countR > 0 ? Math.round(countP / countR * 100) : 0
  const convPC = countP > 0 ? Math.round(countC / countP * 100) : 0

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3 py-4">
        {bars.map((b, i) => (
          <div key={b.label} className="w-full max-w-md">
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1 px-1">
              <span className={b.text + ' font-semibold uppercase tracking-wider'}>{b.label}</span>
              <span className="tabular-nums">{b.count}</span>
            </div>
            <div className="flex justify-center">
              <div
                className={`h-8 rounded ${b.color} transition-all`}
                style={{ width: `${b.pct}%` }}
              />
            </div>
            {i < bars.length - 1 && (
              <div className="flex justify-center mt-1">
                <span className="text-[9px] text-muted-foreground/60">
                  ↓ {i === 0 ? convRP : convPC}% conversión
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
      {countR === 0 && countP === 0 && countC === 0 && (
        <p className="text-center text-xs text-muted-foreground py-8">Sin datos para el período seleccionado</p>
      )}
    </div>
  )
}

function ConversionChart({ entries, activeScenario }: { entries: PipelineSimple[]; activeScenario: ActiveScenario }) {
  const countR = entries.filter(e => e.stage === 'Reunión').length
  const countP = entries.filter(e => e.stage === 'Propuesta').length
  const countC = entries.filter(e => e.stage === 'Cierre').length

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
    { etapa: 'Reuniones',  real: countR, ...(activeScenario ? { meta: metaR } : {}) },
    { etapa: 'Propuestas', real: countP, ...(activeScenario ? { meta: metaP } : {}) },
    { etapa: 'Cierres',    real: countC, ...(activeScenario ? { meta: metaC } : {}) },
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
      Reuniones:  group.filter(e => e.stage === 'Reunión').length,
      Propuestas: group.filter(e => e.stage === 'Propuesta').length,
      Cierres:    group.filter(e => e.stage === 'Cierre').length,
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
