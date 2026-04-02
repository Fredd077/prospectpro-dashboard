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
  'Otro (escribe el tuyo...)',
]

const OTRO_OPTION = 'Otro (escribe el tuyo...)'

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(100),
  type: z.enum(['OUTBOUND', 'INBOUND']),
  channel: z.string().min(1, 'Por favor escribe el nombre de tu canal personalizado'),
  weight: z.number().min(0, 'Mínimo 0').max(100, 'Máximo 100'),
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
      weight: activity?.weight ?? 0,
      status: activity?.status ?? 'active',
      description: activity?.description ?? '',
    },
  })

  const watchedType = watch('type')
  const watchedStatus = watch('status')

  // Combobox state for channel
  const [channelInput, setChannelInput] = useState(activity?.channel ?? '')
  const [channelOpen, setChannelOpen] = useState(false)
  const channelRef = useRef<HTMLDivElement>(null)
  const channelInputRef = useRef<HTMLInputElement>(null)

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

  async function onSubmit(values: FormValues) {
    try {
      if (isEdit) {
        await updateActivity(activity.id, values)
        toast.success('Actividad actualizada')
      } else {
        await createActivity(values)
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
                ref={channelInputRef}
                type="text"
                value={channelInput}
                placeholder="Selecciona o escribe tu propio canal..."
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
                        if (opt === OTRO_OPTION) {
                          setChannelInput('')
                          setValue('channel', '', { shouldValidate: false })
                          setChannelOpen(false)
                          setTimeout(() => channelInputRef.current?.focus(), 0)
                        } else {
                          setChannelInput(opt)
                          setValue('channel', opt, { shouldValidate: true })
                          setChannelOpen(false)
                        }
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              💡 Puedes escribir cualquier canal personalizado
            </p>
            <FieldError errors={[errors.channel]} />
          </Field>
        </div>

        {/* Weight — replaces manual monthly_goal */}
        <Field data-invalid={!!errors.weight}>
          <FieldLabel>Peso relativo (%)</FieldLabel>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.01}
            placeholder="0 – 100"
            {...register('weight', { valueAsNumber: true })}
          />
          <FieldError errors={[errors.weight]} />
          <p className="mt-1.5 text-xs text-muted-foreground">
            La meta mensual se calcula automáticamente en la página de Actividades
            según el peso asignado y tu Recetario activo.
          </p>
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
