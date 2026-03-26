'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { RecipeInputs, RECIPE_DEFAULTS } from './RecipeInputs'
import { RecipeOutputs } from './RecipeOutputs'
import { calcRecipe } from '@/lib/calculations/recipe'
import { createScenario, updateScenario } from '@/lib/queries/recipe'
import type { RecipeInputs as RecipeInputsType } from '@/lib/calculations/recipe'
import type { RecipeScenario } from '@/lib/types/database'

interface RecipeCalculatorProps {
  scenario?: RecipeScenario
  readOnly?: boolean
}

export function RecipeCalculator({ scenario, readOnly = false }: RecipeCalculatorProps) {
  const router = useRouter()
  const [name, setName] = useState(scenario?.name ?? '')
  const [description, setDescription] = useState(scenario?.description ?? '')
  const [saving, setSaving] = useState(false)

  const initialInputs: RecipeInputsType = scenario
    ? {
        monthly_revenue_goal: scenario.monthly_revenue_goal,
        average_ticket: scenario.average_ticket,
        working_days_per_month: scenario.working_days_per_month,
        outbound_pct: scenario.outbound_pct,
        conv_activity_to_speech: scenario.conv_activity_to_speech,
        conv_speech_to_meeting: scenario.conv_speech_to_meeting,
        conv_meeting_to_proposal: scenario.conv_meeting_to_proposal,
        conv_proposal_to_close: scenario.conv_proposal_to_close,
        inbound_conv_activity_to_speech: scenario.inbound_conv_activity_to_speech,
        inbound_conv_speech_to_meeting: scenario.inbound_conv_speech_to_meeting,
        inbound_conv_meeting_to_proposal: scenario.inbound_conv_meeting_to_proposal,
        inbound_conv_proposal_to_close: scenario.inbound_conv_proposal_to_close,
      }
    : RECIPE_DEFAULTS

  const [inputs, setInputs] = useState<RecipeInputsType>(initialInputs)
  const outputs = calcRecipe(inputs)

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('El nombre del escenario es obligatorio')
      return
    }
    setSaving(true)
    try {
      if (scenario) {
        await updateScenario(scenario.id, { ...inputs, name, description: description || null })
        toast.success('Escenario actualizado')
        router.refresh()
      } else {
        const created = await createScenario({ ...inputs, name, description: description || null, is_active: true })
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

        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Parámetros
          </p>
          <RecipeInputs
            defaults={initialInputs}
            onChange={setInputs}
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
        <RecipeOutputs
          outputs={outputs}
          monthlyRevenueGoal={inputs.monthly_revenue_goal}
          averageTicket={inputs.average_ticket}
        />
      </div>
    </div>
  )
}
