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

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={() => navigate(addDaysToISO(currentDate, -1))}
        className="h-8 w-8"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div
        className={cn(
          'flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium',
          isToday
            ? 'border-blue-400/30 bg-blue-400/10 text-blue-400'
            : isFuture
            ? 'border-border text-muted-foreground'
            : 'border-border bg-muted text-foreground'
        )}
      >
        <Calendar className="h-3.5 w-3.5" />
        {isToday ? 'Hoy' : formatDisplayDate(currentDate)}
      </div>

      <Button
        variant="outline"
        size="icon"
        onClick={() => navigate(addDaysToISO(currentDate, 1))}
        disabled={isToday}
        className="h-8 w-8"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

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
