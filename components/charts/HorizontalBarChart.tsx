'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts'
import { CHART_COLORS } from '@/lib/utils/colors'

interface BarDataPoint {
  name: string
  goal: number
  real: number
}

interface HorizontalBarChartProps {
  data: BarDataPoint[]
}

function realColor(real: number, goal: number): string {
  if (goal === 0) return CHART_COLORS.blue
  const pct = (real / goal) * 100
  if (pct >= 100) return '#34d399' // emerald-400
  if (pct >= 70)  return '#fbbf24' // amber-400
  return '#f87171'                 // red-400
}

const NAME_MAP: Record<string, string> = { goal: 'Meta', real: 'Real' }

interface TooltipEntry { name: string; value: number; color: string; dataKey: string }
interface TooltipProps { active?: boolean; payload?: TooltipEntry[]; label?: string }
const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload || !payload.length) return null
  return (
    <div style={{
      backgroundColor: '#1a1a2e',
      border: '1px solid #00D9FF',
      borderRadius: '8px',
      padding: '10px 14px',
      boxShadow: '0 0 20px rgba(0, 217, 255, 0.2)',
      minWidth: '160px',
    }}>
      <p style={{
        color: '#00D9FF',
        fontWeight: 'bold',
        marginBottom: '6px',
        fontSize: '13px',
        fontFamily: 'JetBrains Mono, monospace',
      }}>
        {label}
      </p>
      {payload.map((entry: TooltipEntry, index: number) => (
        <p key={index} style={{
          color: '#FFFFFF',
          margin: '2px 0',
          fontSize: '12px',
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          {NAME_MAP[entry.name] ?? entry.name}: <strong style={{ color: entry.color }}>
            {entry.value}
          </strong>
        </p>
      ))}
    </div>
  )
}

export function HorizontalBarChart({ data }: HorizontalBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        Sin datos para mostrar
      </div>
    )
  }

  const rowHeight = 44
  const chartHeight = Math.max(180, data.length * rowHeight + 40)

  return (
    <div>
      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CHART_COLORS.blue }} />
          Meta
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400" />
          ≥100%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400" />
          70–99%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-400" />
          &lt;70%
        </span>
      </div>

      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 48, left: 8, bottom: 0 }}
          barCategoryGap="35%"
          barGap={3}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.05)"
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={{ fill: '#71717a', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={150}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          {/* Meta bar — blue */}
          <Bar cursor="default" dataKey="goal" fill={CHART_COLORS.blue} fillOpacity={0.25} radius={[0, 3, 3, 0]} name="goal" />
          {/* Real bar — semaphore color */}
          <Bar cursor="default" dataKey="real" radius={[0, 3, 3, 0]} name="real">
            {data.map((entry, index) => (
              <Cell key={index} fill={realColor(entry.real, entry.goal)} />
            ))}
            <LabelList
              dataKey="real"
              position="right"
              style={{ fill: '#a1a1aa', fontSize: 11 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
