'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { todayISO } from '@/lib/utils/dates'
import { cn } from '@/lib/utils'

interface DatePickerInputProps {
  value: string
  onChange: (date: string) => void
  max?: string
  min?: string
  className?: string
}

export function DatePickerInput({
  value,
  onChange,
  max,
  min,
  className,
}: DatePickerInputProps) {
  const [open, setOpen] = useState(false)

  const effectiveMax = max ?? todayISO()
  const selectedDate = value ? parseISO(value) : undefined
  const maxDate      = parseISO(effectiveMax)
  const minDate      = min ? parseISO(min) : undefined

  const disabledMatchers = [
    { after: maxDate },
    ...(minDate ? [{ before: minDate }] : []),
  ]

  function handleSelect(date: Date | undefined) {
    if (date) {
      onChange(format(date, 'yyyy-MM-dd'))
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={(o: boolean) => setOpen(o)}>
      <PopoverTrigger
        className={cn(
          'flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-primary transition-colors',
          className
        )}
      >
        <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        {selectedDate
          ? format(selectedDate, "d 'de' MMMM 'de' yyyy", { locale: es })
          : 'Selecciona una fecha'}
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 border-border bg-card"
        align="start"
        sideOffset={4}
      >
        <div
          style={{
            '--background':         '#0a0a0a',
            '--foreground':         '#f1f5f9',
            '--primary':            '#00D9FF',
            '--primary-foreground': '#0a0a0a',
            '--muted':              '#1e293b',
            '--muted-foreground':   '#64748b',
            '--accent':             '#1e293b',
            '--accent-foreground':  '#f1f5f9',
            '--border':             '#1e293b',
            '--popover':            '#0a0a0a',
            '--popover-foreground': '#f1f5f9',
          } as React.CSSProperties}
        >
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            disabled={disabledMatchers}
            defaultMonth={selectedDate ?? maxDate}
            locale={es}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
