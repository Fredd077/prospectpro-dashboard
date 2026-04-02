'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Trash2, Plus, AlertTriangle, CheckCircle2, FlaskConical } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { saveWeightDistribution } from '@/lib/actions/activities'
import { deleteActivity } from '@/lib/queries/activities'
import type { Activity, RecipeScenario } from '@/lib/types/database'
import { cn } from '@/lib/utils'

interface WeightDistributorProps {
  activities: Activity[]
  activeScenario: RecipeScenario | null
}

function calcGoals(weight: number, typeTotal: number, workingDays: number) {
  const monthly = Math.ceil(typeTotal * weight / 100)
  const weekly  = Math.ceil(monthly / 4)
  const daily   = Math.ceil(monthly / workingDays)
  return { monthly, weekly, daily }
}

function ValidationBadge({ sum, typeTotal }: { sum: number; typeTotal: number }) {
  const gap = Math.round((100 - sum) * 10) / 10
  const unassigned = Math.round(typeTotal * Math.abs(gap) / 100)
  const exact = Math.abs(gap) < 0.05

  if (exact) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Distribución completa ✅
      </div>
    )
  }
  if (gap > 0) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-medium">
        <AlertTriangle className="h-3.5 w-3.5" />
        Falta {gap}% por asignar ({unassigned} actividades sin distribuir)
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-red-400 font-medium">
      <AlertTriangle className="h-3.5 w-3.5" />
      Excedes en {Math.abs(gap)}% — reduce el peso de alguna actividad
    </div>
  )
}

export function WeightDistributor({ activities, activeScenario }: WeightDistributorProps) {
  const router = useRouter()
  const [weights, setWeights] = useState<Record<string, number>>(
    () => Object.fromEntries(activities.map((a) => [a.id, a.weight ?? 0])),
  )
  const [saving, setSaving]   = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const outbound = activities.filter((a) => a.type === 'OUTBOUND' && a.status === 'active')
  const inbound  = activities.filter((a) => a.type === 'INBOUND'  && a.status === 'active')

  const totalMonthly   = activeScenario?.activities_needed_monthly ?? 0
  const outboundPct    = activeScenario?.outbound_pct ?? 60
  const outboundTotal  = Math.round(totalMonthly * outboundPct / 100)
  const inboundTotal   = totalMonthly - outboundTotal
  const workingDays    = activeScenario?.working_days_per_month ?? 20

  const outSum = outbound.reduce((s, a) => s + (weights[a.id] ?? 0), 0)
  const inSum  = inbound.reduce((s, a)  => s + (weights[a.id] ?? 0), 0)
  const outOk  = outbound.length === 0 || Math.abs(outSum - 100) < 0.05
  const inOk   = inbound.length  === 0 || Math.abs(inSum  - 100) < 0.05
  const canSave = outOk && inOk && !!activeScenario

  function setWeight(id: string, val: number) {
    setWeights((prev) => ({ ...prev, [id]: Math.max(0, Math.min(100, Math.round(val * 100) / 100)) }))
  }

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    try {
      const allActive = activities.filter((a) => a.status === 'active')
      const updates = allActive.map((a) => {
        const w = weights[a.id] ?? 0
        const typeTotal = a.type === 'OUTBOUND' ? outboundTotal : inboundTotal
        const { monthly, weekly, daily } = calcGoals(w, typeTotal, workingDays)
        return { id: a.id, weight: w, monthly_goal: monthly, weekly_goal: weekly, daily_goal: daily }
      })
      await saveWeightDistribution(updates)
      toast.success('Distribución guardada ✓')
      router.refresh()
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    setIsDeleting(true)
    try {
      await deleteActivity(deleteId)
      toast.success('Actividad eliminada')
      setDeleteId(null)
      router.refresh()
    } catch {
      toast.error('Error al eliminar')
    } finally {
      setIsDeleting(false)
    }
  }

  if (!activeScenario) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <FlaskConical className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-foreground">Configura tu Recetario primero</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            La distribución de actividades requiere un Recetario activo para calcular las metas automáticamente.
          </p>
        </div>
        <Link
          href="/recipe"
          className="rounded-md bg-primary/10 border border-primary/30 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
        >
          Ir al Recetario →
        </Link>
      </div>
    )
  }

  const renderSection = (
    type: 'OUTBOUND' | 'INBOUND',
    list: Activity[],
    typeTotal: number,
    weightSum: number,
    isValid: boolean,
  ) => {
    const accentColor = type === 'OUTBOUND' ? 'text-blue-400' : 'text-violet-400'
    const barColor    = type === 'OUTBOUND' ? 'bg-blue-400'   : 'bg-violet-400'
    const filledPct   = Math.min(weightSum, 100)

    return (
      <div className="space-y-3">
        {/* Section header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className={cn('text-xs font-bold uppercase tracking-widest', accentColor)}>
              {type}
            </span>
            <span className="text-xs text-muted-foreground ml-2">
              — {typeTotal} actividades/mes según tu recetario
            </span>
          </div>
          <ValidationBadge sum={weightSum} typeTotal={typeTotal} />
        </div>

        {/* Group progress bar */}
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              Math.abs(weightSum - 100) < 0.05 ? 'bg-emerald-400' : weightSum > 100 ? 'bg-red-400' : barColor,
            )}
            style={{ width: `${filledPct}%` }}
          />
        </div>

        {/* Activity rows */}
        {list.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            No hay actividades {type.toLowerCase()} activas.
          </p>
        ) : (
          <div className="space-y-2">
            {list.map((act) => {
              const w = weights[act.id] ?? 0
              const { monthly, weekly, daily } = calcGoals(w, typeTotal, workingDays)
              return (
                <div
                  key={act.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
                >
                  {/* Name + channel */}
                  <div className="min-w-0 w-36 shrink-0">
                    <p className="text-sm font-medium text-foreground truncate">{act.name}</p>
                    <p className="text-[10px] text-muted-foreground/60 truncate">{act.channel}</p>
                  </div>

                  {/* Weight input + bar */}
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        value={w}
                        min={0}
                        max={100}
                        step={0.01}
                        onChange={(e) => setWeight(act.id, parseFloat(e.target.value) || 0)}
                        className="w-16 rounded border border-border bg-background px-2 py-1 text-center text-sm font-data text-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-200', barColor, 'opacity-70')}
                          style={{ width: `${Math.min(w, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Calculated goals */}
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-data text-foreground">
                      <span className="font-semibold">{monthly}</span>
                      <span className="text-muted-foreground">/mes</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground font-data">
                      {weekly}/sem · {daily}/día
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex items-center gap-0.5">
                    <Link
                      href={`/activities/${act.id}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      onClick={() => setDeleteId(act.id)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Add activity link */}
        <Link
          href={`/activities/new?type=${type}`}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar actividad {type === 'OUTBOUND' ? 'Outbound' : 'Inbound'}
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-8">
        {/* Recipe totals banner */}
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Recetario activo',       value: activeScenario.name,                          accent: false },
            { label: 'Total actividades/mes',  value: `${totalMonthly}`,                            accent: true  },
            { label: 'Outbound',               value: `${outboundTotal} act/mes`,                   accent: false },
            { label: 'Inbound',                value: `${inboundTotal} act/mes`,                    accent: false },
            { label: 'Días hábiles/mes',       value: `${workingDays}`,                             accent: false },
          ].map(({ label, value, accent }) => (
            <div key={label} className="rounded-lg border border-border bg-card px-3 py-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
              <p className={cn('text-sm font-semibold font-data mt-0.5', accent ? 'text-emerald-400' : 'text-foreground')}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* OUTBOUND section */}
        {renderSection('OUTBOUND', outbound, outboundTotal, outSum, outOk)}

        {/* INBOUND section */}
        {renderSection('INBOUND', inbound, inboundTotal, inSum, inOk)}

        {/* Save */}
        <div className="flex items-center gap-3 pt-2 border-t border-border">
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            title={!canSave ? 'Completa la distribución al 100% para guardar' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold transition-all',
              canSave && !saving
                ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:shadow-[0_0_16px_rgba(0,217,255,0.2)]'
                : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50',
            )}
          >
            {saving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />}
            {saving ? 'Guardando...' : 'Guardar distribución'}
          </button>
          {!canSave && (
            <p className="text-xs text-muted-foreground">
              Completa la distribución al 100% en ambos grupos para guardar
            </p>
          )}
        </div>
      </div>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar actividad?</DialogTitle>
            <DialogDescription>
              Esta acción eliminará también todos los registros diarios asociados. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
