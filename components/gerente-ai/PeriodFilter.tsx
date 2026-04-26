'use client'

import { useState, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import type { DateRange } from 'react-day-picker'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarDays, ChevronDown, X } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { PeriodPreset } from '@/lib/utils/gerente-ai'
import { presetRange } from '@/lib/utils/gerente-ai'
import { cn } from '@/lib/utils'

const PRESETS: { key: PeriodPreset; label: string }[] = [
  { key: 'week',    label: 'Esta semana'  },
  { key: 'month',   label: 'Este mes'     },
  { key: 'quarter', label: 'Trimestre'    },
  { key: 'year',    label: 'Este año'     },
  { key: 'custom',  label: 'Personalizado' },
]

interface Props {
  currentStart: string
  currentEnd:   string
  currentPreset: string
}

function calendarVars() {
  return {
    '--background':         '#0f1117',
    '--foreground':         '#f1f5f9',
    '--primary':            'oklch(0.82 0.19 200)',
    '--primary-foreground': '#0a0a0a',
    '--muted':              '#1a1f2e',
    '--muted-foreground':   '#64748b',
    '--accent':             '#1a1f2e',
    '--accent-foreground':  '#f1f5f9',
    '--border':             '#1e293b',
    '--popover':            '#0f1117',
    '--popover-foreground': '#f1f5f9',
    '--radius':             '0.5rem',
  } as React.CSSProperties
}

export function PeriodFilter({ currentStart, currentEnd, currentPreset }: Props) {
  const router     = useRouter()
  const pathname   = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)

  // Local range state for the custom picker (only committed on Apply)
  const [range, setRange] = useState<DateRange | undefined>(() => {
    if (currentPreset === 'custom') {
      return {
        from: currentStart ? parseISO(currentStart) : undefined,
        to:   currentEnd   ? parseISO(currentEnd)   : undefined,
      }
    }
    return undefined
  })

  function navigate(start: string, end: string, preset: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('start', start)
    params.set('end', end)
    params.set('preset', preset)
    router.replace(`${pathname}?${params.toString()}`)
  }

  function selectPreset(preset: PeriodPreset) {
    if (preset === 'custom') {
      setOpen(true)
      return
    }
    const { start, end } = presetRange(preset)
    navigate(start, end, preset)
  }

  function applyCustomRange() {
    if (!range?.from) return
    const start = format(range.from, 'yyyy-MM-dd')
    const end   = range.to ? format(range.to, 'yyyy-MM-dd') : start
    setOpen(false)
    navigate(start, end, 'custom')
  }

  function clearCustom() {
    setRange(undefined)
  }

  const formattedRange = currentPreset === 'custom' && currentStart
    ? (() => {
        try {
          const from = format(parseISO(currentStart), "d MMM yyyy", { locale: es })
          const to   = currentEnd !== currentStart
            ? format(parseISO(currentEnd), "d MMM yyyy", { locale: es })
            : null
          return to ? `${from} — ${to}` : from
        } catch { return 'Personalizado' }
      })()
    : null

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

      {PRESETS.map(({ key, label }) => {
        const isActive = currentPreset === key

        if (key === 'custom') {
          return (
            <Popover key="custom" open={open} onOpenChange={setOpen}>
              <PopoverTrigger
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-all',
                  isActive
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                    : 'border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
                )}
              >
                {isActive && formattedRange ? (
                  <>
                    <span>{formattedRange}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const { start, end } = presetRange('month')
                        navigate(start, end, 'month')
                      }}
                      className="hover:text-foreground"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </>
                ) : (
                  <>
                    {label}
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </>
                )}
              </PopoverTrigger>

              <PopoverContent className="w-auto p-0 border-border" align="start" sideOffset={6}>
                <div style={calendarVars()} className="rounded-lg overflow-hidden">
                  <div className="px-3 pt-3 pb-1 border-b border-white/5">
                    <p className="text-[11px] font-semibold text-muted-foreground">Selecciona el rango de fechas</p>
                    {range?.from && (
                      <p className="text-xs text-foreground mt-0.5">
                        {format(range.from, "d 'de' MMMM", { locale: es })}
                        {range.to && range.to !== range.from
                          ? ` → ${format(range.to, "d 'de' MMMM yyyy", { locale: es })}`
                          : ''}
                      </p>
                    )}
                  </div>

                  <Calendar
                    mode="range"
                    selected={range}
                    onSelect={setRange}
                    numberOfMonths={2}
                    locale={es}
                    disabled={{ after: new Date() }}
                    captionLayout="label"
                  />

                  <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1 border-t border-white/5">
                    <button
                      onClick={clearCustom}
                      className="text-[11px] text-muted-foreground hover:text-foreground underline"
                    >
                      Limpiar
                    </button>
                    <button
                      onClick={applyCustomRange}
                      disabled={!range?.from}
                      className="rounded-lg bg-primary px-4 py-1.5 text-[11px] font-semibold text-primary-foreground transition-all hover:bg-primary/85 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )
        }

        return (
          <button
            key={key}
            onClick={() => selectPreset(key)}
            className={cn(
              'rounded-full border px-3 py-1 text-[11px] font-medium transition-all',
              isActive
                ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                : 'border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
