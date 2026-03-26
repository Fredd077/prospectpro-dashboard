'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Trash2, TrendingUp, TrendingDown, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { GoalForm } from './GoalForm'
import { GoalProgressBar } from './GoalProgressBar'
import { calcCompliance } from '@/lib/calculations/compliance'
import { deleteGoal } from '@/lib/queries/goals'
import { formatPercent } from '@/lib/utils/formatters'
import { semaphoreBgClass } from '@/lib/utils/colors'
import { elapsedDays, totalDays } from '@/lib/utils/dates'
import { cn } from '@/lib/utils'
import type { Goal } from '@/lib/types/database'

interface GoalWithProgress extends Goal {
  real?: number
}

interface GoalPeriodGridProps {
  goals: GoalWithProgress[]
  activities: Array<{ id: string; name: string }>
}

const PERIOD_LABELS: Record<string, string> = {
  daily:     'Diaria',
  weekly:    'Semanal',
  monthly:   'Mensual',
  quarterly: 'Trimestral',
}

export function GoalPeriodGrid({ goals, activities }: GoalPeriodGridProps) {
  const router = useRouter()
  const [editing, setEditing] = useState<Goal | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Goal | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      await deleteGoal(confirmDelete.id)
      toast.success('Meta eliminada')
      router.refresh()
      setConfirmDelete(null)
    } catch {
      toast.error('Error al eliminar')
    } finally {
      setDeleting(false)
    }
  }

  if (goals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground gap-2">
        <p>No hay metas definidas.</p>
        <p className="text-xs">Crea tu primera meta usando el botón de arriba.</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {goals.map((goal) => {
          const real       = goal.real ?? 0
          const compliance = calcCompliance(real, goal.target_value)
          const activityName = activities.find((a) => a.id === goal.activity_id)?.name

          // Projection
          const elapsed = elapsedDays(goal.period_start, goal.period_end)
          const total   = totalDays(goal.period_start, goal.period_end)
          const pctElapsed = total > 0 ? (elapsed / total) * 100 : 0
          const projected  = elapsed > 0 ? Math.round((real / elapsed) * total) : 0
          const projPct    = goal.target_value > 0 ? (projected / goal.target_value) * 100 : 0
          const showProjection = pctElapsed >= 20 && pctElapsed < 100

          return (
            <div key={goal.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                        semaphoreBgClass(compliance.semaphore)
                      )}
                    >
                      {formatPercent(compliance.pct)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {PERIOD_LABELS[goal.period_type] ?? goal.period_type}
                    </span>
                  </div>
                  <h3 className="mt-1 text-sm font-semibold text-foreground">
                    {goal.label ?? `${goal.period_start} → ${goal.period_end}`}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {activityName ?? <span className="italic text-muted-foreground/60">Meta global</span>}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditing(goal)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-red-400 hover:text-red-400"
                    onClick={() => setConfirmDelete(goal)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Progress bar */}
              <GoalProgressBar
                label="Progreso"
                real={real}
                goal={goal.target_value}
                semaphore={compliance.semaphore}
                subLabel={`Meta: ${goal.target_value}`}
              />

              {/* Stats row */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Desviación</span>
                <span className={cn(
                  'font-medium tabular-nums',
                  compliance.deviation >= 0 ? 'text-emerald-400' : 'text-red-400'
                )}>
                  {compliance.deviation >= 0 ? '+' : ''}{compliance.deviation}
                </span>
              </div>

              {/* Elapsed progress */}
              {pctElapsed > 0 && pctElapsed < 100 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Período
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {elapsed}d / {total}d ({pctElapsed.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-muted-foreground/40 transition-all"
                      style={{ width: `${Math.min(pctElapsed, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Projection */}
              {showProjection && (
                <div className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs',
                  projPct >= 100
                    ? 'bg-emerald-400/5 text-emerald-400'
                    : projPct >= 70
                    ? 'bg-amber-400/5 text-amber-400'
                    : 'bg-red-400/5 text-red-400'
                )}>
                  {projPct >= 100
                    ? <TrendingUp className="h-3 w-3 shrink-0" />
                    : <TrendingDown className="h-3 w-3 shrink-0" />
                  }
                  <span>
                    Proyección: <span className="font-semibold tabular-nums">~{projected}</span>
                    {' '}de {goal.target_value}
                    {' '}({projPct >= 100 ? '¡En camino!' : `${projPct.toFixed(0)}% proyectado`})
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar meta</DialogTitle>
          </DialogHeader>
          {editing && (
            <GoalForm goal={editing} activities={activities} onClose={() => setEditing(null)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar meta</DialogTitle>
            <DialogDescription>Esta acción no se puede deshacer. ¿Confirmas?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-accent">
              Cancelar
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
