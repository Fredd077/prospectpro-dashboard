import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CoachProCardProps {
  weekLabel: string
  hasMessage: boolean
  compliancePct: number
}

export function CoachProCard({ weekLabel, hasMessage, compliancePct }: CoachProCardProps) {
  const badgeClass = compliancePct >= 100
    ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
    : compliancePct >= 70
    ? 'text-amber-400 bg-amber-400/10 border-amber-400/20'
    : 'text-red-400 bg-red-400/10 border-red-400/20'

  return (
    <Link
      href="/coach?type=weekly"
      className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-4 flex items-center gap-4 hover:bg-cyan-400/10 transition-colors"
    >
      {/* Icon */}
      <div className="shrink-0 text-base leading-none">🤖</div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          Ver tu análisis semanal Coach Pro
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{weekLabel}</p>
      </div>

      {/* Badge + arrow */}
      <div className="flex items-center gap-2 shrink-0">
        {hasMessage && (
          <span className={cn('rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums', badgeClass)}>
            {Math.round(compliancePct)}%
          </span>
        )}
        <ArrowRight className="h-4 w-4 text-cyan-400" />
      </div>
    </Link>
  )
}
