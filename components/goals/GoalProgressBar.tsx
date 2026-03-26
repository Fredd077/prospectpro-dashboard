'use client'

import { cn } from '@/lib/utils'
import { semaphoreHex } from '@/lib/utils/colors'
import type { SemaphoreColor } from '@/lib/types/common'

interface GoalProgressBarProps {
  label: string
  real: number
  goal: number
  semaphore: SemaphoreColor
  subLabel?: string
}

export function GoalProgressBar({ label, real, goal, semaphore, subLabel }: GoalProgressBarProps) {
  const pct = goal > 0 ? Math.min((real / goal) * 100, 100) : 0
  const color = semaphoreHex(semaphore)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div>
          <span className="font-medium text-foreground">{label}</span>
          {subLabel && <span className="ml-2 text-muted-foreground">{subLabel}</span>}
        </div>
        <span className="tabular-nums text-muted-foreground">
          {real} / {goal}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}
