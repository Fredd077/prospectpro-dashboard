'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { FunnelStageEditor } from './FunnelStageEditor'
import { RecipeInputs, RECIPE_DEFAULTS } from './RecipeInputs'
import { RecipeOutputs } from './RecipeOutputs'
import { SupervisionPanel } from './SupervisionPanel'
import type { ActivityForSupervision } from './SupervisionPanel'
import { calcRecipe, adjustRates, DEFAULT_FUNNEL_STAGES, DEFAULT_OUTBOUND_RATES, DEFAULT_INBOUND_RATES } from '@/lib/calculations/recipe'
import {
  calcCierresRequeridos,
  calcCitasRequeridas,
  calcIngresoProy,
  calcDesviacion,
} from '@/lib/calculations/recipe-supervision'
import { createScenario } from '@/lib/queries/recipe'
import { updateScenarioAction } from '@/lib/actions/recipe'
import type { RecipeInputs as RecipeInputsType } from '@/lib/calculations/recipe'
import type { RecipeScenario } from '@/lib/types/database'

interface RecipeCalculatorProps {
  scenario?: RecipeScenario
  readOnly?: boolean
  activities?: ActivityForSupervision[]
}

export function RecipeCalculator({ scenario, readOnly = false, activities }: RecipeCalculatorProps) {
  const router = useRouter()
  const [name, setName]             = useState(scenario?.name ?? '')
  const [description, setDescription] = useState(scenario?.description ?? '')
  const [saving, setSaving]         = useState(false)

  // Funnel stage state lives here — changes trigger RecipeInputs remount via key
  const [funnelStages, setFunnelStages] = useState<string[]>(
    scenario?.funnel_stages ?? DEFAULT_FUNNEL_STAGES
  )
  const [outboundRates, setOutboundRates] = useState<number[]>(
    scenario?.outbound_rates ?? DEFAULT_OUTBOUND_RATES
  )
  const [inboundRates, setInboundRates] = useState<number[]>(
    scenario?.inbound_rates ?? DEFAULT_INBOUND_RATES
  )

  const initialInputs: RecipeInputsType = {
    monthly_revenue_goal:   scenario?.monthly_revenue_goal   ?? RECIPE_DEFAULTS.monthly_revenue_goal,
    average_ticket:         scenario?.average_ticket         ?? RECIPE_DEFAULTS.average_ticket,
    working_days_per_month: scenario?.working_days_per_month ?? RECIPE_DEFAULTS.working_days_per_month,
    outbound_pct:           scenario?.outbound_pct           ?? RECIPE_DEFAULTS.outbound_pct,
    funnel_stages:  funnelStages,
    outbound_rates: outboundRates,
    inbound_rates:  inboundRates,
  }

  const [inputs, setInputs] = useState<RecipeInputsType>(initialInputs)
  const outputs = calcRecipe({ ...inputs, funnel_stages: funnelStages, outbound_rates: outboundRates, inbound_rates: inboundRates })

  function handleStagesChange(newStages: string[]) {
    const newTransitions = newStages.length - 1
    const newOut = adjustRates(outboundRates, newTransitions)
    const newIn  = adjustRates(inboundRates,  newTransitions)
    setFunnelStages(newStages)
    setOutboundRates(newOut)
    setInboundRates(newIn)
  }

  function handleInputsChange(vals: RecipeInputsType) {
    // RecipeInputs owns the rate arrays when it's mounted — sync back
    setOutboundRates(vals.outbound_rates)
    setInboundRates(vals.inbound_rates)
    setInputs(vals)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('El nombre del escenario es obligatorio')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...inputs,
        funnel_stages:  funnelStages,
        outbound_rates: outboundRates,
        inbound_rates:  inboundRates,
        name,
        description: description || null,
      }
      if (scenario) {
        await updateScenarioAction(scenario.id, payload)
        toast.success('Escenario actualizado')
      } else {
        const created = await createScenario({ ...payload, is_active: true })
        toast.success('Escenario guardado')
        router.push(`/recipe/${created.id}`)
      }
    } catch {
      toast.error('Error al guardar el escenario')
    } finally {
      setSaving(false)
    }
  }

  // Auto rates: average conversion_rate_pct per group (feeds RecipeInputs first slider)
  const autoFirstOutRate = useMemo(() => {
    const out = (activities ?? []).filter(a => a.type === 'OUTBOUND' && (a.conversion_rate_pct ?? 0) > 0)
    return out.length > 0
      ? Math.round(out.reduce((s, a) => s + (a.conversion_rate_pct ?? 0), 0) / out.length)
      : null
  }, [activities])

  const autoFirstInRate = useMemo(() => {
    const inb = (activities ?? []).filter(a => a.type === 'INBOUND' && (a.conversion_rate_pct ?? 0) > 0)
    return inb.length > 0
      ? Math.round(inb.reduce((s, a) => s + (a.conversion_rate_pct ?? 0), 0) / inb.length)
      : null
  }, [activities])

  const showSupervision = !readOnly && activities && activities.length > 0
  const outboundPct     = inputs.outbound_pct
  const metaOut         = inputs.monthly_revenue_goal * (outboundPct / 100)
  const metaIn          = inputs.monthly_revenue_goal * (1 - outboundPct / 100)
  const outActivities   = (activities ?? []).filter((a) => a.type === 'OUTBOUND')
  const inActivities    = (activities ?? []).filter((a) => a.type === 'INBOUND')

  // ── Global totals (blended: each group uses its own last rate) ───────────
  const lastOutRate     = outboundRates[outboundRates.length - 1] ?? 30
  const lastInRate      = inboundRates[inboundRates.length  - 1] ?? 30
  const avgTicket       = inputs.average_ticket
  const totalGoal       = inputs.monthly_revenue_goal

  const cierresReqOutG  = calcCierresRequeridos(metaOut, avgTicket)
  const cierresReqInG   = calcCierresRequeridos(metaIn,  avgTicket)
  const cierresReqGlobal = cierresReqOutG + cierresReqInG

  const citasReqOutG    = calcCitasRequeridas(cierresReqOutG, lastOutRate)
  const citasReqInG     = calcCitasRequeridas(cierresReqInG,  lastInRate)
  const citasReqGlobal  = citasReqOutG + citasReqInG

  const citasProyOutG   = outActivities.reduce((s, a) => s + (a.meetings_expected ?? 0), 0)
  const citasProyInG    = inActivities.reduce( (s, a) => s + (a.meetings_expected ?? 0), 0)
  const citasProyGlobal = citasProyOutG + citasProyInG

  const ingresoProyOutG  = calcIngresoProy(citasProyOutG, lastOutRate, avgTicket)
  const ingresoProyInG   = calcIngresoProy(citasProyInG,  lastInRate,  avgTicket)
  const ingresoProyGlobal = ingresoProyOutG + ingresoProyInG

  const desviacionGlobal  = calcDesviacion(ingresoProyGlobal, totalGoal)
  const progressGlobal    = Math.min(100, (ingresoProyGlobal / Math.max(totalGoal, 1)) * 100)
  const progressColorGlobal = progressGlobal >= 95 ? 'bg-emerald-400' : progressGlobal >= 75 ? 'bg-amber-400' : 'bg-red-400'
  const devLabelGlobal    =
    desviacionGlobal.pct >= 0     ? 'Por encima de meta'
    : desviacionGlobal.pct >= -5  ? 'En rango'
    : desviacionGlobal.pct >= -25 ? 'Brecha moderada'
    : 'Brecha crítica'
  const devClsGlobal = desviacionGlobal.estado === 'ok'
    ? 'bg-emerald-400/10 text-emerald-400 border-emerald-500/20'
    : desviacionGlobal.estado === 'warn'
    ? 'bg-amber-400/10 text-amber-400 border-amber-500/20'
    : 'bg-red-400/10 text-red-400 border-red-500/20'
  const fmtUsdG = (n: number) => '$' + Math.abs(Math.round(n)).toLocaleString('es')
  const fmtG    = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 1 })

  return (
    <div className="space-y-8">
      {/* ── Top grid: inputs (left) + outputs (right) ── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Left: Inputs */}
        <div className="space-y-6">
          {!readOnly && (
            <div className="space-y-4 rounded-lg border border-border bg-card p-4">
              <div className="space-y-1.5">
                <Label htmlFor="scenario-name" className="text-xs text-muted-foreground">
                  Nombre del escenario *
                </Label>
                <Input
                  id="scenario-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Conservador, Optimista, Q1 2026…"
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="scenario-desc" className="text-xs text-muted-foreground">
                  Descripción (opcional)
                </Label>
                <Input
                  id="scenario-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Notas sobre este escenario…"
                  className="bg-background"
                />
              </div>
            </div>
          )}

          {/* Funnel Stage Editor */}
          {!readOnly && (
            <div className="rounded-lg border border-border bg-card p-4">
              <FunnelStageEditor stages={funnelStages} onChange={handleStagesChange} />
            </div>
          )}

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
              Parámetros
            </p>
            {/* key= triggers remount when stage count changes, resetting rate sliders */}
            <RecipeInputs
              key={funnelStages.join('|')}
              defaults={{ ...inputs, funnel_stages: funnelStages, outbound_rates: outboundRates, inbound_rates: inboundRates }}
              onChange={handleInputsChange}
              autoFirstOutRate={autoFirstOutRate}
              autoFirstInRate={autoFirstInRate}
            />
          </div>
        </div>

        {/* Right: Outputs */}
        <div>
          <RecipeOutputs outputs={outputs} monthlyRevenueGoal={inputs.monthly_revenue_goal} />
        </div>
      </div>

      {/* ── Supervision panels — full width, below grid ── */}
      {showSupervision && outActivities.length > 0 && (
        <div className="rounded-lg border border-[#00D9FF]/30 bg-card p-5 space-y-1">
          <div className="flex items-center gap-3 mb-6">
            <span className="h-2.5 w-2.5 rounded-full bg-[#00D9FF]" />
            <p className="text-xs font-bold text-[#00D9FF] uppercase tracking-widest">
              Supervisión de meta por actividad — Outbound
            </p>
            <span className="ml-auto text-[10px] font-semibold text-[#00D9FF]/60 font-mono">
              Meta: ${Math.round(metaOut).toLocaleString('es')}
            </span>
          </div>
          <SupervisionPanel
            activities={outActivities}
            monthlyRevenueGoal={metaOut}
            averageTicket={inputs.average_ticket}
            workingDays={inputs.working_days_per_month}
            outboundPct={inputs.outbound_pct}
            outboundRates={outboundRates}
            inboundRates={inboundRates}
            group="OUTBOUND"
          />
        </div>
      )}

      {showSupervision && inActivities.length > 0 && (
        <div className="rounded-lg border border-violet-500/30 bg-card p-5 space-y-1">
          <div className="flex items-center gap-3 mb-6">
            <span className="h-2.5 w-2.5 rounded-full bg-violet-400" />
            <p className="text-xs font-bold text-violet-400 uppercase tracking-widest">
              Supervisión de meta por actividad — Inbound
            </p>
            <span className="ml-auto text-[10px] font-semibold text-violet-400/60 font-mono">
              Meta: ${Math.round(metaIn).toLocaleString('es')}
            </span>
          </div>
          <SupervisionPanel
            activities={inActivities}
            monthlyRevenueGoal={metaIn}
            averageTicket={inputs.average_ticket}
            workingDays={inputs.working_days_per_month}
            outboundPct={inputs.outbound_pct}
            outboundRates={outboundRates}
            inboundRates={inboundRates}
            group="INBOUND"
          />
        </div>
      )}

      {/* ── Global summary panel ── */}
      {showSupervision && (outActivities.length > 0 || inActivities.length > 0) && (
        <div className="rounded-lg border border-white/10 bg-card p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full bg-white/60" />
            <p className="text-xs font-bold text-white/70 uppercase tracking-widest">
              Resumen Global — Outbound + Inbound
            </p>
            <span className="ml-auto text-[10px] font-semibold text-white/40 font-mono">
              Meta total: {fmtUsdG(totalGoal)}
            </span>
          </div>

          {/* KPI cards */}
          <div className="flex gap-3 flex-wrap">
            {/* Negocios requeridos */}
            <div className="flex-1 min-w-0 rounded-lg border border-border bg-muted/10 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Negocios requeridos</p>
              <p className="text-2xl font-mono font-bold leading-none text-white/80">{fmtG(cierresReqGlobal)}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">cierres / mes</p>
            </div>
            {/* Citas requeridas */}
            <div className="flex-1 min-w-0 rounded-lg border border-border bg-muted/10 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Citas requeridas</p>
              <p className="text-2xl font-mono font-bold leading-none text-white/80">{fmtG(citasReqGlobal)}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">para lograr ese cierre</p>
            </div>
            {/* Citas proyectadas */}
            <div className="flex-1 min-w-0 rounded-lg border border-border bg-muted/10 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Citas proyectadas</p>
              <p className={`text-2xl font-mono font-bold leading-none ${
                citasProyGlobal >= citasReqGlobal * 0.95 ? 'text-emerald-400'
                : citasProyGlobal >= citasReqGlobal * 0.75 ? 'text-amber-400'
                : 'text-red-400'
              }`}>{fmtG(citasProyGlobal)}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">según reuniones esperadas</p>
            </div>
            {/* Ingreso proyectado */}
            <div className="flex-1 min-w-0 rounded-lg border border-border bg-muted/10 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Ingreso proyectado</p>
              <p className={`text-2xl font-mono font-bold leading-none ${devClsGlobal.split(' ')[1]}`}>{fmtUsdG(ingresoProyGlobal)}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">vs meta total</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Cobertura de meta global</span>
              <span className="font-semibold">{Math.round(progressGlobal)}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-300 ${progressColorGlobal}`} style={{ width: `${progressGlobal}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground/50">
              <span>$0</span>
              <span>{fmtUsdG(totalGoal)}</span>
            </div>
          </div>

          {/* Alignment card */}
          <div className={`rounded-lg border px-4 py-3 space-y-2 ${devClsGlobal}`}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider">Alineación Total</p>
              <span className={`text-[10px] font-semibold rounded-full border px-2 py-0.5 ${devClsGlobal}`}>{devLabelGlobal}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[10px] text-current/70 mb-0.5">Citas proyectadas</p>
                <p className="font-mono font-bold text-sm">{citasProyGlobal.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-[10px] text-current/70 mb-0.5">Citas requeridas</p>
                <p className="font-mono font-bold text-sm">{citasReqGlobal.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-[10px] text-current/70 mb-0.5">
                  {citasProyGlobal < citasReqGlobal ? 'Faltan' : 'Excedente'}
                </p>
                <p className="font-mono font-bold text-sm">
                  {citasProyGlobal < citasReqGlobal
                    ? `−${(Math.round((citasReqGlobal - citasProyGlobal) * 10) / 10).toFixed(1)}`
                    : `+${(Math.round((citasProyGlobal - citasReqGlobal) * 10) / 10).toFixed(1)}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1 border-t border-current/20">
              <span className="text-[10px]">Ingreso proy: <strong>{fmtUsdG(ingresoProyGlobal)}</strong></span>
              <span className="text-[10px]">
                Desv: <strong>{desviacionGlobal.pct >= 0 ? '+' : ''}{desviacionGlobal.pct}%</strong>
                {' '}({desviacionGlobal.valor >= 0 ? '+' : '−'}{fmtUsdG(desviacionGlobal.valor)})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Save scenario button ── */}
      {!readOnly && (
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? 'Guardando…' : scenario ? 'Actualizar escenario' : 'Guardar escenario'}
        </Button>
      )}
    </div>
  )
}
