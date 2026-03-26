'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FunnelChart } from '@/components/charts/FunnelChart'
import { formatDecimal } from '@/lib/utils/formatters'
import { upsertActual } from '@/lib/queries/recipe'
import type { RecipeScenario, RecipeActual } from '@/lib/types/database'
import { cn } from '@/lib/utils'

interface ScenarioComparisonProps {
  scenario: RecipeScenario
  actuals: RecipeActual[]
}

interface ActualFormState {
  period_start: string
  period_end: string
  period_type: 'weekly' | 'monthly' | 'quarterly'
  actual_activities: number
  actual_speeches: number
  actual_meetings: number
  actual_proposals: number
  actual_closes: number
}

const PERIOD_LABELS: Record<string, string> = {
  weekly: 'Semana',
  monthly: 'Mes',
  quarterly: 'Trimestre',
}

const STAGE_KEYS = [
  { key: 'activities' as const, label: 'Actividades', planKey: 'activities_needed_monthly', actualKey: 'actual_activities' as const },
  { key: 'speeches'   as const, label: 'Discursos',   planKey: 'speeches_needed_monthly',   actualKey: 'actual_speeches'   as const },
  { key: 'meetings'   as const, label: 'Reuniones',   planKey: 'meetings_needed_monthly',   actualKey: 'actual_meetings'   as const },
  { key: 'proposals'  as const, label: 'Propuestas',  planKey: 'proposals_needed_monthly',  actualKey: 'actual_proposals'  as const },
  { key: 'closes'     as const, label: 'Cierres',     planKey: 'closes_needed_monthly',     actualKey: 'actual_closes'     as const },
] as const

function semBadge(pct: number) {
  if (pct >= 100) return 'bg-emerald-400/10 text-emerald-400'
  if (pct >= 70)  return 'bg-amber-400/10 text-amber-400'
  return 'bg-red-400/10 text-red-400'
}
function semText(pct: number) {
  if (pct >= 100) return 'text-emerald-400'
  if (pct >= 70)  return 'text-amber-400'
  return 'text-red-400'
}

export function ScenarioComparison({ scenario, actuals }: ScenarioComparisonProps) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedActualId, setSelectedActualId] = useState<string | null>(
    actuals.length > 0 ? actuals[0].id : null
  )
  const [form, setForm] = useState<ActualFormState>({
    period_start: '',
    period_end: '',
    period_type: 'monthly',
    actual_activities: 0,
    actual_speeches: 0,
    actual_meetings: 0,
    actual_proposals: 0,
    actual_closes: 0,
  })

  const selectedActual = actuals.find((a) => a.id === selectedActualId) ?? actuals[0] ?? null

  const funnelStages = [
    { label: 'Actividades', planned: scenario.activities_needed_monthly ?? 0 },
    { label: 'Discursos',   planned: scenario.speeches_needed_monthly   ?? 0 },
    { label: 'Reuniones',   planned: scenario.meetings_needed_monthly   ?? 0 },
    { label: 'Propuestas',  planned: scenario.proposals_needed_monthly  ?? 0 },
    { label: 'Cierres',     planned: scenario.closes_needed_monthly     ?? 0 },
  ]

  const funnelWithActuals = selectedActual
    ? [
        { label: 'Actividades', planned: scenario.activities_needed_monthly ?? 0, actual: selectedActual.actual_activities },
        { label: 'Discursos',   planned: scenario.speeches_needed_monthly   ?? 0, actual: selectedActual.actual_speeches   },
        { label: 'Reuniones',   planned: scenario.meetings_needed_monthly   ?? 0, actual: selectedActual.actual_meetings   },
        { label: 'Propuestas',  planned: scenario.proposals_needed_monthly  ?? 0, actual: selectedActual.actual_proposals  },
        { label: 'Cierres',     planned: scenario.closes_needed_monthly     ?? 0, actual: selectedActual.actual_closes     },
      ]
    : funnelStages

  const handleSaveActual = async () => {
    if (!form.period_start || !form.period_end) {
      toast.error('Las fechas son obligatorias')
      return
    }
    setSaving(true)
    try {
      const saved = await upsertActual({ scenario_id: scenario.id, ...form })
      toast.success('Resultado real guardado')
      setShowForm(false)
      setSelectedActualId(saved.id)
      router.refresh()
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Funnel visual */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          {selectedActual ? 'Plan vs Real — embudo' : 'Embudo planificado (mensual)'}
        </h3>
        <FunnelChart stages={funnelWithActuals} />
      </div>

      {/* Plan vs Real comparison table */}
      {selectedActual && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Comparación Plan vs Real</h3>
            <span className="text-xs text-muted-foreground">
              {PERIOD_LABELS[selectedActual.period_type]} · {selectedActual.period_start} → {selectedActual.period_end}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Etapa</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Plan</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Real</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Gap</th>
                  <th className="text-right px-5 py-2.5 text-xs font-semibold text-muted-foreground">% Cumpl.</th>
                </tr>
              </thead>
              <tbody>
                {STAGE_KEYS.map(({ label, planKey, actualKey }) => {
                  const plan   = (scenario[planKey] ?? 0) as number
                  const real   = selectedActual[actualKey]
                  const gap    = real - plan
                  const pct    = plan > 0 ? (real / plan) * 100 : 0
                  return (
                    <tr key={label} className="border-b border-border/50 last:border-0 hover:bg-muted/10">
                      <td className="px-5 py-3 font-medium text-foreground">{label}</td>
                      <td className="text-right px-4 py-3 tabular-nums text-muted-foreground">
                        {formatDecimal(plan)}
                      </td>
                      <td className={cn('text-right px-4 py-3 tabular-nums font-semibold', semText(pct))}>
                        {formatDecimal(real)}
                      </td>
                      <td className={cn(
                        'text-right px-4 py-3 tabular-nums',
                        gap >= 0 ? 'text-emerald-400' : 'text-red-400'
                      )}>
                        {gap >= 0 ? '+' : ''}{formatDecimal(gap)}
                      </td>
                      <td className="text-right px-5 py-3">
                        <span className={cn('rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums', semBadge(pct))}>
                          {pct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actuals log */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Historial de resultados</h3>
          <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Agregar período
          </Button>
        </div>

        {/* Add form */}
        {showForm && (
          <div className="p-5 border-b border-border bg-muted/20 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tipo de período</Label>
                <select
                  value={form.period_type}
                  onChange={(e) => setForm({ ...form, period_type: e.target.value as ActualFormState['period_type'] })}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                >
                  <option value="weekly">Semana</option>
                  <option value="monthly">Mes</option>
                  <option value="quarterly">Trimestre</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Fecha inicio</Label>
                <Input
                  type="date"
                  value={form.period_start}
                  onChange={(e) => setForm({ ...form, period_start: e.target.value })}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Fecha fin</Label>
                <Input
                  type="date"
                  value={form.period_end}
                  onChange={(e) => setForm({ ...form, period_end: e.target.value })}
                  className="bg-background"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                { key: 'actual_activities' as const, label: 'Actividades' },
                { key: 'actual_speeches'   as const, label: 'Discursos'   },
                { key: 'actual_meetings'   as const, label: 'Reuniones'   },
                { key: 'actual_proposals'  as const, label: 'Propuestas'  },
                { key: 'actual_closes'     as const, label: 'Cierres'     },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: parseInt(e.target.value) || 0 })}
                    className="bg-background"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveActual} disabled={saving}>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {saving ? 'Guardando…' : 'Guardar'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Actuals list */}
        {actuals.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Aún no hay resultados registrados. Usa el botón &ldquo;Agregar período&rdquo; para registrar datos reales.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left px-5 py-2.5">Período</th>
                  <th className="text-right px-3 py-2.5">Activ.</th>
                  <th className="text-right px-3 py-2.5">Discursos</th>
                  <th className="text-right px-3 py-2.5">Reuniones</th>
                  <th className="text-right px-3 py-2.5">Propuestas</th>
                  <th className="text-right px-5 py-2.5">Cierres</th>
                </tr>
              </thead>
              <tbody>
                {actuals.map((a) => {
                  const planned = scenario.closes_needed_monthly ?? 1
                  const closePct = planned > 0 ? (a.actual_closes / planned) * 100 : 0
                  const isSelected = a.id === selectedActualId
                  return (
                    <tr
                      key={a.id}
                      onClick={() => setSelectedActualId(a.id)}
                      className={cn(
                        'border-b border-border last:border-0 cursor-pointer transition-colors',
                        isSelected ? 'bg-blue-400/5' : 'hover:bg-muted/20'
                      )}
                    >
                      <td className="px-5 py-2.5 font-medium">
                        <div className="flex items-center gap-2">
                          {isSelected && (
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                          )}
                          <div>
                            <div>{PERIOD_LABELS[a.period_type]} · {a.period_start}</div>
                            <div className="text-xs text-muted-foreground">{a.period_start} → {a.period_end}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-right px-3 py-2.5 tabular-nums">{a.actual_activities}</td>
                      <td className="text-right px-3 py-2.5 tabular-nums">{a.actual_speeches}</td>
                      <td className="text-right px-3 py-2.5 tabular-nums">{a.actual_meetings}</td>
                      <td className="text-right px-3 py-2.5 tabular-nums">{a.actual_proposals}</td>
                      <td className={cn(
                        'text-right px-5 py-2.5 tabular-nums font-semibold',
                        closePct >= 100 ? 'text-emerald-400' : closePct >= 70 ? 'text-amber-400' : 'text-red-400'
                      )}>
                        {a.actual_closes}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="px-5 py-2 text-xs text-muted-foreground/60 border-t border-border">
              Haz clic en una fila para ver la comparación Plan vs Real
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
