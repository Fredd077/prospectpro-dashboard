import { cn } from '@/lib/utils'
import { semaphoreTextClass } from '@/lib/utils/colors'
import type { SemaphoreColor } from '@/lib/types/common'

interface KpiCardProps {
  label: string
  value: string | number
  subValue?: string
  semaphore?: SemaphoreColor
  description?: string
  icon?: React.ReactNode
}

export function KpiCard({
  label,
  value,
  subValue,
  semaphore,
  description,
  icon,
}: KpiCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span
          className={cn(
            'text-2xl font-bold tabular-nums',
            semaphore && semaphoreTextClass(semaphore)
          )}
        >
          {value}
        </span>
        {subValue && (
          <span className="text-sm text-muted-foreground">{subValue}</span>
        )}
      </div>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  )
}
