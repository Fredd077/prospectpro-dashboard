'use client'

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

const CHANNELS = [
  { value: 'cold_call', label: 'Llamadas en frío' },
  { value: 'cold_message', label: 'Mensajes en frío' },
  { value: 'linkedin_dm', label: 'DM LinkedIn' },
  { value: 'linkedin_post', label: 'Post LinkedIn' },
  { value: 'linkedin_comment', label: 'Comentario LinkedIn' },
  { value: 'networking_event', label: 'Evento Networking' },
  { value: 'networking_lead', label: 'Lead Networking' },
  { value: 'referral', label: 'Referidos' },
  { value: 'mkt_lead', label: 'Lead MKT' },
  { value: 'vsl_lead', label: 'Lead VSL' },
  { value: 'other', label: 'Otro' },
]

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(100),
  type: z.enum(['OUTBOUND', 'INBOUND']),
  channel: z.string().min(1, 'Selecciona un canal'),
  daily_goal: z.number().int().min(0, 'Debe ser ≥ 0'),
  weekly_goal: z.number().int().min(0, 'Debe ser ≥ 0'),
  monthly_goal: z.number().int().min(0, 'Debe ser ≥ 0'),
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
      daily_goal: activity?.daily_goal ?? 0,
      weekly_goal: activity?.weekly_goal ?? 0,
      monthly_goal: activity?.monthly_goal ?? 0,
      status: activity?.status ?? 'active',
      description: activity?.description ?? '',
    },
  })

  const watchedType = watch('type')
  const watchedChannel = watch('channel')
  const watchedStatus = watch('status')

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

          {/* Channel */}
          <Field data-invalid={!!errors.channel}>
            <FieldLabel>Canal</FieldLabel>
            <Select
              defaultValue={watchedChannel}
              onValueChange={(v) => v && setValue('channel', v, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el canal" />
              </SelectTrigger>
              <SelectContent>
                {CHANNELS.map((ch) => (
                  <SelectItem key={ch.value} value={ch.value}>
                    {ch.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError errors={[errors.channel]} />
          </Field>

          {/* Daily goal */}
          <Field data-invalid={!!errors.daily_goal}>
            <FieldLabel>Meta diaria</FieldLabel>
            <Input
              type="number"
              min={0}
              {...register('daily_goal', { valueAsNumber: true })}
            />
            <FieldError errors={[errors.daily_goal]} />
          </Field>

          {/* Weekly goal */}
          <Field data-invalid={!!errors.weekly_goal}>
            <FieldLabel>Meta semanal</FieldLabel>
            <Input
              type="number"
              min={0}
              {...register('weekly_goal', { valueAsNumber: true })}
            />
            <FieldError errors={[errors.weekly_goal]} />
          </Field>

          {/* Monthly goal */}
          <Field data-invalid={!!errors.monthly_goal}>
            <FieldLabel>Meta mensual</FieldLabel>
            <Input
              type="number"
              min={0}
              {...register('monthly_goal', { valueAsNumber: true })}
            />
            <FieldError errors={[errors.monthly_goal]} />
          </Field>
        </div>

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
