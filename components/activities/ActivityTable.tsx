'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Trash2, Plus } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ActivityStatusBadge } from './ActivityStatusBadge'
import { deleteActivity } from '@/lib/queries/activities'
import type { Activity } from '@/lib/types/database'
import { cn } from '@/lib/utils'

const TYPE_LABELS: Record<string, string> = {
  OUTBOUND: 'Outbound',
  INBOUND: 'Inbound',
}

const CHANNEL_LABELS: Record<string, string> = {
  cold_call: 'Llamada fría',
  cold_message: 'Mensaje frío',
  linkedin_dm: 'DM LinkedIn',
  linkedin_post: 'Post LinkedIn',
  linkedin_comment: 'Comentario LinkedIn',
  networking_event: 'Evento Networking',
  networking_lead: 'Lead Networking',
  referral: 'Referido',
  mkt_lead: 'Lead MKT',
  vsl_lead: 'Lead VSL',
  other: 'Otro',
}

interface ActivityTableProps {
  activities: Activity[]
}

export function ActivityTable({ activities }: ActivityTableProps) {
  const router = useRouter()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete() {
    if (!deleteId) return
    setIsDeleting(true)
    try {
      await deleteActivity(deleteId)
      toast.success('Actividad eliminada')
      router.refresh()
    } catch {
      toast.error('Error al eliminar la actividad')
    } finally {
      setIsDeleting(false)
      setDeleteId(null)
    }
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16 text-center">
        <p className="text-sm font-medium text-foreground">Sin actividades</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Crea tu primera actividad para comenzar.
        </p>
        <Link
          href="/activities/new"
          className={cn(buttonVariants({ size: 'sm' }), 'mt-4')}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nueva actividad
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-[280px]">Actividad</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead className="text-right">Meta diaria</TableHead>
              <TableHead className="text-right">Meta semanal</TableHead>
              <TableHead className="text-right">Meta mensual</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-[48px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.map((activity) => (
              <TableRow key={activity.id} className="border-border">
                <TableCell className="font-medium">{activity.name}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      activity.type === 'OUTBOUND'
                        ? 'border-blue-400/30 bg-blue-400/10 text-blue-400'
                        : 'border-violet-400/30 bg-violet-400/10 text-violet-400'
                    }
                  >
                    {TYPE_LABELS[activity.type] ?? activity.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {CHANNEL_LABELS[activity.channel] ?? activity.channel}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {activity.daily_goal}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {activity.weekly_goal}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {activity.monthly_goal}
                </TableCell>
                <TableCell>
                  <ActivityStatusBadge status={activity.status} />
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Acciones</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Link
                          href={`/activities/${activity.id}`}
                          className="flex items-center gap-2 w-full"
                        >
                          <Pencil className="h-4 w-4" />
                          Editar
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteId(activity.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar actividad?</DialogTitle>
            <DialogDescription>
              Esta acción eliminará también todos los registros diarios asociados.
              No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
