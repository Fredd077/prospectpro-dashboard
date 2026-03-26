'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { RecipeInputs as RecipeInputsType } from '@/lib/calculations/recipe'

const convRate = z.number().min(0.1).max(100)

const schema = z.object({
  monthly_revenue_goal: z.number().min(1),
  average_ticket: z.number().min(1),
  working_days_per_month: z.number().min(1).max(31),
  outbound_pct: z.number().min(0).max(100),
  conv_activity_to_speech: convRate,
  conv_speech_to_meeting: convRate,
  conv_meeting_to_proposal: convRate,
  conv_proposal_to_close: convRate,
  inbound_conv_activity_to_speech: convRate,
  inbound_conv_speech_to_meeting: convRate,
  inbound_conv_meeting_to_proposal: convRate,
  inbound_conv_proposal_to_close: convRate,
})

interface RecipeInputsProps {
  defaults?: Partial<RecipeInputsType>
  onChange: (values: RecipeInputsType) => void
}

export const RECIPE_DEFAULTS: RecipeInputsType = {
  monthly_revenue_goal: 50000,
  average_ticket: 5000,
  working_days_per_month: 22,
  outbound_pct: 60,
  conv_activity_to_speech: 20,
  conv_speech_to_meeting: 30,
  conv_meeting_to_proposal: 50,
  conv_proposal_to_close: 25,
  inbound_conv_activity_to_speech: 20,
  inbound_conv_speech_to_meeting: 30,
  inbound_conv_meeting_to_proposal: 50,
  inbound_conv_proposal_to_close: 25,
}

function ConvRateSlider({
  label,
  fieldKey,
  value,
  onSet,
}: {
  label: string
  fieldKey: string
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
        value={[value ?? 25]}
        onValueChange={(v) => { const val = Array.isArray(v) ? v[0] : v; onSet(val) }}
        className="[&_[data-slot=slider-thumb]]:h-4 [&_[data-slot=slider-thumb]]:w-4"
      />
    </div>
  )
}

export function RecipeInputs({ defaults, onChange }: RecipeInputsProps) {
  const values = { ...RECIPE_DEFAULTS, ...defaults }

  const { register, watch, setValue, formState: { errors } } = useForm<RecipeInputsType>({
    resolver: zodResolver(schema),
    defaultValues: values,
  })

  const watched = watch()

  useEffect(() => {
    const valid = schema.safeParse(watched)
    if (valid.success) onChange(valid.data)
  }, [JSON.stringify(watched)]) // eslint-disable-line react-hooks/exhaustive-deps

  const outboundGoal = (watched.monthly_revenue_goal ?? 0) * ((watched.outbound_pct ?? 60) / 100)
  const inboundGoal  = (watched.monthly_revenue_goal ?? 0) * ((100 - (watched.outbound_pct ?? 60)) / 100)

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
            onValueChange={(v) => { const val = Array.isArray(v) ? v[0] : v; setValue('working_days_per_month', val, { shouldValidate: true }) }}
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
            onValueChange={(v) => { const val = Array.isArray(v) ? v[0] : v; setValue('outbound_pct', val, { shouldValidate: true }) }}
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

      {/* Two-column conversion rates */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Outbound rates */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-blue-400 uppercase tracking-wider mb-3">
            Tasas Outbound
          </p>
          {([
            { key: 'conv_activity_to_speech' as const,   label: 'Actividad → Discurso' },
            { key: 'conv_speech_to_meeting' as const,    label: 'Discurso → Reunión' },
            { key: 'conv_meeting_to_proposal' as const,  label: 'Reunión → Propuesta' },
            { key: 'conv_proposal_to_close' as const,    label: 'Propuesta → Cierre' },
          ] as const).map(({ key, label }) => (
            <ConvRateSlider
              key={key}
              fieldKey={key}
              label={label}
              value={watched[key] ?? 25}
              onSet={(val) => setValue(key, val, { shouldValidate: true })}
            />
          ))}
        </div>

        {/* Inbound rates */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-violet-400 uppercase tracking-wider mb-3">
            Tasas Inbound
          </p>
          {([
            { key: 'inbound_conv_activity_to_speech' as const,   label: 'Actividad → Discurso' },
            { key: 'inbound_conv_speech_to_meeting' as const,    label: 'Discurso → Reunión' },
            { key: 'inbound_conv_meeting_to_proposal' as const,  label: 'Reunión → Propuesta' },
            { key: 'inbound_conv_proposal_to_close' as const,    label: 'Propuesta → Cierre' },
          ] as const).map(({ key, label }) => (
            <ConvRateSlider
              key={key}
              fieldKey={key}
              label={label}
              value={watched[key] ?? 25}
              onSet={(val) => setValue(key, val, { shouldValidate: true })}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
