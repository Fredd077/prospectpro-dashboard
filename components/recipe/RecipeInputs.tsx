'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { RecipeInputs as RecipeInputsType } from '@/lib/calculations/recipe'
import { DEFAULT_FUNNEL_STAGES, DEFAULT_OUTBOUND_RATES, DEFAULT_INBOUND_RATES } from '@/lib/calculations/recipe'

const scalarSchema = z.object({
  monthly_revenue_goal:   z.number().min(1),
  average_ticket:         z.number().min(1),
  working_days_per_month: z.number().min(1).max(31),
  outbound_pct:           z.number().min(0).max(100),
})
type ScalarFields = z.infer<typeof scalarSchema>

interface RecipeInputsProps {
  // Full inputs including funnel arrays — used to initialize state.
  // When funnel_stages changes externally, re-key this component to reset.
  defaults?: Partial<RecipeInputsType>
  onChange: (values: RecipeInputsType) => void
}

export const RECIPE_DEFAULTS: RecipeInputsType = {
  monthly_revenue_goal:   50000,
  average_ticket:         5000,
  working_days_per_month: 22,
  outbound_pct:           60,
  funnel_stages:  DEFAULT_FUNNEL_STAGES,
  outbound_rates: DEFAULT_OUTBOUND_RATES,
  inbound_rates:  DEFAULT_INBOUND_RATES,
}

function RateSlider({
  label,
  value,
  onSet,
}: {
  label: string
  value: number
  onSet: (v: number) => void
}) {
  return (
    <div className="space-y-2 py-2 border-b border-border last:border-0">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-sm font-semibold tabular-nums text-foreground">{value}%</span>
      </div>
      <Slider
        min={1}
        max={100}
        step={1}
        value={[value]}
        onValueChange={(v) => onSet(Array.isArray(v) ? v[0] : v)}
        className="[&_[data-slot=slider-thumb]]:h-4 [&_[data-slot=slider-thumb]]:w-4"
      />
    </div>
  )
}

export function RecipeInputs({ defaults, onChange }: RecipeInputsProps) {
  const merged = { ...RECIPE_DEFAULTS, ...defaults }
  const funnelStages   = merged.funnel_stages
  const [outboundRates, setOutboundRates] = useState<number[]>(merged.outbound_rates)
  const [inboundRates,  setInboundRates]  = useState<number[]>(merged.inbound_rates)

  const { register, watch, setValue, formState: { errors } } = useForm<ScalarFields>({
    resolver: zodResolver(scalarSchema),
    defaultValues: {
      monthly_revenue_goal:   merged.monthly_revenue_goal,
      average_ticket:         merged.average_ticket,
      working_days_per_month: merged.working_days_per_month,
      outbound_pct:           merged.outbound_pct,
    },
  })

  const watched = watch()

  // Fire onChange whenever scalars or rates change
  useEffect(() => {
    const valid = scalarSchema.safeParse(watched)
    if (valid.success) {
      onChange({
        ...valid.data,
        funnel_stages:  funnelStages,
        outbound_rates: outboundRates,
        inbound_rates:  inboundRates,
      })
    }
  }, [JSON.stringify(watched), JSON.stringify(outboundRates), JSON.stringify(inboundRates)]) // eslint-disable-line react-hooks/exhaustive-deps

  const outboundGoal = (watched.monthly_revenue_goal ?? 0) * ((watched.outbound_pct ?? 60) / 100)
  const inboundGoal  = (watched.monthly_revenue_goal ?? 0) * ((100 - (watched.outbound_pct ?? 60)) / 100)

  // Generate transition labels from stage names
  const transitions = funnelStages.slice(0, -1).map((stage, i) => ({
    label: `${stage} → ${funnelStages[i + 1]}`,
    index: i,
  }))

  function setOutboundRate(i: number, v: number) {
    setOutboundRates((prev) => prev.map((r, idx) => (idx === i ? v : r)))
  }
  function setInboundRate(i: number, v: number) {
    setInboundRates((prev) => prev.map((r, idx) => (idx === i ? v : r)))
  }

  return (
    <div className="space-y-6">
      {/* Revenue & Ticket */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="monthly_revenue_goal" className="text-xs text-muted-foreground">
            Meta de ingresos mensual ($)
          </Label>
          <Input
            id="monthly_revenue_goal"
            type="number"
            min={1}
            {...register('monthly_revenue_goal', { valueAsNumber: true })}
            className="bg-background"
          />
          {errors.monthly_revenue_goal && (
            <p className="text-xs text-red-400">{errors.monthly_revenue_goal.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="average_ticket" className="text-xs text-muted-foreground">
            Ticket promedio ($)
          </Label>
          <Input
            id="average_ticket"
            type="number"
            min={1}
            {...register('average_ticket', { valueAsNumber: true })}
            className="bg-background"
          />
          {errors.average_ticket && (
            <p className="text-xs text-red-400">{errors.average_ticket.message}</p>
          )}
        </div>
      </div>

      {/* Working days & Outbound pct */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Días hábiles / mes</Label>
            <span className="text-sm font-semibold tabular-nums">{watched.working_days_per_month}</span>
          </div>
          <Slider
            min={1} max={31} step={1}
            value={[watched.working_days_per_month ?? 22]}
            onValueChange={(v) => setValue('working_days_per_month', Array.isArray(v) ? v[0] : v, { shouldValidate: true })}
            className="[&_[data-slot=slider-thumb]]:h-4 [&_[data-slot=slider-thumb]]:w-4"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Outbound / Inbound</Label>
            <span className="text-sm font-semibold tabular-nums">
              {watched.outbound_pct}% / {100 - (watched.outbound_pct ?? 60)}%
            </span>
          </div>
          <Slider
            min={0} max={100} step={5}
            value={[watched.outbound_pct ?? 60]}
            onValueChange={(v) => setValue('outbound_pct', Array.isArray(v) ? v[0] : v, { shouldValidate: true })}
            className="[&_[data-slot=slider-thumb]]:h-4 [&_[data-slot=slider-thumb]]:w-4"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span className="text-blue-400 font-medium">OUT {watched.outbound_pct}%</span>
            <span className="text-violet-400 font-medium">IN {100 - (watched.outbound_pct ?? 60)}%</span>
          </div>
        </div>
      </div>

      {/* Sub-goals preview */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-blue-400/20 bg-blue-400/5 px-3 py-2 text-center">
          <p className="text-[10px] text-muted-foreground mb-0.5">Meta Outbound</p>
          <p className="text-sm font-semibold text-blue-400">
            ${outboundGoal.toLocaleString('es', { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="rounded-md border border-violet-400/20 bg-violet-400/5 px-3 py-2 text-center">
          <p className="text-[10px] text-muted-foreground mb-0.5">Meta Inbound</p>
          <p className="text-sm font-semibold text-violet-400">
            ${inboundGoal.toLocaleString('es', { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* Dynamic conversion rates — two columns */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Outbound rates */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-blue-400 uppercase tracking-wider mb-3">
            Tasas Outbound
          </p>
          {transitions.map(({ label, index }) => (
            <RateSlider
              key={`o-${index}`}
              label={label}
              value={outboundRates[index] ?? 50}
              onSet={(v) => setOutboundRate(index, v)}
            />
          ))}
        </div>
        {/* Inbound rates */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-violet-400 uppercase tracking-wider mb-3">
            Tasas Inbound
          </p>
          {transitions.map(({ label, index }) => (
            <RateSlider
              key={`i-${index}`}
              label={label}
              value={inboundRates[index] ?? 50}
              onSet={(v) => setInboundRate(index, v)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
