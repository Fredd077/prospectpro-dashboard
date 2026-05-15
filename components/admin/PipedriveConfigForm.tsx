'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, ExternalLink } from 'lucide-react'
import { savePipedriveConfig } from '@/lib/actions/integrations'
import type { PipedriveStageConfig } from '@/lib/actions/integrations'

interface Props {
  initial: PipedriveStageConfig | null
}

export function PipedriveConfigForm({ initial }: Props) {
  const [citaStage,      setCitaStage]      = useState(initial?.cita_stage      ?? '')
  const [reagendarStage, setReagendarStage] = useState(initial?.reagendar_stage ?? '')
  const [reunionStage,   setReunionStage]   = useState(initial?.reunion_stage   ?? '')
  const [propuestaStage, setPropuestaStage] = useState(initial?.propuesta_stage ?? '')
  const [cierreStage,    setCierreStage]    = useState(initial?.cierre_stage    ?? '')
  const [ownerId,        setOwnerId]        = useState(initial?.owner_id        ?? '')
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [pending,  startTransition] = useTransition()

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        await savePipedriveConfig({
          cita_stage:      citaStage.trim()      || undefined,
          reagendar_stage: reagendarStage.trim() || undefined,
          reunion_stage:   reunionStage.trim(),
          propuesta_stage: propuestaStage.trim(),
          cierre_stage:    cierreStage.trim(),
          owner_id:        ownerId.trim() || undefined,
        })
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al guardar')
      }
    })
  }

  const inputClass = 'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60'
  const labelClass = 'block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1'

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      {/* Stage mapping — 5 stages */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div>
          <label className={labelClass}>Cita agendada</label>
          <input
            type="text"
            value={citaStage}
            onChange={(e) => setCitaStage(e.target.value)}
            placeholder="ej: 1"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Reagendar</label>
          <input
            type="text"
            value={reagendarStage}
            onChange={(e) => setReagendarStage(e.target.value)}
            placeholder="ej: 2"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>1ra Reunión</label>
          <input
            type="text"
            value={reunionStage}
            onChange={(e) => setReunionStage(e.target.value)}
            placeholder="ej: 3"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Propuesta</label>
          <input
            type="text"
            value={propuestaStage}
            onChange={(e) => setPropuestaStage(e.target.value)}
            placeholder="ej: 4"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Cierre</label>
          <input
            type="text"
            value={cierreStage}
            onChange={(e) => setCierreStage(e.target.value)}
            placeholder="ej: 5"
            className={inputClass}
          />
        </div>
      </div>

      {/* Owner filter */}
      <div>
        <label className={labelClass}>
          Tu ID de usuario en Pipedrive
          <span className="ml-1 normal-case font-normal text-muted-foreground/60">(opcional — filtra solo tus deals)</span>
        </label>
        <input
          type="text"
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          placeholder="ej: 24658977"
          className={`${inputClass} sm:max-w-[180px]`}
        />
        <p className="mt-1 text-[10px] text-muted-foreground/60">
          Encuéntralo en la URL cuando abres tu pipeline: <span className="font-mono">/pipeline/1/user/<strong>XXXXXXXX</strong></span>
        </p>
      </div>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-md bg-primary/15 border border-primary/30 px-4 py-1.5 text-xs font-semibold text-primary hover:bg-primary/25 transition-colors disabled:opacity-50"
        >
          {pending ? 'Guardando...' : 'Guardar configuración'}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Guardado
          </span>
        )}
      </div>

      {/* Webhook setup instructions */}
      <div className="rounded border border-border bg-muted/10 p-3 space-y-1.5 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground/70">Configurar webhook en Pipedrive</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Ve a <span className="font-mono text-primary/80">Herramientas → Webhooks → Crear nuevo webhook</span></li>
          <li><strong>Acción de evento:</strong> <span className="font-mono text-primary/80">*</span> (todos)</li>
          <li><strong>Event objects:</strong> <span className="font-mono text-primary/80">deal</span></li>
          <li><strong>URL de punto de término:</strong> copia la URL del endpoint de arriba y agrega al final <span className="font-mono text-primary/80">?key=TU_API_KEY</span></li>
          <li>Deja los campos de autenticación HTTP vacíos y haz clic en <strong>Guardar</strong></li>
        </ol>
        <a
          href="https://sandlerdanmacias.pipedrive.com/settings/webhooks/create"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary/70 hover:text-primary transition-colors mt-1"
        >
          Abrir creación de webhook en Pipedrive
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  )
}
