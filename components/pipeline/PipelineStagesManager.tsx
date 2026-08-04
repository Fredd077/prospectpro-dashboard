'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Settings2, GripVertical, Trash2, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getPipelineStages,
  createPipelineStage,
  renamePipelineStage,
  deletePipelineStage,
  reorderPipelineStages,
  type PipelineStageOption,
} from '@/lib/actions/pipeline-stages'

interface Props {
  stages: PipelineStageOption[]
}

interface Item {
  id: string
  name: string
}

// Gestor de etapas del Pipeline: engranaje junto al filtro "Etapa" que abre un
// modal para renombrar (inline), eliminar, agregar y reordenar (drag & drop
// nativo). Estética Tactical Command Center: fondo oscuro, bordes sutiles,
// acento cyan en estados activos.
export function PipelineStagesManager({ stages }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  async function openModal() {
    setItems(stages.map((s) => ({ id: s.id, name: s.name })))
    setNewName('')
    setOpen(true)

    // Solo si el usuario no tiene ninguna etapa: getPipelineStages siembra las 5
    // canónicas y devuelve esa lista, así nunca ve el gestor vacío. Si ya tiene
    // etapas se respeta su lista tal cual —incluido haber borrado alguna canónica.
    if (stages.length === 0) {
      setBusy(true)
      try {
        const fresh = await getPipelineStages()
        setItems(fresh.map((s) => ({ id: s.id, name: s.name })))
        // El tablero deja de usar el respaldo y pasa a las etapas reales.
        if (fresh.length > 0) router.refresh()
      } catch {
        toast.error('No se pudieron cargar las etapas')
      } finally {
        setBusy(false)
      }
    }
  }

  // Recarga ids reales desde el servidor tras crear/eliminar/reordenar.
  async function reseed() {
    const fresh = await getPipelineStages()
    setItems(fresh.map((s) => ({ id: s.id, name: s.name })))
  }

  async function handleRename(item: Item, value: string) {
    const trimmed = value.trim()
    if (!trimmed || trimmed === item.name) {
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, name: item.name } : it)))
      return
    }
    setBusy(true)
    try {
      await renamePipelineStage(item.id, trimmed)
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, name: trimmed } : it)))
      toast.success('Etapa renombrada ✓')
      router.refresh()
    } catch (e) {
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, name: item.name } : it)))
      toast.error(e instanceof Error ? e.message : 'Error al renombrar')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(item: Item) {
    setBusy(true)
    try {
      await deletePipelineStage(item.id)
      toast.success('Etapa eliminada ✓')
      await reseed()
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar')
    } finally {
      setBusy(false)
    }
  }

  async function handleAdd() {
    const trimmed = newName.trim()
    if (!trimmed) return
    setBusy(true)
    try {
      await createPipelineStage(trimmed)
      setNewName('')
      toast.success('Etapa agregada ✓')
      await reseed()
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al agregar')
    } finally {
      setBusy(false)
    }
  }

  async function handleDrop(targetIndex: number) {
    const from = dragIndex
    setDragIndex(null)
    setOverIndex(null)
    if (from === null || from === targetIndex) return

    const reordered = [...items]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(targetIndex, 0, moved)
    setItems(reordered)

    setBusy(true)
    try {
      await reorderPipelineStages(reordered.map((it) => it.id))
      router.refresh()
    } catch {
      toast.error('Error al reordenar')
      await reseed()
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60'

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        title="Gestionar etapas"
        aria-label="Gestionar etapas"
        className="ml-1 p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
      >
        <Settings2 className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 className="text-sm font-bold text-foreground mb-1">Gestionar etapas</h2>
            <p className="text-[10px] text-muted-foreground mb-4">
              Renombra, elimina, agrega o arrastra para reordenar. Solo afecta a tu Pipeline.
            </p>

            {/* Lista de etapas */}
            <div className="space-y-1.5 mb-4">
              {items.map((item, i) => (
                <div
                  key={item.id}
                  draggable={!busy}
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={(e) => { e.preventDefault(); setOverIndex(i) }}
                  onDrop={() => handleDrop(i)}
                  onDragEnd={() => { setDragIndex(null); setOverIndex(null) }}
                  className={cn(
                    'flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 transition-colors',
                    overIndex === i && dragIndex !== null ? 'border-primary/60' : 'border-border',
                    dragIndex === i ? 'opacity-50' : '',
                  )}
                >
                  <span className="cursor-grab text-muted-foreground/50 hover:text-muted-foreground" title="Arrastrar para reordenar">
                    <GripVertical className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    defaultValue={item.name}
                    onBlur={(e) => handleRename(item, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur() }
                    }}
                    disabled={busy}
                    className="flex-1 bg-transparent text-sm text-foreground focus:outline-none focus:border-b focus:border-primary/60"
                  />
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    disabled={busy}
                    title="Eliminar etapa"
                    className="p-1 rounded text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {items.length === 0 && (
                <p className="text-[11px] text-muted-foreground/60 text-center py-3 border border-dashed border-border rounded-md">
                  Aún no tienes etapas. Agrega la primera abajo.
                </p>
              )}
            </div>

            {/* Agregar etapa nueva */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
                placeholder="Nueva etapa..."
                disabled={busy}
                className={inputClass}
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={busy || !newName.trim()}
                className="shrink-0 flex items-center gap-1 rounded-md bg-primary/15 border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/25 transition-colors disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" /> Agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
