'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Trash2, BarChart2, Copy, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { formatCurrency, formatDecimal } from '@/lib/utils/formatters'
import { deleteScenario, setActiveScenario, duplicateScenario } from '@/lib/queries/recipe'
import type { RecipeScenario } from '@/lib/types/database'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface ScenarioCardProps {
  scenario: RecipeScenario
}

export function ScenarioCard({ scenario: s }: ScenarioCardProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [open, setOpen] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteScenario(s.id)
      toast.success('Escenario eliminado')
      router.refresh()
    } catch {
      toast.error('Error al eliminar')
      setDeleting(false)
    }
  }

  const handleSetActive = async () => {
    try {
      await setActiveScenario(s.id)
      toast.success(`"${s.name}" ahora es el escenario activo`)
      router.refresh()
    } catch {
      toast.error('Error al activar')
    }
  }

  const handleDuplicate = async () => {
    try {
      const copy = await duplicateScenario(s.id)
      toast.success('Escenario duplicado')
      router.push(`/recipe/${copy.id}`)
    } catch {
      toast.error('Error al duplicar')
    }
  }

  return (
    <>
      <div
        className={cn(
          'rounded-lg border bg-card p-5 flex flex-col gap-4 transition-colors',
          s.is_active
            ? 'border-emerald-400/40 shadow-[0_0_0_1px_theme(colors.emerald.400/20)]'
            : 'border-border'
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground truncate">{s.name}</h3>
              {s.is_active && (
                <span className="shrink-0 rounded-full bg-emerald-400/10 border border-emerald-400/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                  Activo
                </span>
              )}
            </div>
            {s.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{s.description}</p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground shrink-0"
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Link href={`/recipe/${s.id}`} className="flex items-center gap-2 w-full">
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDuplicate}>
                <Copy className="h-3.5 w-3.5" />
                Duplicar
              </DropdownMenuItem>
              {!s.is_active && (
                <DropdownMenuItem onClick={handleSetActive}>
                  <Zap className="h-3.5 w-3.5" />
                  Establecer como activo
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-400 focus:text-red-400"
                onClick={() => setOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Meta mensual" value={formatCurrency(s.monthly_revenue_goal)} />
          <Stat label="Ticket promedio" value={formatCurrency(s.average_ticket)} />
          <Stat label="Actividades/día" value={formatDecimal(s.activities_needed_daily ?? 0)} accent />
          <Stat label="Actividades/mes" value={formatDecimal(s.activities_needed_monthly ?? 0)} accent />
        </div>

        {/* Outbound conversion chain — dynamic rates from JSONB */}
        <div>
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1">
            Outbound ({(s.funnel_stages ?? []).join(' → ')})
          </p>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground overflow-x-auto">
            {(s.outbound_rates ?? []).map((rate, i) => (
              <span key={i} className="flex items-center gap-1 shrink-0">
                {i > 0 && <span className="text-muted-foreground/40">·</span>}
                <ConvPill value={rate} />
              </span>
            ))}
          </div>
        </div>

        {/* CTA */}
        <Link
          href={`/recipe/${s.id}`}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full')}
        >
          <BarChart2 className="h-3.5 w-3.5 mr-1.5" />
          Ver análisis
        </Link>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar escenario</DialogTitle>
            <DialogDescription>
              ¿Seguro que quieres eliminar &ldquo;{s.name}&rdquo;? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-accent"
            >
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

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded bg-muted/30 px-2.5 py-1.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${accent ? 'text-emerald-400' : 'text-foreground'}`}>{value}</p>
    </div>
  )
}

function ConvPill({ value }: { value: number }) {
  const color =
    value >= 30 ? 'text-emerald-400' : value >= 15 ? 'text-amber-400' : 'text-red-400'
  return <span className={`shrink-0 font-medium ${color}`}>{value}%</span>
}
