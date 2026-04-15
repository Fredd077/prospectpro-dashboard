'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtUSD } from '@/lib/calculations/pipeline'
import { DatePickerInput } from '@/components/ui/DatePickerInput'
import { todayISO } from '@/lib/utils/dates'
import {
  createDeal,
  advanceDeal,
  closeDealWon,
  closeDealLost,
  updateDeal,
} from '@/lib/actions/deals'
import type { PipelineEntry } from '@/lib/types/database'
import type { PeriodType } from '@/lib/types/common'

interface KanbanBoardProps {
  activeDeals: PipelineEntry[]
  closedDeals: PipelineEntry[]
  stages: string[]
  scenarioId: string | null
  period: PeriodType
  periodLabel: string
}

// ── Metric card ───────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string
  value: string
  accent: 'primary' | 'emerald' | 'red'
}

function MetricCard({ label, value, accent }: MetricCardProps) {
  const borderClass =
    accent === 'primary'
      ? 'border-t-primary/50'
      : accent === 'emerald'
        ? 'border-t-emerald-500/50'
        : 'border-t-red-500/50'
  const valueClass =
    accent === 'primary'
      ? 'text-primary'
      : accent === 'emerald'
        ? 'text-emerald-400'
        : 'text-red-400'
  return (
    <div className={cn('rounded-lg border border-border bg-card p-4 border-t-2', borderClass)}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </p>
      <p className={cn('text-xl font-bold tabular-nums', valueClass)}>{value}</p>
    </div>
  )
}

// ── Deal card ─────────────────────────────────────────────────────────────────

interface DealCardProps {
  deal: PipelineEntry
  isLastStage: boolean
  onAdvance: () => void
  onWin: () => void
  onLose: () => void
  onEdit: () => void
}

function DealCard({ deal, isLastStage, onAdvance, onWin, onLose, onEdit }: DealCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2.5 hover:border-primary/30 transition-colors cursor-default">
      {/* Row 0: stage tag + date */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-bold uppercase tracking-widest rounded px-1.5 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/30">
          {deal.stage}
        </span>
        <span className="text-[9px] text-muted-foreground">
          {format(parseISO(deal.entry_date), 'd MMM', { locale: es })}
        </span>
      </div>

      {/* Row 1: type badge */}
      <div>
        <span className={cn(
          'text-[9px] font-bold rounded-full border px-1.5 py-0.5',
          deal.prospect_type === 'OUTBOUND'
            ? 'bg-cyan-400/10 text-cyan-400 border-cyan-400/20'
            : 'bg-purple-400/10 text-purple-400 border-purple-400/20'
        )}>
          {deal.prospect_type}
        </span>
      </div>

      {/* Row 2: company / prospect */}
      {(deal.company_name || deal.prospect_name) && (
        <div>
          {deal.company_name && (
            <p className="text-xs font-semibold text-foreground truncate">{deal.company_name}</p>
          )}
          {deal.prospect_name && (
            <p className="text-[10px] text-muted-foreground truncate">{deal.prospect_name}</p>
          )}
        </div>
      )}

      {/* Row 3: amount */}
      {deal.amount_usd != null && (
        <p className="text-sm font-bold font-data text-emerald-400">
          {fmtUSD(deal.amount_usd)}
        </p>
      )}

      {/* Row 4: action buttons */}
      <div className="flex gap-1.5 pt-1">
        <button
          onClick={onEdit}
          className="rounded px-2 py-1 text-[10px] font-semibold bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          title="Editar trato"
        >
          <Pencil className="h-3 w-3" />
        </button>
        {isLastStage ? (
          <button
            onClick={onWin}
            className="flex-1 rounded py-1 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
          >
            🏆 Ganado
          </button>
        ) : (
          <button
            onClick={onAdvance}
            className="flex-1 rounded py-1 text-[10px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            → Avanzar
          </button>
        )}
        <button
          onClick={onLose}
          className="rounded px-2 py-1 text-[10px] font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
        >
          ✗
        </button>
      </div>
    </div>
  )
}

// ── Modal overlay wrapper ─────────────────────────────────────────────────────

function ModalOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {children}
    </div>
  )
}

// ── KanbanBoard ───────────────────────────────────────────────────────────────

export function KanbanBoard({
  activeDeals,
  closedDeals,
  stages,
  scenarioId,
  period: _period,
  periodLabel,
}: KanbanBoardProps) {
  void _period
  const router = useRouter()
  const today = todayISO()
  // 'Actividad' se registra via Check-in, no en deals — excluirla del Kanban.
  // Si el funnel del usuario no empieza con 'Actividad', mostrar todos los stages.
  const kanbanStages = stages[0]?.toLowerCase() === 'actividad' ? stages.slice(1) : stages
  const lastStage = stages[stages.length - 1]

  // Modal open/close state
  const [showNewDeal, setShowNewDeal] = useState(false)
  const [advancingDeal, setAdvancingDeal] = useState<PipelineEntry | null>(null)
  const [losingDeal, setLosingDeal] = useState<PipelineEntry | null>(null)
  const [winningDeal, setWinningDeal] = useState<PipelineEntry | null>(null)
  const [editingDeal, setEditingDeal] = useState<PipelineEntry | null>(null)
  const [saving, setSaving] = useState(false)

  // Edit deal form state
  const [editCompany, setEditCompany] = useState('')
  const [editProspect, setEditProspect] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editType, setEditType] = useState<'OUTBOUND' | 'INBOUND'>('OUTBOUND')
  const [editDate, setEditDate] = useState(today)
  const [editStage, setEditStage] = useState('')

  // New deal form state
  const [newStage, setNewStage] = useState(kanbanStages[0] ?? '')
  const [newType, setNewType] = useState<'OUTBOUND' | 'INBOUND'>('OUTBOUND')
  const [newDate, setNewDate] = useState(today)
  const [newCompany, setNewCompany] = useState('')
  const [newProspect, setNewProspect] = useState('')
  const [newAmount, setNewAmount] = useState('')

  // Advance form state
  const [advanceDate, setAdvanceDate] = useState(today)

  // Win form state
  const [winAmount, setWinAmount] = useState('')
  const [winDate, setWinDate] = useState(today)

  // Lose form state
  const [lostReason, setLostReason] = useState('')

  // Derived metrics
  const wonDeals  = closedDeals.filter((d) => d.stage === 'Ganado')
  const lostDeals = closedDeals.filter((d) => d.stage === 'Perdido')
  const openPipeline = activeDeals.reduce((sum, d) => sum + (d.amount_usd ?? 0), 0)

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleCreateDeal() {
    setSaving(true)
    try {
      await createDeal({
        company_name:       newCompany.trim() || null,
        prospect_name:      newProspect.trim() || null,
        prospect_type:      newType,
        initial_stage:      newStage,
        amount_usd:         newAmount ? Number(newAmount) : null,
        recipe_scenario_id: scenarioId,
        entry_date:         newDate,
      })
      toast.success('Trato creado ✓')
      setShowNewDeal(false)
      setNewCompany('')
      setNewProspect('')
      setNewAmount('')
      setNewDate(today)
      router.refresh()
    } catch {
      toast.error('Error al crear el trato')
    } finally {
      setSaving(false)
    }
  }

  async function handleAdvanceDeal() {
    if (!advancingDeal) return
    const nextIndex = stages.indexOf(advancingDeal.stage) + 1
    const nextStage = stages[nextIndex]
    if (!nextStage) return
    setSaving(true)
    try {
      await advanceDeal(advancingDeal.id, nextStage, advanceDate)
      toast.success(`Trato avanzado a ${nextStage} ✓`)
      setAdvancingDeal(null)
      router.refresh()
    } catch {
      toast.error('Error al avanzar el trato')
    } finally {
      setSaving(false)
    }
  }

  async function handleWinDeal() {
    if (!winningDeal) return
    setSaving(true)
    try {
      await closeDealWon(
        winningDeal.id,
        winAmount ? Number(winAmount) : null,
        winDate,
      )
      toast.success('¡Trato cerrado! 🏆')
      setWinningDeal(null)
      router.refresh()
    } catch {
      toast.error('Error al cerrar el trato')
    } finally {
      setSaving(false)
    }
  }

  async function handleLoseDeal() {
    if (!losingDeal) return
    setSaving(true)
    try {
      await closeDealLost(losingDeal.id, lostReason.trim() || null, today)
      toast.success('Trato marcado como perdido')
      setLosingDeal(null)
      setLostReason('')
      router.refresh()
    } catch {
      toast.error('Error al actualizar el trato')
    } finally {
      setSaving(false)
    }
  }

  async function handleEditDeal() {
    if (!editingDeal) return
    setSaving(true)
    try {
      // Nota: cambiar stage aquí es una corrección directa.
      // No registra pipeline_entry — usar advanceDeal() para movimientos reales.
      await updateDeal(editingDeal.id, {
        company_name:  editCompany.trim() || null,
        prospect_name: editProspect.trim() || null,
        amount_usd:    editAmount ? Number(editAmount) : null,
        prospect_type: editType,
        entry_date:    editDate,
        stage:         editStage,
      })
      toast.success('Trato actualizado ✓')
      setEditingDeal(null)
      router.refresh()
    } catch {
      toast.error('Error al actualizar el trato')
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
        <MetricCard label="Tratos activos"                   value={String(activeDeals.length)} accent="primary" />
        <MetricCard label={`Ganados · ${periodLabel}`}  value={String(wonDeals.length)}  accent="emerald" />
        <MetricCard label={`Perdidos · ${periodLabel}`} value={String(lostDeals.length)} accent="red"     />
        <MetricCard label="Pipeline abierto"                 value={fmtUSD(openPipeline)}       accent="primary" />
      </div>

      {/* Kanban board */}
      <div className="flex gap-4 overflow-x-auto pb-6">

        {/* Active stage columns */}
        {kanbanStages.map((stage) => {
          const stageDeals = activeDeals.filter((d) => d.stage === stage)
          const stageCount = stageDeals.length
          return (
            <div key={stage} className="flex flex-col gap-3 min-w-[220px] max-w-[220px]">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {stage}
                </span>
                <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-primary/10 text-primary min-w-[20px] text-center">
                  {stageCount}
                </span>
              </div>
              {stageDeals.map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  isLastStage={deal.stage === lastStage}
                  onAdvance={() => { setAdvanceDate(today); setAdvancingDeal(deal) }}
                  onWin={() => {
                    setWinAmount(deal.amount_usd != null ? String(deal.amount_usd) : '')
                    setWinDate(today)
                    setWinningDeal(deal)
                  }}
                  onLose={() => { setLostReason(''); setLosingDeal(deal) }}
                  onEdit={() => {
                    setEditCompany(deal.company_name ?? '')
                    setEditProspect(deal.prospect_name ?? '')
                    setEditAmount(deal.amount_usd != null ? String(deal.amount_usd) : '')
                    setEditType(deal.prospect_type)
                    setEditDate(deal.entry_date)
                    setEditStage(deal.stage)
                    setEditingDeal(deal)
                  }}
                />
              ))}
            </div>
          )
        })}

        {/* Won column — read only */}
        <div className="flex flex-col gap-3 min-w-[220px] max-w-[220px]">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              🏆 Ganados
            </span>
            <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-emerald-500/10 text-emerald-400 min-w-[20px] text-center">
              {wonDeals.length}
            </span>
          </div>
          {wonDeals.map((deal) => (
            <div key={deal.id} className="rounded-lg border border-emerald-500/20 bg-card p-3 space-y-1.5">
              {deal.company_name && (
                <p className="text-xs font-semibold text-foreground truncate">{deal.company_name}</p>
              )}
              {!deal.company_name && deal.prospect_name && (
                <p className="text-xs font-semibold text-foreground truncate">{deal.prospect_name}</p>
              )}
              {deal.amount_usd != null && (
                <p className="text-sm font-bold font-data text-emerald-400">{fmtUSD(deal.amount_usd)}</p>
              )}
              <p className="text-[10px] text-muted-foreground">
                {format(parseISO(deal.updated_at), 'd MMM', { locale: es })}
              </p>
            </div>
          ))}
        </div>

        {/* Lost column — read only */}
        <div className="flex flex-col gap-3 min-w-[220px] max-w-[220px]">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-widest text-red-400">
              ✗ Perdidos
            </span>
            <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-red-500/10 text-red-400 min-w-[20px] text-center">
              {lostDeals.length}
            </span>
          </div>
          {lostDeals.map((deal) => (
            <div key={deal.id} className="rounded-lg border border-red-500/20 bg-card p-3 space-y-1.5">
              {deal.company_name && (
                <p className="text-xs font-semibold text-foreground truncate">{deal.company_name}</p>
              )}
              {!deal.company_name && deal.prospect_name && (
                <p className="text-xs font-semibold text-foreground truncate">{deal.prospect_name}</p>
              )}
              <p className="text-[10px] text-muted-foreground">
                Se perdió en: {deal.from_stage ?? deal.stage}
              </p>
              {deal.notes && (
                <p className="text-[10px] text-muted-foreground/70 italic">{deal.notes}</p>
              )}
            </div>
          ))}
        </div>

      </div>

      {/* FAB — New Deal */}
      <button
        onClick={() => { setNewStage(kanbanStages[0] ?? ''); setShowNewDeal(true) }}
        className="fixed bottom-20 right-20 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_0_20px_rgba(0,217,255,0.3)] hover:opacity-90 transition-all"
      >
        + Nuevo trato
      </button>

      {/* ── Modal: New Deal ──────────────────────────────────────────────── */}
      {showNewDeal && (
        <ModalOverlay>
          <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <button
              onClick={() => setShowNewDeal(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground text-lg leading-none"
              aria-label="Cerrar"
            >
              ✕
            </button>
            <h2 className="text-sm font-bold text-foreground mb-5">Nuevo trato</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {/* Etapa inicial */}
                <div>
                  <label className={labelClass}>Etapa inicial *</label>
                  <select
                    value={newStage}
                    onChange={(e) => setNewStage(e.target.value)}
                    className={inputClass}
                  >
                    {kanbanStages.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                {/* Tipo */}
                <div>
                  <label className={labelClass}>Tipo *</label>
                  <div className="flex rounded-md border border-border overflow-hidden">
                    {(['OUTBOUND', 'INBOUND'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setNewType(t)}
                        className={cn(
                          'flex-1 py-1.5 text-[11px] font-bold transition-colors',
                          newType === t
                            ? t === 'OUTBOUND'
                              ? 'bg-cyan-400/15 text-cyan-400'
                              : 'bg-purple-400/15 text-purple-400'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Fecha */}
              <div>
                <label className={labelClass}>Fecha *</label>
                <DatePickerInput
                  value={newDate}
                  onChange={(d) => setNewDate(d)}
                  max={today}
                />
              </div>

              {/* Empresa */}
              <div>
                <label className={labelClass}>Empresa</label>
                <input
                  type="text"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  placeholder="Nombre de empresa..."
                  className={inputClass}
                />
              </div>

              {/* Prospecto */}
              <div>
                <label className={labelClass}>Prospecto</label>
                <input
                  type="text"
                  value={newProspect}
                  onChange={(e) => setNewProspect(e.target.value)}
                  placeholder="Nombre del prospecto..."
                  className={inputClass}
                />
              </div>

              {/* Monto */}
              <div>
                <label className={labelClass}>Monto estimado</label>
                <input
                  type="number"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  placeholder="$0"
                  min={0}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowNewDeal(false)} className={cancelBtnClass}>
                Cancelar
              </button>
              <button
                onClick={handleCreateDeal}
                disabled={saving || !newStage}
                className="flex-1 rounded-lg bg-primary/15 border border-primary/30 py-2 text-sm font-semibold text-primary hover:bg-primary/25 transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Crear trato'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal: Advance Deal ─────────────────────────────────────────── */}
      {advancingDeal && (
        <ModalOverlay>
          <div className="relative w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl">
            <button
              onClick={() => setAdvancingDeal(null)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground text-lg leading-none"
              aria-label="Cerrar"
            >
              ✕
            </button>
            <h2 className="text-sm font-bold text-foreground mb-1">Avanzar trato</h2>
            <p className="text-xs text-muted-foreground mb-4">
              {advancingDeal.company_name ?? advancingDeal.prospect_name ?? 'Trato sin nombre'}
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Etapa actual:</span>
                <span className="font-semibold text-foreground">{advancingDeal.stage}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Avanzar a:</span>
                <span className="font-semibold text-primary">
                  {stages[stages.indexOf(advancingDeal.stage) + 1] ?? '—'}
                </span>
              </div>
              <div>
                <label className={labelClass}>Fecha del movimiento</label>
                <input
                  type="date"
                  value={advanceDate}
                  max={today}
                  onChange={(e) => setAdvanceDate(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setAdvancingDeal(null)} className={cancelBtnClass}>
                Cancelar
              </button>
              <button
                onClick={handleAdvanceDeal}
                disabled={saving}
                className="flex-1 rounded-lg bg-primary/15 border border-primary/30 py-2 text-sm font-semibold text-primary hover:bg-primary/25 transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Confirmar avance →'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal: Mark as Won ──────────────────────────────────────────── */}
      {winningDeal && (
        <ModalOverlay>
          <div className="relative w-full max-w-sm rounded-xl border border-emerald-500/30 bg-card p-6 shadow-2xl">
            <button
              onClick={() => setWinningDeal(null)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground text-lg leading-none"
              aria-label="Cerrar"
            >
              ✕
            </button>
            <h2 className="text-sm font-bold text-emerald-400 mb-1">🏆 ¡Trato ganado!</h2>
            <p className="text-xs text-muted-foreground mb-4">
              {winningDeal.company_name ?? winningDeal.prospect_name ?? 'Trato sin nombre'}
            </p>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Monto final (USD)</label>
                <input
                  type="number"
                  value={winAmount}
                  onChange={(e) => setWinAmount(e.target.value)}
                  placeholder="0"
                  min={0}
                  className={cn(inputClass, 'focus:border-emerald-500/60')}
                />
              </div>
              <div>
                <label className={labelClass}>Fecha de cierre</label>
                <input
                  type="date"
                  value={winDate}
                  max={today}
                  onChange={(e) => setWinDate(e.target.value)}
                  className={cn(inputClass, 'focus:border-emerald-500/60')}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setWinningDeal(null)} className={cancelBtnClass}>
                Cancelar
              </button>
              <button
                onClick={handleWinDeal}
                disabled={saving}
                className="flex-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 py-2 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Confirmar cierre 🏆'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal: Mark as Lost ─────────────────────────────────────────── */}
      {losingDeal && (
        <ModalOverlay>
          <div className="relative w-full max-w-sm rounded-xl border border-red-500/30 bg-card p-6 shadow-2xl">
            <button
              onClick={() => setLosingDeal(null)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground text-lg leading-none"
              aria-label="Cerrar"
            >
              ✕
            </button>
            <h2 className="text-sm font-bold text-red-400 mb-1">¿Marcar como perdido?</h2>
            <p className="text-xs text-muted-foreground mb-0.5">
              {losingDeal.company_name ?? losingDeal.prospect_name ?? 'Trato sin nombre'}
            </p>
            <p className="text-[10px] text-muted-foreground/60 mb-4">
              Se perdió en etapa: {losingDeal.stage}
            </p>
            <div>
              <label className={labelClass}>Razón (opcional)</label>
              <textarea
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                placeholder="¿Por qué se perdió este trato?"
                rows={3}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-red-500/40 resize-none"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setLosingDeal(null)} className={cancelBtnClass}>
                Cancelar
              </button>
              <button
                onClick={handleLoseDeal}
                disabled={saving}
                className="flex-1 rounded-lg bg-red-500/20 border border-red-500/30 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Marcar como perdido ✗'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal: Edit Deal ────────────────────────────────────────────── */}
      {editingDeal && (
        <ModalOverlay>
          <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <button
              onClick={() => setEditingDeal(null)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground text-lg leading-none"
              aria-label="Cerrar"
            >
              ✕
            </button>
            <h2 className="text-sm font-bold text-foreground mb-1">Editar trato</h2>
            <p className="text-xs text-muted-foreground mb-5">
              {editingDeal.company_name ?? editingDeal.prospect_name ?? 'Trato sin nombre'}
            </p>
            <div className="space-y-3">
              {/* Empresa */}
              <div>
                <label className={labelClass}>Empresa</label>
                <input
                  type="text"
                  value={editCompany}
                  onChange={(e) => setEditCompany(e.target.value)}
                  placeholder="Nombre de empresa..."
                  className={inputClass}
                />
              </div>

              {/* Prospecto */}
              <div>
                <label className={labelClass}>Prospecto</label>
                <input
                  type="text"
                  value={editProspect}
                  onChange={(e) => setEditProspect(e.target.value)}
                  placeholder="Nombre del prospecto..."
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Monto */}
                <div>
                  <label className={labelClass}>Monto USD</label>
                  <input
                    type="number"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    placeholder="0"
                    min={0}
                    className={inputClass}
                  />
                </div>

                {/* Fecha */}
                <div>
                  <label className={labelClass}>Fecha entrada</label>
                  <input
                    type="date"
                    value={editDate}
                    max={today}
                    onChange={(e) => setEditDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Tipo */}
              <div>
                <label className={labelClass}>Tipo</label>
                <div className="flex rounded-md border border-border overflow-hidden">
                  {(['OUTBOUND', 'INBOUND'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setEditType(t)}
                      className={cn(
                        'flex-1 py-1.5 text-[11px] font-bold transition-colors',
                        editType === t
                          ? t === 'OUTBOUND'
                            ? 'bg-cyan-400/15 text-cyan-400'
                            : 'bg-purple-400/15 text-purple-400'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Etapa — corrección directa, no registra movimiento */}
              <div>
                <label className={labelClass}>Etapa actual</label>
                <select
                  value={editStage}
                  onChange={(e) => setEditStage(e.target.value)}
                  className={inputClass}
                >
                  {kanbanStages.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground/50 mt-1">
                  Corrección manual — no registra movimiento en el historial.
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditingDeal(null)} className={cancelBtnClass}>
                Cancelar
              </button>
              <button
                onClick={handleEditDeal}
                disabled={saving}
                className="flex-1 rounded-lg bg-primary/15 border border-primary/30 py-2 text-sm font-semibold text-primary hover:bg-primary/25 transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  )
}
