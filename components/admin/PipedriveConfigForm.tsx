'use client'

import { useMemo, useState, useTransition } from 'react'
import { CheckCircle2, ExternalLink, Trash2, AlertTriangle, Wand2, UserCheck, Download } from 'lucide-react'
import { savePipedriveConfig, cleanupPipedriveDeals, discoverPipedriveData, importPipedriveDeals } from '@/lib/actions/integrations'
import type { PipedriveStageConfig, PipedriveDiscoveredStage } from '@/lib/actions/integrations'

interface Props {
  initial: PipedriveStageConfig | null
}

const inputClass = 'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60'
const labelClass = 'block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1'

function StageField({ label, value, onChange, placeholder, stagesByPipeline }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  stagesByPipeline: [string, PipedriveDiscoveredStage[]][] | null
}) {
  if (stagesByPipeline) {
    // Varias etapas de Pipedrive pueden marcarse para UNA sola etapa de
    // ProspectPro — ej: si tienes "Ganados" y "Facturados" por separado en
    // Pipedrive, puedes marcar ambas en "Cierre" para que ninguna quede
    // invisible en ProspectPro.
    const selected = new Set(value.split(',').map((s) => s.trim()).filter(Boolean))
    function toggle(idStr: string) {
      const next = new Set(selected)
      if (next.has(idStr)) next.delete(idStr)
      else next.add(idStr)
      onChange(Array.from(next).join(','))
    }
    return (
      <div>
        <label className={labelClass}>{label}</label>
        <div className="max-h-36 overflow-y-auto rounded-md border border-border bg-background p-2 space-y-1.5">
          {stagesByPipeline.map(([pipelineName, pStages]) => (
            <div key={pipelineName}>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-0.5">{pipelineName}</p>
              {pStages.map((s) => (
                <label key={s.id} className="flex items-center gap-1.5 py-0.5 text-xs text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(String(s.id))}
                    onChange={() => toggle(String(s.id))}
                    className="accent-primary"
                  />
                  <span className="truncate">{s.name}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
    </div>
  )
}

export function PipedriveConfigForm({ initial }: Props) {
  const [citaStage,      setCitaStage]      = useState(initial?.cita_stage      ?? '')
  const [reagendarStage, setReagendarStage] = useState(initial?.reagendar_stage ?? '')
  const [reunionStage,   setReunionStage]   = useState(initial?.reunion_stage   ?? '')
  const [propuestaStage, setPropuestaStage] = useState(initial?.propuesta_stage ?? '')
  const [cierreStage,    setCierreStage]    = useState(initial?.cierre_stage    ?? '')
  const [ownerId,        setOwnerId]        = useState(initial?.owner_id        ?? '')
  const [saved,          setSaved]          = useState(false)
  const [error,          setError]          = useState<string | null>(null)
  const [pending,        startTransition]   = useTransition()

  const [stages,          setStages]          = useState<PipedriveDiscoveredStage[] | null>(null)
  const [detectedUser,    setDetectedUser]    = useState<{ id: number; name: string } | null>(null)
  const [discoverError,   setDiscoverError]   = useState<string | null>(null)
  const [discoverPending, startDiscover]      = useTransition()

  const stagesByPipeline = useMemo(() => {
    if (!stages) return []
    const groups = new Map<string, PipedriveDiscoveredStage[]>()
    for (const s of stages) {
      const list = groups.get(s.pipelineName) ?? []
      list.push(s)
      groups.set(s.pipelineName, list)
    }
    return Array.from(groups.entries())
  }, [stages])

  function handleDiscover() {
    setDiscoverError(null)
    startDiscover(async () => {
      try {
        const result = await discoverPipedriveData()
        setStages(result.stages)
        setDetectedUser(result.currentUser)
        if (result.currentUser && !ownerId) {
          setOwnerId(String(result.currentUser.id))
        }
      } catch (err) {
        setDiscoverError(err instanceof Error ? err.message : 'No se pudo conectar con Pipedrive')
      }
    })
  }

  const [cleanupConfirm,  setCleanupConfirm]  = useState(false)
  const [cleanupResult,   setCleanupResult]   = useState<string | null>(null)
  const [cleanupPending,  startCleanup]       = useTransition()

  const [importResult,  setImportResult]  = useState<string | null>(null)
  const [importDetails, setImportDetails] = useState<string[]>([])
  const [importError,   setImportError]   = useState<string | null>(null)
  const [importPending, startImport]      = useTransition()

  function handleImport() {
    setImportError(null)
    setImportResult(null)
    setImportDetails([])
    startImport(async () => {
      try {
        const { imported, skipped, errors, details } = await importPipedriveDeals()
        setImportResult(`✓ ${imported} trato${imported !== 1 ? 's' : ''} importado${imported !== 1 ? 's' : ''} · ${skipped} sin mapear · ${errors} con error`)
        setImportDetails(details)
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Error al importar')
      }
    })
  }

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

  function handleCleanup() {
    if (!cleanupConfirm) {
      setCleanupConfirm(true)
      return
    }
    setCleanupConfirm(false)
    setCleanupResult(null)
    startCleanup(async () => {
      try {
        const { deleted } = await cleanupPipedriveDeals()
        setCleanupResult(`✓ Se eliminaron ${deleted} trato${deleted !== 1 ? 's' : ''} sincronizados desde Pipedrive. Tus propios tratos volverán a aparecer la próxima vez que los muevas en Pipedrive.`)
      } catch (err) {
        setCleanupResult(`Error: ${err instanceof Error ? err.message : 'desconocido'}`)
      }
    })
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      {/* Autodetección — lee las etapas y el usuario directo de la API de Pipedrive */}
      <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3 space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-cyan-400">Detectar automáticamente</p>
            <p className="text-[11px] text-cyan-400/70">
              Lee tus etapas y tu usuario reales desde Pipedrive, para que elijas de una lista en vez de escribir números a mano.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDiscover}
            disabled={discoverPending}
            className="flex items-center gap-1.5 rounded-md border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25 transition-colors disabled:opacity-50 shrink-0"
          >
            <Wand2 className="h-3.5 w-3.5" />
            {discoverPending ? 'Detectando…' : stages ? 'Detectar de nuevo' : 'Detectar automáticamente'}
          </button>
        </div>
        {discoverError && (
          <p className="text-[11px] text-red-400">{discoverError}</p>
        )}
        {detectedUser && (
          <p className="flex items-center gap-1.5 text-[11px] text-emerald-400">
            <UserCheck className="h-3.5 w-3.5" />
            Detectado: {detectedUser.name} (ID {detectedUser.id})
          </p>
        )}
        {stages && (
          <button
            type="button"
            onClick={() => { setStages(null); setDetectedUser(null) }}
            className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground"
          >
            Volver a escribir los números manualmente
          </button>
        )}
      </div>

      {/* Stage mapping — 5 stages */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StageField label="Cita agendada" value={citaStage} onChange={setCitaStage} placeholder="ej: 1" stagesByPipeline={stages ? stagesByPipeline : null} />
        <StageField label="Reagendar" value={reagendarStage} onChange={setReagendarStage} placeholder="ej: 2" stagesByPipeline={stages ? stagesByPipeline : null} />
        <StageField label="1ra Reunión" value={reunionStage} onChange={setReunionStage} placeholder="ej: 3" stagesByPipeline={stages ? stagesByPipeline : null} />
        <StageField label="Propuesta" value={propuestaStage} onChange={setPropuestaStage} placeholder="ej: 4" stagesByPipeline={stages ? stagesByPipeline : null} />
        <StageField label="Cierre" value={cierreStage} onChange={setCierreStage} placeholder="ej: 5" stagesByPipeline={stages ? stagesByPipeline : null} />
      </div>
      <p className="text-[10px] text-muted-foreground/60 -mt-2">
        {stages
          ? 'Puedes marcar varias etapas de Pipedrive en una misma casilla — útil si en Pipedrive tienes, por ejemplo, "Ganados" y "Facturados" separados y en ProspectPro deben contar los dos como "Cierre".'
          : 'Si escribes manualmente, puedes poner varios IDs separados por coma (ej: 10,11,12) para que todos cuenten como la misma etapa de ProspectPro.'}
      </p>

      {/* Owner filter */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
        <div className="flex items-start gap-2">
          <span className="text-amber-400 text-sm shrink-0 mt-0.5">⚠</span>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-amber-400">
              Tu ID de usuario en Pipedrive
              <span className="ml-1.5 font-normal text-amber-400/70">(muy recomendado)</span>
            </label>
            <p className="text-[11px] text-amber-400/70">
              Sin este filtro, los movimientos de <strong>todos los usuarios de tu cuenta Pipedrive</strong> (compañeros, gerentes) sincronizarán en tu pipeline de ProspectPro.
            </p>
          </div>
        </div>
        <input
          type="text"
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          placeholder="ej: 12694"
          className={`${inputClass} sm:max-w-[220px]`}
        />
        <p className="text-[10px] text-muted-foreground/60">
          {detectedUser
            ? 'Ya se completó automáticamente con el botón "Detectar automáticamente" de arriba.'
            : <>Usa el botón <span className="font-mono">Detectar automáticamente</span> de arriba para completarlo solo, o encuéntralo a mano en Pipedrive: <span className="font-mono">Tu perfil → Configuración</span> → campo <span className="font-mono">ID de usuario</span>.</>}
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

      {/* Import existing deals — el webhook solo avisa de cambios nuevos; esto trae
          de una sola vez los tratos que ya existían antes de conectar el webhook. */}
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-emerald-400">Importar tratos que ya existen en Pipedrive</p>
            <p className="text-[11px] text-emerald-400/70">
              El webhook solo avisa cuando MUEVES un trato. Usa este botón una vez para traer de un jalón los tratos que ya tenías antes de conectar — no hace falta moverlos uno por uno.
            </p>
          </div>
          <button
            type="button"
            onClick={handleImport}
            disabled={importPending}
            className="flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 transition-colors disabled:opacity-50 shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            {importPending ? 'Importando…' : 'Importar tratos existentes'}
          </button>
        </div>
        {importError && (
          <p className="text-[11px] text-red-400">{importError}</p>
        )}
        {importResult && (
          <div className="space-y-1">
            <p className="text-[11px] font-mono text-emerald-400">{importResult}</p>
            {importDetails.length > 0 && (
              <ul className="space-y-0.5 max-h-28 overflow-y-auto">
                {importDetails.map((d, i) => (
                  <li key={i} className="text-[10px] font-mono text-muted-foreground/60">{d}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Cleanup section — removes deals from other users already in the pipeline */}
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 space-y-2">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-semibold text-red-400">Limpiar tratos de otros usuarios</p>
            <p className="text-[11px] text-red-400/70">
              Elimina del pipeline todos los tratos sincronizados desde Pipedrive (incluyendo los de compañeros que llegaron antes de configurar tu ID de usuario).
              Tus propios tratos volverán a aparecer la próxima vez que los muevas en Pipedrive.
            </p>
          </div>
        </div>
        {cleanupResult && (
          <p className={`text-[11px] font-mono ${cleanupResult.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>
            {cleanupResult}
          </p>
        )}
        <div className="flex items-center gap-3">
          <button
            onClick={handleCleanup}
            disabled={cleanupPending}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
              cleanupConfirm
                ? 'bg-red-500/20 border-red-500/50 text-red-300 hover:bg-red-500/30'
                : 'bg-muted/20 border-border text-muted-foreground hover:bg-muted/40'
            }`}
          >
            <Trash2 className="h-3 w-3" />
            {cleanupPending ? 'Limpiando...' : cleanupConfirm ? '¿Confirmar? Haz clic de nuevo' : 'Limpiar pipeline de Pipedrive'}
          </button>
          {cleanupConfirm && (
            <button
              onClick={() => setCleanupConfirm(false)}
              className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Webhook setup instructions */}
      <div className="rounded border border-border bg-muted/10 p-3 space-y-1.5 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground/70">Configurar webhook en Pipedrive</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Ve a <span className="font-mono text-primary/80">Herramientas y aplicaciones → Webhooks → + Webhook</span></li>
          <li><strong>Acción de evento:</strong> <span className="font-mono text-primary/80">Todas</span></li>
          <li><strong>Objetos de evento:</strong> <span className="font-mono text-primary/80">Trato</span></li>
          <li><strong>URL de punto de término:</strong> copia la URL del endpoint de arriba y agrega al final <span className="font-mono text-primary/80">?key=TU_API_KEY</span></li>
        </ol>
        <p className="rounded border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-[11px] text-amber-400">
          Los campos <strong>&quot;Nombre de usuario&quot;</strong> y <strong>&quot;Contraseña de autentificación HTTP&quot;</strong> déjalos <strong>VACÍOS</strong> — ProspectPro no los necesita. Luego haz clic en <strong>Guardar</strong>.
        </p>
        <a
          href="https://app.pipedrive.com/settings/webhooks"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary/70 hover:text-primary transition-colors mt-1"
        >
          Abrir Webhooks en Pipedrive
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  )
}
