'use client'

import {
  Radar,
  RadarChart as RechartsRadar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'
import { CHART_COLORS } from '@/lib/utils/colors'

interface RadarDataPoint {
  channel: string
  real: number
  goal: number
  pct: number
}

interface RadarChartProps {
  data: RadarDataPoint[]
}

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
          {entry.name}: <strong style={{ color: entry.color }}>
            {entry.value}
          </strong>
        </p>
      ))}
    </div>
  )
}

export function RadarChart({ data }: RadarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        Sin datos para mostrar
      </div>
    )
  }

  const maxVal = Math.max(...data.map((d) => Math.max(d.goal, d.real)), 1)

  return (
    <ResponsiveContainer width="100%" height={340}>
      <RechartsRadar
        data={data}
        margin={{ top: 16, right: 48, left: 48, bottom: 16 }}
      >
        <PolarGrid stroke="rgba(255,255,255,0.08)" />
        <PolarAngleAxis
          dataKey="channel"
          tick={{ fill: '#a1a1aa', fontSize: 11 }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, maxVal]}
          tick={{ fill: '#52525b', fontSize: 10 }}
          tickCount={4}
          axisLine={false}
        />
        {/* Goal polygon — outline only */}
        <Radar
          name="Meta"
          dataKey="goal"
          stroke={CHART_COLORS.blue}
          fill={CHART_COLORS.blue}
          fillOpacity={0.04}
          strokeWidth={1.5}
          strokeDasharray="5 3"
        />
        {/* Real polygon — filled semi-transparent */}
        <Radar
          name="Real"
          dataKey="real"
          stroke={CHART_COLORS.emerald}
          fill={CHART_COLORS.emerald}
          fillOpacity={0.25}
          strokeWidth={2}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: '#a1a1aa', paddingTop: 8 }}
        />
      </RechartsRadar>
    </ResponsiveContainer>
  )
}
