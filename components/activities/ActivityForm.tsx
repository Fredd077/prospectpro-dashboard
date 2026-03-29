'use client'

import { useState, useRef, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldLabel,
  FieldError,
  FieldGroup,
} from '@/components/ui/field'
import { createActivity, updateActivity } from '@/lib/queries/activities'
import type { Activity } from '@/lib/types/database'

const CHANNEL_SUGGESTIONS = [
  'Llamadas en frío',
  'Mensajes en frío',
  'DM LinkedIn',
  'Post LinkedIn',
  'Comentario LinkedIn',
  'Evento Networking',
  'Lead Networking',
  'Referidos',
  'Lead MKT',
  'Lead VSL',
  'Otro',
]

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(100),
  type: z.enum(['OUTBOUND', 'INBOUND']),
  channel: z.string().min(1, 'Selecciona un canal'),
  monthly_goal: z.number().int().min(1, 'Debe ser ≥ 1'),
  status: z.enum(['active', 'inactive']),
  description: z.string().max(500).optional(),
})

type FormValues = z.infer<typeof schema>

interface ActivityFormProps {
  activity?: Activity
}

export function ActivityForm({ activity }: ActivityFormProps) {
  const router = useRouter()
  const isEdit = !!activity

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: activity?.name ?? '',
      type: activity?.type ?? 'OUTBOUND',
      channel: activity?.channel ?? '',
      monthly_goal: activity?.monthly_goal ?? 20,
      status: activity?.status ?? 'active',
      description: activity?.description ?? '',
    },
  })

  const watchedType = watch('type')
  const watchedStatus = watch('status')
  const monthlyGoal = watch('monthly_goal') || 0

  // Combobox state for channel
  const [channelInput, setChannelInput] = useState(activity?.channel ?? '')
  const [channelOpen, setChannelOpen] = useState(false)
  const channelRef = useRef<HTMLDivElement>(null)

  const filteredChannels = CHANNEL_SUGGESTIONS.filter((opt) =>
    opt.toLowerCase().includes(channelInput.toLowerCase())
  )

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (channelRef.current && !channelRef.current.contains(e.target as Node)) {
        setChannelOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Derived previews
  const weeklyPreview = Math.ceil(monthlyGoal / 4)
  const dailyPreview = Math.ceil(monthlyGoal / 20)
  const isWeeklyActivity = dailyPreview < 1

  async function onSubmit(values: FormValues) {
    try {
      const monthly = values.monthly_goal
      const weekly_goal = Math.ceil(monthly / 4)
      const daily_goal = Math.ceil(monthly / 20)
      const payload = { ...values, weekly_goal, daily_goal }

      if (isEdit) {
        await updateActivity(activity.id, payload)
        toast.success('Actividad actualizada')
      } else {
        await createActivity(payload)
        toast.success('Actividad creada')
      }
      router.push('/activities')
      router.refresh()
    } catch (err) {
      toast.error('Error al guardar la actividad')
      console.error(err)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <FieldGroup>
        {/* Name */}
        <Field data-invalid={!!errors.name}>
          <FieldLabel>Nombre de la actividad</FieldLabel>
          <Input placeholder="ej: Llamadas en frío" {...register('name')} />
          <FieldError errors={[errors.name]} />
        </Field>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Type */}
          <Field data-invalid={!!errors.type}>
            <FieldLabel>Tipo</FieldLabel>
            <Select
              defaultValue={watchedType}
              onValueChange={(v) => setValue('type', v as 'OUTBOUND' | 'INBOUND', { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OUTBOUND">Outbound</SelectItem>
                <SelectItem value="INBOUND">Inbound</SelectItem>
              </SelectContent>
            </Select>
            <FieldError errors={[errors.type]} />
          </Field>

          {/* Channel — combobox */}
          <Field data-invalid={!!errors.channel}>
            <FieldLabel>Canal</FieldLabel>
            <div ref={channelRef} className="relative">
              <input
                type="text"
                value={channelInput}
                placeholder="Selecciona o escribe un canal..."
                autoComplete="off"
                onChange={(e) => {
                  setChannelInput(e.target.value)
                  setValue('channel', e.target.value, { shouldValidate: true })
                  setChannelOpen(true)
                }}
                onFocus={() => setChannelOpen(true)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {channelOpen && filteredChannels.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
                  {filteredChannels.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setChannelInput(opt)
                        setValue('channel', opt, { shouldValidate: true })
                        setChannelOpen(false)
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <FieldError errors={[errors.channel]} />
          </Field>
        </div>

        {/* Monthly goal — single source of truth */}
        <Field data-invalid={!!errors.monthly_goal}>
          <FieldLabel>Meta mensual</FieldLabel>
          <Input
            type="number"
            min={1}
            {...register('monthly_goal', { valueAsNumber: true })}
          />
          <FieldError errors={[errors.monthly_goal]} />

          {/* Live preview */}
          {monthlyGoal >= 1 && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {'→ '}
              <span className="text-foreground font-medium">Semanal: {weeklyPreview}</span>
              {' | '}
              {isWeeklyActivity ? (
                <span className="text-amber-400">Esta actividad se trackea semanalmente</span>
              ) : (
                <span className="text-foreground font-medium">Diaria: {dailyPreview}</span>
              )}
            </p>
          )}
        </Field>

        {/* Description */}
        <Field>
          <FieldLabel>Descripción (opcional)</FieldLabel>
          <Input placeholder="Descripción corta..." {...register('description')} />
        </Field>

        {/* Status */}
        <Field>
          <div className="flex items-center gap-3">
            <Switch
              checked={watchedStatus === 'active'}
              onCheckedChange={(checked) =>
                setValue('status', checked ? 'active' : 'inactive')
              }
            />
            <FieldLabel className="!mt-0 cursor-pointer font-normal">
              {watchedStatus === 'active' ? 'Actividad activa' : 'Actividad inactiva'}
            </FieldLabel>
          </div>
        </Field>
      </FieldGroup>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? 'Guardando...'
            : isEdit
            ? 'Guardar cambios'
            : 'Crear actividad'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push('/activities')}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}
