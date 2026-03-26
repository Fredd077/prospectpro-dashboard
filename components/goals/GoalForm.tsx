'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createGoal, updateGoal } from '@/lib/queries/goals'
import type { Goal, GoalInsert } from '@/lib/types/database'
import type { PeriodType } from '@/lib/types/common'

interface GoalFormProps {
  goal?: Goal
  activities: Array<{ id: string; name: string }>
  onClose: () => void
}

const PERIOD_OPTIONS: Array<{ value: PeriodType; label: string }> = [
  { value: 'daily', label: 'Diaria' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' },
  { value: 'quarterly', label: 'Trimestral' },
]

export function GoalForm({ goal, activities, onClose }: GoalFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    activity_id: goal?.activity_id ?? '',
    period_type: (goal?.period_type ?? 'weekly') as PeriodType,
    period_start: goal?.period_start ?? '',
    period_end: goal?.period_end ?? '',
    target_value: goal?.target_value ?? 0,
    label: goal?.label ?? '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.period_start || !form.period_end || form.target_value <= 0) {
      toast.error('Rellena todos los campos obligatorios')
      return
    }
    setSaving(true)
    try {
      const payload: GoalInsert = {
        activity_id: form.activity_id || null,
        period_type: form.period_type,
        period_start: form.period_start,
        period_end: form.period_end,
        target_value: form.target_value,
        label: form.label || null,
      }
      if (goal) {
        await updateGoal(goal.id, payload)
        toast.success('Meta actualizada')
      } else {
        await createGoal(payload)
        toast.success('Meta creada')
      }
      router.refresh()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar'
      toast.error(msg.includes('unique') ? 'Ya existe una meta para ese período/actividad' : msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Activity */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Actividad (opcional — vacío = meta global)</Label>
        <select
          value={form.activity_id}
          onChange={(e) => setForm({ ...form, activity_id: e.target.value })}
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">— Meta global del período —</option>
          {activities.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {/* Period type */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Tipo de período</Label>
        <div className="flex gap-2 flex-wrap">
          {PERIOD_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setForm({ ...form, period_type: value })}
              className={`rounded-md px-3 py-1 text-xs border transition-colors ${
                form.period_type === value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-foreground/40'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Fecha inicio *</Label>
          <Input
            type="date"
            value={form.period_start}
            onChange={(e) => setForm({ ...form, period_start: e.target.value })}
            required
            className="bg-background"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Fecha fin *</Label>
          <Input
            type="date"
            value={form.period_end}
            onChange={(e) => setForm({ ...form, period_end: e.target.value })}
            required
            className="bg-background"
          />
        </div>
      </div>

      {/* Target value */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Meta (número de actividades) *</Label>
        <Input
          type="number"
          min={1}
          value={form.target_value || ''}
          onChange={(e) => setForm({ ...form, target_value: parseInt(e.target.value) || 0 })}
          required
          className="bg-background"
        />
      </div>

      {/* Label */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Etiqueta (opcional)</Label>
        <Input
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          placeholder="Ej: Semana 14, Q1 2026…"
          className="bg-background"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={saving} className="flex-1">
          {saving ? 'Guardando…' : goal ? 'Actualizar' : 'Crear meta'}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
