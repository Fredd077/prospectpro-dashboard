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
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-6 flex-wrap">
        {CHART_TABS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setActive(value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              active === value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {label}
          </button>
        ))}
      </div>

      {/* Chart content */}
      {active === 'bars' && <HorizontalBarChart data={barData} />}
      {active === 'trend' && <TrendLineChart data={trendData} />}
      {active === 'radar' && <RadarChart data={radarData} />}
      {active === 'heatmap' && <HeatmapChart data={heatmapData} />}
      {active === 'table' && <DetailTable rows={tableRows} periodLabel="Semana" />}
      {active === 'funnel' && <FunnelChart stages={funnelStages} />}
    </div>
  )
}
