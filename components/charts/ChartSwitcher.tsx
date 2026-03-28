'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { BarChart2, TrendingUp, Radar, CalendarDays, Table2, Filter } from 'lucide-react'
import { HorizontalBarChart } from './HorizontalBarChart'
import { TrendLineChart } from './TrendLineChart'
import { RadarChart } from './RadarChart'
import { HeatmapChart } from './HeatmapChart'
import { DetailTable } from './DetailTable'
import type { DetailRow } from './DetailTable'
import type { FunnelStage } from './FunnelChart'
import { FunnelChart } from './FunnelChart'

interface BarDataPoint {
  name: string
  goal: number
  real: number
}

export interface TrendPoint {
  date: string
  meta?: number
  outbound?: number
  inbound?: number
  [key: string]: number | string | undefined
}

interface RadarDataPoint {
  channel: string
  real: number
  goal: number
  pct: number
}

interface HeatmapDay {
  date: string
  compliancePct: number | null
}

interface ChartSwitcherProps {
  barData?: BarDataPoint[]
  trendData?: TrendPoint[]
  radarData?: RadarDataPoint[]
  heatmapData?: HeatmapDay[]
  tableRows?: DetailRow[]
  funnelStages?: FunnelStage[]
  defaultChart?: string
}

const CHART_TABS = [
  { value: 'bars',    label: 'Barras',     icon: BarChart2 },
  { value: 'trend',   label: 'Tendencia',  icon: TrendingUp },
  { value: 'radar',   label: 'Balance',    icon: Radar },
  { value: 'heatmap', label: 'Heatmap',    icon: CalendarDays },
  { value: 'table',   label: 'Tabla',      icon: Table2 },
  { value: 'funnel',  label: 'Funnel',     icon: Filter },
] as const

export function ChartSwitcher({
  barData = [],
  trendData = [],
  radarData = [],
  heatmapData = [],
  tableRows = [],
  funnelStages = [],
  defaultChart = 'bars',
}: ChartSwitcherProps) {
  const [active, setActive] = useState(defaultChart)

  return (
    <div>
      {/* Tab bar — pill buttons */}
      <div className="flex items-center gap-1.5 mb-6 flex-wrap">
        {CHART_TABS.map(({ value, label, icon: Icon }) => {
          const isActive = active === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => setActive(value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-[0_0_14px_oklch(0.82_0.19_200_/_35%)]'
                  : 'border border-border text-muted-foreground hover:text-foreground hover:border-border/80 hover:bg-muted/50'
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
            </button>
          )
        })}
      </div>

      {/* Chart content */}
      {active === 'bars'    && <HorizontalBarChart data={barData} />}
      {active === 'trend'   && <TrendLineChart data={trendData} />}
      {active === 'radar'   && <RadarChart data={radarData} />}
      {active === 'heatmap' && <HeatmapChart data={heatmapData} />}
      {active === 'table'   && <DetailTable rows={tableRows} periodLabel="Semana" />}
      {active === 'funnel'  && <FunnelChart stages={funnelStages} />}
    </div>
  )
}
