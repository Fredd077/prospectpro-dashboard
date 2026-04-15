'use client'

import { useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { parseISO, subDays, addDays, subWeeks, addWeeks, subMonths, addMonths, subQuarters, addQuarters, subYears, addYears } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
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
    case 'yearly':    return direction === -1 ? subYears(date, 1)    : addYears(date, 1)
  }
}

export function DateNavigator({ period, refDate }: DateNavigatorProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const ref = parseISO(refDate)
  const today = todayISO()
  const currentStart = getPeriodRange(period, parseISO(today)).start
  const refStart = getPeriodRange(period, ref).start
  const isCurrentOrFuture = refStart >= currentStart

  function navigateTo(isoDate: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('refDate', isoDate)
    router.push(`${pathname}?${params.toString()}`)
  }

  function navigate(direction: -1 | 1) {
    if (direction === 1 && isCurrentOrFuture) return
    navigateTo(toISODate(shiftDate(period, ref, direction)))
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

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border hover:border-primary/40 hover:text-primary transition-colors text-sm font-mono text-foreground min-w-[160px] justify-center group">
          <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          {periodLabel(period, ref)}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" side="bottom" align="center">
          <Calendar
            mode="single"
            selected={ref}
            onSelect={(date) => {
              if (date) {
                navigateTo(toISODate(date))
                setOpen(false)
              }
            }}
            disabled={{ after: new Date() }}
            locale={es}
            initialFocus
          />
        </PopoverContent>
      </Popover>

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
