'use client'

import { useState, useMemo } from 'react'
import { RotateCcw, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RecipeInputs, RECIPE_DEFAULTS } from './RecipeInputs'
import { calcRecipe } from '@/lib/calculations/recipe'
import { formatDecimal, formatCurrency } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'
import type { RecipeInputs as RecipeInputsType } from '@/lib/calculations/recipe'
import type { RecipeScenario } from '@/lib/types/database'

interface RecipeSimulatorProps {
  scenario: RecipeScenario
}

interface DeltaRowProps {
  label: string
  saved: number
  simulated: number
  unit?: string
  lowerIsBetter?: boolean
}

function DeltaRow({ label, saved, simulated, unit = '', lowerIsBetter = false }: DeltaRowProps) {
  const delta = simulated - saved
  const improved = lowerIsBetter ? delta < 0 : delta > 0
  const worsened = lowerIsBetter ? delta > 0 : delta < 0
  const neutral = delta === 0

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <span className="flex-1 text-sm text-muted-foreground">{label}</span>
      <span className="tabular-nums text-sm w-20 text-right text-foreground/60">
        {formatDecimal(saved)}{unit}
      </span>
      <span className={cn(
        'tabular-nums text-sm font-semibold w-20 text-right',
        improved ? 'text-emerald-400' : worsened ? 'text-red-400' : 'text-foreground'
      )}>
        {formatDecimal(simulated)}{unit}
      </span>
      <div className={cn(
        'flex items-center gap-1 w-24 text-right justify-end tabular-nums text-xs font-medium',
        improved ? 'text-emerald-400' : worsened ? 'text-red-400' : 'text-muted-foreground'
      )}>
        {neutral ? (
          <><Minus className="h-3 w-3" /> Sin cambio</>
        ) : improved ? (
          <><TrendingDown className="h-3 w-3" /> {lowerIsBetter ? '' : '+'}{formatDecimal(delta)}{unit}</>
        ) : (
          <><TrendingUp className="h-3 w-3" /> {delta > 0 ? '+' : ''}{formatDecimal(delta)}{unit}</>
        )}
      </div>
    </div>
  )
}

export function RecipeSimulator({ scenario }: RecipeSimulatorProps) {
  const savedInputs: RecipeInputsType = {
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

  const [simInputs, setSimInputs] = useState<RecipeInputsType>(savedInputs)
  const [isDirty, setIsDirty] = useState(false)

  const savedOutputs = useMemo(() => calcRecipe(savedInputs), [scenario.id])
  const simOutputs   = useMemo(() => calcRecipe(simInputs), [simInputs])

  const handleChange = (inputs: RecipeInputsType) => {
    setSimInputs(inputs)
    setIsDirty(true)
  }

  const handleReset = () => {
    setSimInputs(savedInputs)
    setIsDirty(false)
  }

  // Key insight strings
  const insights: string[] = []
  const actDelta = simOutputs.activities_needed_daily - savedOutputs.activities_needed_daily
  const closeDelta = simOutputs.closes_needed_monthly - savedOutputs.closes_needed_monthly

  if (Math.abs(actDelta) >= 1) {
    insights.push(
      actDelta < 0
        ? `Necesitas ${formatDecimal(Math.abs(actDelta))} actividades/día menos`
        : `Necesitas ${formatDecimal(actDelta)} actividades/día más`
    )
  }
  if (Math.abs(closeDelta) >= 1) {
    insights.push(
      closeDelta > 0
        ? `Generarías ${formatDecimal(closeDelta)} cierres/mes adicionales`
        : `Perderías ${formatDecimal(Math.abs(closeDelta))} cierres/mes`
    )
  }

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-4 py-3">
        <p className="text-xs text-amber-400 font-medium">Modo simulación</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Modifica los parámetros para ver el impacto sin guardar cambios en el escenario.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Left: Inputs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Parámetros simulados
            </h3>
            {isDirty && (
              <Button size="sm" variant="ghost" onClick={handleReset} className="h-7 text-xs gap-1.5">
                <RotateCcw className="h-3 w-3" />
                Restaurar guardado
              </Button>
            )}
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <RecipeInputs defaults={simInputs} onChange={handleChange} />
          </div>
        </div>

        {/* Right: Delta comparison */}
        <div className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Impacto vs escenario guardado
          </h3>

          {/* Insight pills */}
          {isDirty && insights.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {insights.map((msg, i) => (
                <span
                  key={i}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium border',
                    msg.includes('menos') || msg.includes('adicionales')
                      ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20'
                      : 'bg-red-400/10 text-red-400 border-red-400/20'
                  )}
                >
                  {msg}
                </span>
              ))}
            </div>
          )}

          {/* Delta table */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_80px_80px_96px] gap-3 px-4 py-2 bg-muted/30 border-b border-border">
              <span className="text-xs text-muted-foreground">Métrica</span>
              <span className="text-xs text-muted-foreground text-right">Guardado</span>
              <span className="text-xs text-muted-foreground text-right">Simulado</span>
              <span className="text-xs text-muted-foreground text-right">Delta</span>
            </div>
            <div className="px-4 divide-y divide-transparent">

              {/* OUTBOUND section */}
              <div className="pt-2 pb-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-400 mb-1">
                  Outbound
                </p>
                <DeltaRow
                  label="Actividades / día"
                  saved={savedOutputs.outbound.activities_daily}
                  simulated={simOutputs.outbound.activities_daily}
                  lowerIsBetter
                />
                <DeltaRow
                  label="Actividades / mes"
                  saved={savedOutputs.outbound.activities_monthly}
                  simulated={simOutputs.outbound.activities_monthly}
                  lowerIsBetter
                />
                <DeltaRow
                  label="Cierres / mes"
                  saved={savedOutputs.outbound.closes_needed}
                  simulated={simOutputs.outbound.closes_needed}
                />
              </div>

              {/* INBOUND section */}
              <div className="pt-2 pb-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-400 mb-1">
                  Inbound
                </p>
                <DeltaRow
                  label="Actividades / día"
                  saved={savedOutputs.inbound.activities_daily}
                  simulated={simOutputs.inbound.activities_daily}
                  lowerIsBetter
                />
                <DeltaRow
                  label="Actividades / mes"
                  saved={savedOutputs.inbound.activities_monthly}
                  simulated={simOutputs.inbound.activities_monthly}
                  lowerIsBetter
                />
                <DeltaRow
                  label="Cierres / mes"
                  saved={savedOutputs.inbound.closes_needed}
                  simulated={simOutputs.inbound.closes_needed}
                />
              </div>

              {/* Total section */}
              <div className="pt-2 pb-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Total
                </p>
                <DeltaRow
                  label="Actividades / día"
                  saved={savedOutputs.activities_needed_daily}
                  simulated={simOutputs.activities_needed_daily}
                  lowerIsBetter
                />
                <DeltaRow
                  label="Actividades / mes"
                  saved={savedOutputs.activities_needed_monthly}
                  simulated={simOutputs.activities_needed_monthly}
                  lowerIsBetter
                />
                <DeltaRow
                  label="Cierres totales / mes"
                  saved={savedOutputs.closes_needed_monthly}
                  simulated={simOutputs.closes_needed_monthly}
                />
              </div>
            </div>
          </div>

          {/* Not dirty state */}
          {!isDirty && (
            <p className="text-center text-xs text-muted-foreground pt-2">
              Modifica cualquier parámetro para ver el impacto
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
