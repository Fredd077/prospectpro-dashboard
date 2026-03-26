import { getSemaphoreColor } from '@/lib/utils/colors'
import type { SemaphoreColor } from '@/lib/types/common'

export interface ComplianceResult {
  pct: number
  semaphore: SemaphoreColor
  real: number
  goal: number
  deviation: number
}

export function calcCompliance(real: number, goal: number): ComplianceResult {
  const pct = goal === 0 ? 0 : (real / goal) * 100
  const semaphore = goal === 0 ? 'no_goal' : getSemaphoreColor(pct)
  return {
    pct: Math.round(pct * 10) / 10,
    semaphore,
    real,
    goal,
    deviation: real - goal,
  }
}

/** Aggregate compliance across multiple activities */
export function calcAggregateCompliance(
  items: Array<{ real_executed: number; day_goal: number }>
): ComplianceResult {
  const totalReal = items.reduce((s, i) => s + i.real_executed, 0)
  const totalGoal = items.reduce((s, i) => s + i.day_goal, 0)
  return calcCompliance(totalReal, totalGoal)
}
