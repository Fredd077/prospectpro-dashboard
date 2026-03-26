'use client'

import { useRef } from 'react'
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
  const dateInputRef = useRef<HTMLInputElement>(null)
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

  function openPicker() {
    try {
      dateInputRef.current?.showPicker()
    } catch {
      dateInputRef.current?.click()
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Previous day — always enabled, no past-date restriction */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => navigate(addDaysToISO(currentDate, -1))}
        className="h-8 w-8"
        aria-label="Día anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Date display — clicking opens native calendar picker */}
      <div className="relative">
        <button
          type="button"
          onClick={openPicker}
          className={cn(
            'flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-80',
            isToday
              ? 'border-blue-400/30 bg-blue-400/10 text-blue-400'
              : isFuture
              ? 'border-border text-muted-foreground'
              : 'border-border bg-muted text-foreground'
          )}
          aria-label="Abrir selector de fecha"
        >
          <Calendar className="h-3.5 w-3.5" />
          {isToday ? 'Hoy' : formatDisplayDate(currentDate)}
        </button>

        {/* Hidden native date input — provides the calendar popup */}
        <input
          ref={dateInputRef}
          type="date"
          value={currentDate}
          max={today}
          onChange={(e) => {
            if (e.target.value) navigate(e.target.value)
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          style={{ colorScheme: 'dark' }}
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>

      {/* Next day — disabled when already on today or future */}
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

      {/* Jump to today shortcut — shown when not on today */}
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
