'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, ExternalLink } from 'lucide-react'
import { savePipedriveConfig } from '@/lib/actions/integrations'
import type { PipedriveStageConfig } from '@/lib/actions/integrations'

interface Props {
  initial: PipedriveStageConfig | null
}

export function PipedriveConfigForm({ initial }: Props) {
  const [reunionStage,   setReunionStage]   = useState(initial?.reunion_stage   ?? '')
  const [propuestaStage, setPropuestaStage] = useState(initial?.propuesta_stage ?? '')
  const [cierreStage,    setCierreStage]    = useState(initial?.cierre_stage    ?? '')
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [pending,  startTransition] = useTransition()

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        await savePipedriveConfig({
          reunion_stage:   reunionStage.trim(),
          propuesta_stage: propuestaStage.trim(),
          cierre_stage:    cierreStage.trim(),
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
      {/* Instructions */}
      <div className="rounded border border-border bg-muted/10 p-3 space-y-1.5 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground/70">Cómo obtener los IDs de etapa</p>
        <p>
          En Pipedrive ve a <span className="font-mono text-primary/80">Configuración → Etapas del pipeline</span>.
          Haz clic en cada etapa y copia el número al final de la URL.
          Por ejemplo: <span className="font-mono text-primary/80">/stage/<strong>12</strong></span>
        </p>
        <a
          href="https://app.pipedrive.com/settings/pipelines"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary/70 hover:text-primary transition-colors"
        >
          Abrir Pipedrive
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>ID etapa — Reunión</label>
          <input
            type="text"
            value={reunionStage}
            onChange={(e) => setReunionStage(e.target.value)}
            placeholder="ej: 12"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>ID etapa — Propuesta</label>
          <input
            type="text"
            value={propuestaStage}
            onChange={(e) => setPropuestaStage(e.target.value)}
            placeholder="ej: 15"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>ID etapa — Cierre</label>
          <input
            type="text"
            value={cierreStage}
            onChange={(e) => setCierreStage(e.target.value)}
            placeholder="ej: 18"
            className={inputClass}
          />
        </div>
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
          {pending ? 'Guardando...' : 'Guardar mapeo de etapas'}
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
          <li>Ve a <span className="font-mono text-primary/80">Configuración → Webhooks → + Agregar webhook</span></li>
          <li>URL del evento: pega la URL del endpoint que aparece arriba en esta página</li>
          <li>Versión: <span className="font-mono text-primary/80">1.0</span></li>
          <li>Objeto: <span className="font-mono text-primary/80">deal</span> — Eventos: <span className="font-mono text-primary/80">all</span></li>
          <li>Header personalizado: <span className="font-mono text-primary/80">x-prospectpro-key</span> con tu API Key de ProspectPro</li>
        </ol>
      </div>
    </div>
  )
}
