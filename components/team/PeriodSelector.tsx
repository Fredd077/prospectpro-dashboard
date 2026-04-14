'use client'

import { useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import type { DateRange } from 'react-day-picker'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'

export type PeriodOption = 'week' | 'last_week' | 'month' | 'last_month' | 'quarter' | 'custom'

const OPTIONS: { value: PeriodOption; label: string }[] = [
  { value: 'week',       label: 'Esta semana'   },
  { value: 'last_week',  label: 'Semana pasada' },
  { value: 'month',      label: 'Este mes'      },
  { value: 'last_month', label: 'Mes pasado'    },
  { value: 'quarter',    label: 'Trim. actual'  },
  { value: 'custom',     label: 'Personalizado' },
]

export function PeriodSelector() {
  const router   = useRouter()
  const pathname = usePathname()
  const params   = useSearchParams()

  const period    = (params.get('period') ?? 'week') as PeriodOption
  const fromParam = params.get('from') ?? ''
  const toParam   = params.get('to')   ?? ''

  const [popOpen, setPopOpen] = useState(false)
  const [range,   setRange]   = useState<DateRange | undefined>(
    fromParam && toParam
      ? { from: parseISO(fromParam), to: parseISO(toParam) }
      : undefined
  )

  function selectPeriod(p: PeriodOption) {
    router.push(`${pathname}?period=${p}`)
  }

  function applyRange() {
    if (!range?.from || !range?.to) return
    const from = format(range.from, 'yyyy-MM-dd')
    const to   = format(range.to,   'yyyy-MM-dd')
    setPopOpen(false)
    router.push(`${pathname}?period=custom&from=${from}&to=${to}`)
  }

  const customLabel =
    period === 'custom' && fromParam && toParam
      ? `${format(parseISO(fromParam), 'd MMM', { locale: es })} – ${format(parseISO(toParam), 'd MMM', { locale: es })}`
      : 'Personalizado'

  function pillStyle(active: boolean): React.CSSProperties {
    return {
      fontSize: 12, fontWeight: 500, padding: '5px 14px', borderRadius: 6, cursor: 'pointer',
      background: active ? 'rgba(0,217,255,0.1)' : 'transparent',
      color:      active ? '#00D9FF'              : 'rgba(255,255,255,0.4)',
      border:     active ? '1px solid rgba(0,217,255,0.3)' : '1px solid transparent',
      transition: 'all 0.15s',
      display: 'inline-flex', alignItems: 'center', gap: 5,
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
      {OPTIONS.map(({ value, label }) => {
        if (value !== 'custom') {
          return (
            <button key={value} onClick={() => selectPeriod(value)} style={pillStyle(period === value)}>
              {label}
            </button>
          )
        }

        // Custom: popover with range calendar
        return (
          <Popover
            key="custom"
            open={popOpen}
            onOpenChange={(o: boolean) => setPopOpen(o)}
          >
            <PopoverTrigger
              style={pillStyle(period === 'custom')}
              render={
                <button style={pillStyle(period === 'custom')}>
                  <CalendarIcon style={{ width: 11, height: 11 }} />
                  {period === 'custom' ? customLabel : label}
                </button>
              }
            />
            <PopoverContent
              side="bottom"
              align="start"
              className="!w-auto"
              style={{ background: '#0a0a0a', border: '1px solid rgba(0,217,255,0.2)', padding: 16, zIndex: 60 }}
            >
              <Calendar
                mode="range"
                selected={range}
                onSelect={setRange}
                locale={es}
                numberOfMonths={1}
                className="bg-transparent"
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setPopOpen(false)}
                  style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.45)', background: 'transparent', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={applyRange}
                  disabled={!range?.from || !range?.to}
                  style={{
                    fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 6,
                    background: range?.from && range?.to ? '#00D9FF' : 'rgba(0,217,255,0.25)',
                    color:      range?.from && range?.to ? '#0a0a0a' : 'rgba(0,0,0,0.4)',
                    border: 'none', cursor: range?.from && range?.to ? 'pointer' : 'not-allowed',
                  }}
                >
                  Aplicar
                </button>
              </div>
            </PopoverContent>
          </Popover>
        )
      })}
    </div>
  )
}
