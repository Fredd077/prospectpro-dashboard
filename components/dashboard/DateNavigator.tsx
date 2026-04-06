'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { parseISO, subDays, addDays, subWeeks, addWeeks, subMonths, addMonths, subQuarters, addQuarters } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { toISODate, todayISO, getPeriodRange, periodLabel } from '@/lib/utils/dates'
import type { PeriodType } from '@/lib/types/common'

interface DateNavigatorProps {
  period: PeriodType
  refDate: string
}

function shiftDate(period: PeriodType, date: Date, direction: -1 | 1): Date {
  switch (period) {
    case 'daily':     return direction === -1 ? subDays(date, 1)     : addDays(date, 1)
    case 'weekly':    return direction === -1 ? subWeeks(date, 1)    : addWeeks(date, 1)
    case 'monthly':   return direction === -1 ? subMonths(date, 1)   : addMonths(date, 1)
    case 'quarterly': return direction === -1 ? subQuarters(date, 1) : addQuarters(date, 1)
  }
}

export function DateNavigator({ period, refDate }: DateNavigatorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const ref = parseISO(refDate)
  const today = todayISO()
  const currentStart = getPeriodRange(period, parseISO(today)).start
  const refStart = getPeriodRange(period, ref).start
  const isCurrentOrFuture = refStart >= currentStart

  function navigate(direction: -1 | 1) {
    if (direction === 1 && isCurrentOrFuture) return
    const newDate = shiftDate(period, ref, direction)
    const params = new URLSearchParams(searchParams.toString())
    params.set('refDate', toISODate(newDate))
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => navigate(-1)}
        className="p-1.5 rounded-md border border-border hover:border-primary/40 hover:text-primary transition-colors text-muted-foreground"
        title="Período anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <span className="text-sm font-mono text-foreground min-w-[160px] text-center">
        {periodLabel(period, ref)}
      </span>

      <button
        onClick={() => navigate(1)}
        disabled={isCurrentOrFuture}
        className="p-1.5 rounded-md border border-border hover:border-primary/40 hover:text-primary transition-colors text-muted-foreground disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-muted-foreground"
        title="Período siguiente"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
