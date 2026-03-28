import { cn } from '@/lib/utils'
import type { SemaphoreColor } from '@/lib/types/common'

interface KpiCardProps {
  label: string
  value: string | number
  subValue?: string
  semaphore?: SemaphoreColor
  description?: string
  icon?: React.ReactNode
}

function semaphoreAccent(sem: SemaphoreColor | undefined): string {
  if (sem === 'green')   return '#00FF9D'
  if (sem === 'yellow')  return '#F59E0B'
  if (sem === 'red')     return '#FF3B5C'
  return 'oklch(1 0 0 / 12%)'
}

function semaphoreTextClass(sem: SemaphoreColor | undefined) {
  if (sem === 'green')  return 'text-emerald-400'
  if (sem === 'yellow') return 'text-amber-400'
  if (sem === 'red')    return 'text-red-400'
  return 'text-foreground'
}

export function KpiCard({
  label,
  value,
  subValue,
  semaphore,
  description,
  icon,
}: KpiCardProps) {
  const accent = semaphoreAccent(semaphore)

  return (
    <div
      className={cn(
        'relative rounded-lg border border-border bg-card p-5 overflow-hidden',
        'border-t-2 transition-all duration-300',
        'hover:border-border/80',
      )}
      style={{
        borderTopColor: accent,
        ['--kpi-accent' as string]: accent,
      }}
    >
      {/* Subtle accent glow in top corner */}
      <div
        className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full opacity-[0.06] blur-2xl"
        style={{ background: accent }}
      />

      <div className="relative flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          {label}
        </p>
        {icon && (
          <div className="text-muted-foreground/50 mt-0.5">{icon}</div>
        )}
      </div>

      <div className="relative mt-3 flex items-baseline gap-1.5">
        <span
          className={cn(
            'font-data text-3xl font-bold leading-none',
            semaphoreTextClass(semaphore)
          )}
        >
          {value}
        </span>
        {subValue && (
          <span className="font-data text-sm text-muted-foreground">{subValue}</span>
        )}
      </div>

      {description && (
        <p className="relative mt-2 text-[11px] text-muted-foreground/70">{description}</p>
      )}
    </div>
  )
}
