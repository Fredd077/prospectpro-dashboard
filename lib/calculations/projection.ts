import { elapsedDays, totalDays } from '@/lib/utils/dates'

export interface ProjectionResult {
  projected: number
  goal: number
  projectedPct: number
  daysElapsed: number
  daysTotal: number
}

/**
 * Linear extrapolation: if we keep the current pace, what will we reach by period end?
 * projected = (real / elapsed_days) * total_days
 */
export function calcProjection(
  real: number,
  goal: number,
  periodStart: string,
  periodEnd: string
): ProjectionResult {
  const daysElapsed = elapsedDays(periodStart, periodEnd)
  const daysTotal = totalDays(periodStart, periodEnd)
  const dailyRate = daysElapsed > 0 ? real / daysElapsed : 0
  const projected = Math.round(dailyRate * daysTotal)
  const projectedPct = goal === 0 ? 0 : (projected / goal) * 100

  return {
    projected,
    goal,
    projectedPct: Math.round(projectedPct * 10) / 10,
    daysElapsed,
    daysTotal,
  }
}
