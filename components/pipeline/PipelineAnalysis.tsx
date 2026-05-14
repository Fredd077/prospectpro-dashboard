'use client'

import { useMemo } from 'react'
import { fmtUSD } from '@/lib/calculations/pipeline'
import type { PipelineSimple } from '@/lib/types/database'

interface Props {
  entries: PipelineSimple[]
  monthlyRevenueGoal: number | null
  period: string
  periodLabel: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(num: number, den: number) {
  return den > 0 ? Math.round((num / den) * 100) : 0
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
      {children}
    </h3>
  )
}

function StatRow({ label, value, sub, color = 'text-foreground' }: {
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className={`text-sm font-bold tabular-nums ${color}`}>{value}</span>
        {sub && <p className="text-[10px] text-muted-foreground/60">{sub}</p>}
      </div>
    </div>
  )
}

function NeonStat({ label, value, sub, threshHigh, threshLow }: {
  label: string
  value: number
  sub?: string
  threshHigh: number
  threshLow: number
}) {
  const glowColor = value >= threshHigh ? '#34d399' : value >= threshLow ? '#fbbf24' : '#f87171'
  const textColor = value >= threshHigh ? 'text-emerald-400' : value >= threshLow ? 'text-amber-400' : 'text-red-400'
  return (
    <div className="py-3 border-b border-border/50 last:border-0">
      <p className="text-base font-semibold text-foreground mb-1">{label}</p>
      <p
        className={`text-2xl font-bold tabular-nums leading-none ${textColor}`}
        style={{ filter: `drop-shadow(0 0 4px ${glowColor})` }}
      >
        {value}%
      </p>
      {sub && <p className="text-sm text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

function StageOriginBlock({ stage, total, outbound, inbound, stageColor }: {
  stage: string
  total: number
  outbound: number
  inbound: number
  stageColor: string
}) {
  return (
    <div className="py-2.5 border-b border-border/50 last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-xs font-bold ${stageColor}`}>{stage}</span>
        <span className="text-sm font-bold tabular-nums text-foreground">{total}</span>
      </div>
      <div className="flex gap-1.5">
        <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded border bg-orange-500/10 text-orange-400 border-orange-500/20">
          OUTBOUND {outbound}
        </span>
        <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded border bg-sky-500/10 text-sky-400 border-sky-500/20">
          INBOUND {inbound}
        </span>
      </div>
    </div>
  )
}

function GoalBar({ value, goal }: { value: number; goal: number }) {
  const progress = goal > 0 ? Math.min(Math.round((value / goal) * 100), 100) : 0
  const color = progress >= 100 ? 'bg-emerald-500' : progress >= 60 ? 'bg-amber-500' : 'bg-primary'
  const textColor = progress >= 100 ? 'text-emerald-400' : progress >= 60 ? 'text-amber-400' : 'text-primary'
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px]">
        <span className="text-muted-foreground">Progreso hacia meta</span>
        <span className={`font-bold tabular-nums ${textColor}`}>{progress}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${progress}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground/60">
        <span>{fmtUSD(value)} ganado</span>
        <span>Meta: {fmtUSD(goal)}</span>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function PipelineAnalysis({ entries, monthlyRevenueGoal, periodLabel }: Props) {
  const stats = useMemo(() => {
    const reuniones  = entries.filter(e => e.stage === 'Primera reu ejecutada/Propuesta en preparación')
    const propuestas = entries.filter(e => e.stage === 'Propuesta Presentada')
    const cierres    = entries.filter(e => e.stage === 'Por facturar/cobrar')

    const propAbiertas = propuestas.filter(e => e.status === 'abierto')
    const propGanadas  = propuestas.filter(e => e.status === 'ganado')
    const propPerdidas = propuestas.filter(e => e.status === 'perdido')

    const revenueGanado   = cierres.reduce((s, e) => s + (e.amount_usd ?? 0), 0)
    const revenuePipeline = propAbiertas.reduce((s, e) => s + (e.amount_usd ?? 0), 0)
    const revenuePerdido  = propPerdidas.reduce((s, e) => s + (e.amount_usd ?? 0), 0)

    const totalConAmonto  = entries.filter(e => e.amount_usd != null).length
    const sumaAmonto      = entries.reduce((s, e) => s + (e.amount_usd ?? 0), 0)
    const avgTicket       = totalConAmonto > 0 ? sumaAmonto / totalConAmonto : 0

    const convReunProp    = pct(propuestas.length, reuniones.length)
    const convPropCierre  = pct(cierres.length, propuestas.length)
    const tasaGanado      = pct(propGanadas.length + cierres.length, propuestas.length + cierres.length)

    const reunionesOut  = reuniones.filter(e => e.prospect_type === 'outbound').length
    const reunionesIn   = reuniones.filter(e => e.prospect_type === 'inbound').length
    const propuestasOut = propuestas.filter(e => e.prospect_type === 'outbound').length
    const propuestasIn  = propuestas.filter(e => e.prospect_type === 'inbound').length
    const cierresOut    = cierres.filter(e => e.prospect_type === 'outbound').length
    const cierresIn     = cierres.filter(e => e.prospect_type === 'inbound').length

    return {
      reuniones: reuniones.length,
      propuestas: propuestas.length,
      cierres: cierres.length,
      propAbiertas: propAbiertas.length,
      propGanadas: propGanadas.length,
      propPerdidas: propPerdidas.length,
      revenueGanado,
      revenuePipeline,
      revenuePerdido,
      avgTicket,
      convReunProp,
      convPropCierre,
      tasaGanado,
      reunionesOut, reunionesIn,
      propuestasOut, propuestasIn,
      cierresOut, cierresIn,
      total: entries.length,
    }
  }, [entries])

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">
        Sin datos para el período: {periodLabel}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">

      {/* ── Columna 1: Revenue ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <SectionTitle>Revenue — {periodLabel}</SectionTitle>

        {monthlyRevenueGoal != null && monthlyRevenueGoal > 0 && (
          <GoalBar value={stats.revenueGanado} goal={monthlyRevenueGoal} />
        )}

        <div>
          <StatRow
            label="Ganado (Cierres)"
            value={fmtUSD(stats.revenueGanado)}
            color="text-emerald-400"
          />
          <StatRow
            label="Pipeline abierto"
            value={fmtUSD(stats.revenuePipeline)}
            sub={`${stats.propAbiertas} propuesta${stats.propAbiertas !== 1 ? 's' : ''} activa${stats.propAbiertas !== 1 ? 's' : ''}`}
            color="text-amber-400"
          />
          <StatRow
            label="Perdido"
            value={fmtUSD(stats.revenuePerdido)}
            color="text-red-400"
          />
          <StatRow
            label="Ticket promedio"
            value={stats.avgTicket > 0 ? fmtUSD(stats.avgTicket) : '—'}
            sub="sobre entradas con monto"
          />
        </div>
      </div>

      {/* ── Columna 2: Conversión ──────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-1">
        <SectionTitle>Conversión</SectionTitle>
        <NeonStat
          label="Reunión → Propuesta"
          value={stats.convReunProp}
          sub={`${stats.propuestas} de ${stats.reuniones} reuniones`}
          threshHigh={50}
          threshLow={25}
        />
        <NeonStat
          label="Propuesta → Cierre"
          value={stats.convPropCierre}
          sub={`${stats.cierres} de ${stats.propuestas} propuestas`}
          threshHigh={40}
          threshLow={20}
        />
        <NeonStat
          label="Tasa ganados"
          value={stats.tasaGanado}
          sub="propuestas ganadas + cierres"
          threshHigh={50}
          threshLow={25}
        />

        <div className="pt-3 border-t border-border/50">
          <SectionTitle>Estado de propuestas</SectionTitle>
          {([
            { label: 'Abiertas', value: stats.propAbiertas, color: 'text-amber-400'   },
            { label: 'Ganadas',  value: stats.propGanadas,  color: 'text-emerald-400' },
            { label: 'Perdidas', value: stats.propPerdidas, color: 'text-red-400'     },
          ] as const).map(({ label, value, color }) => (
            <div key={label} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
              <span className="text-base text-muted-foreground">{label}</span>
              <span className={`text-2xl font-bold tabular-nums ${color}`}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Columna 3: Actividad ───────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <SectionTitle>Actividad por etapa y origen</SectionTitle>
          <span className="text-xs text-muted-foreground tabular-nums">{stats.total} total</span>
        </div>
        <div>
          <StageOriginBlock
            stage="Reuniones"
            total={stats.reuniones}
            outbound={stats.reunionesOut}
            inbound={stats.reunionesIn}
            stageColor="text-cyan-400"
          />
          <StageOriginBlock
            stage="Propuestas"
            total={stats.propuestas}
            outbound={stats.propuestasOut}
            inbound={stats.propuestasIn}
            stageColor="text-amber-400"
          />
          <StageOriginBlock
            stage="Cierres"
            total={stats.cierres}
            outbound={stats.cierresOut}
            inbound={stats.cierresIn}
            stageColor="text-emerald-400"
          />
        </div>
      </div>

    </div>
  )
}
