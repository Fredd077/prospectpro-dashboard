import { cn } from '@/lib/utils'
import { semaphoreBgClass } from '@/lib/utils/colors'
import type { SemaphoreColor } from '@/lib/types/common'

interface ComplianceBadgeProps {
  pct: number | null
  semaphore: SemaphoreColor
  size?: 'sm' | 'md'
}

export function ComplianceBadge({ pct, semaphore, size = 'md' }: ComplianceBadgeProps) {
  if (semaphore === 'no_goal' || pct === null) {
    return (
      <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        Sin meta
      </span>
    )
  }

  return (
    <span
      className={cn(
        'rounded-md border px-2 py-0.5 font-medium tabular-nums',
        semaphoreBgClass(semaphore),
        size === 'sm' ? 'text-xs' : 'text-sm'
      )}
    >
      {pct.toFixed(1)}%
    </span>
  )
}
