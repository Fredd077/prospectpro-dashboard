'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ChevronDown, ChevronUp, Plus, Trash2, TrendingUp } from 'lucide-react'
import { savePipelineEntry, deletePipelineEntry } from '@/lib/actions/pipeline'
import { PipelineEntryForm } from './PipelineEntryForm'
import { todayISO } from '@/lib/utils/dates'
import { fmtUSD } from '@/lib/calculations/pipeline'

interface SavedEntry {
  id: string
  stage: string
  prospect_type: 'OUTBOUND' | 'INBOUND'
  company_name: string
  prospect_name: string
  quantity: number
  amount_usd: number | null
}

interface CheckinPipelineSectionProps {
  stages: string[]
  scenarioId?: string | null
  /** Date being checked-in (for pre-filling the form) */
  date: string
}

export function CheckinPipelineSection({ stages, scenarioId, date }: CheckinPipelineSectionProps) {
  const [expanded, setExpanded]     = useState(false)
  const [showForm, setShowForm]     = useState(false)
  const [saved, setSaved]           = useState<SavedEntry[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)

  if (stages.length <= 1) return null

  async function handleSaved(id: string, prospectType: 'OUTBOUND' | 'INBOUND') {
    setShowForm(false)
    setSaved((prev) => [
      ...prev,
      { id, stage: '…', prospect_type: prospectType, company_name: '…', prospect_name: '…', quantity: 1, amount_usd: null },
    ])
    toast.success('Movimiento registrado ✓')
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await deletePipelineEntry(id)
      setSaved((prev) => prev.filter((e) => e.id !== id))
    } catch {
      toast.error('Error al eliminar')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card/50">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">¿Avanzaste en tu pipeline hoy?</span>
          {saved.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {saved.length} registrado{saved.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border/50 px-4 pb-4 pt-3 space-y-3">
          {/* Saved entries */}
          {saved.length > 0 && (
            <div className="space-y-1.5">
              {saved.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-md bg-muted/20 border border-border/50 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary shrink-0">
                      {e.stage}
                    </span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold shrink-0 ${
                      e.prospect_type === 'OUTBOUND'
                        ? 'bg-cyan-400/10 text-cyan-400'
                        : 'bg-purple-400/10 text-purple-400'
                    }`}>
                      {e.prospect_type}
                    </span>
                    <span className="text-foreground/80 truncate">{e.company_name} — {e.prospect_name}</span>
                    {e.amount_usd != null && (
                      <span className="text-emerald-400 shrink-0">{fmtUSD(e.amount_usd)}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(e.id)}
                    disabled={deletingId === e.id}
                    className="ml-2 shrink-0 text-muted-foreground hover:text-red-400 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Quick-add form */}
          {showForm ? (
            <div className="rounded-lg border border-border bg-background p-4">
              <PipelineEntryForm
                stages={stages}
                scenarioId={scenarioId}
                onSaved={handleSaved}
                onCancel={() => setShowForm(false)}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors w-full justify-center"
            >
              <Plus className="h-3.5 w-3.5" />
              Registrar movimiento en el funnel
            </button>
          )}

          <p className="text-[10px] text-muted-foreground/60 text-center">
            Esta sección es opcional — no afecta el guardado del check-in.
          </p>
        </div>
      )}
    </div>
  )
}
