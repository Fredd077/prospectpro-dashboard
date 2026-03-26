'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { CHART_COLORS } from '@/lib/utils/colors'

export interface TrendPoint {
  date: string
  meta?: number
  outbound?: number
  inbound?: number
  [key: string]: number | string | undefined
}

interface TrendLineChartProps {
  data: TrendPoint[]
}

const SERIES = [
  { key: 'meta',     label: 'Meta acumulada', color: CHART_COLORS.goal,    dashed: true,  dot: false },
  { key: 'outbound', label: 'Outbound real',  color: CHART_COLORS.blue,   dashed: false, dot: true  },
  { key: 'inbound',  label: 'Inbound real',   color: CHART_COLORS.violet, dashed: false, dot: true  },
] as const

export function TrendLineChart({ data }: TrendLineChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        Sin datos para mostrar
      </div>
    )
  }

  // Determine which series have actual data
  const activeSeries = SERIES.filter((s) =>
    data.some((d) => d[s.key] !== undefined && d[s.key] !== null)
  )

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="date"
          tick={{ fill: '#71717a', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: '#71717a', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip
          contentStyle={{
            background: '#18181b',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: '#e4e4e7', fontWeight: 600 }}
          formatter={(value: unknown, name: unknown) => {
            const s = SERIES.find((x) => x.key === name)
            return [value as number, s?.label ?? (name as string)]
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: '#a1a1aa', paddingTop: 8 }}
          formatter={(value) => {
            const s = SERIES.find((x) => x.key === value)
            return s?.label ?? value
          }}
        />
        {activeSeries.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            stroke={s.color}
            strokeWidth={s.dashed ? 1.5 : 2}
            strokeDasharray={s.dashed ? '6 3' : undefined}
            dot={s.dot ? { r: 2.5, fill: s.color, strokeWidth: 0 } : false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
