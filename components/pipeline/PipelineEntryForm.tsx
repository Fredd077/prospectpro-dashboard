'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DatePickerInput } from '@/components/ui/DatePickerInput'
import { savePipelineEntry, updatePipelineEntry, getCompanyNames } from '@/lib/actions/pipeline'
import type { PipelineEntryData } from '@/lib/actions/pipeline'
import type { PipelineEntry } from '@/lib/types/database'
import { todayISO } from '@/lib/utils/dates'
import { cn } from '@/lib/utils'

interface PipelineEntryFormProps {
  stages: string[]
  scenarioId?: string | null
  editEntry?: PipelineEntry | null
  onSaved?: (id: string, prospectType: 'OUTBOUND' | 'INBOUND') => void
  onCancel?: () => void
}

export function PipelineEntryForm({ stages, scenarioId, editEntry, onSaved, onCancel }: PipelineEntryFormProps) {
  const today = todayISO()

  const availableStages = stages.slice(1)
  const amountStages    = new Set(availableStages.slice(-3))

  const [stage, setStage]           = useState(editEntry?.stage ?? availableStages[0] ?? '')
  const [prospectType, setProspectType] = useState<'OUTBOUND' | 'INBOUND'>(editEntry?.prospect_type ?? 'OUTBOUND')
  const [company, setCompany]       = useState(editEntry?.company_name ?? '')
  const [prospect, setProspect]     = useState(editEntry?.prospect_name ?? '')
  // company_name and prospect_name are optional (nullable)
  const [quantity, setQuantity]     = useState(editEntry?.quantity ?? 1)
  const [amount, setAmount]         = useState<string>(editEntry?.amount_usd != null ? String(editEntry.amount_usd) : '')
  const [entryDate, setEntryDate]   = useState(editEntry?.entry_date ?? today)
  const [notes, setNotes]           = useState(editEntry?.notes ?? '')
  const [saving, setSaving]         = useState(false)
  const [companies, setCompanies]   = useState<string[]>([])

  const showAmount = amountStages.has(stage)
  const stageLabel = stage ? `${stage}(s) realizados` : 'Cantidad'

  useEffect(() => {
    getCompanyNames().then(setCompanies).catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const parsedAmount = amount.trim() ? parseFloat(amount.replace(/\./g, '').replace(',', '.')) : null
    if (showAmount && amount.trim() && (isNaN(parsedAmount!) || parsedAmount! <= 0)) {
      toast.error('El monto debe ser mayor a 0')
      return
    }
    if (entryDate > today) {
      toast.error('La fecha no puede ser futura')
      return
    }

    setSaving(true)
    try {
      const payload: PipelineEntryData = {
        stage,
        prospect_type: prospectType,
        company_name:  company.trim() || null,
        prospect_name: prospect.trim() || null,
        quantity,
        amount_usd: showAmount && parsedAmount ? parsedAmount : null,
        entry_date: entryDate,
        notes: notes.trim() || null,
        recipe_scenario_id: scenarioId ?? null,
        is_quick_entry: false,
      }

      if (editEntry) {
        await updatePipelineEntry(editEntry.id, payload)
        toast.success('Registro actualizado ✓')
        onSaved?.(editEntry.id, prospectType)
      } else {
        const id = await savePipelineEntry(payload)
        toast.success('Movimiento registrado ✓')
        onSaved?.(id, prospectType)
      }
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary'
  const labelCls = 'block text-xs font-medium text-muted-foreground mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Row 1: Date + Stage */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Fecha</label>
          <DatePickerInput
            value={entryDate}
            onChange={(d) => setEntryDate(d)}
            max={today}
          />
        </div>
        <div>
          <label className={labelCls}>Etapa</label>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className={`${inputCls} cursor-pointer bg-card [&>option]:bg-card [&>option]:text-foreground`}
            required
          >
            {availableStages.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Type toggle: OUTBOUND / INBOUND */}
      <div>
        <label className={labelCls}>Tipo de prospecto</label>
        <div className="flex rounded-md border border-border overflow-hidden w-fit">
          {(['OUTBOUND', 'INBOUND'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setProspectType(t)}
              className={cn(
                'px-4 py-1.5 text-xs font-semibold transition-colors border-r border-border last:border-r-0',
                prospectType === t
                  ? t === 'OUTBOUND'
                    ? 'bg-cyan-400/15 text-cyan-400 border-b border-b-cyan-400/40'
                    : 'bg-purple-400/15 text-purple-400 border-b border-b-purple-400/40'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Company */}
      <div>
        <label className={labelCls}>Empresa <span className="text-muted-foreground/40">(opcional)</span></label>
        <input
          list="company-suggestions"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Nombre de la empresa"
          className={inputCls}
          autoComplete="off"
        />
        <datalist id="company-suggestions">
          {companies.map((c) => <option key={c} value={c} />)}
        </datalist>
      </div>

      {/* Prospect name */}
      <div>
        <label className={labelCls}>Prospecto <span className="text-muted-foreground/40">(opcional)</span></label>
        <input
          value={prospect}
          onChange={(e) => setProspect(e.target.value)}
          placeholder="Nombre del contacto"
          className={inputCls}
        />
      </div>

      {/* Quantity + Amount */}
      <div className={showAmount ? 'grid grid-cols-2 gap-3' : ''}>
        <div>
          <label className={labelCls}>{stageLabel}</label>
          <input
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className={inputCls}
            required
          />
        </div>
        {showAmount && (
          <div>
            <label className={labelCls}>
              {stage === availableStages[availableStages.length - 1]
                ? 'Valor cerrado (USD)'
                : 'Valor de la propuesta (USD)'}
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className={inputCls}
            />
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className={labelCls}>Notas <span className="text-muted-foreground/40">(opcional)</span></label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="Contexto adicional..."
          className={`${inputCls} resize-none`}
        />
        {notes.length > 400 && (
          <p className="text-[10px] text-muted-foreground mt-0.5 text-right">{500 - notes.length} caracteres restantes</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end pt-1">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
        )}
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? 'Guardando...' : editEntry ? 'Actualizar' : 'Registrar movimiento'}
        </Button>
      </div>
    </form>
  )
}
