'use client'

import { useMemo } from 'react'
import { Tooltip } from '@/components/ui/tooltip'
import {
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatDisplayDate, toISODate } from '@/lib/utils/dates'

interface HeatmapDay {
  date: string
  compliancePct: number | null
}

interface HeatmapChartProps {
  data: HeatmapDay[]
  weeks?: number
}

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function getCellColor(pct: number | null): string {
  if (pct === null) return 'bg-muted/40'
  if (pct >= 100) return 'bg-emerald-400'
  if (pct >= 70) return 'bg-amber-400'
  if (pct > 0) return 'bg-red-400/60'
  return 'bg-muted'
}

export function HeatmapChart({ data, weeks = 13 }: HeatmapChartProps) {
  // Build a grid: weeks × 7 days
  const grid = useMemo(() => {
    const map: Record<string, HeatmapDay> = {}
    for (const d of data) map[d.date] = d

    // Find the most recent Monday as the last week's start
    const today = new Date()
    const dayOfWeek = (today.getDay() + 6) % 7 // Monday=0
    const lastMonday = new Date(today)
    lastMonday.setDate(today.getDate() - dayOfWeek)

    const result: Array<Array<HeatmapDay | null>> = []
    for (let w = weeks - 1; w >= 0; w--) {
      const week: Array<HeatmapDay | null> = []
      for (let d = 0; d < 7; d++) {
        const date = new Date(lastMonday)
        date.setDate(lastMonday.getDate() - w * 7 + d)
        const iso = toISODate(date)
        week.push(map[iso] ?? { date: iso, compliancePct: null })
      }
      result.push(week)
    }
    return result
  }, [data, weeks])

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex gap-1">
        {/* Day labels */}
        <div className="flex flex-col gap-1 pt-5 mr-1">
          {DAYS.map((d) => (
            <div key={d} className="h-3.5 text-[10px] text-muted-foreground leading-none">
              {d}
            </div>
          ))}
        </div>
        {/* Week columns */}
        {grid.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {/* Month label (show only when it changes) */}
            <div className="h-4 text-[10px] text-muted-foreground leading-none">
              {week[0] && new Date(week[0].date).getDate() <= 7
                ? new Date(week[0].date).toLocaleString('es', { month: 'short' })
                : ''}
            </div>
            {week.map((day, di) => (
              <Tooltip key={di}>
                <TooltipTrigger>
                  <div
                    className={`h-3.5 w-3.5 rounded-sm cursor-pointer transition-opacity hover:opacity-80 ${
                      day ? getCellColor(day.compliancePct) : 'bg-muted/20'
                    }`}
                  />
                </TooltipTrigger>
                {day && (
                  <TooltipContent side="top" className="text-xs">
                    <p className="font-medium">{formatDisplayDate(day.date)}</p>
                    <p className="text-muted-foreground">
                      {day.compliancePct !== null
                        ? `${day.compliancePct.toFixed(1)}% cumplimiento`
                        : 'Sin datos'}
                    </p>
                  </TooltipContent>
                )}
              </Tooltip>
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        <span>Menos</span>
        <div className="flex gap-1">
          <div className="h-3 w-3 rounded-sm bg-muted" />
          <div className="h-3 w-3 rounded-sm bg-red-400/60" />
          <div className="h-3 w-3 rounded-sm bg-amber-400" />
          <div className="h-3 w-3 rounded-sm bg-emerald-400" />
        </div>
        <span>Más</span>
      </div>
    </div>
  )
}
