'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Trash2, X, Check } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { deletePipelineEntry } from '@/lib/actions/pipeline'
import { PipelineEntryForm } from './PipelineEntryForm'
import type { PipelineEntry } from '@/lib/types/database'
import { fmtUSD } from '@/lib/calculations/pipeline'
import { cn } from '@/lib/utils'

interface PipelineEntriesTableProps {
  entries: PipelineEntry[]
  stages: string[]
  scenarioId?: string | null
  stageFilter?: string
}

function groupByDate(entries: PipelineEntry[]) {
  const groups: Record<string, PipelineEntry[]> = {}
  for (const e of entries) {
    if (!groups[e.entry_date]) groups[e.entry_date] = []
    groups[e.entry_date].push(e)
  }
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
}

export function PipelineEntriesTable({ entries, stages, scenarioId, stageFilter }: PipelineEntriesTableProps) {
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [deletingId, setDeletingId]   = useState<string | null>(null)

  const filtered = stageFilter
    ? entries.filter((e) => e.stage === stageFilter)
    : entries

  if (filtered.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/50 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          {stageFilter
            ? `No hay registros para la etapa "${stageFilter}" en este período.`
            : 'Registra tu primer avance en el pipeline.'}
        </p>
      </div>
    )
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await deletePipelineEntry(id)
      toast.success('Registro eliminado')
    } catch {
      toast.error('Error al eliminar')
    } finally {
      setDeletingId(null)
    }
  }

  const grouped = groupByDate(filtered)

  return (
    <div className="space-y-4">
      {grouped.map(([date, dateEntries]) => (
        <div key={date}>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">
            {format(parseISO(date), "EEEE d 'de' MMMM", { locale: es })}
          </p>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Etapa</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Empresa</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Prospecto</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cant.</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Monto</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {dateEntries.map((entry) => (
                  editingId === entry.id ? (
                    <tr key={entry.id}>
                      <td colSpan={6} className="px-4 py-4">
                        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-semibold text-primary">Editando registro</p>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <PipelineEntryForm
                            stages={stages}
                            scenarioId={scenarioId}
                            editEntry={entry}
                            onSaved={() => setEditingId(null)}
                            onCancel={() => setEditingId(null)}
                          />
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={entry.id} className="hover:bg-muted/10 transition-colors group">
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {entry.stage}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="text-xs font-medium text-foreground">{entry.company_name}</p>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-foreground/80">{entry.prospect_name}</td>
                      <td className="px-4 py-2.5 text-right text-xs font-data text-foreground">{entry.quantity}</td>
                      <td className="px-4 py-2.5 text-right text-xs font-data text-foreground">
                        {entry.amount_usd != null ? fmtUSD(entry.amount_usd) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditingId(entry.id)}
                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            disabled={deletingId === entry.id}
                            className="p-1 rounded text-muted-foreground hover:text-red-400 hover:bg-red-400/10 disabled:opacity-50"
                            title="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
