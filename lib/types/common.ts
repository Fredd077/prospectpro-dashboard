export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'quarterly'
export type ActivityType = 'OUTBOUND' | 'INBOUND' | 'ALL'
export type SemaphoreColor = 'green' | 'yellow' | 'red' | 'no_goal'

export interface DateRange {
  start: string  // ISO date YYYY-MM-DD
  end: string
}

export interface KpiStat {
  label: string
  value: number | string
  delta?: number
  semaphore?: SemaphoreColor
  format?: 'percent' | 'number' | 'currency'
}

export interface PeriodFilter {
  period: PeriodType
  type: ActivityType
  channel: string | null
  date: string  // reference date ISO YYYY-MM-DD
}
