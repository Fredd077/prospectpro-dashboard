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

/**
 * "Cumplimiento" oficial del proyecto: PROMEDIO DE RATIOS TOPADOS al 100% por
 * actividad, todas pesando igual — NUNCA totalReal/totalGoal. Es la misma
 * fórmula que ya usan el Dashboard y /team (ver cappedCompliance en
 * lib/utils/team-metrics.ts), reescrita aquí sin dependencias de servidor para
 * poder usarla desde componentes cliente como Check-in Diario.
 *
 * El motivo del tope: una actividad que se pasa de su meta no debe tapar que
 * otra quedó abandonada — si promediara los ratios sin tope, o si sumara
 * totales en vez de promediar por actividad, un solo canal con mucho volumen
 * puede maquillar un cumplimiento real bajo (visto en vivo: 54/73 actividades
 * daba 74% por totales, pero 27.6% por esta fórmula, porque la mayoría de las
 * actividades individuales estaban en 0%).
 */
export function calcCappedCompliance(
  items: Array<{ real: number; goal: number }>
): ComplianceResult {
  let ratioSum = 0
  let ratioCount = 0
  let totalReal = 0
  let totalGoal = 0
  for (const it of items) {
    totalReal += it.real
    totalGoal += it.goal
    if (it.goal <= 0) continue
    ratioSum += Math.min(it.real, it.goal) / it.goal
    ratioCount++
  }
  const pct = ratioCount > 0 ? (ratioSum / ratioCount) * 100 : 0
  const semaphore = totalGoal === 0 ? 'no_goal' : getSemaphoreColor(pct)
  return {
    pct: Math.round(pct * 10) / 10,
    semaphore,
    real: totalReal,
    goal: totalGoal,
    deviation: totalReal - totalGoal,
  }
}
