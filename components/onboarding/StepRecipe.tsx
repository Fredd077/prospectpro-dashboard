'use client'

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'

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
  }) => void
  saving: boolean
}

function fmt(n: number) {
  return n.toLocaleString('es-CO', { maximumFractionDigits: 0 })
}

function calcActivities(
  revenueGoal: number,
  ticket: number,
  outboundPct: number,
  rates: number[]
) {
  if (!revenueGoal || !ticket || rates.some((r) => r <= 0)) return null
  const closes = revenueGoal / ticket
  const [r1, r2, r3, r4] = rates.map((r) => r / 100)
  const activities = closes / (r4 * r3 * r2 * r1)
  return Math.ceil(activities)
}

export function StepRecipe({ onSave, saving }: StepRecipeProps) {
  const [name, setName] = useState('Mi recetario')
  const [revenue, setRevenue] = useState(50000000)
  const [ticket, setTicket] = useState(5000000)
  const [outbound, setOutbound] = useState(70)
  const [r1, setR1] = useState(20) // activity → speech
  const [r2, setR2] = useState(50) // speech → meeting
  const [r3, setR3] = useState(60) // meeting → proposal
  const [r4, setR4] = useState(40) // proposal → close

  const activitiesMonthly = calcActivities(revenue, ticket, outbound, [r1, r2, r3, r4])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({
      name,
      monthly_revenue_goal: revenue,
      average_ticket: ticket,
      outbound_pct: outbound,
      conv_activity_to_speech: r1,
      conv_speech_to_meeting: r2,
      conv_meeting_to_proposal: r3,
      conv_proposal_to_close: r4,
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
              % Outbound
            </label>
            <span className="text-xs font-data text-primary">{outbound}% Outbound · {100 - outbound}% Inbound</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={outbound}
            onChange={(e) => setOutbound(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        {/* Conversion rates */}
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Tasas de conversión (%)
          </label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Actividad → Presentación', value: r1, set: setR1 },
              { label: 'Presentación → Reunión',   value: r2, set: setR2 },
              { label: 'Reunión → Propuesta',       value: r3, set: setR3 },
              { label: 'Propuesta → Cierre',        value: r4, set: setR4 },
            ].map(({ label, value, set }) => (
              <div key={label} className="space-y-1">
                <label className="text-[10px] text-muted-foreground/70">{label}</label>
                <div className="relative">
                  <input
                    type="number"
                    value={value}
                    min={1}
                    max={100}
                    onChange={(e) => set(Number(e.target.value))}
                    className={`${inputClass} pr-6`}
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Preview */}
        {activitiesMonthly !== null && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Actividades mensuales necesarias</span>
            <span className="text-2xl font-bold font-data text-primary">{fmt(activitiesMonthly)}</span>
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
