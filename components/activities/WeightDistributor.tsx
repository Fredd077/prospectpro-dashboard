'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Trash2, Plus, FlaskConical } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { deleteActivity } from '@/lib/queries/activities'
import type { Activity, RecipeScenario } from '@/lib/types/database'
import { cn } from '@/lib/utils'

interface WeightDistributorProps {
  activities: Activity[]
  activeScenario: RecipeScenario | null
}

export function WeightDistributor({ activities, activeScenario }: WeightDistributorProps) {
  const router = useRouter()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const outbound = activities.filter((a) => a.type === 'OUTBOUND')
  const inbound  = activities.filter((a) => a.type === 'INBOUND')

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

  const renderSection = (type: 'OUTBOUND' | 'INBOUND', list: Activity[]) => {
    const accentColor = type === 'OUTBOUND' ? 'text-blue-400' : 'text-violet-400'

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className={cn('text-xs font-bold uppercase tracking-widest', accentColor)}>
            {type}
          </span>
          <span className="text-xs text-muted-foreground">{list.length} actividad{list.length !== 1 ? 'es' : ''}</span>
        </div>

        {list.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            No hay actividades {type.toLowerCase()}.
          </p>
        ) : (
          <div className="space-y-2">
            {list.map((act) => (
              <div
                key={act.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
              >
                {/* Name + channel */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{act.name}</p>
                  <p className="text-[10px] text-muted-foreground/60 truncate">{act.channel}</p>
                </div>

                {/* Status badge */}
                <Badge
                  variant="outline"
                  className={cn(
                    'shrink-0 text-[10px]',
                    act.status === 'active'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      : 'border-border bg-muted/30 text-muted-foreground',
                  )}
                >
                  {act.status === 'active' ? 'Activa' : 'Inactiva'}
                </Badge>

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
            ))}
          </div>
        )}

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
        {/* Active recipe chip */}
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-4 py-3 w-fit">
          <FlaskConical className="h-4 w-4 text-muted-foreground shrink-0" />
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Recetario activo</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">
              {activeScenario?.name ?? <span className="text-muted-foreground italic">Sin recetario activo</span>}
            </p>
          </div>
        </div>

        {/* OUTBOUND section */}
        {renderSection('OUTBOUND', outbound)}

        {/* INBOUND section */}
        {renderSection('INBOUND', inbound)}
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
