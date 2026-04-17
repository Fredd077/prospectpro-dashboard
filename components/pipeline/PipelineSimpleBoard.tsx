'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtUSD } from '@/lib/calculations/pipeline'
import { DatePickerInput } from '@/components/ui/DatePickerInput'
import { todayISO } from '@/lib/utils/dates'
import {
  createPipelineSimple,
  updatePipelineSimple,
  deletePipelineSimple,
} from '@/lib/actions/pipeline-simple'
import type { PipelineSimple } from '@/lib/types/database'

const STAGES = ['Reunión', 'Propuesta', 'Cierre'] as const
type Stage = (typeof STAGES)[number]

// ── Stage config ──────────────────────────────────────────────────────────────

const STAGE_COLOR: Record<Stage, { border: string; label: string; badge: string }> = {
  'Reunión':  { border: 'border-t-cyan-500/50',    label: 'text-cyan-400',    badge: 'bg-cyan-400/10 text-cyan-400'    },
  'Propuesta':{ border: 'border-t-amber-500/50',   label: 'text-amber-400',   badge: 'bg-amber-400/10 text-amber-400'  },
  'Cierre':   { border: 'border-t-emerald-500/50', label: 'text-emerald-400', badge: 'bg-emerald-400/10 text-emerald-400' },
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 border-t-2 border-t-primary/40">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className="text-xl font-bold tabular-nums text-primary">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Entry card ────────────────────────────────────────────────────────────────

function EntryCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: PipelineSimple
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2 hover:border-primary/30 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-muted-foreground">
          {format(parseISO(entry.entry_date), 'd MMM', { locale: es })}
        </span>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
            title="Editar"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded text-muted-foreground hover:text-red-400 transition-colors"
            title="Eliminar"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {(entry.company_name || entry.prospect_name) && (
        <div>
          {entry.company_name && (
            <p className="text-xs font-semibold text-foreground truncate">{entry.company_name}</p>
          )}
          {entry.prospect_name && (
            <p className="text-[10px] text-muted-foreground truncate">{entry.prospect_name}</p>
          )}
        </div>
      )}

      {entry.amount_usd != null && (
        <p className="text-sm font-bold text-emerald-400">{fmtUSD(entry.amount_usd)}</p>
      )}

      {entry.notes && (
        <p className="text-[10px] text-muted-foreground/70 italic line-clamp-2">{entry.notes}</p>
      )}
    </div>
  )
}

// ── Modal overlay ─────────────────────────────────────────────────────────────

function ModalOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {children}
    </div>
  )
}

// ── PipelineSimpleBoard ───────────────────────────────────────────────────────

interface PipelineSimpleBoardProps {
  entries: PipelineSimple[]
  periodLabel: string
}

export function PipelineSimpleBoard({ entries, periodLabel }: PipelineSimpleBoardProps) {
  const router = useRouter()
  const today = todayISO()

  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingEntry, setEditingEntry] = useState<PipelineSimple | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Form state
  const [formStage, setFormStage]       = useState<Stage>('Reunión')
  const [formDate, setFormDate]         = useState(today)
  const [formCompany, setFormCompany]   = useState('')
  const [formProspect, setFormProspect] = useState('')
  const [formAmount, setFormAmount]     = useState('')
  const [formNotes, setFormNotes]       = useState('')

  // Derived metrics
  const totalValue = entries.reduce((s, e) => s + (e.amount_usd ?? 0), 0)
  const stageCount = STAGES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = entries.filter((e) => e.stage === s).length
    return acc
  }, {})

  // ── Helpers ───────────────────────────────────────────────────────────────

  function openCreate(stage: Stage = 'Reunión') {
    setEditingEntry(null)
    setFormStage(stage)
    setFormDate(today)
    setFormCompany('')
    setFormProspect('')
    setFormAmount('')
    setFormNotes('')
    setShowForm(true)
  }

  function openEdit(entry: PipelineSimple) {
    setEditingEntry(entry)
    setFormStage(entry.stage)
    setFormDate(entry.entry_date)
    setFormCompany(entry.company_name ?? '')
    setFormProspect(entry.prospect_name ?? '')
    setFormAmount(entry.amount_usd != null ? String(entry.amount_usd) : '')
    setFormNotes(entry.notes ?? '')
    setShowForm(true)
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        stage:         formStage,
        entry_date:    formDate,
        company_name:  formCompany.trim() || null,
        prospect_name: formProspect.trim() || null,
        amount_usd:    formAmount ? Number(formAmount) : null,
        notes:         formNotes.trim() || null,
      }
      if (editingEntry) {
        await updatePipelineSimple(editingEntry.id, payload)
        toast.success('Entrada actualizada ✓')
      } else {
        await createPipelineSimple(payload)
        toast.success('Entrada creada ✓')
      }
      setShowForm(false)
      router.refresh()
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setSaving(true)
    try {
      await deletePipelineSimple(id)
      toast.success('Entrada eliminada')
      setDeletingId(null)
      router.refresh()
    } catch {
      toast.error('Error al eliminar')
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60'
  const labelClass =
    'block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1'
  const cancelBtnClass =
    'flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors'

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative">
      {/* Metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Total entradas"     value={String(entries.length)}    sub={periodLabel} />
        <MetricCard label="Reuniones"          value={String(stageCount['Reunión'] ?? 0)} />
        <MetricCard label="Propuestas"         value={String(stageCount['Propuesta'] ?? 0)} />
        <MetricCard label="Pipeline estimado"  value={fmtUSD(totalValue)}        sub={periodLabel} />
      </div>

      {/* Kanban columns */}
      <div className="flex gap-4 overflow-x-auto pb-6">
        {STAGES.map((stage) => {
          const col = STAGE_COLOR[stage]
          const stageEntries = entries.filter((e) => e.stage === stage)
          return (
            <div key={stage} className="flex flex-col gap-3 min-w-[240px] max-w-[240px]">
              {/* Column header */}
              <div className="flex items-center gap-2 mb-2">
                <span className={cn('text-xs font-bold uppercase tracking-widest', col.label)}>
                  {stage}
                </span>
                <span className={cn('text-[10px] font-bold rounded-full px-2 py-0.5 min-w-[20px] text-center', col.badge)}>
                  {stageEntries.length}
                </span>
                <button
                  onClick={() => openCreate(stage)}
                  className="ml-auto text-[10px] text-muted-foreground hover:text-primary transition-colors px-1.5 py-0.5 rounded hover:bg-primary/10"
                  title={`Agregar a ${stage}`}
                >
                  + Nuevo
                </button>
              </div>

              {/* Cards */}
              {stageEntries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  onEdit={() => openEdit(entry)}
                  onDelete={() => setDeletingId(entry.id)}
                />
              ))}

              {stageEntries.length === 0 && (
                <p className="text-[10px] text-muted-foreground/40 text-center py-4 border border-dashed border-border rounded-lg">
                  Sin entradas
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* FAB */}
      <button
        onClick={() => openCreate()}
        className="fixed bottom-20 right-20 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_0_20px_rgba(0,217,255,0.3)] hover:opacity-90 transition-all"
      >
        + Nueva entrada
      </button>

      {/* ── Modal: Create / Edit ─────────────────────────────────────────── */}
      {showForm && (
        <ModalOverlay>
          <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <button
              onClick={() => setShowForm(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground text-lg leading-none"
              aria-label="Cerrar"
            >
              ✕
            </button>
            <h2 className="text-sm font-bold text-foreground mb-5">
              {editingEntry ? 'Editar entrada' : 'Nueva entrada'}
            </h2>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {/* Etapa */}
                <div>
                  <label className={labelClass}>Etapa *</label>
                  <select
                    value={formStage}
                    onChange={(e) => setFormStage(e.target.value as Stage)}
                    className={inputClass}
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                {/* Fecha */}
                <div>
                  <label className={labelClass}>Fecha *</label>
                  <DatePickerInput
                    value={formDate}
                    onChange={(d) => setFormDate(d)}
                    max={today}
                  />
                </div>
              </div>

              {/* Empresa */}
              <div>
                <label className={labelClass}>Empresa</label>
                <input
                  type="text"
                  value={formCompany}
                  onChange={(e) => setFormCompany(e.target.value)}
                  placeholder="Nombre de empresa..."
                  className={inputClass}
                />
              </div>

              {/* Prospecto */}
              <div>
                <label className={labelClass}>Prospecto</label>
                <input
                  type="text"
                  value={formProspect}
                  onChange={(e) => setFormProspect(e.target.value)}
                  placeholder="Nombre del prospecto..."
                  className={inputClass}
                />
              </div>

              {/* Monto */}
              <div>
                <label className={labelClass}>Monto estimado (USD)</label>
                <input
                  type="number"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="0"
                  min={0}
                  className={inputClass}
                />
              </div>

              {/* Notas */}
              <div>
                <label className={labelClass}>Notas</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Notas adicionales..."
                  rows={2}
                  className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowForm(false)} className={cancelBtnClass}>
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-lg bg-primary/15 border border-primary/30 py-2 text-sm font-semibold text-primary hover:bg-primary/25 transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando...' : editingEntry ? 'Guardar cambios' : 'Crear entrada'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal: Delete confirm ────────────────────────────────────────── */}
      {deletingId && (
        <ModalOverlay>
          <div className="relative w-full max-w-sm rounded-xl border border-red-500/30 bg-card p-6 shadow-2xl">
            <h2 className="text-sm font-bold text-red-400 mb-2">¿Eliminar entrada?</h2>
            <p className="text-xs text-muted-foreground mb-5">Esta acción no se puede deshacer.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeletingId(null)} className={cancelBtnClass}>
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                disabled={saving}
                className="flex-1 rounded-lg bg-red-500/20 border border-red-500/30 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
              >
                {saving ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  )
}
