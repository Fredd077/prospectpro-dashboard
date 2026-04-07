'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Trash2, X } from 'lucide-react'
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

// ── Summary tab ──────────────────────────────────────────────────────────────

interface DailyStageSummary {
  date: string
  stage: string
  outbound: number
  inbound: number
  total: number
  amount: number | null
}

function buildSummary(entries: PipelineEntry[]): DailyStageSummary[] {
  const map: Record<string, DailyStageSummary> = {}
  for (const e of entries) {
    const key = `${e.entry_date}||${e.stage}`
    if (!map[key]) {
      map[key] = { date: e.entry_date, stage: e.stage, outbound: 0, inbound: 0, total: 0, amount: null }
    }
    const row = map[key]
    if (e.prospect_type === 'OUTBOUND') row.outbound += e.quantity
    else row.inbound += e.quantity
    row.total += e.quantity
    if (e.amount_usd != null) row.amount = (row.amount ?? 0) + e.amount_usd
  }
  return Object.values(map).sort((a, b) =>
    b.date.localeCompare(a.date) || a.stage.localeCompare(b.stage)
  )
}

function groupByDate<T extends { date: string }>(rows: T[]) {
  const groups: Record<string, T[]> = {}
  for (const r of rows) {
    if (!groups[r.date]) groups[r.date] = []
    groups[r.date].push(r)
  }
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
}

function groupEntriesByDate(entries: PipelineEntry[]) {
  const groups: Record<string, PipelineEntry[]> = {}
  for (const e of entries) {
    if (!groups[e.entry_date]) groups[e.entry_date] = []
    groups[e.entry_date].push(e)
  }
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
}

// ── Component ────────────────────────────────────────────────────────────────

export function PipelineEntriesTable({ entries, stages, scenarioId, stageFilter }: PipelineEntriesTableProps) {
  const [tab, setTab] = useState<'summary' | 'detail'>('summary')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

  const detailEntries = filtered.filter((e) => e.company_name != null)

  return (
    <div className="space-y-3">
      {/* Tab switcher */}
      <div className="flex rounded-md border border-border overflow-hidden w-fit">
        {[
          { value: 'summary', label: 'Resumen' },
          { value: 'detail',  label: `Detalle por empresa${detailEntries.length > 0 ? ` (${detailEntries.length})` : ''}` },
        ].map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value as 'summary' | 'detail')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium transition-colors border-r border-border last:border-r-0',
              tab === value
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Summary tab */}
      {tab === 'summary' && (
        <SummaryTab entries={filtered} />
      )}

      {/* Detail tab */}
      {tab === 'detail' && (
        <DetailTab
          entries={detailEntries}
          stages={stages}
          scenarioId={scenarioId}
          editingId={editingId}
          deletingId={deletingId}
          setEditingId={setEditingId}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}

// ── Summary tab component ─────────────────────────────────────────────────────

function SummaryTab({ entries }: { entries: PipelineEntry[] }) {
  const summary = buildSummary(entries)
  const grouped = groupByDate(summary)

  return (
    <div className="space-y-4">
      {grouped.map(([date, rows]) => (
        <div key={date}>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">
            {format(parseISO(date), "EEEE d 'de' MMMM", { locale: es })}
          </p>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Etapa</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-cyan-400/70">OUT</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-purple-400/70">IN</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {rows.map((row) => (
                  <tr key={`${row.date}-${row.stage}`} className="hover:bg-muted/10">
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        {row.stage}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs font-semibold tabular-nums text-cyan-400">
                      {row.outbound > 0 ? row.outbound : <span className="text-muted-foreground/30">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs font-semibold tabular-nums text-purple-400">
                      {row.inbound > 0 ? row.inbound : <span className="text-muted-foreground/30">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs font-semibold tabular-nums text-foreground">
                      {row.total}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums text-foreground">
                      {row.amount != null ? fmtUSD(row.amount) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Detail tab component ──────────────────────────────────────────────────────

interface DetailTabProps {
  entries: PipelineEntry[]
  stages: string[]
  scenarioId?: string | null
  editingId: string | null
  deletingId: string | null
  setEditingId: (id: string | null) => void
  onDelete: (id: string) => void
}

function DetailTab({ entries, stages, scenarioId, editingId, deletingId, setEditingId, onDelete }: DetailTabProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/50 py-10 text-center">
        <p className="text-sm text-muted-foreground">No hay registros con detalle de empresa en este período.</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Usa &ldquo;+ Agregar detalle por empresa&rdquo; al registrar avances.</p>
      </div>
    )
  }

  const grouped = groupEntriesByDate(entries)

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
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Empresa</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Monto</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {dateEntries.map((entry) =>
                  editingId === entry.id ? (
                    <tr key={entry.id}>
                      <td colSpan={5} className="px-4 py-4">
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
                        <span className={cn(
                          'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold',
                          entry.prospect_type === 'OUTBOUND'
                            ? 'bg-cyan-400/10 text-cyan-400 border-cyan-400/20'
                            : 'bg-purple-400/10 text-purple-400 border-purple-400/20'
                        )}>
                          {entry.prospect_type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="text-xs font-medium text-foreground">{entry.company_name ?? '—'}</p>
                        {entry.prospect_name && (
                          <p className="text-[10px] text-muted-foreground/70">{entry.prospect_name}</p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs font-data text-foreground">
                        {entry.amount_usd != null ? fmtUSD(entry.amount_usd) : <span className="text-muted-foreground/40">—</span>}
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
                            onClick={() => onDelete(entry.id)}
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
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
