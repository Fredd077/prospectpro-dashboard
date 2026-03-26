import type { SemaphoreColor } from '@/lib/types/common'

export function getSemaphoreColor(compliancePct: number | null): SemaphoreColor {
  if (compliancePct === null) return 'no_goal'
  if (compliancePct >= 100) return 'green'
  if (compliancePct >= 70) return 'yellow'
  return 'red'
}

/** Tailwind text color class for semaphore */
export function semaphoreTextClass(color: SemaphoreColor): string {
  switch (color) {
    case 'green':   return 'text-emerald-400'
    case 'yellow':  return 'text-amber-400'
    case 'red':     return 'text-red-400'
    default:        return 'text-muted-foreground'
  }
}

/** Tailwind bg color class for semaphore badges */
export function semaphoreBgClass(color: SemaphoreColor): string {
  switch (color) {
    case 'green':   return 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20'
    case 'yellow':  return 'bg-amber-400/10 text-amber-400 border-amber-400/20'
    case 'red':     return 'bg-red-400/10 text-red-400 border-red-400/20'
    default:        return 'bg-muted text-muted-foreground border-border'
  }
}

/** Hex color for Recharts (chart elements) */
export function semaphoreHex(color: SemaphoreColor): string {
  switch (color) {
    case 'green':  return '#34d399'  // emerald-400
    case 'yellow': return '#fbbf24'  // amber-400
    case 'red':    return '#f87171'  // red-400
    default:       return '#71717a'  // zinc-500
  }
}

/** Chart palette — consistent colors across all charts */
export const CHART_COLORS = {
  blue:    '#60a5fa',  // blue-400
  emerald: '#34d399',  // emerald-400
  amber:   '#fbbf24',  // amber-400
  violet:  '#a78bfa',  // violet-400
  rose:    '#fb7185',  // rose-400
  cyan:    '#22d3ee',  // cyan-400
  goal:    '#3f3f46',  // zinc-700 (ghost bar for goals)
  real:    '#60a5fa',  // blue-400 (actual bar)
} as const
