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
      {payload.map((entry: TooltipEntry, index: number) => {
        const series = SERIES.find((s) => s.key === entry.dataKey)
        return (
          <p key={index} style={{
            color: '#FFFFFF',
            margin: '2px 0',
            fontSize: '12px',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {series?.label ?? entry.name}: <strong style={{ color: entry.color }}>
              {entry.value}
            </strong>
          </p>
        )
      })}
    </div>
  )
}

export function TrendLineChart({ data }: TrendLineChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        Sin datos para mostrar
      </div>
    )
  }

  const activeSeries = SERIES.filter((s) =>
    data.some((d) => d[s.key] !== undefined && d[s.key] !== null)
  )

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
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
        <Tooltip content={<CustomTooltip />} />
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
