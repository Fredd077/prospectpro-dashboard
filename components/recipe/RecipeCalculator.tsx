'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { FunnelStageEditor } from './FunnelStageEditor'
import { RecipeInputs, RECIPE_DEFAULTS } from './RecipeInputs'
import { RecipeOutputs } from './RecipeOutputs'
import { calcRecipe, adjustRates, DEFAULT_FUNNEL_STAGES, DEFAULT_OUTBOUND_RATES, DEFAULT_INBOUND_RATES } from '@/lib/calculations/recipe'
import { createScenario, updateScenario } from '@/lib/queries/recipe'
import type { RecipeInputs as RecipeInputsType } from '@/lib/calculations/recipe'
import type { RecipeScenario } from '@/lib/types/database'

interface RecipeCalculatorProps {
  scenario?: RecipeScenario
  readOnly?: boolean
}

export function RecipeCalculator({ scenario, readOnly = false }: RecipeCalculatorProps) {
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
        await updateScenario(scenario.id, payload)
        toast.success('Escenario actualizado')
        router.refresh()
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

  return (
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
          />
        </div>

        {!readOnly && (
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Guardando…' : scenario ? 'Actualizar escenario' : 'Guardar escenario'}
          </Button>
        )}
      </div>

      {/* Right: Outputs */}
      <div>
        <RecipeOutputs outputs={outputs} monthlyRevenueGoal={inputs.monthly_revenue_goal} />
      </div>
    </div>
  )
}
