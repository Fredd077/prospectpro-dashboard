import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  eachDayOfInterval,
  parseISO,
  differenceInDays,
  addDays,
  getISOWeek,
  getYear,
  format,
} from 'date-fns'
import { es } from 'date-fns/locale'
import type { PeriodType, DateRange } from '@/lib/types/common'

const BOGOTA_TZ = 'America/Bogota'

/** Convert any JS Date to YYYY-MM-DD in Bogota timezone (UTC-5) */
export function toISODate(date: Date): string {
  return Intl.DateTimeFormat('en-CA', { timeZone: BOGOTA_TZ }).format(date)
}

/** Today's date as YYYY-MM-DD in Bogota timezone — never uses UTC */
export function todayISO(): string {
  return Intl.DateTimeFormat('en-CA', { timeZone: BOGOTA_TZ }).format(new Date())
}

/** Get the date range for a given period type anchored at refDate */
export function getPeriodRange(period: PeriodType, refDate: Date): DateRange {
  switch (period) {
    case 'daily':
      return { start: toISODate(refDate), end: toISODate(refDate) }
    case 'weekly':
      return {
        start: toISODate(startOfWeek(refDate, { weekStartsOn: 1 })),
        end: toISODate(endOfWeek(refDate, { weekStartsOn: 1 })),
      }
    case 'monthly':
      return {
        start: toISODate(startOfMonth(refDate)),
        end: toISODate(endOfMonth(refDate)),
      }
    case 'quarterly':
      return {
        start: toISODate(startOfQuarter(refDate)),
        end: toISODate(endOfQuarter(refDate)),
      }
  }
}

/** All ISO dates in a range (inclusive) */
export function datesInRange(start: string, end: string): string[] {
  const days = eachDayOfInterval({
    start: parseISO(start),
    end: parseISO(end),
  })
  return days.map(toISODate)
}

/** Elapsed days from period start to today (or end if past) */
export function elapsedDays(start: string, end: string): number {
  const s = parseISO(start)
  const e = parseISO(end)
  const todayStr = todayISO()
  const today = parseISO(todayStr)
  const effectiveEnd = today > e ? e : today < s ? s : today
  return Math.max(1, differenceInDays(effectiveEnd, s) + 1)
}

/** Total days in range */
export function totalDays(start: string, end: string): number {
  return differenceInDays(parseISO(end), parseISO(start)) + 1
}

/** Human-readable period label in Spanish */
export function periodLabel(period: PeriodType, refDate: Date): string {
  switch (period) {
    case 'daily':
      return toISODate(refDate) === todayISO()
        ? 'Hoy'
        : format(refDate, "d 'de' MMMM", { locale: es })
    case 'weekly':
      return `Semana ${getISOWeek(refDate)}, ${getYear(refDate)}`
    case 'monthly':
      return format(refDate, 'MMMM yyyy', { locale: es })
    case 'quarterly':
      return `Q${Math.ceil((refDate.getMonth() + 1) / 3)} ${getYear(refDate)}`
  }
}

/** Format ISO date for display */
export function formatDisplayDate(isoDate: string): string {
  return format(parseISO(isoDate), 'd MMM yyyy', { locale: es })
}

/** Add n days to ISO date */
export function addDaysToISO(isoDate: string, n: number): string {
  return toISODate(addDays(parseISO(isoDate), n))
}
