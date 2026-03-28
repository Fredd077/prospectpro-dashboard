import { cn } from '@/lib/utils'
import type { RecipeValidation, GapStatus } from '@/lib/utils/recipe-validation'

interface RecipePaceWidgetProps {
  validation: RecipeValidation
  weeklyOutbound: number
  weeklyInbound: number
}

function paceStatus(real: number, target: number): GapStatus {
  if (target === 0) return 'above'
  const pct = real / target
  if (pct >= 0.9) return 'above'
  if (pct >= 0.7) return 'close'
  return 'below'
}

function PaceRow({
  label,
  real,
  target,
}: {
  label: string
  real: number
  target: number
}) {
  const pct = target > 0 ? Math.min((real / target) * 100, 100) : 0
  const status = paceStatus(real, target)

  const barColor =
    status === 'above' ? 'bg-emerald-400' : status === 'close' ? 'bg-amber-400' : 'bg-red-400'

  const textColor =
    status === 'above' ? 'text-emerald-400' : status === 'close' ? 'text-amber-400' : 'text-red-400'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          <span className={cn('font-semibold', textColor)}>{real}</span>
          <span className="text-muted-foreground"> de {target} necesarias</span>
          <span className={cn('ml-1.5 font-medium', textColor)}>({Math.round(pct)}%)</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function RecipePaceWidget({ validation, weeklyOutbound, weeklyInbound }: RecipePaceWidgetProps) {
  const weeklyTotal = weeklyOutbound + weeklyInbound
  const weeklyTarget = validation.weeklyRecipe.total
  const status = paceStatus(weeklyTotal, weeklyTarget)

  const message =
    status === 'above'
      ? '¡Vas bien! Sigue así para alcanzar tu meta del mes'
      : status === 'close'
      ? 'Vas un poco lento, intenta acelerar el ritmo'
      : 'Estás por debajo del ritmo necesario para cerrar el mes'

  const messageBg =
    status === 'above'
      ? 'border-emerald-400/20 bg-emerald-400/5 text-emerald-400'
      : status === 'close'
      ? 'border-amber-400/20 bg-amber-400/5 text-amber-400'
      : 'border-red-400/20 bg-red-400/5 text-red-400'

  return (
    <div className="rounded-lg border border-border bg-card/50 p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        ¿Estás en camino?
      </p>

      {/* Status message */}
      <div className={cn('rounded-md border px-3 py-2 text-xs font-medium', messageBg)}>
        {message}
      </div>

      {/* Pace bars */}
      <div className="space-y-2.5">
        <PaceRow label="Total esta semana"    real={weeklyTotal}    target={weeklyTarget} />
        <PaceRow label="Outbound esta semana" real={weeklyOutbound} target={validation.weeklyRecipe.outbound} />
        <PaceRow label="Inbound esta semana"  real={weeklyInbound}  target={validation.weeklyRecipe.inbound} />
      </div>

      <p className="text-[10px] text-muted-foreground">
        Basado en: <span className="text-foreground">{validation.scenario.name}</span>
      </p>
    </div>
  )
}
