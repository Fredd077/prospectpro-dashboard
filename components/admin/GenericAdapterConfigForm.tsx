'use client'

import { useState, useTransition } from 'react'
import { ArrowRight, Info } from 'lucide-react'
import { saveGenericConfig } from '@/lib/actions/integrations'
import type { GenericAdapterConfig } from '@/lib/integrations/generic/adapter'

interface Props {
  initial: GenericAdapterConfig | null
}

// The 5 ProspectPro stages with friendly descriptions
const PP_STAGES = [
  { key: 'Cita agendada',                                          label: 'Cita agendada',    desc: 'Reunión confirmada pero aún no ejecutada',         color: 'text-blue-400'    },
  { key: 'Reagendar',                                              label: 'Reagendar',         desc: 'La reunión se pospuso o hay que reagendarla',      color: 'text-rose-400'    },
  { key: 'Primera reu ejecutada/Propuesta en preparación',         label: '1ª Reunión',        desc: 'Se tuvo la primera reunión, propuesta en proceso', color: 'text-cyan-400'    },
  { key: 'Propuesta Presentada',                                   label: 'Propuesta',         desc: 'El cliente recibió la propuesta económica',        color: 'text-amber-400'   },
  { key: 'Por facturar/cobrar',                                    label: 'Cierre / Ganado',   desc: 'Negocio ganado, en proceso de facturación',        color: 'text-emerald-400' },
]

export function GenericAdapterConfigForm({ initial }: Props) {
  // Stage map: keyed by ProspectPro stage → CRM stage value(s) comma-separated
  const [stageMap, setStageMap] = useState<Record<string, string>>(() => {
    const m = initial?.stage_map ?? {}
    // Invert: CRM value → PP stage  →  PP stage → CRM value (for display)
    const inverted: Record<string, string[]> = {}
    for (const [crmVal, ppStage] of Object.entries(m)) {
      if (!inverted[ppStage]) inverted[ppStage] = []
      inverted[ppStage].push(crmVal)
    }
    return Object.fromEntries(PP_STAGES.map(s => [s.key, (inverted[s.key] ?? []).join(', ')]))
  })

  const [idField,    setIdField]    = useState(initial?.id_field ?? '')
  const [nameField,  setNameField]  = useState(initial?.deal_name_field ?? '')
  const [amtField,   setAmtField]   = useState(initial?.amount_field ?? '')
  const [stageField, setStageField] = useState(initial?.stage_field ?? '')
  const [wonValue,   setWonValue]   = useState(initial?.won_value ?? '')
  const [lostValue,  setLostValue]  = useState(initial?.lost_value ?? '')

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [pending, start]      = useTransition()

  function buildStageMapFromInputs(): Record<string, string> {
    const result: Record<string, string> = {}
    for (const stage of PP_STAGES) {
      const raw = stageMap[stage.key] ?? ''
      for (const val of raw.split(',').map(v => v.trim()).filter(Boolean)) {
        result[val] = stage.key
      }
    }
    return result
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const config: GenericAdapterConfig = {
      stage_map:       buildStageMapFromInputs(),
      id_field:        idField.trim()    || undefined,
      deal_name_field: nameField.trim()  || undefined,
      amount_field:    amtField.trim()   || undefined,
      stage_field:     stageField.trim() || undefined,
      won_value:       wonValue.trim()   || undefined,
      lost_value:      lostValue.trim()  || undefined,
    }
    start(async () => {
      try {
        await saveGenericConfig(config)
        setSaved(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al guardar')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Intro */}
      <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-2 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground text-sm">Compatible con cualquier CRM</p>
        <p>
          ProspectPro acepta webhooks de HubSpot, Salesforce, Zoho, Monday.com, Close, Freshsales
          y cualquier CRM que pueda enviar datos JSON por HTTP.
        </p>
        <p>
          El único requisito: tu CRM debe poder enviar un POST a la URL de webhook de arriba
          cada vez que un negocio cambia de etapa.
        </p>
      </div>

      {/* Stage mapping — the key section */}
      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <div>
            <p className="text-xs font-bold text-foreground">Mapeo de etapas <span className="text-red-400">*</span></p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Escribe cómo se llama cada etapa en TU CRM. Separa con coma si tienes varios nombres para la misma etapa.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-0 border-b border-border bg-muted/30 px-4 py-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Etapa en ProspectPro</p>
            <span />
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Cómo la llama tu CRM</p>
          </div>
          {PP_STAGES.map((stage, i) => (
            <div
              key={stage.key}
              className={`grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3 ${i < PP_STAGES.length - 1 ? 'border-b border-border/50' : ''}`}
            >
              {/* ProspectPro stage */}
              <div>
                <p className={`text-xs font-semibold ${stage.color}`}>{stage.label}</p>
                <p className="text-[10px] text-muted-foreground/60 leading-tight mt-0.5">{stage.desc}</p>
              </div>

              <ArrowRight className="h-4 w-4 text-muted-foreground/30 shrink-0" />

              {/* CRM value input */}
              <input
                type="text"
                value={stageMap[stage.key] ?? ''}
                onChange={e => { setStageMap(m => ({ ...m, [stage.key]: e.target.value })); setSaved(false) }}
                placeholder="Nombre en tu CRM…"
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2 rounded-md border border-border/50 bg-muted/10 px-3 py-2">
          <Info className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
            <strong className="text-foreground/60">Ejemplo HubSpot:</strong> Cita agendada → <code className="font-mono">appointmentscheduled</code> ·
            1ª Reunión → <code className="font-mono">qualifiedtobuy</code> ·
            Propuesta → <code className="font-mono">presentationscheduled</code> ·
            Cierre → <code className="font-mono">closedwon</code>
            <br />
            <strong className="text-foreground/60">Ejemplo Salesforce:</strong> Cierre → <code className="font-mono">Closed Won</code>
          </p>
        </div>
      </div>

      {/* Won / lost values */}
      <div className="space-y-3">
        <p className="text-xs font-bold text-foreground">Detección de negocios ganados / perdidos</p>
        <p className="text-[11px] text-muted-foreground">
          Cuando tu CRM envíe uno de estos valores en el campo de estado, el negocio se marcará como
          Ganado o Perdido en ProspectPro. Deja vacío si tu CRM usa las etapas de arriba para esto.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/70">Valor = Ganado</label>
            <input
              type="text"
              value={wonValue}
              onChange={e => { setWonValue(e.target.value); setSaved(false) }}
              placeholder="ej: won, closed_won, 1"
              className="w-full rounded-md border border-emerald-500/20 bg-background px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-red-400/70">Valor = Perdido</label>
            <input
              type="text"
              value={lostValue}
              onChange={e => { setLostValue(e.target.value); setSaved(false) }}
              placeholder="ej: lost, closed_lost, 0"
              className="w-full rounded-md border border-red-500/20 bg-background px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-red-500/40"
            />
          </div>
        </div>
      </div>

      {/* Advanced: field name overrides */}
      <div className="border border-border/50 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(v => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-muted-foreground hover:bg-muted/20 transition-colors"
        >
          <span className="font-semibold">Configuración avanzada — nombres de campos</span>
          <span>{showAdvanced ? '▲' : '▼'}</span>
        </button>
        {showAdvanced && (
          <div className="px-4 pb-4 pt-1 border-t border-border/50 space-y-3">
            <p className="text-[11px] text-muted-foreground">
              Solo necesitas esto si el webhook de tu CRM usa nombres de campos poco comunes.
              ProspectPro detecta automáticamente <code className="font-mono">id</code>, <code className="font-mono">title</code>, <code className="font-mono">name</code>, <code className="font-mono">amount</code>, <code className="font-mono">value</code> y <code className="font-mono">stage</code>.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Campo ID del trato',    value: idField,    set: setIdField,    ph: 'id' },
                { label: 'Campo nombre / título',  value: nameField,  set: setNameField,  ph: 'title' },
                { label: 'Campo monto',            value: amtField,   set: setAmtField,   ph: 'amount' },
                { label: 'Campo etapa',            value: stageField, set: setStageField, ph: 'stage' },
              ].map(({ label, value, set, ph }) => (
                <div key={label} className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground/70">{label}</label>
                  <input
                    type="text"
                    value={value}
                    onChange={e => { set(e.target.value); setSaved(false) }}
                    placeholder={ph}
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar configuración'}
      </button>
    </form>
  )
}
