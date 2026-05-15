'use client'

import { useState, useTransition } from 'react'
import { saveGenericConfig } from '@/lib/actions/integrations'
import type { GenericAdapterConfig } from '@/lib/integrations/generic/adapter'

interface Props {
  initial: GenericAdapterConfig | null
}

const FIELDS: { key: keyof GenericAdapterConfig; label: string; placeholder: string; hint: string }[] = [
  {
    key:         'id_field',
    label:       'Campo ID del trato',
    placeholder: 'id',
    hint:        'Nombre del campo que identifica unívocamente el trato en tu CRM. Ej: id, deal_id',
  },
  {
    key:         'deal_name_field',
    label:       'Campo nombre del trato / prospecto',
    placeholder: 'title',
    hint:        'Ej: name, title, deal_name, subject',
  },
  {
    key:         'amount_field',
    label:       'Campo monto',
    placeholder: 'amount',
    hint:        'Ej: amount, value, deal_value. Debe ser numérico.',
  },
  {
    key:         'stage_field',
    label:       'Campo etapa',
    placeholder: 'stage',
    hint:        'El valor de este campo debe coincidir exactamente con una etapa de ProspectPro.',
  },
  {
    key:         'won_value',
    label:       'Valor que indica "Ganado"',
    placeholder: 'won',
    hint:        'Valor exacto del campo status que indica un trato ganado. Ej: won, closed_won, 1',
  },
  {
    key:         'lost_value',
    label:       'Valor que indica "Perdido"',
    placeholder: 'lost',
    hint:        'Valor exacto del campo status que indica un trato perdido. Ej: lost, closed_lost, 0',
  },
]

export function GenericAdapterConfigForm({ initial }: Props) {
  const [values, setValues] = useState<GenericAdapterConfig>(initial ?? {})
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [isPending, start]  = useTransition()

  function handleChange(key: keyof GenericAdapterConfig, value: string) {
    setValues(v => ({ ...v, [key]: value || undefined }))
    setSaved(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    start(async () => {
      try {
        await saveGenericConfig(values)
        setSaved(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al guardar')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded border border-border bg-muted/10 p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground/70">¿Cómo funciona?</p>
        <p>
          Si tu CRM soporta webhooks, copia la URL de arriba y pégala como destino.
          Luego configura abajo los nombres de los campos tal como aparecen en el JSON que envía tu CRM.
          Deja un campo vacío para usar los nombres predeterminados comunes (<code className="font-mono">id</code>, <code className="font-mono">title</code>, <code className="font-mono">amount</code>, <code className="font-mono">stage</code>).
        </p>
        <p className="text-muted-foreground/60">
          El campo <strong>Etapa</strong> debe contener exactamente el nombre de una etapa de ProspectPro:
          Cita agendada · Reagendar · Primera reu ejecutada/Propuesta en preparación · Propuesta Presentada · Por facturar/cobrar
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FIELDS.map(({ key, label, placeholder, hint }) => (
          <div key={key} className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {label}
            </label>
            <input
              type="text"
              value={values[key] ?? ''}
              onChange={e => handleChange(key, e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="text-[10px] text-muted-foreground/60">{hint}</p>
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? 'Guardando…' : saved ? 'Guardado ✓' : 'Guardar configuración'}
      </button>
    </form>
  )
}
