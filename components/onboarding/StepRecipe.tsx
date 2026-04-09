'use client'

import { useState } from 'react'
import { ArrowRight, Sparkles, SlidersHorizontal } from 'lucide-react'
import { FunnelStageEditor } from '@/components/recipe/FunnelStageEditor'
import { AIRecipeBuilder } from '@/components/recipe/AIRecipeBuilder'
import {
  calcRecipe,
  adjustRates,
  DEFAULT_FUNNEL_STAGES,
  DEFAULT_OUTBOUND_RATES,
  DEFAULT_INBOUND_RATES,
} from '@/lib/calculations/recipe'

interface StepRecipeProps {
  onSave: (data: {
    name: string
    monthly_revenue_goal: number
    average_ticket: number
    outbound_pct: number
    funnel_stages: string[]
    outbound_rates: number[]
    inbound_rates: number[]
  }) => void
  saving: boolean
  onNext?: () => void
}

function fmt(n: number) {
  return n.toLocaleString('es-CO', { maximumFractionDigits: 0 })
}
function fmtCurrency(n: number) {
  return '$' + n.toLocaleString('es-CO', { maximumFractionDigits: 0 })
}

function RateField({
  label,
  value,
  onChange,
  inputClass,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  inputClass: string
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] text-muted-foreground/70 truncate block">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          min={1}
          max={100}
          onChange={(e) => onChange(Math.max(1, Math.min(100, Number(e.target.value))))}
          className={`${inputClass} pr-6`}
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
      </div>
    </div>
  )
}

export function StepRecipe({ onSave, saving, onNext }: StepRecipeProps) {
  const [mode, setMode] = useState<'ai' | 'manual'>('ai')
  const [name, setName]         = useState('Mi recetario')
  const [revenue, setRevenue]   = useState(50000000)
  const [ticket, setTicket]     = useState(5000000)
  const [outbound, setOutbound] = useState(70)

  const [funnelStages, setFunnelStages]   = useState<string[]>(DEFAULT_FUNNEL_STAGES)
  const [outboundRates, setOutboundRates] = useState<number[]>(DEFAULT_OUTBOUND_RATES)
  const [inboundRates, setInboundRates]   = useState<number[]>(DEFAULT_INBOUND_RATES)

  function handleStagesChange(newStages: string[]) {
    const newTransitions = newStages.length - 1
    setFunnelStages(newStages)
    setOutboundRates(adjustRates(outboundRates, newTransitions))
    setInboundRates(adjustRates(inboundRates, newTransitions))
  }

  function setOutboundRate(i: number, v: number) {
    setOutboundRates((prev) => prev.map((r, idx) => (idx === i ? v : r)))
  }
  function setInboundRate(i: number, v: number) {
    setInboundRates((prev) => prev.map((r, idx) => (idx === i ? v : r)))
  }

  const inboundPct    = 100 - outbound
  const outboundGoal  = revenue * (outbound / 100)
  const inboundGoal   = revenue * (inboundPct / 100)

  const result = revenue && ticket
    ? calcRecipe({
        monthly_revenue_goal:   revenue,
        average_ticket:         ticket,
        outbound_pct:           outbound,
        working_days_per_month: 20,
        funnel_stages:  funnelStages,
        outbound_rates: outboundRates,
        inbound_rates:  inboundRates,
      })
    : null

  // Transition labels
  const transitions = funnelStages.slice(0, -1).map((stage, i) => ({
    label: `${stage} → ${funnelStages[i + 1]}`,
    index: i,
  }))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({
      name,
      monthly_revenue_goal: revenue,
      average_ticket: ticket,
      outbound_pct: outbound,
      funnel_stages: funnelStages,
      outbound_rates: outboundRates,
      inbound_rates: inboundRates,
    })
  }

  const inputClass =
    'w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors font-data'

  return (
    <div className="rounded-xl border border-border bg-card p-8 space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-foreground">Tu Recetario</h2>
        <p className="text-sm text-muted-foreground">
          Define tu proceso de ventas y cuántas actividades necesitas para alcanzar tu meta.
        </p>
      </div>

      {/* IA / Manual toggle */}
      <div className="flex items-center gap-2 p-1 rounded-lg bg-muted/40 border border-border w-fit">
        <button
          type="button"
          onClick={() => setMode('ai')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            mode === 'ai'
              ? 'bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/30'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Crear con IA
        </button>
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            mode === 'manual'
              ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Manual
        </button>
      </div>

      {mode === 'ai' ? (
        <AIRecipeBuilder onSaved={onNext} />
      ) : (
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Nombre del escenario
          </label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
        </div>

        {/* Revenue + ticket */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Meta mensual ($)</label>
            <input type="number" value={revenue} min={0} onChange={(e) => setRevenue(Number(e.target.value))} required className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Ticket promedio ($)</label>
            <input type="number" value={ticket} min={1} onChange={(e) => setTicket(Number(e.target.value))} required className={inputClass} />
          </div>
        </div>

        {/* Funnel stage editor */}
        <div className="space-y-2">
          <FunnelStageEditor stages={funnelStages} onChange={handleStagesChange} />
        </div>

        {/* Outbound % slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">% Outbound / Inbound</label>
            <span className="text-xs font-data text-primary">{outbound}% · {inboundPct}%</span>
          </div>
          <input
            type="range" min={0} max={100} value={outbound}
            onChange={(e) => setOutbound(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md border border-border bg-muted/20 px-3 py-1.5">
              <span className="text-muted-foreground">Meta Outbound </span>
              <span className="font-data font-semibold text-foreground">{fmtCurrency(outboundGoal)}</span>
            </div>
            <div className="rounded-md border border-border bg-muted/20 px-3 py-1.5">
              <span className="text-muted-foreground">Meta Inbound </span>
              <span className="font-data font-semibold text-foreground">{fmtCurrency(inboundGoal)}</span>
            </div>
          </div>
        </div>

        {/* Conversion rates — two columns, dynamic */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-primary/80">Tasas Outbound</label>
            <div className="space-y-2">
              {transitions.map(({ label, index }) => (
                <RateField key={`o-${index}`} label={label} value={outboundRates[index] ?? 50} onChange={(v) => setOutboundRate(index, v)} inputClass={inputClass} />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-success/80">Tasas Inbound</label>
            <div className="space-y-2">
              {transitions.map(({ label, index }) => (
                <RateField key={`i-${index}`} label={label} value={inboundRates[index] ?? 50} onChange={(v) => setInboundRate(index, v)} inputClass={inputClass} />
              ))}
            </div>
          </div>
        </div>

        {/* Activity summary */}
        {result && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Actividades necesarias</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-primary/80 font-medium">Outbound</span>
                <span className="font-data text-foreground">
                  {fmt(result.outbound.activities_monthly)}/mes · {fmt(result.outbound.activities_weekly)}/sem · {fmt(result.outbound.activities_daily)}/día
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-success/80 font-medium">Inbound</span>
                <span className="font-data text-foreground">
                  {fmt(result.inbound.activities_monthly)}/mes · {fmt(result.inbound.activities_weekly)}/sem · {fmt(result.inbound.activities_daily)}/día
                </span>
              </div>
              <div className="border-t border-border/50 pt-2 flex items-center justify-between">
                <span className="font-semibold text-foreground">Total</span>
                <span className="text-xl font-bold font-data text-primary">{fmt(result.activities_needed_monthly)} act/mes</span>
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 hover:shadow-[0_0_20px_rgba(0,217,255,0.25)] transition-all disabled:opacity-50"
        >
          {saving ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          {saving ? 'Guardando...' : 'Guardar y continuar →'}
        </button>
      </form>
      )}
    </div>
  )
}
