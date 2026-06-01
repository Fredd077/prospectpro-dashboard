'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FlaskConical, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RecipeValidation } from '@/lib/utils/recipe-validation'
import type { PeriodType } from '@/lib/types/common'

interface RecetarioFunnelCardProps {
  validation: RecipeValidation
  period: PeriodType
  actualOutbound: number
  actualInbound: number
  pipelineByStage: Record<string, number>
  citasProyectadas: number
  citasRequeridas: number
}

const PERIOD_MULTIPLIER: Record<PeriodType, number> = {
  daily:     0.2,
  weekly:    1,
  monthly:   4.33,
  quarterly: 13,
  yearly:    52,
}

const PERIOD_LABEL: Record<PeriodType, string> = {
  daily:     'hoy',
  weekly:    'esta semana',
  monthly:   'este mes',
  quarterly: 'este trimestre',
  yearly:    'este año',
}

const PIPELINE_STAGES = [
  { key: 'Cita agendada',                                          label: 'Citas' },
  { key: 'Reagendar',                                              label: 'Reagendar' },
  { key: 'Primera reu ejecutada/Propuesta en preparación',         label: '1ra Reunión' },
  { key: 'Propuesta Presentada',                                   label: 'Propuesta' },
  { key: 'Por facturar/cobrar',                                    label: 'Cierre' },
]

function ActivityRow({ label, actual, target }: { label: string; actual: number; target: number }) {
  const pct = target > 0 ? Math.min((actual / target) * 100, 100) : 0
  const barColor = pct >= 100 ? 'bg-emerald-400' : pct >= 70 ? 'bg-amber-400' : 'bg-red-400'
  const pctColor = pct >= 100 ? 'text-emerald-400' : pct >= 70 ? 'text-amber-400' : 'text-red-400'
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium text-foreground">
          {actual}
          <span className="ml-1 font-normal text-muted-foreground">/ {target}</span>
          <span className={cn('ml-1.5 text-[10px]', pctColor)}>{Math.round(pct)}%</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function RecetarioFunnelCard({
  validation,
  period,
  actualOutbound,
  actualInbound,
  pipelineByStage,
  citasProyectadas,
  citasRequeridas,
}: RecetarioFunnelCardProps) {
  const [actCollapsed, setActCollapsed] = useState(false)

  const mult        = PERIOD_MULTIPLIER[period]
  const targetOut   = Math.max(1, Math.round(validation.weeklyRecipe.outbound * mult))
  const targetIn    = Math.max(1, Math.round(validation.weeklyRecipe.inbound  * mult))
  const targetTotal = targetOut + targetIn
  const actualTotal = actualOutbound + actualInbound

  const hasPipeline = Object.values(pipelineByStage).some(v => v > 0)

  // Alineación de citas
  const gap           = Math.round((citasProyectadas - citasRequeridas) * 10) / 10
  const citasAligned  = citasProyectadas >= citasRequeridas
  const citasClose    = !citasAligned && citasProyectadas >= citasRequeridas * 0.9
  const citasStatus   = citasAligned ? 'ok' : citasClose ? 'warn' : 'danger'
  const citasHasData  = citasProyectadas > 0 || citasRequeridas > 0

  const statusConfig = {
    ok:     { badge: 'bg-emerald-400/10 text-emerald-400 border-emerald-500/30', icon: TrendingUp,   label: 'Por encima de meta', cardBorder: 'border-emerald-400/20' },
    warn:   { badge: 'bg-amber-400/10  text-amber-400  border-amber-500/30',    icon: Minus,        label: 'Cerca de meta',      cardBorder: 'border-amber-400/20' },
    danger: { badge: 'bg-red-400/10    text-red-400    border-red-500/30',      icon: TrendingDown, label: 'Brecha crítica',     cardBorder: 'border-red-400/20' },
  }
  const cfg       = statusConfig[citasStatus]
  const StatusIcon = cfg.icon

  return (
    <div className={cn('rounded-lg border bg-card overflow-hidden h-full flex flex-col', cfg.cardBorder)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50">
        <FlaskConical className="h-4 w-4 shrink-0 text-cyan-400" />
        <span className="text-xs font-semibold text-foreground">Recetario</span>
        <span className="text-[11px] text-muted-foreground truncate">{validation.scenario.name}</span>
        <Link href="/recipe" className="ml-auto text-[10px] text-primary hover:text-primary/80 transition-colors shrink-0">
          Ver →
        </Link>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {/* Section A: Alineación de citas (the real metric matching the Recetario page) */}
        {citasHasData && (
          <div className={cn('rounded-md border px-3 py-2.5 space-y-2', cfg.badge)}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Alineación de citas</p>
              <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold rounded-full border px-2 py-0.5', cfg.badge)}>
                <StatusIcon className="h-3 w-3" />{cfg.label}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] opacity-60 mb-0.5">Citas proyectadas</p>
                <p className="font-mono font-bold text-sm">{citasProyectadas.toFixed(1)}</p>
                <p className="text-[9px] opacity-40 mt-0.5">según reuniones esperadas</p>
              </div>
              <div>
                <p className="text-[10px] opacity-60 mb-0.5">Citas requeridas</p>
                <p className="font-mono font-bold text-sm">{citasRequeridas.toFixed(1)}</p>
                <p className="text-[9px] opacity-40 mt-0.5">según recetario</p>
              </div>
              <div>
                <p className="text-[10px] opacity-60 mb-0.5">{gap < 0 ? 'Faltan' : 'Excedente'}</p>
                <p className={cn('font-mono font-bold text-sm', gap >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {gap >= 0 ? `+${gap}` : gap}
                </p>
              </div>
            </div>
          </div>
        )}
        {!citasHasData && (
          <div className="rounded-md border border-border/40 px-3 py-2.5 text-center space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Alineación de citas</p>
            <p className="text-xs text-muted-foreground">Configura las reuniones esperadas por actividad en el{' '}
              <Link href="/recipe" className="text-primary hover:underline">Recetario</Link> para ver este análisis.
            </p>
          </div>
        )}

        {/* Section B: Actividades del período vs target del recetario (collapsible) */}
        <div className="border border-border/50 rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => setActCollapsed(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors"
          >
            <span className="text-[11px] font-medium text-muted-foreground">
              Actividades {PERIOD_LABEL[period]}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {actualTotal} / {targetTotal}
            </span>
          </button>
          {!actCollapsed && (
            <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border/50">
              <ActivityRow label="Outbound" actual={actualOutbound} target={targetOut} />
              <ActivityRow label="Inbound"  actual={actualInbound}  target={targetIn} />
              <ActivityRow label="Total"    actual={actualTotal}     target={targetTotal} />
              <p className="text-[10px] text-muted-foreground/60">vs target semanal del recetario × {mult}</p>
            </div>
          )}
        </div>

        {/* Section C: Pipeline del período */}
        {hasPipeline && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Pipeline del período
            </p>
            <div className="grid grid-cols-5 gap-1 text-center">
              {PIPELINE_STAGES.map(s => (
                <div key={s.key} className="space-y-0.5">
                  <p className="text-sm font-bold tabular-nums text-foreground">
                    {pipelineByStage[s.key] ?? 0}
                  </p>
                  <p className="text-[9px] text-muted-foreground leading-tight">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
