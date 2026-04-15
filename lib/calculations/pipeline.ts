export interface PipelineEntrySlim {
  stage: string
  quantity: number
  amount_usd: number | null
}

export interface ConversionResult {
  fromStage: string
  toStage: string
  fromCount: number
  toCount: number
  realConversion: number   // %
  plannedConversion: number // %
  gap: number              // real - planned (positive = better than plan)
}

export interface PipelineValue {
  open: number    // amount_usd sum for non-last stages
  closed: number  // amount_usd sum for last stage only
}

/**
 * For each consecutive stage pair, compute real vs planned conversion rate.
 * Stage 0 (activities) uses activityTotal instead of pipeline_entries.
 * Only computes a rate when the "from" count > 0 (avoids division by zero).
 */
export function calcRealConversions(
  activityTotal: number,
  entries: PipelineEntrySlim[],
  stages: string[],
  plannedRates: number[],
): ConversionResult[] {
  const countByStage: Record<string, number> = {}
  for (const e of entries) {
    countByStage[e.stage] = (countByStage[e.stage] ?? 0) + e.quantity
  }

  const results: ConversionResult[] = []
  for (let i = 0; i < stages.length - 1; i++) {
    const fromStage = stages[i]
    const toStage   = stages[i + 1]
    const fromCount = i === 0 ? activityTotal : (countByStage[fromStage] ?? 0)
    const toCount   = countByStage[toStage] ?? 0
    const realConversion    = fromCount > 0 ? Math.round((toCount / fromCount) * 100) : 0
    const plannedConversion = plannedRates[i] ?? 0
    results.push({ fromStage, toStage, fromCount, toCount, realConversion, plannedConversion, gap: realConversion - plannedConversion })
  }
  return results
}

/**
 * Sum open (proposals not yet closed) and closed (last stage) amounts.
 * Amount fields are only expected on the last few stages, but we sum all
 * non-null amounts regardless.
 */
export function calcPipelineValue(
  entries: PipelineEntrySlim[],
  stages: string[],
): PipelineValue {
  const lastStage = stages[stages.length - 1]
  let open = 0
  let closed = 0
  for (const e of entries) {
    if (e.amount_usd === null) continue
    if (e.stage === lastStage) closed += e.amount_usd
    else open += e.amount_usd
  }
  return { open, closed }
}

/** % of monthly revenue goal closed so far */
export function calcRevenueProgress(closed: number, monthlyGoal: number): number {
  if (monthlyGoal <= 0) return 0
  return Math.round((closed / monthlyGoal) * 100)
}

/**
 * Given a full planned monthly value at each stage (derived from recipe),
 * scale it to the requested period.
 */
export function scalePlanToperiod(
  monthlyValue: number,
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly',
  workingDays: number,
): number {
  if (period === 'monthly')   return Math.ceil(monthlyValue)
  if (period === 'weekly')    return Math.ceil(monthlyValue / (workingDays / 5))
  if (period === 'quarterly') return Math.ceil(monthlyValue * 3)
  if (period === 'yearly')    return Math.ceil(monthlyValue * 12)
  return Math.ceil(monthlyValue / workingDays)
}

/** Semaphore color for real vs planned */
export function conversionSemaphore(real: number, planned: number): 'green' | 'yellow' | 'red' {
  const gap = real - planned
  if (gap >= 0)    return 'green'
  if (gap >= -10)  return 'yellow'
  return 'red'
}

/** COP-style number format: 1.234.567 */
export function fmtCOP(n: number): string {
  return n.toLocaleString('es-CO')
}

/** USD format with period separators */
export function fmtUSD(n: number): string {
  return '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
