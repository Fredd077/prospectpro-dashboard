'use client'

import { useMemo, useState, useTransition } from 'react'
import { Save, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { saveActivityConversionRates } from '@/lib/actions/activities'
import {
  calcCierresRequeridos,
  calcCitasRequeridas,
  calcCitasProyectadasPorActividad,
  calcIngresoProy,
  calcDesviacion,
  calcEficienciaActividad,
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

type ActivityState = { weight: number; convRate: number }

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

// ── Efficiency badge ─────────────────────────────────────────────────────────
function EficienciaBadge({ nivel }: { nivel: 'alta' | 'media' | 'baja' }) {
  const map = {
    alta:  { label: 'Alta',  cls: 'bg-emerald-400/10 text-emerald-400' },
    media: { label: 'Media', cls: 'bg-amber-400/10 text-amber-400' },
    baja:  { label: 'Baja',  cls: 'bg-red-400/10 text-red-400' },
  }
  const { label, cls } = map[nivel]
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  )
}

// ── Activity table ────────────────────────────────────────────────────────────
function ActivityTable({
  title,
  color,
  activities,
  state,
  citasReqGrupo,
  workingDays,
  weightedAvg,
  onWeightChange,
  onRateChange,
}: {
  title: string
  color: string
  activities: ActivityForSupervision[]
  state: Record<string, ActivityState>
  citasReqGrupo: number
  workingDays: number
  weightedAvg: number
  onWeightChange: (id: string, v: number) => void
  onRateChange:   (id: string, v: number) => void
}) {
  const totalWeight = activities.reduce((s, a) => s + (state[a.id]?.weight ?? 0), 0)
  const weightOk = Math.abs(totalWeight - 100) < 0.01

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <p className={`text-xs font-bold uppercase tracking-widest ${color}`}>{title}</p>
        <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${
          weightOk
            ? 'bg-emerald-400/10 text-emerald-400'
            : 'bg-red-400/10 text-red-400'
        }`}>
          Σ peso = {Math.round(totalWeight * 10) / 10}%
        </span>
      </div>

      {/* Warning banner */}
      {!weightOk && (
        <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
          <p className="text-xs text-red-400">
            El peso total {title} debe sumar 100%. Actualmente suma {Math.round(totalWeight * 10) / 10}%.
          </p>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Actividad</th>
              <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Peso %</th>
              <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tasa → Cita</th>
              <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Citas/mes</th>
              <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Actos nec.</th>
              <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Diario</th>
              <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Eficiencia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {activities.map((act) => {
              const w  = state[act.id]?.weight ?? 0
              const cr = state[act.id]?.convRate ?? 0
              const { citasAsignadas, actividadesNecesarias } = calcCitasProyectadasPorActividad({
                citasReqGrupo,
                pesoPct: w,
                conversionRatePct: cr,
              })
              const diario = actividadesNecesarias > 0
                ? Math.ceil(actividadesNecesarias / Math.max(workingDays, 1))
                : 0
              const eficiencia = calcEficienciaActividad(cr, weightedAvg)

              return (
                <tr key={act.id} className="hover:bg-muted/5 transition-colors">
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-foreground/90 leading-tight">{act.name}</p>
                    <p className="text-[10px] text-muted-foreground/60">{act.channel}</p>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={w}
                      onChange={(e) => onWeightChange(act.id, Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                      className="w-16 text-center rounded border border-border bg-background px-1.5 py-1 text-xs font-mono focus:outline-none focus:border-primary/60"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={cr}
                      onChange={(e) => onRateChange(act.id, Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                      className="w-16 text-center rounded border border-border bg-background px-1.5 py-1 text-xs font-mono focus:outline-none focus:border-primary/60"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono text-foreground/80">
                    {citasAsignadas.toFixed(1)}
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono text-foreground/80">
                    {actividadesNecesarias > 0 ? Math.round(actividadesNecesarias) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono font-semibold text-foreground">
                    {diario > 0 ? diario : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <EficienciaBadge nivel={cr > 0 ? eficiencia : 'baja'} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
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
  workingDays,
  outboundPct,
  outboundRates,
  inboundRates,
  group,
}: SupervisionPanelProps) {
  // Editable state per activity
  const [actState, setActState] = useState<Record<string, ActivityState>>(() =>
    Object.fromEntries(
      activities.map((a) => [
        a.id,
        { weight: a.weight, convRate: a.conversion_rate_pct ?? 0 },
      ]),
    ),
  )
  const [saving, startSave] = useTransition()

  const outActivities = activities.filter((a) => a.type === 'OUTBOUND')
  const inActivities  = activities.filter((a) => a.type === 'INBOUND')

  const lastOutRate = outboundRates[outboundRates.length - 1] ?? 30
  const lastInRate  = inboundRates[inboundRates.length  - 1] ?? 30
  const inboundPct  = 100 - outboundPct

  // ── Global KPIs ──────────────────────────────────────────────────────────
  // When group is set, use that group's last rate so inbound changes react correctly
  const primaryRate    = group === 'INBOUND' ? lastInRate : lastOutRate
  const cierresReq     = calcCierresRequeridos(monthlyRevenueGoal, averageTicket)
  const citasReqTotal  = calcCitasRequeridas(cierresReq, primaryRate)
  // When group is set, the passed monthlyRevenueGoal is already the group's meta → all citas req go to that group
  const citasReqOut    = group === 'INBOUND' ? 0 : group === 'OUTBOUND' ? citasReqTotal : citasReqTotal * (outboundPct / 100)
  const citasReqIn     = group === 'OUTBOUND' ? 0 : group === 'INBOUND' ? citasReqTotal : citasReqTotal * (inboundPct  / 100)

  // ── Per-activity projected citas (contribution = 0 if convRate=0) ──────
  const { citasProyOut, citasProyIn } = useMemo(() => {
    const out = outActivities.reduce((s, a) => {
      const w  = actState[a.id]?.weight ?? 0
      const cr = actState[a.id]?.convRate ?? 0
      const { citasAsignadas } = calcCitasProyectadasPorActividad({
        citasReqGrupo: citasReqOut,
        pesoPct: w,
        conversionRatePct: cr,
      })
      return s + (cr > 0 ? citasAsignadas : 0)
    }, 0)
    const inb = inActivities.reduce((s, a) => {
      const w  = actState[a.id]?.weight ?? 0
      const cr = actState[a.id]?.convRate ?? 0
      const { citasAsignadas } = calcCitasProyectadasPorActividad({
        citasReqGrupo: citasReqIn,
        pesoPct: w,
        conversionRatePct: cr,
      })
      return s + (cr > 0 ? citasAsignadas : 0)
    }, 0)
    return { citasProyOut: out, citasProyIn: inb }
  }, [actState, citasReqOut, citasReqIn]) // eslint-disable-line react-hooks/exhaustive-deps

  const citasProyTotal = group === 'OUTBOUND' ? citasProyOut
    : group === 'INBOUND' ? citasProyIn
    : citasProyOut + citasProyIn
  const ingresoProy    = calcIngresoProy(citasProyTotal, primaryRate, averageTicket)
  const desviacion     = calcDesviacion(ingresoProy, monthlyRevenueGoal)

  const progressPct    = Math.min(100, (ingresoProy / Math.max(monthlyRevenueGoal, 1)) * 100)
  const progressColor  =
    progressPct >= 95 ? 'bg-emerald-400' : progressPct >= 75 ? 'bg-amber-400' : 'bg-red-400'

  // ── Weighted average conv rates per group ─────────────────────────────
  function weightedAvg(list: ActivityForSupervision[]) {
    const totalW = list.reduce((s, a) => s + (actState[a.id]?.weight ?? 0), 0)
    if (totalW <= 0) return 0
    return list.reduce((s, a) => {
      const w  = actState[a.id]?.weight ?? 0
      const cr = actState[a.id]?.convRate ?? 0
      return s + w * cr
    }, 0) / totalW
  }
  const avgOut = weightedAvg(outActivities)
  const avgIn  = weightedAvg(inActivities)

  // ── Per-group ingreso proyectado ───────────────────────────────────────
  const ingresoProyOut = calcIngresoProy(citasProyOut, lastOutRate, averageTicket)
  const ingresoProyIn  = calcIngresoProy(citasProyIn,  lastInRate,  averageTicket)
  const metaOut        = monthlyRevenueGoal * (outboundPct / 100)
  const metaIn         = monthlyRevenueGoal * (inboundPct  / 100)

  // ── Deviation badge style ──────────────────────────────────────────────
  const devStyle = {
    ok:     { text: 'text-emerald-400', bg: 'bg-emerald-400/10', badge: 'bg-emerald-400/10 text-emerald-400 border-emerald-500/20', icon: TrendingUp },
    warn:   { text: 'text-amber-400',   bg: 'bg-amber-400/10',   badge: 'bg-amber-400/10   text-amber-400   border-amber-500/20',   icon: Minus },
    danger: { text: 'text-red-400',     bg: 'bg-red-400/10',     badge: 'bg-red-400/10     text-red-400     border-red-500/20',     icon: TrendingDown },
  }[desviacion.estado]
  const DevIcon = devStyle.icon
  const devBadgeLabel =
    desviacion.pct >= 0 ? 'Por encima de meta'
    : desviacion.pct >= -5 ? 'En rango'
    : desviacion.pct >= -25 ? 'Brecha moderada'
    : 'Brecha crítica'

  function handleWeightChange(id: string, v: number) {
    setActState((prev) => ({ ...prev, [id]: { ...prev[id], weight: v } }))
  }
  function handleRateChange(id: string, v: number) {
    setActState((prev) => ({ ...prev, [id]: { ...prev[id], convRate: v } }))
  }

  function handleSave() {
    startSave(async () => {
      try {
        await saveActivityConversionRates(
          activities.map((a) => ({
            activityId:        a.id,
            conversionRatePct: actState[a.id]?.convRate ?? null,
            weight:            actState[a.id]?.weight ?? null,
          })),
        )
        toast.success('Tasas de conversión y pesos guardados')
      } catch {
        toast.error('Error al guardar las tasas')
      }
    })
  }

  return (
    <div className="space-y-8">
      {/* ─── Section A: Panel de supervisión de meta ─────────────────────── */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
          Panel de supervisión de meta
        </p>

        <div className="flex gap-4">
          {/* KPIs + progress */}
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
                sub="según tus actividades"
                accent={
                  citasProyTotal >= citasReqTotal * 0.95
                    ? 'text-emerald-400'
                    : citasProyTotal >= citasReqTotal * 0.75
                    ? 'text-amber-400'
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

            {/* Progress bar */}
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

          {/* Vertical divider + deviation */}
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

      {/* ─── Section B: Tables ────────────────────────────────────────────── */}
      <div className="space-y-8">
        {/* OUTBOUND — show when no group filter or specifically outbound */}
        {outActivities.length > 0 && group !== 'INBOUND' && (
          <div className="space-y-4">
            <ActivityTable
              title="Outbound"
              color="text-blue-400"
              activities={outActivities}
              state={actState}
              citasReqGrupo={citasReqOut}
              workingDays={workingDays}
              weightedAvg={avgOut}
              onWeightChange={handleWeightChange}
              onRateChange={handleRateChange}
            />
            <AlignmentCard
              label="Alineación Outbound"
              citasProy={citasProyOut}
              citasReq={citasReqOut}
              ingresoProy={ingresoProyOut}
              metaMensual={group === 'OUTBOUND' ? monthlyRevenueGoal : metaOut}
              averageTicket={averageTicket}
              lastRate={lastOutRate}
            />
          </div>
        )}

        {/* INBOUND — show when no group filter or specifically inbound */}
        {inActivities.length > 0 && group !== 'OUTBOUND' && (
          <div className="space-y-4">
            <ActivityTable
              title="Inbound"
              color="text-violet-400"
              activities={inActivities}
              state={actState}
              citasReqGrupo={citasReqIn}
              workingDays={workingDays}
              weightedAvg={avgIn}
              onWeightChange={handleWeightChange}
              onRateChange={handleRateChange}
            />
            <AlignmentCard
              label="Alineación Inbound"
              citasProy={citasProyIn}
              citasReq={citasReqIn}
              ingresoProy={ingresoProyIn}
              metaMensual={group === 'INBOUND' ? monthlyRevenueGoal : metaIn}
              averageTicket={averageTicket}
              lastRate={lastInRate}
            />
          </div>
        )}

        {/* Total alignment card — only when no group filter */}
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

      {/* ─── Save button ─────────────────────────────────────────────────── */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 rounded-md bg-primary/15 border border-primary/30 px-5 py-2 text-sm font-semibold text-primary hover:bg-primary/25 transition-colors disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        {saving ? 'Guardando…' : 'Guardar tasas de conversión'}
      </button>
    </div>
  )
}
