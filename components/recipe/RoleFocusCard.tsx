'use client'

import { Target, Trophy } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/formatters'
import { findHandoffStageIndex, type RecipeOutputs, type SalesPosition } from '@/lib/calculations/recipe'

interface RoleFocusCardProps {
  salesPosition: SalesPosition
  outputs: RecipeOutputs
  monthlyRevenueGoal: number
}

/**
 * Resumen de meta enfocado en lo que le toca a CADA cargo del embudo, en vez
 * de obligar a un BDR/SDR a leer un tablero pensado para alguien que también
 * cierra (o viceversa). No reemplaza el detalle de Outbound/Inbound de abajo
 * — es un atajo arriba con el número que a ese cargo más le importa.
 *
 * Sin cargo definido ('full_cycle' o null) no se muestra nada: la pantalla
 * se ve exactamente igual que antes de este feature.
 */
export function RoleFocusCard({ salesPosition, outputs, monthlyRevenueGoal }: RoleFocusCardProps) {
  if (salesPosition !== 'bdr_sdr' && salesPosition !== 'closer') return null

  const stageNames = outputs.outbound.stage_names
  const handoff = findHandoffStageIndex(stageNames)
  const handoffLabel = stageNames[handoff] ?? 'Reunión'

  const reunionesNecesarias =
    (outputs.outbound.stage_values[handoff] ?? 0) + (outputs.inbound.stage_values[handoff] ?? 0)

  if (salesPosition === 'bdr_sdr') {
    return (
      <div className="rounded-lg border border-cyan-400/30 bg-cyan-400/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-cyan-400" />
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-400">Tu meta como BDR/SDR</p>
        </div>
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-2xl font-mono font-bold text-foreground leading-none">
              {outputs.activities_needed_daily}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">actividades de prospección / día</p>
          </div>
          <div>
            <p className="text-2xl font-mono font-bold text-cyan-300 leading-none">{reunionesNecesarias}</p>
            <p className="text-[11px] text-muted-foreground mt-1">&quot;{handoffLabel}&quot; a agendar / mes</p>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground/70">
          Tu trabajo termina al agendar — el cierre es responsabilidad del Closer que recibe la reunión.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-emerald-400" />
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Tu meta como Closer</p>
      </div>
      <div className="flex flex-wrap gap-6">
        <div>
          <p className="text-2xl font-mono font-bold text-foreground leading-none">{reunionesNecesarias}</p>
          <p className="text-[11px] text-muted-foreground mt-1">&quot;{handoffLabel}&quot; a ejecutar / mes</p>
        </div>
        <div>
          <p className="text-2xl font-mono font-bold text-emerald-300 leading-none">
            {outputs.closes_needed_monthly}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">cierres necesarios / mes</p>
        </div>
        <div>
          <p className="text-2xl font-mono font-bold text-foreground leading-none">
            {formatCurrency(monthlyRevenueGoal)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">facturación proyectada</p>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground/70">
        Las reuniones que llegan ya vienen agendadas por tu BDR/SDR — tu número es el % de cierre sobre esas reuniones.
      </p>
    </div>
  )
}
