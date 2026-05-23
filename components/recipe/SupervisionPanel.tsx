'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import {
  calcCierresRequeridos,
  calcCitasRequeridas,
  calcIngresoProy,
  calcDesviacion,
} from '@/lib/calculations/recipe-supervision'

export type ActivityForSupervision = {
  id: string
  name: string
  type: 'OUTBOUND' | 'INBOUND'
  channel: string
  weight: number
  conversion_rate_pct: number | null
  meetings_expected: number | null
}

interface SupervisionPanelProps {
  activities: ActivityForSupervision[]
  monthlyRevenueGoal: number
  averageTicket: number
  workingDays: number
  outboundPct: number
  outboundRates: number[]
  inboundRates: number[]
  group?: 'OUTBOUND' | 'INBOUND'
}

function fmt(n: number) {
  return n.toLocaleString('es', { maximumFractionDigits: 0 })
}
function fmtUsd(n: number) {
  return '$' + fmt(Math.abs(n))
}

// ── KPI card ────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub: string
  accent?: string
}) {
  return (
    <div className="flex-1 min-w-0 rounded-lg border border-border bg-muted/10 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </p>
      <p className={`text-2xl font-mono font-bold leading-none ${accent ?? 'text-foreground'}`}>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground/60 mt-1">{sub}</p>
    </div>
  )
}

// ── Alignment card ────────────────────────────────────────────────────────────
function AlignmentCard({
  label,
  citasProy,
  citasReq,
  ingresoProy,
  metaMensual,
  averageTicket,
  lastRate,
}: {
  label: string
  citasProy: number
  citasReq: number
  ingresoProy: number
  metaMensual: number
  averageTicket: number
  lastRate: number
}) {
  const dev = calcDesviacion(ingresoProy, metaMensual)
  const faltanCitas = Math.round((citasReq - citasProy) * 10) / 10
  const statusMap = {
    ok:     { label: dev.pct >= 0 ? 'Por encima de meta' : 'En rango', cls: 'bg-emerald-400/10 text-emerald-400 border-emerald-500/20' },
    warn:   { label: 'Brecha moderada', cls: 'bg-amber-400/10 text-amber-400 border-amber-500/20' },
    danger: { label: 'Brecha crítica',  cls: 'bg-red-400/10 text-red-400 border-red-500/20' },
  }
  const { label: statusLabel, cls } = statusMap[dev.estado]

  // suppress unused-var warning — lastRate and averageTicket kept for API stability
  void averageTicket; void lastRate

  return (
    <div className={`rounded-lg border px-4 py-3 space-y-2 ${cls}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider">{label}</p>
        <span className={`text-[10px] font-semibold rounded-full border px-2 py-0.5 ${cls}`}>
          {statusLabel}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-[10px] text-current/70 mb-0.5">Citas proyectadas</p>
          <p className="font-mono font-bold text-sm">{citasProy.toFixed(1)}</p>
        </div>
        <div>
          <p className="text-[10px] text-current/70 mb-0.5">Citas requeridas</p>
          <p className="font-mono font-bold text-sm">{citasReq.toFixed(1)}</p>
        </div>
        <div>
          <p className="text-[10px] text-current/70 mb-0.5">
            {faltanCitas > 0 ? 'Faltan' : 'Excedente'}
          </p>
          <p className="font-mono font-bold text-sm">
            {faltanCitas > 0 ? `−${faltanCitas}` : `+${Math.abs(faltanCitas)}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 pt-1 border-t border-current/20">
        <span className="text-[10px]">
          Ingreso proy: <strong>{fmtUsd(ingresoProy)}</strong>
        </span>
        <span className="text-[10px]">
          Desv: <strong>{dev.pct >= 0 ? '+' : ''}{dev.pct}%</strong>
          {' '}({dev.valor >= 0 ? '+' : '−'}{fmtUsd(dev.valor)})
        </span>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function SupervisionPanel({
  activities,
  monthlyRevenueGoal,
  averageTicket,
  workingDays: _workingDays,
  outboundPct,
  outboundRates,
  inboundRates,
  group,
}: SupervisionPanelProps) {
  const outActivities = activities.filter((a) => a.type === 'OUTBOUND')
  const inActivities  = activities.filter((a) => a.type === 'INBOUND')

  const lastOutRate = outboundRates[outboundRates.length - 1] ?? 30
  const lastInRate  = inboundRates[inboundRates.length  - 1] ?? 30
  const inboundPct  = 100 - outboundPct

  // When group is set, use that group's last rate so inbound panel reacts to inbound sliders
  const primaryRate   = group === 'INBOUND' ? lastInRate : lastOutRate
  const cierresReq    = calcCierresRequeridos(monthlyRevenueGoal, averageTicket)
  const citasReqTotal = calcCitasRequeridas(cierresReq, primaryRate)
  const citasReqOut   = group === 'INBOUND'  ? 0            : group === 'OUTBOUND' ? citasReqTotal : citasReqTotal * (outboundPct / 100)
  const citasReqIn    = group === 'OUTBOUND' ? 0            : group === 'INBOUND'  ? citasReqTotal : citasReqTotal * (inboundPct  / 100)

  // Citas proyectadas = meetings_expected fijos del usuario (ingresados en Rendimiento)
  const citasProyOut = outActivities.reduce((s, a) => s + (a.meetings_expected ?? 0), 0)
  const citasProyIn  = inActivities.reduce((s,  a) => s + (a.meetings_expected ?? 0), 0)

  const citasProyTotal = group === 'OUTBOUND' ? citasProyOut
    : group === 'INBOUND' ? citasProyIn
    : citasProyOut + citasProyIn
  const ingresoProy   = calcIngresoProy(citasProyTotal, primaryRate, averageTicket)
  const desviacion    = calcDesviacion(ingresoProy, monthlyRevenueGoal)

  const progressPct   = Math.min(100, (ingresoProy / Math.max(monthlyRevenueGoal, 1)) * 100)
  const progressColor = progressPct >= 95 ? 'bg-emerald-400' : progressPct >= 75 ? 'bg-amber-400' : 'bg-red-400'

  const ingresoProyOut = calcIngresoProy(citasProyOut, lastOutRate, averageTicket)
  const ingresoProyIn  = calcIngresoProy(citasProyIn,  lastInRate,  averageTicket)
  const metaOut        = monthlyRevenueGoal * (outboundPct / 100)
  const metaIn         = monthlyRevenueGoal * (inboundPct  / 100)

  const devStyle = {
    ok:     { text: 'text-emerald-400', badge: 'bg-emerald-400/10 text-emerald-400 border-emerald-500/20', icon: TrendingUp },
    warn:   { text: 'text-amber-400',   badge: 'bg-amber-400/10   text-amber-400   border-amber-500/20',   icon: Minus },
    danger: { text: 'text-red-400',     badge: 'bg-red-400/10     text-red-400     border-red-500/20',     icon: TrendingDown },
  }[desviacion.estado]
  const DevIcon = devStyle.icon
  const devBadgeLabel =
    desviacion.pct >= 0       ? 'Por encima de meta'
    : desviacion.pct >= -5    ? 'En rango'
    : desviacion.pct >= -25   ? 'Brecha moderada'
    : 'Brecha crítica'

  return (
    <div className="space-y-6">
      {/* ─── Panel de supervisión de meta ──────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
          Panel de supervisión de meta
        </p>

        <div className="flex gap-4">
          <div className="flex-1 space-y-4">
            <div className="flex gap-3 flex-wrap">
              <KpiCard
                label="Negocios requeridos"
                value={cierresReq.toFixed(1)}
                sub="cierres / mes"
                accent="text-[#00D9FF]"
              />
              <KpiCard
                label="Citas requeridas"
                value={citasReqTotal.toFixed(1)}
                sub="para lograr ese cierre"
                accent="text-[#00D9FF]"
              />
              <KpiCard
                label="Citas proyectadas"
                value={citasProyTotal.toFixed(1)}
                sub="según reuniones esperadas"
                accent={
                  citasProyTotal >= citasReqTotal * 0.95 ? 'text-emerald-400'
                  : citasProyTotal >= citasReqTotal * 0.75 ? 'text-amber-400'
                  : 'text-red-400'
                }
              />
              <KpiCard
                label="Ingreso proyectado"
                value={fmtUsd(ingresoProy)}
                sub="vs meta"
                accent={devStyle.text}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Cobertura de meta</span>
                <span className="font-semibold">{Math.round(progressPct)}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${progressColor}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground/50">
                <span>$0</span>
                <span>{fmtUsd(monthlyRevenueGoal)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-px bg-border" />
            <div className={`rounded-lg border ${devStyle.badge} px-5 py-4 flex flex-col items-center justify-center gap-2 min-w-[140px]`}>
              <DevIcon className="h-5 w-5" />
              <p className="font-mono text-3xl font-bold leading-none">
                {desviacion.pct >= 0 ? '+' : ''}{desviacion.pct}%
              </p>
              <p className="font-mono text-sm font-semibold">
                {desviacion.valor >= 0 ? '+' : '−'}{fmtUsd(desviacion.valor)}
              </p>
              <span className={`text-[10px] font-semibold rounded-full border px-2 py-0.5 ${devStyle.badge}`}>
                {devBadgeLabel}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Alignment cards ───────────────────────────────────────────── */}
      <div className="space-y-4">
        {outActivities.length > 0 && group !== 'INBOUND' && (
          <AlignmentCard
            label="Alineación Outbound"
            citasProy={citasProyOut}
            citasReq={citasReqOut}
            ingresoProy={ingresoProyOut}
            metaMensual={group === 'OUTBOUND' ? monthlyRevenueGoal : metaOut}
            averageTicket={averageTicket}
            lastRate={lastOutRate}
          />
        )}
        {inActivities.length > 0 && group !== 'OUTBOUND' && (
          <AlignmentCard
            label="Alineación Inbound"
            citasProy={citasProyIn}
            citasReq={citasReqIn}
            ingresoProy={ingresoProyIn}
            metaMensual={group === 'INBOUND' ? monthlyRevenueGoal : metaIn}
            averageTicket={averageTicket}
            lastRate={lastInRate}
          />
        )}
        {!group && (
          <AlignmentCard
            label="Alineación Total"
            citasProy={citasProyTotal}
            citasReq={citasReqTotal}
            ingresoProy={ingresoProy}
            metaMensual={monthlyRevenueGoal}
            averageTicket={averageTicket}
            lastRate={lastOutRate}
          />
        )}
      </div>
    </div>
  )
}
