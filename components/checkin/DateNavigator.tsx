'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { addDaysToISO, todayISO, formatDisplayDate } from '@/lib/utils/dates'
import { cn } from '@/lib/utils'

interface DateNavigatorProps {
  currentDate: string // ISO YYYY-MM-DD
}

export function DateNavigator({ currentDate }: DateNavigatorProps) {
  const router = useRouter()
  const today = todayISO()
  const isToday = currentDate === today
  const isFuture = currentDate > today

  function navigate(date: string) {
    if (date === todayISO()) {
      router.push('/checkin')
    } else {
      router.push(`/checkin/${date}`)
    }
  }

  function onDateChange(value: string) {
    if (value) navigate(value)
  }

  return (
    <div className="flex items-center gap-2">
      {/* Previous day — never disabled */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => navigate(addDaysToISO(currentDate, -1))}
        className="h-8 w-8"
        aria-label="Día anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Date display — clicking opens native calendar popup */}
      <div className="relative">
        <button
          type="button"
          onClick={() => document.getElementById('date-picker')?.click()}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors hover:bg-accent',
            isToday
              ? 'border-blue-400/30 bg-blue-400/10 text-blue-400'
              : isFuture
              ? 'border-border text-muted-foreground'
              : 'border-border bg-muted text-foreground'
          )}
        >
          <Calendar className="h-3.5 w-3.5" />
          {isToday ? 'Hoy' : formatDisplayDate(currentDate)}
        </button>
        <input
          id="date-picker"
          type="date"
          value={currentDate}
          max={todayISO()}
          onChange={(e) => onDateChange(e.target.value)}
          className="absolute opacity-0 top-0 left-0 w-full h-full cursor-pointer"
          style={{ colorScheme: 'dark' }}
        />
      </div>

      {/* Next day — disabled only on today or future */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => navigate(addDaysToISO(currentDate, 1))}
        disabled={isToday || isFuture}
        className="h-8 w-8"
        aria-label="Día siguiente"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {/* Jump to today — only shown when not on today */}
      {!isToday && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(today)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Ir a hoy
        </Button>
      )}
    </div>
  )
}
