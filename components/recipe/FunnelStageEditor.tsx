'use client'

import { useTransition } from 'react'
import { Plus, Trash2, RefreshCw } from 'lucide-react'
import { getPipelineStages } from '@/lib/actions/pipeline-stages'

const MIN_STAGES = 3
const MAX_STAGES = 6

interface FunnelStageEditorProps {
  stages: string[]
  onChange: (stages: string[]) => void
}

export function FunnelStageEditor({ stages, onChange }: FunnelStageEditorProps) {
  const [syncing, startSync] = useTransition()
  const canAdd    = stages.length < MAX_STAGES
  const canRemove = stages.length > MIN_STAGES

  function updateMiddle(index: number, value: string) {
    // index in the middle stages array (not counting first/last)
    const next = [...stages]
    next[index + 1] = value.slice(0, 30)
    onChange(next)
  }

  function updateEdge(position: 'first' | 'last', value: string) {
    const next = [...stages]
    const i = position === 'first' ? 0 : next.length - 1
    next[i] = value.slice(0, 30)
    onChange(next)
  }

  // Trae los nombres REALES de tu Pipeline (los mismos que ves en "Mi Pipeline"
  // y que mapeaste en Integraciones) para que el Recetario deje de mostrar
  // nombres genéricos que no coinciden con lo que ya configuraste.
  function syncFromPipeline() {
    startSync(async () => {
      const pipelineStages = await getPipelineStages()
      if (pipelineStages.length === 0) return
      onChange(pipelineStages.slice(0, MAX_STAGES).map((s) => s.name))
    })
  }

  function addStage() {
    if (!canAdd) return
    // Insert before "Cierre" (last stage)
    const next = [...stages]
    next.splice(next.length - 1, 0, 'Nueva etapa')
    onChange(next)
  }

  function removeStage(middleIndex: number) {
    if (!canRemove) return
    const next = [...stages]
    next.splice(middleIndex + 1, 1) // +1 to skip "Actividad"
    onChange(next)
  }

  const middleStages = stages.slice(1, -1)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Etapas del funnel
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={syncFromPipeline}
            disabled={syncing}
            className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
            title="Reemplaza estas etapas por las que ya configuraste en Mi Pipeline"
          >
            <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando…' : 'Usar mis etapas de Pipeline'}
          </button>
          <span className="text-[10px] text-muted-foreground/60">
            {stages.length} de {MAX_STAGES} etapas máximo
          </span>
        </div>
      </div>

      {/* Visual pill chain */}
      <div className="flex items-center gap-1 flex-wrap">
        {/* First stage */}
        <input
          type="text"
          value={stages[0] ?? ''}
          onChange={(e) => updateEdge('first', e.target.value)}
          maxLength={30}
          className="rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary outline-none focus:ring-1 focus:ring-primary/30 transition-colors w-36"
        />

        {middleStages.map((stage, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="text-muted-foreground/40 text-xs select-none">→</span>
            <div className="relative flex items-center group">
              <input
                type="text"
                value={stage}
                onChange={(e) => updateMiddle(i, e.target.value)}
                maxLength={30}
                className="rounded-md border border-border bg-muted/30 px-2.5 py-1 text-xs text-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors w-36"
              />
              {canRemove && (
                <button
                  type="button"
                  onClick={() => removeStage(i)}
                  className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition-opacity flex h-4 w-4 items-center justify-center rounded-full bg-destructive/80 text-destructive-foreground hover:bg-destructive"
                  title="Eliminar etapa"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Add stage button */}
        {canAdd && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground/40 text-xs select-none">→</span>
            <button
              type="button"
              onClick={addStage}
              className="rounded-md border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />
              Agregar
            </button>
          </div>
        )}

        {/* Arrow to last stage */}
        <span className="text-muted-foreground/40 text-xs select-none">→</span>

        {/* Last stage */}
        <input
          type="text"
          value={stages[stages.length - 1] ?? ''}
          onChange={(e) => updateEdge('last', e.target.value)}
          maxLength={30}
          className="rounded-md border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-400 outline-none focus:ring-1 focus:ring-emerald-400/30 transition-colors w-36"
        />
      </div>

      {!canAdd && (
        <p className="text-[10px] text-muted-foreground/50">
          Has alcanzado el máximo de {MAX_STAGES} etapas.
        </p>
      )}
    </div>
  )
}
