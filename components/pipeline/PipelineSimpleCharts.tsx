'use client'

import { useState, useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { format, parseISO, startOfWeek, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import type { PipelineSimple } from '@/lib/types/database'
import type { PipelineStageRole } from '@/lib/utils/pipeline-stages'

type ActiveScenario = {
  funnel_stages: string[]
  outbound_rates: number[]
  inbound_rates: number[]
  working_days_per_month: number
} | null

type StageNameByRole = Partial<Record<PipelineStageRole, string>>

interface Props {
  entries: PipelineSimple[]
  period: string
  activeScenario: ActiveScenario
  /** Nombre de etapa que tiene cada rol HOY (ver buildStageNameByRole en
   * PipelineSimpleBoard) — identifica "cita"/"reunión"/etc. sin depender del
   * nombre exacto, para que un rename no rompa estos gráficos en silencio. */
  stageNameByRole: StageNameByRole
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

function FunnelChart({ entries, stageNameByRole }: { entries: PipelineSimple[]; stageNameByRole: StageNameByRole }) {
  // Reagendar NO es un paso del embudo (rompe la conversión): se reporta aparte, informativo.
  const reagendar = entries.filter(e => e.stage === stageNameByRole.reagendar).length

  // Cadena real del embudo: Cita agendada → 1ra Reunión → Propuesta → Cierre.
  // Por rol, no por nombre: si el usuario no le ha asignado un rol a ninguna
  // etapa todavía, esa barra cuenta 0 (igual que ya pasaba con cualquier etapa
  // personalizada sin match) — no hace falta un placeholder especial porque
  // son conteos reales, no porcentajes que puedan confundirse con "0% de conversión".
  const bars = [
    { label: 'Cita agenda.', count: entries.filter(e => e.stage === stageNameByRole.cita).length,      color: 'bg-blue-500/70',    text: 'text-blue-400'    },
    { label: 'Reuniones',    count: entries.filter(e => e.stage === stageNameByRole.reunion).length,   color: 'bg-cyan-500/70',    text: 'text-cyan-400'    },
    { label: 'Propuestas',   count: entries.filter(e => e.stage === stageNameByRole.propuesta).length, color: 'bg-amber-500/70',   text: 'text-amber-400'   },
    { label: 'Cierres',      count: entries.filter(e => e.stage === stageNameByRole.cierre).length,    color: 'bg-emerald-500/70', text: 'text-emerald-400' },
  ]
  const maxCount = Math.max(...bars.map(b => b.count), 1)
  // "Sin datos" se basa en las entradas reales del período, no en la suma de
  // barras: si el usuario tiene negocios pero ninguna etapa con rol asignado
  // todavía, es más honesto que las barras se vean en 0 a que el mensaje diga
  // "sin datos" cuando sí los hay (solo que sin clasificar por rol).
  const total = entries.length

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-2 py-4">
        {bars.map((b, i) => {
          const pct = b.count === maxCount ? 100 : Math.round(b.count / maxCount * 100)
          const nextCount = i < bars.length - 1 ? bars[i + 1].count : null
          // Conversión a la siguiente etapa (acotada a 100%). La primera es CITA → 1RA REUNIÓN.
          const convVal = b.count > 0 && nextCount !== null ? Math.min(100, Math.round(nextCount / b.count * 100)) : null
          const convColor = convVal !== null ? (convVal >= 50 ? 'text-emerald-400' : convVal >= 25 ? 'text-amber-400' : 'text-red-400') : ''
          const convLabel = i === 0 ? 'a 1ra reunión' : 'conv.'
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
                  <span className={`text-xs font-semibold ${convColor}`}>↓ {convVal}% {convLabel}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Reagendar — fuera del embudo, solo informativo */}
      <div className="flex items-center justify-center gap-2 border-t border-border pt-3">
        <span className="h-2 w-2 rounded-full bg-rose-400/70" />
        <span className="text-xs text-muted-foreground">
          Reagendar: <span className="font-bold tabular-nums text-rose-400">{reagendar}</span>{' '}
          {reagendar === 1 ? 'cita reprogramada' : 'citas reprogramadas'} — informativo, fuera del embudo
        </span>
      </div>

      {total === 0 && (
        <p className="text-center text-xs text-muted-foreground py-8">Sin datos para el período seleccionado</p>
      )}
    </div>
  )
}

function ConversionChart({ entries, activeScenario, stageNameByRole }: { entries: PipelineSimple[]; activeScenario: ActiveScenario; stageNameByRole: StageNameByRole }) {
  const countR = entries.filter(e => e.stage === stageNameByRole.reunion).length
  const countP = entries.filter(e => e.stage === stageNameByRole.propuesta).length
  const countC = entries.filter(e => e.stage === stageNameByRole.cierre).length
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

function TrendChart({ entries, period, stageNameByRole }: { entries: PipelineSimple[]; period: string; stageNameByRole: StageNameByRole }) {
  const buckets = useMemo(() => groupByBucket(entries, period), [entries, period])
  const keys = Object.keys(buckets).sort()

  const data = keys.map(k => {
    const group = buckets[k]!
    return {
      fecha:      k,
      Citas:      group.filter(e => e.stage === stageNameByRole.cita).length,
      Reagendar:  group.filter(e => e.stage === stageNameByRole.reagendar).length,
      Reuniones:  group.filter(e => e.stage === stageNameByRole.reunion).length,
      Propuestas: group.filter(e => e.stage === stageNameByRole.propuesta).length,
      Cierres:    group.filter(e => e.stage === stageNameByRole.cierre).length,
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

export function PipelineSimpleCharts({ entries, period, activeScenario, stageNameByRole }: Props) {
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
              className={`px-3 py-1 text-xs font-semibold transition-colors border-r border-border last:border-r-0 ${
                tab === value ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'embudo'     && <FunnelChart entries={entries} stageNameByRole={stageNameByRole} />}
      {tab === 'conversion' && <ConversionChart entries={entries} activeScenario={activeScenario} stageNameByRole={stageNameByRole} />}
      {tab === 'tendencia'  && <TrendChart entries={entries} period={period} stageNameByRole={stageNameByRole} />}
    </div>
  )
}
