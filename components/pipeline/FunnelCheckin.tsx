'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Minus, ChevronDown, ChevronUp, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { saveQuickFunnelCheckin } from '@/lib/actions/pipeline'
import type { FunnelCheckinStageData } from '@/lib/actions/pipeline'
import { todayISO } from '@/lib/utils/dates'
import { cn } from '@/lib/utils'

interface FunnelCheckinProps {
  stages: string[]          // full funnel_stages array (first entry = "Actividad" or similar)
  scenarioId: string | null
  /** Pre-filled date; editable if allowDateEdit=true */
  defaultDate?: string
  allowDateEdit?: boolean
  onSaved?: () => void
  onCancel?: () => void
}

interface StageState {
  quantity: number
  amountStr: string
  companies: string[]
  newCompany: string
}

function emptyStageState(): StageState {
  return { quantity: 0, amountStr: '', companies: [], newCompany: '' }
}

export function FunnelCheckin({
  stages,
  scenarioId,
  defaultDate,
  allowDateEdit = false,
  onSaved,
  onCancel,
}: FunnelCheckinProps) {
  const today = todayISO()
  const funnel = stages.slice(1) // skip first "Actividad" stage
  const amountStages = new Set(funnel.slice(-2))

  const [type, setType] = useState<'OUTBOUND' | 'INBOUND'>('OUTBOUND')
  const [date, setDate] = useState(defaultDate ?? today)
  const [outState, setOutState] = useState<Record<string, StageState>>(
    () => Object.fromEntries(funnel.map((s) => [s, emptyStageState()]))
  )
  const [inState, setInState] = useState<Record<string, StageState>>(
    () => Object.fromEntries(funnel.map((s) => [s, emptyStageState()]))
  )
  const [showDetail, setShowDetail] = useState(false)
  const [saving, setSaving] = useState(false)

  const stateFor = type === 'OUTBOUND' ? outState : inState
  const setStateFor = type === 'OUTBOUND' ? setOutState : setInState

  function updateStage(stage: string, patch: Partial<StageState>) {
    setStateFor((prev) => ({
      ...prev,
      [stage]: { ...prev[stage], ...patch },
    }))
  }

  function incr(stage: string) {
    updateStage(stage, { quantity: (stateFor[stage]?.quantity ?? 0) + 1 })
  }
  function decr(stage: string) {
    const cur = stateFor[stage]?.quantity ?? 0
    updateStage(stage, { quantity: Math.max(0, cur - 1) })
  }

  function addCompany(stage: string) {
    const val = stateFor[stage]?.newCompany?.trim()
    if (!val) return
    const existing = stateFor[stage]?.companies ?? []
    updateStage(stage, {
      companies: [...existing, val],
      newCompany: '',
      // sync quantity to match company count
      quantity: existing.length + 1,
    })
  }

  function removeCompany(stage: string, idx: number) {
    const companies = (stateFor[stage]?.companies ?? []).filter((_, i) => i !== idx)
    updateStage(stage, { companies, quantity: Math.max(stateFor[stage]?.quantity ?? 0, companies.length) })
  }

  function stagesWithData() {
    return funnel.filter((s) => (stateFor[s]?.quantity ?? 0) > 0 || (stateFor[s]?.companies ?? []).length > 0)
  }

  async function handleSave() {
    const active = stagesWithData()
    if (active.length === 0) {
      toast.error('Ingresa al menos un valor')
      return
    }
    if (date > today) {
      toast.error('La fecha no puede ser futura')
      return
    }

    const payload: FunnelCheckinStageData[] = active.map((stage) => {
      const st = stateFor[stage]
      const parsed = st.amountStr.trim()
        ? parseFloat(st.amountStr.replace(/\./g, '').replace(',', '.'))
        : null
      return {
        stage,
        quantity: st.quantity,
        amount_usd: parsed && !isNaN(parsed) && parsed > 0 ? parsed : null,
        companies: st.companies,
      }
    })

    setSaving(true)
    try {
      await saveQuickFunnelCheckin(date, type, payload, scenarioId)
      toast.success('Avance del funnel registrado ✓')
      onSaved?.()
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  // Validation warnings for detail section
  const mismatchedStages = showDetail
    ? funnel.filter((s) => {
        const st = stateFor[s]
        return st && st.quantity > 0 && st.companies.length > 0 && st.companies.length !== st.quantity
      })
    : []

  const inputCls = 'w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary'

  return (
    <div className="space-y-4">
      {/* Date + type toggle header */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Date */}
        {allowDateEdit ? (
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        ) : (
          <span className="text-xs text-muted-foreground">{date}</span>
        )}

        {/* OUTBOUND / INBOUND toggle */}
        <div className="flex rounded-md border border-border overflow-hidden">
          {(['OUTBOUND', 'INBOUND'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn(
                'px-4 py-1.5 text-xs font-semibold transition-colors border-r border-border last:border-r-0',
                type === t
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

      {/* Stage counter grid */}
      <div className="space-y-2">
        {funnel.map((stage) => {
          const st = stateFor[stage] ?? emptyStageState()
          const showAmt = amountStages.has(stage)
          return (
            <div key={stage} className="flex items-center gap-3">
              <span className="text-sm text-foreground w-36 shrink-0">{stage}</span>

              {/* Counter */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => decr(stage)}
                  className="h-7 w-7 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className={cn(
                  'w-10 text-center text-sm font-semibold tabular-nums',
                  st.quantity > 0
                    ? type === 'OUTBOUND' ? 'text-cyan-400' : 'text-purple-400'
                    : 'text-muted-foreground/50'
                )}>
                  {st.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => incr(stage)}
                  className="h-7 w-7 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>

              {/* Amount field for last 2 stages */}
              {showAmt && (
                <div className="flex items-center gap-1.5 flex-1">
                  <span className="text-muted-foreground/60 text-xs">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={st.amountStr}
                    onChange={(e) => updateStage(stage, { amountStr: e.target.value })}
                    placeholder="Monto USD"
                    className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary w-32"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Detail section toggle */}
      <button
        type="button"
        onClick={() => setShowDetail((p) => !p)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {showDetail ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {showDetail ? 'Ocultar detalle por empresa' : '+ Agregar detalle por empresa'}
      </button>

      {/* Detail per stage */}
      {showDetail && (
        <div className="space-y-3">
          {mismatchedStages.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-400">
                {mismatchedStages.map((s) => {
                  const st = stateFor[s]
                  return `Tienes ${st.quantity} ${s.toLowerCase()}(s) pero solo ${st.companies.length} empresa(s) registrada(s).`
                }).join(' ')}
              </p>
            </div>
          )}

          {funnel
            .filter((s) => (stateFor[s]?.quantity ?? 0) > 0)
            .map((stage) => {
              const st = stateFor[stage] ?? emptyStageState()
              return (
                <div key={stage} className="rounded-md border border-border bg-muted/10 p-3 space-y-2">
                  <p className="text-xs font-semibold text-foreground">
                    {stage}
                    <span className="ml-1.5 font-normal text-muted-foreground">({st.quantity} total)</span>
                  </p>

                  {/* Company list */}
                  {st.companies.length > 0 && (
                    <div className="space-y-1">
                      {st.companies.map((company, idx) => (
                        <div key={idx} className="flex items-center justify-between rounded bg-muted/30 px-2 py-1 text-xs">
                          <span className="text-foreground/80">{company}</span>
                          <button
                            type="button"
                            onClick={() => removeCompany(stage, idx)}
                            className="text-muted-foreground hover:text-red-400 ml-2"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add company input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={st.newCompany}
                      onChange={(e) => updateStage(stage, { newCompany: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCompany(stage) } }}
                      placeholder="Nombre de empresa"
                      className={cn(inputCls, 'text-xs py-1.5 flex-1')}
                    />
                    <button
                      type="button"
                      onClick={() => addCompany(stage)}
                      className="shrink-0 flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                    >
                      <Plus className="h-3 w-3" /> Agregar
                    </button>
                  </div>
                </div>
              )
            })}

          {funnel.filter((s) => (stateFor[s]?.quantity ?? 0) > 0).length === 0 && (
            <p className="text-xs text-muted-foreground/60 text-center py-2">
              Ingresa conteos arriba para agregar detalle por empresa.
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 justify-end pt-1 border-t border-border/50">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={saving || stagesWithData().length === 0}
        >
          {saving ? 'Guardando...' : 'Guardar avance'}
        </Button>
      </div>
    </div>
  )
}
