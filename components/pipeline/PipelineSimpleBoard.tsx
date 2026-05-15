'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Copy, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtUSD } from '@/lib/calculations/pipeline'
import { DatePickerInput } from '@/components/ui/DatePickerInput'
import { todayISO } from '@/lib/utils/dates'
import {
  createPipelineSimple,
  updatePipelineSimple,
  updatePipelineSimpleStatus,
  deletePipelineSimple,
} from '@/lib/actions/pipeline-simple'
import { PipelineSimpleCharts } from '@/components/pipeline/PipelineSimpleCharts'
import type { PipelineSimple } from '@/lib/types/database'

const STAGES = [
  'Cita agendada',
  'Reagendar',
  'Primera reu ejecutada/Propuesta en preparación',
  'Propuesta Presentada',
  'Por facturar/cobrar',
] as const
type Stage = (typeof STAGES)[number]
type Status = 'abierto' | 'perdido' | 'ganado'
type ProspectType = 'inbound' | 'outbound'

const STAGE_SHORT: Record<Stage, string> = {
  'Cita agendada':                                  'Cita agenda.',
  'Reagendar':                                      'Reagendar',
  'Primera reu ejecutada/Propuesta en preparación': '1ra Reunión',
  'Propuesta Presentada':                           'Prop. Presentada',
  'Por facturar/cobrar':                            'Por facturar',
}

type ActiveScenario = {
  funnel_stages: string[]
  outbound_rates: number[]
  inbound_rates: number[]
  working_days_per_month: number
} | null

// ── Stage config ──────────────────────────────────────────────────────────────

const STAGE_COLOR: Record<Stage, { border: string; label: string; badge: string }> = {
  'Cita agendada':                                  { border: 'border-t-blue-500/50',    label: 'text-blue-400',    badge: 'bg-blue-400/10 text-blue-400'       },
  'Reagendar':                                      { border: 'border-t-rose-500/50',    label: 'text-rose-400',    badge: 'bg-rose-400/10 text-rose-400'       },
  'Primera reu ejecutada/Propuesta en preparación': { border: 'border-t-cyan-500/50',    label: 'text-cyan-400',    badge: 'bg-cyan-400/10 text-cyan-400'       },
  'Propuesta Presentada':                           { border: 'border-t-amber-500/50',   label: 'text-amber-400',   badge: 'bg-amber-400/10 text-amber-400'     },
  'Por facturar/cobrar':                            { border: 'border-t-emerald-500/50', label: 'text-emerald-400', badge: 'bg-emerald-400/10 text-emerald-400' },
}

// ── Toggle button ─────────────────────────────────────────────────────────────

function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; activeClass: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-md border border-border overflow-hidden">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border-r border-border last:border-r-0 transition-colors',
            value === o.value ? o.activeClass : 'text-muted-foreground hover:text-foreground hover:bg-muted/20',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, accent = 'primary',
}: {
  label: string
  value: string
  sub?: string
  accent?: 'primary' | 'emerald' | 'amber' | 'red' | 'cyan'
}) {
  const colorMap = {
    primary: { border: 'border-t-primary/40',         value: 'text-primary'        },
    emerald: { border: 'border-t-emerald-500/40',     value: 'text-emerald-400'    },
    amber:   { border: 'border-t-amber-500/40',       value: 'text-amber-400'      },
    red:     { border: 'border-t-red-500/40',         value: 'text-red-400'        },
    cyan:    { border: 'border-t-cyan-500/40',        value: 'text-cyan-400'       },
  }
  const c = colorMap[accent]
  return (
    <div className={`rounded-lg border border-border bg-card p-4 border-t-2 ${c.border}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${c.value}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Entry card ────────────────────────────────────────────────────────────────

function EntryCard({
  entry,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  entry: PipelineSimple
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const origenBadge = entry.prospect_type === 'outbound'
    ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
    : 'bg-sky-500/10 text-sky-400 border-sky-500/20'

  const estadoBadge = entry.status === 'abierto'
    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    : entry.status === 'ganado'
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : 'bg-red-500/10 text-red-400 border-red-500/20'

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2 hover:border-primary/30 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-muted-foreground">
          {format(parseISO(entry.entry_date), 'd MMM', { locale: es })}
        </span>
        <div className="flex gap-1">
          <button onClick={onEdit}      className="p-1 rounded text-muted-foreground hover:text-primary transition-colors" title="Editar">
            <Pencil className="h-3 w-3" />
          </button>
          <button onClick={onDuplicate} className="p-1 rounded text-muted-foreground hover:text-primary transition-colors" title="Duplicar">
            <Copy className="h-3 w-3" />
          </button>
          <button onClick={onDelete}    className="p-1 rounded text-muted-foreground hover:text-red-400 transition-colors" title="Eliminar">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Badges */}
      <div className="flex gap-1 flex-wrap">
        <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${origenBadge}`}>
          {entry.prospect_type}
        </span>
        {entry.stage === 'Propuesta Presentada' && (
          <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${estadoBadge}`}>
            {entry.status}
          </span>
        )}
        {entry.integration_source && (
          <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
            {entry.integration_source}
          </span>
        )}
      </div>

      {(entry.company_name || entry.prospect_name) && (
        <div>
          {entry.company_name  && <p className="text-xs font-semibold text-foreground truncate">{entry.company_name}</p>}
          {entry.prospect_name && <p className="text-[10px] text-muted-foreground truncate">{entry.prospect_name}</p>}
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

// ── Filter bar ────────────────────────────────────────────────────────────────

function FilterBar({
  filterOrigen, setFilterOrigen,
  filterEstado, setFilterEstado,
  filterEtapa,  setFilterEtapa,
  onNewEntry,
}: {
  filterOrigen: 'all' | ProspectType
  setFilterOrigen: (v: 'all' | ProspectType) => void
  filterEstado: 'all' | Status
  setFilterEstado: (v: 'all' | Status) => void
  filterEtapa:  'all' | Stage
  setFilterEtapa:  (v: 'all' | Stage) => void
  onNewEntry: () => void
}) {
  const btnBase = 'px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wider transition-colors'
  const active  = 'bg-primary/15 text-primary border border-primary/30'
  const inactive = 'text-muted-foreground hover:text-foreground hover:bg-muted/20 border border-transparent'

  return (
    <div className="flex flex-wrap gap-3 mb-4 items-center text-[10px]">
      {/* Origen */}
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground/60 mr-1 uppercase tracking-widest">Origen</span>
        {(['all', 'outbound', 'inbound'] as const).map((v) => (
          <button key={v} onClick={() => setFilterOrigen(v)}
            className={cn(btnBase, filterOrigen === v ? (
              v === 'outbound' ? 'bg-cyan-400/10 text-cyan-400 border border-cyan-400/30' :
              v === 'inbound'  ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/30' :
              active
            ) : inactive)}
          >
            {v === 'all' ? 'Todos' : v}
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-border" />

      {/* Estado */}
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground/60 mr-1 uppercase tracking-widest">Estado</span>
        {(['all', 'abierto', 'perdido', 'ganado'] as const).map((v) => (
          <button key={v} onClick={() => setFilterEstado(v)}
            className={cn(btnBase, filterEstado === v ? (
              v === 'abierto' ? 'bg-amber-400/10 text-amber-400 border border-amber-400/30' :
              v === 'perdido' ? 'bg-red-400/10 text-red-400 border border-red-400/30' :
              v === 'ganado'  ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/30' :
              active
            ) : inactive)}
          >
            {v === 'all' ? 'Todos' : v}
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-border" />

      {/* Etapa */}
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground/60 mr-1 uppercase tracking-widest">Etapa</span>
        {(['all', ...STAGES] as const).map((v) => (
          <button key={v} onClick={() => setFilterEtapa(v as 'all' | Stage)}
            className={cn(btnBase, filterEtapa === v ? active : inactive)}
          >
            {v === 'all' ? 'Todas' : STAGE_SHORT[v as Stage]}
          </button>
        ))}
      </div>

      {/* Nueva entrada — right-aligned */}
      <button
        onClick={onNewEntry}
        className="ml-auto flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-[0_0_14px_rgba(0,217,255,0.3)] hover:opacity-90 transition-all"
      >
        + Nueva entrada
      </button>
    </div>
  )
}

// ── PipelineSimpleBoard ───────────────────────────────────────────────────────

interface PipelineSimpleBoardProps {
  entries: PipelineSimple[]
  period: string
  activeScenario: ActiveScenario
}

export function PipelineSimpleBoard({ entries, period, activeScenario }: PipelineSimpleBoardProps) {
  const router = useRouter()
  const today = todayISO()

  type ModalMode = 'create' | 'edit' | 'duplicate'

  const [saving, setSaving]           = useState(false)
  const [showForm, setShowForm]       = useState(false)
  const [modalMode, setModalMode]     = useState<ModalMode>('create')
  const [editingEntry, setEditingEntry] = useState<PipelineSimple | null>(null)
  const [deletingId, setDeletingId]   = useState<string | null>(null)
  const [sourceEntryId, setSourceEntryId]     = useState<string | null>(null)
  const [sourceEntryStage, setSourceEntryStage] = useState<Stage | null>(null)

  // Auto-refresh via Supabase Realtime when Pipedrive webhooks insert/update rows
  useEffect(() => {
    const sb = getSupabaseBrowserClient()
    let userId: string | null = null

    sb.auth.getUser().then(({ data }) => {
      userId = data.user?.id ?? null
      if (!userId) return

      const channel = sb
        .channel('pipeline-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'pipeline_simple', filter: `user_id=eq.${userId}` },
          () => { router.refresh() }
        )
        .subscribe()

      return () => { sb.removeChannel(channel) }
    })
  }, [router])

  // Filters
  const [filterOrigen, setFilterOrigen] = useState<'all' | ProspectType>('all')
  const [filterEstado, setFilterEstado] = useState<'all' | Status>('all')
  const [filterEtapa,  setFilterEtapa]  = useState<'all' | Stage>('all')

  // Form state
  const [formStage,       setFormStage]       = useState<Stage>('Primera reu ejecutada/Propuesta en preparación')
  const [formStatus,      setFormStatus]      = useState<Status>('abierto')
  const [formProspectType, setFormProspectType] = useState<ProspectType>('outbound')
  const [formDate,        setFormDate]        = useState(today)
  const [formCompany,     setFormCompany]     = useState('')
  const [formProspect,    setFormProspect]    = useState('')
  const [formAmount,      setFormAmount]      = useState('')
  const [formNotes,       setFormNotes]       = useState('')

  // Filtered entries for Kanban columns + metrics
  const filtered = entries.filter(e => {
    if (filterOrigen !== 'all' && e.prospect_type !== filterOrigen) return false
    if (filterEstado !== 'all' && e.status !== filterEstado) return false
    if (filterEtapa  !== 'all' && e.stage  !== filterEtapa)  return false
    return true
  })

  // Derived metrics (on filtered data)
  const countCita      = filtered.filter(e => e.stage === 'Cita agendada').length
  const countReunion   = filtered.filter(e => e.stage === 'Primera reu ejecutada/Propuesta en preparación').length
  const countPropuesta = filtered.filter(e => e.stage === 'Propuesta Presentada').length
  const countCierre    = filtered.filter(e => e.stage === 'Por facturar/cobrar').length
  const pipelineValue  = filtered.filter(e => e.stage === 'Propuesta Presentada' && e.status === 'abierto').reduce((s, e) => s + (e.amount_usd ?? 0), 0)
  const perdidoValue   = filtered.filter(e => e.status === 'perdido').reduce((s, e) => s + (e.amount_usd ?? 0), 0)
  const closedValue    = filtered.filter(e => e.stage === 'Por facturar/cobrar').reduce((s, e) => s + (e.amount_usd ?? 0), 0)

  const convRP = countReunion > 0   ? Math.round(countPropuesta / countReunion * 100)   : 0
  const convPC = countPropuesta > 0 ? Math.round(countCierre / countPropuesta * 100) : 0
  const minConv = Math.min(convRP, convPC)
  const convColor = minConv >= 70 ? 'emerald' : minConv >= 40 ? 'amber' : 'red'
  const convValue = countReunion === 0 && countPropuesta === 0 ? '—' : `${convRP}% → ${convPC}%`

  // ── Helpers ───────────────────────────────────────────────────────────────

  function resetForm(stage: Stage = 'Cita agendada', source?: PipelineSimple) {
    setFormStage(source?.stage ?? stage)
    setFormStatus(source?.status ?? 'abierto')
    setFormProspectType(source?.prospect_type ?? 'outbound')
    setFormDate(today)
    setFormCompany(source?.company_name ?? '')
    setFormProspect(source?.prospect_name ?? '')
    setFormAmount(source?.amount_usd != null ? String(source.amount_usd) : '')
    setFormNotes(source?.notes ?? '')
  }

  function openCreate(stage: Stage = 'Cita agendada') {
    setEditingEntry(null)
    setModalMode('create')
    setSourceEntryId(null)
    setSourceEntryStage(null)
    resetForm(stage)
    setShowForm(true)
  }

  function openEdit(entry: PipelineSimple) {
    setEditingEntry(entry)
    setModalMode('edit')
    setSourceEntryId(null)
    setSourceEntryStage(null)
    setFormStage(entry.stage)
    setFormStatus(entry.status)
    setFormProspectType(entry.prospect_type)
    setFormDate(entry.entry_date)
    setFormCompany(entry.company_name ?? '')
    setFormProspect(entry.prospect_name ?? '')
    setFormAmount(entry.amount_usd != null ? String(entry.amount_usd) : '')
    setFormNotes(entry.notes ?? '')
    setShowForm(true)
  }

  function openDuplicate(entry: PipelineSimple) {
    setEditingEntry(null)
    setModalMode('duplicate')
    setSourceEntryId(entry.id)
    setSourceEntryStage(entry.stage)
    resetForm('Cita agendada', entry)
    setShowForm(true)
  }

  // Auto-set status when stage changes in the modal
  function handleFormStageChange(s: Stage) {
    setFormStage(s)
    if (s === 'Por facturar/cobrar') setFormStatus('ganado')
    if (s === 'Cita agendada' || s === 'Reagendar' || s === 'Primera reu ejecutada/Propuesta en preparación') setFormStatus('abierto')
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true)
    try {
      const derivedStatus: Status = formStage === 'Por facturar/cobrar' ? 'ganado' :
        (formStage === 'Cita agendada' || formStage === 'Reagendar' || formStage === 'Primera reu ejecutada/Propuesta en preparación') ? 'abierto' :
        formStatus
      const payload = {
        stage:         formStage,
        status:        derivedStatus,
        prospect_type: formProspectType,
        entry_date:    formDate,
        company_name:  formCompany.trim() || null,
        prospect_name: formProspect.trim() || null,
        amount_usd:    formAmount ? Number(formAmount) : null,
        notes:         formNotes.trim() || null,
      }
      if (modalMode === 'edit' && editingEntry) {
        await updatePipelineSimple(editingEntry.id, payload)
        toast.success('Entrada actualizada ✓')
      } else if (modalMode === 'duplicate' || modalMode === 'create') {
        await createPipelineSimple(payload)
        if (modalMode === 'duplicate' && sourceEntryId && sourceEntryStage === 'Propuesta Presentada' && formStage === 'Por facturar/cobrar') {
          await updatePipelineSimpleStatus(sourceEntryId, 'ganado')
          toast.success('Propuesta marcada como Ganada automáticamente')
        } else {
          toast.success(modalMode === 'duplicate' ? 'Entrada duplicada ✓' : 'Entrada creada ✓')
        }
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

  const inputClass   = 'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60'
  const labelClass   = 'block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1'
  const cancelBtnClass = 'flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors'

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative">
      {/* Metrics row — 6 cards */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
        <MetricCard label="Citas"        value={String(countCita)}      sub="citas agendadas"    accent="cyan"    />
        <MetricCard label="Reuniones"    value={String(countReunion)}   sub="1ra reunión ejec."  accent="cyan"    />
        <MetricCard label="En propuesta" value={fmtUSD(pipelineValue)}  sub="pipeline estimado"  accent="amber"   />
        <MetricCard label="Perdidos"     value={fmtUSD(perdidoValue)}   sub="negocios perdidos"  accent="red"     />
        <MetricCard label="Cerrado"      value={fmtUSD(closedValue)}    sub="negocios ganados"   accent="emerald" />
        <MetricCard
          label="Conversión"
          value={convValue}
          sub="reun→prop → prop→cierre"
          accent={convColor as 'emerald' | 'amber' | 'red'}
        />
      </div>

      {/* Filter bar */}
      <FilterBar
        filterOrigen={filterOrigen} setFilterOrigen={setFilterOrigen}
        filterEstado={filterEstado} setFilterEstado={setFilterEstado}
        filterEtapa={filterEtapa}   setFilterEtapa={setFilterEtapa}
        onNewEntry={() => openCreate()}
      />

      {/* Kanban columns */}
      <div className="flex gap-4 overflow-x-auto pb-6">
        {STAGES.map((stage) => {
          const col          = STAGE_COLOR[stage]
          const stageEntries = filtered.filter(e => e.stage === stage)
          return (
            <div key={stage} className="flex flex-col gap-3 min-w-[240px] max-w-[240px]">
              {/* Column header */}
              <div className="flex items-center gap-2 mb-2">
                <span className={cn('text-xs font-bold', col.label)}>{STAGE_SHORT[stage]}</span>
                <span className={cn('text-[10px] font-bold rounded-full px-2 py-0.5 min-w-[20px] text-center', col.badge)}>
                  {stageEntries.length}
                </span>
                <button
                  onClick={() => openCreate(stage)}
                  className="ml-auto text-[10px] text-muted-foreground hover:text-primary transition-colors px-1.5 py-0.5 rounded hover:bg-primary/10"
                >
                  + Nuevo
                </button>
              </div>

              {/* Cards */}
              {stageEntries.map(entry => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  onEdit={() => openEdit(entry)}
                  onDuplicate={() => openDuplicate(entry)}
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

      {/* Charts section */}
      <PipelineSimpleCharts entries={filtered} period={period} activeScenario={activeScenario} />

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
              {modalMode === 'edit' ? 'Editar entrada' : modalMode === 'duplicate' ? 'Duplicar entrada' : 'Nueva entrada'}
            </h2>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {/* Etapa */}
                <div>
                  <label className={labelClass}>Etapa *</label>
                  <select
                    value={formStage}
                    onChange={e => handleFormStageChange(e.target.value as Stage)}
                    className={inputClass}
                  >
                    {STAGES.map(s => <option key={s} value={s}>{STAGE_SHORT[s]}</option>)}
                  </select>
                </div>
                {/* Fecha */}
                <div>
                  <label className={labelClass}>Fecha *</label>
                  <DatePickerInput value={formDate} onChange={d => setFormDate(d)} max={today} />
                </div>
              </div>

              {/* Origen */}
              <div>
                <label className={labelClass}>Origen</label>
                <ToggleGroup<ProspectType>
                  value={formProspectType}
                  onChange={setFormProspectType}
                  options={[
                    { value: 'outbound', label: 'Outbound', activeClass: 'bg-orange-500/20 border-orange-500/40 text-orange-300' },
                    { value: 'inbound',  label: 'Inbound',  activeClass: 'bg-sky-500/20 border-sky-500/40 text-sky-300'          },
                  ]}
                />
              </div>

              {/* Estado — only for Propuesta */}
              {formStage === 'Propuesta Presentada' && (
                <div>
                  <label className={labelClass}>Estado</label>
                  <ToggleGroup<Status>
                    value={formStatus}
                    onChange={setFormStatus}
                    options={[
                      { value: 'abierto', label: 'Abierto', activeClass: 'bg-amber-400/15 text-amber-400'   },
                      { value: 'ganado',  label: 'Ganado',  activeClass: 'bg-emerald-400/15 text-emerald-400' },
                      { value: 'perdido', label: 'Perdido', activeClass: 'bg-red-400/15 text-red-400'       },
                    ]}
                  />
                </div>
              )}

              {/* Empresa */}
              <div>
                <label className={labelClass}>Empresa</label>
                <input type="text" value={formCompany} onChange={e => setFormCompany(e.target.value)}
                  placeholder="Nombre de empresa..." className={inputClass} />
              </div>

              {/* Prospecto */}
              <div>
                <label className={labelClass}>Prospecto</label>
                <input type="text" value={formProspect} onChange={e => setFormProspect(e.target.value)}
                  placeholder="Nombre del prospecto..." className={inputClass} />
              </div>

              {/* Monto */}
              <div>
                <label className={labelClass}>Monto estimado (USD)</label>
                <input type="number" value={formAmount} onChange={e => setFormAmount(e.target.value)}
                  placeholder="0" min={0} className={inputClass} />
              </div>

              {/* Notas */}
              <div>
                <label className={labelClass}>Notas</label>
                <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)}
                  placeholder="Notas adicionales..." rows={2}
                  className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowForm(false)} className={cancelBtnClass}>Cancelar</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-lg bg-primary/15 border border-primary/30 py-2 text-sm font-semibold text-primary hover:bg-primary/25 transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando...' : modalMode === 'edit' ? 'Guardar cambios' : modalMode === 'duplicate' ? 'Duplicar entrada' : 'Crear entrada'}
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
              <button onClick={() => setDeletingId(null)} className={cancelBtnClass}>Cancelar</button>
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
