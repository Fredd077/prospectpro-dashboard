'use client'

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { calcRecipe } from '@/lib/calculations/recipe'

interface StepRecipeProps {
  onSave: (data: {
    name: string
    monthly_revenue_goal: number
    average_ticket: number
    outbound_pct: number
    conv_activity_to_speech: number
    conv_speech_to_meeting: number
    conv_meeting_to_proposal: number
    conv_proposal_to_close: number
    inbound_conv_activity_to_speech: number
    inbound_conv_speech_to_meeting: number
    inbound_conv_meeting_to_proposal: number
    inbound_conv_proposal_to_close: number
  }) => void
  saving: boolean
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
      <label className="text-[10px] text-muted-foreground/70">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          min={1}
          max={100}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`${inputClass} pr-6`}
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
      </div>
    </div>
  )
}

const RATE_LABELS = [
  'Actividad → Discurso/Presentación',
  'Discurso → Reunión inicial',
  'Reunión → Propuesta',
  'Propuesta → Cierre',
]

export function StepRecipe({ onSave, saving }: StepRecipeProps) {
  const [name, setName]       = useState('Mi recetario')
  const [revenue, setRevenue] = useState(50000000)
  const [ticket, setTicket]   = useState(5000000)
  const [outbound, setOutbound] = useState(70)

  // Outbound defaults
  const [o1, setO1] = useState(80)
  const [o2, setO2] = useState(10)
  const [o3, setO3] = useState(50)
  const [o4, setO4] = useState(30)

  // Inbound defaults
  const [i1, setI1] = useState(100)
  const [i2, setI2] = useState(100)
  const [i3, setI3] = useState(50)
  const [i4, setI4] = useState(30)

  const inboundPct = 100 - outbound
  const outboundGoal = revenue * (outbound / 100)
  const inboundGoal  = revenue * (inboundPct / 100)

  const result = revenue && ticket
    ? calcRecipe({
        monthly_revenue_goal: revenue,
        average_ticket: ticket,
        outbound_pct: outbound,
        working_days_per_month: 20,
        conv_activity_to_speech: o1,
        conv_speech_to_meeting: o2,
        conv_meeting_to_proposal: o3,
        conv_proposal_to_close: o4,
        inbound_conv_activity_to_speech: i1,
        inbound_conv_speech_to_meeting: i2,
        inbound_conv_meeting_to_proposal: i3,
        inbound_conv_proposal_to_close: i4,
      })
    : null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({
      name,
      monthly_revenue_goal: revenue,
      average_ticket: ticket,
      outbound_pct: outbound,
      conv_activity_to_speech: o1,
      conv_speech_to_meeting: o2,
      conv_meeting_to_proposal: o3,
      conv_proposal_to_close: o4,
      inbound_conv_activity_to_speech: i1,
      inbound_conv_speech_to_meeting: i2,
      inbound_conv_meeting_to_proposal: i3,
      inbound_conv_proposal_to_close: i4,
    })
  }

  const inputClass =
    'w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors font-data'

  return (
    <div className="rounded-xl border border-border bg-card p-8 space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-foreground">Tu Recetario</h2>
        <p className="text-sm text-muted-foreground">
          Define cuántas actividades necesitas para alcanzar tu meta de ventas.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Nombre del escenario
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={inputClass}
          />
        </div>

        {/* Revenue + ticket */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Meta mensual ($)
            </label>
            <input
              type="number"
              value={revenue}
              min={0}
              onChange={(e) => setRevenue(Number(e.target.value))}
              required
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Ticket promedio ($)
            </label>
            <input
              type="number"
              value={ticket}
              min={1}
              onChange={(e) => setTicket(Number(e.target.value))}
              required
              className={inputClass}
            />
          </div>
        </div>

        {/* Outbound % slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              % Outbound / Inbound
            </label>
            <span className="text-xs font-data text-primary">{outbound}% · {inboundPct}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={outbound}
            onChange={(e) => setOutbound(Number(e.target.value))}
            className="w-full accent-primary"
          />
          {/* Split revenue preview */}
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

        {/* Outbound conversion rates */}
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wider text-primary/80">
            Tasas Outbound
          </label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: RATE_LABELS[0], value: o1, set: setO1 },
              { label: RATE_LABELS[1], value: o2, set: setO2 },
              { label: RATE_LABELS[2], value: o3, set: setO3 },
              { label: RATE_LABELS[3], value: o4, set: setO4 },
            ].map(({ label, value, set }) => (
              <RateField key={`o-${label}`} label={label} value={value} onChange={set} inputClass={inputClass} />
            ))}
          </div>
        </div>

        {/* Inbound conversion rates */}
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wider text-success/80">
            Tasas Inbound
          </label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: RATE_LABELS[0], value: i1, set: setI1 },
              { label: RATE_LABELS[1], value: i2, set: setI2 },
              { label: RATE_LABELS[2], value: i3, set: setI3 },
              { label: RATE_LABELS[3], value: i4, set: setI4 },
            ].map(({ label, value, set }) => (
              <RateField key={`i-${label}`} label={label} value={value} onChange={set} inputClass={inputClass} />
            ))}
          </div>
        </div>

        {/* Split activity summary */}
        {result && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Actividades necesarias
            </p>
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
                <span className="text-xl font-bold font-data text-primary">
                  {fmt(result.activities_needed_monthly)} act/mes
                </span>
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
    </div>
  )
}
