'use client'

import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ScatterChart, Scatter, ZAxis,
  BarChart, Bar, Cell, RadialBarChart, RadialBar, Legend,
} from 'recharts'
import type { TeamPipelineAnalytics } from '@/lib/utils/gerente-pipeline'
import type { GerenteAnalytics, RepAnalytics } from '@/lib/utils/gerente-ai'
import { TrendingUp, TrendingDown, AlertTriangle, Target, Zap, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  pipeline:     TeamPipelineAnalytics
  activity:     GerenteAnalytics
  visibleReps?: RepAnalytics[]
}

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

function pctColor(pct: number) {
  if (pct >= 70) return 'text-emerald-400'
  if (pct >= 40) return 'text-amber-400'
  return 'text-red-400'
}

const ForecastTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg space-y-1">
      <p className="font-semibold text-foreground">{label}</p>
      {payload.map((p: any) => p.value != null && (
        <p key={p.name} style={{ color: p.color ?? p.stroke }}>
          {p.name}: <span className="font-bold">{fmt(Math.round(p.value))}</span>
        </p>
      ))}
    </div>
  )
}

const ScatterTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground">{d.repName}</p>
      <p className="text-muted-foreground">Actividad: <span className="text-foreground font-bold">{d.compliance}%</span></p>
      <p className="text-muted-foreground">Ganado: <span className="text-emerald-400 font-bold">{fmt(d.wonValue)}</span></p>
    </div>
  )
}

export function PredictivePanel({ pipeline, activity, visibleReps }: Props) {
  // Use the filtered activity reps if provided (from rep filter selection)
  const repsToShow = visibleReps ?? activity.reps
  const { summary } = activity
  const goalPct = pipeline.revenueGoal
    ? Math.min(150, Math.round((pipeline.projectedRevenue / pipeline.revenueGoal) * 100))
    : null

  // Momentum radial data
  const momentumData = pipeline.byRep.slice(0, 6).map((r) => ({
    name:  r.name.split(' ')[0],
    score: r.momentumScore,
    fill:  r.riskLevel === 'low' ? '#34d399' : r.riskLevel === 'medium' ? '#fbbf24' : '#f87171',
  }))

  // Forecast chart — split actual vs forecast with confidence band
  const hasForecast = pipeline.forecastWeeks.length > 0
  const splitIdx    = pipeline.forecastWeeks.findIndex((f) => f.actual === null)
  const hasActual   = splitIdx > 0

  return (
    <div className="space-y-6 p-6">

      {/* ── Scope note ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-400/90">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>
          Estas métricas son <strong>agregados del equipo completo</strong>. Para ver datos individuales, selecciona un vendedor en el filtro de arriba.
          Los montos <em>ganados</em> son reales confirmados; el <em>pipeline abierto</em> usa ticket promedio como estimado.
        </span>
      </div>

      {/* ── Top KPI row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            icon:  Target,
            label: 'Proyección equipo',
            value: fmt(pipeline.projectedRevenue),
            sub:   pipeline.revenueGoal ? `Meta total equipo: ${fmt(pipeline.revenueGoal)}` : 'Sin meta configurada',
            accent:'border-t-cyan-500/60',
            extra: goalPct != null ? (
              <span className={cn('text-xs font-bold', goalPct >= 100 ? 'text-emerald-400' : goalPct >= 70 ? 'text-amber-400' : 'text-red-400')}>
                {goalPct}% de meta
              </span>
            ) : null,
          },
          {
            icon:  Zap,
            label: 'Pipeline abierto (estimado)',
            value: fmt(pipeline.teamOpenValue),
            sub:   `${pipeline.byRep.reduce((s,r) => s + r.openCount, 0)} deals · todos los stages`,
            accent:'border-t-violet-500/60',
          },
          {
            icon:  TrendingUp,
            label: 'Win rate general',
            value: `${pipeline.teamWinRate}%`,
            sub:   `ganados / (ganados+perdidos) · ticket prom. ${fmt(pipeline.teamAvgDealSize)}`,
            accent:'border-t-emerald-500/60',
          },
          {
            icon:  AlertTriangle,
            label: 'Vendedores en riesgo',
            value: `${pipeline.atRiskRepIds.length}`,
            sub:   `de ${pipeline.byRep.length} en el equipo`,
            accent: pipeline.atRiskRepIds.length > 0 ? 'border-t-red-500/60' : 'border-t-emerald-500/60',
          },
        ].map(({ icon: Icon, label, value, sub, accent, extra }) => (
          <div key={label} className={`rounded-xl border bg-card p-4 border-t-2 ${accent}`}>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold font-mono text-foreground">{value}</p>
                <p className="text-[10px] text-muted-foreground/60">{sub}</p>
                {extra}
              </div>
              <Icon className="h-4 w-4 text-muted-foreground/40 mt-0.5" />
            </div>
          </div>
        ))}
      </div>

      {/* ── Revenue goal progress bar ───────────────────────────────── */}
      {pipeline.revenueGoal && goalPct != null && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Progreso hacia meta de ingresos</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                <span className="text-emerald-400 font-medium">{fmt(pipeline.teamWonValue)} reales confirmados</span>
                {' '}· <span className="text-cyan-400/80">{fmt(Math.max(0, pipeline.projectedRevenue - pipeline.teamWonValue))} proyectado del pipeline abierto</span>
              </p>
            </div>
            <span className={cn('text-xl font-bold font-mono', pctColor(goalPct))}>
              {goalPct}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden relative">
            {/* Won portion */}
            <div
              className="absolute left-0 top-0 h-full rounded-l-full bg-emerald-400 transition-all duration-700"
              style={{ width: `${Math.min(100, Math.round((pipeline.teamWonValue / pipeline.revenueGoal) * 100))}%` }}
            />
            {/* Projected portion (stacked) */}
            <div
              className="absolute top-0 h-full bg-cyan-400/40 transition-all duration-700"
              style={{
                left:  `${Math.min(100, Math.round((pipeline.teamWonValue / pipeline.revenueGoal) * 100))}%`,
                width: `${Math.min(100 - Math.round((pipeline.teamWonValue / pipeline.revenueGoal) * 100), Math.round(((pipeline.projectedRevenue - pipeline.teamWonValue) / pipeline.revenueGoal) * 100))}%`,
              }}
            />
          </div>
          <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-400 inline-block"/>Ganado (real)</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-cyan-400/60 inline-block"/>Proyección (estimado)</span>
            <span className="ml-auto">Meta total equipo: {fmt(pipeline.revenueGoal)}</span>
          </div>
          <p className="text-[10px] text-muted-foreground/50 mt-1.5 italic">
            Proyección = deals abiertos × probabilidad de cierre por stage (modelo compuesto). Diferente a Mi Pipeline que muestra conversión stage por stage.
          </p>
        </div>
      )}

      {/* ── Charts row ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Revenue forecast chart */}
        {hasForecast && (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-cyan-400" />
                Forecast de ingresos
              </h3>
              <span className="text-[10px] rounded-full px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-medium">
                IA predictiva
              </span>
            </div>
            <ResponsiveContainer width="100%" height={230}>
              <ComposedChart data={pipeline.forecastWeeks} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                <defs>
                  <linearGradient id="wonGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#34d399" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22d3ee" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'rgba(148,163,184,0.7)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'rgba(148,163,184,0.7)' }} tickLine={false} axisLine={false} tickFormatter={(v) => fmt(v)} />
                <Tooltip content={<ForecastTooltip />} />
                {/* Confidence band */}
                <Area dataKey="upper"  stroke="none" fill="rgba(34,211,238,0.06)" legendType="none" name="Máximo" />
                <Area dataKey="lower"  stroke="none" fill="rgba(34,211,238,0)"    legendType="none" name="Mínimo" />
                {/* Actual won */}
                <Area dataKey="actual" stroke="#34d399" strokeWidth={2} fill="url(#wonGrad)" dot={false} activeDot={{ r: 4 }} name="Real ganado" connectNulls={false} />
                {/* Forecast line */}
                <Line dataKey="forecast" stroke="#22d3ee" strokeWidth={1.5} strokeDasharray="5 3" dot={false} activeDot={{ r: 3 }} name="Proyección" />
                {splitIdx > 0 && (
                  <ReferenceLine x={pipeline.forecastWeeks[splitIdx - 1]?.label} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 2" label={{ value: 'hoy', fill: 'rgba(148,163,184,0.5)', fontSize: 9 }} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              Zona sombreada = banda de confianza · Línea cyan = proyección IA
            </p>
          </div>
        )}

        {/* Activity vs Results scatter */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            Actividad vs Resultados
          </h3>
          <p className="text-[10px] text-muted-foreground mb-4">
            Correlación entre cumplimiento de actividad y valor ganado por vendedor
          </p>
          <ResponsiveContainer width="100%" height={210}>
            <ScatterChart margin={{ top: 4, right: 16, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                type="number" dataKey="compliance" name="Actividad" domain={[0, 110]}
                tick={{ fontSize: 10, fill: 'rgba(148,163,184,0.7)' }} tickLine={false} axisLine={false}
                tickFormatter={(v) => `${v}%`} label={{ value: 'Cumpl. actividad', position: 'insideBottom', offset: -2, fontSize: 9, fill: 'rgba(148,163,184,0.5)' }}
              />
              <YAxis
                type="number" dataKey="wonValue" name="Ganado"
                tick={{ fontSize: 10, fill: 'rgba(148,163,184,0.7)' }} tickLine={false} axisLine={false}
                tickFormatter={(v) => fmt(v)}
              />
              <ZAxis range={[60, 240]} />
              <Tooltip content={<ScatterTooltip />} />
              <Scatter data={pipeline.scatterData} fill="#22d3ee" fillOpacity={0.8} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Momentum scores per rep ─────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Zap className="h-4 w-4 text-violet-400" />
            Momentum Score por vendedor
          </h3>
          <p className="text-[10px] text-muted-foreground">Actividad 40% · Win rate 35% · Tendencia 25%</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {pipeline.byRep.map((rep) => {
            const actRep = repsToShow.find((r) => r.userId === rep.userId)
            const riskColors = {
              low:    { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', text: 'text-emerald-400', label: 'Bajo riesgo',   dot: 'bg-emerald-400' },
              medium: { bg: 'bg-amber-500/5',   border: 'border-amber-500/20',   text: 'text-amber-400',   label: 'Riesgo medio', dot: 'bg-amber-400'   },
              high:   { bg: 'bg-red-500/5',      border: 'border-red-500/20',     text: 'text-red-400',     label: 'Alto riesgo',  dot: 'bg-red-400'     },
            }[rep.riskLevel]

            return (
              <div key={rep.userId} className={`rounded-xl border p-4 space-y-3 ${riskColors.bg} ${riskColors.border}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${riskColors.dot}`} />
                      <p className="text-sm font-semibold text-foreground truncate">{rep.name}</p>
                    </div>
                    <p className={`text-[10px] font-medium mt-0.5 ${riskColors.text}`}>{riskColors.label}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-2xl font-bold font-mono ${riskColors.text}`}>{rep.momentumScore}</p>
                    <p className="text-[9px] text-muted-foreground">/ 100</p>
                  </div>
                </div>

                {/* Score bar */}
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      rep.riskLevel === 'low' ? 'bg-emerald-400' : rep.riskLevel === 'medium' ? 'bg-amber-400' : 'bg-red-400'
                    }`}
                    style={{ width: `${rep.momentumScore}%` }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div className="text-center">
                    <p className="text-muted-foreground">Actividad</p>
                    <p className="font-bold font-mono text-foreground">{actRep?.avgCompliance ?? 0}%</p>
                  </div>
                  <div className="text-center border-x border-border/30">
                    <p className="text-muted-foreground">Win rate</p>
                    <p className="font-bold font-mono text-foreground">{rep.winRate}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground">Pipeline</p>
                    <p className="font-bold font-mono text-foreground">{fmt(rep.openValue)}</p>
                  </div>
                </div>

                {pipeline.atRiskRepIds.includes(rep.userId) && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-[10px] text-red-400">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    Necesita atención — baja actividad y pipeline estancado
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Inbound vs Outbound breakdown ───────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-primary" />
            Inbound vs Outbound
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={pipeline.inboundVsOutbound} margin={{ top: 0, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="type" tick={{ fontSize: 11, fill: 'rgba(148,163,184,0.7)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'rgba(148,163,184,0.7)' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: '#0f1117', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="won"  name="Ganados" stackId="a" fill="#34d399" radius={[0,0,0,0]} />
              <Bar dataKey="open" name="Abiertos" stackId="a" fill="#22d3ee" fillOpacity={0.5} radius={[0,0,0,0]} />
              <Bar dataKey="lost" name="Perdidos" stackId="a" fill="#f87171" fillOpacity={0.7} radius={[4,4,0,0]} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-3">
            {pipeline.inboundVsOutbound.map((t) => (
              <div key={t.type} className="flex-1 rounded-lg bg-muted/20 px-3 py-2 text-center">
                <p className="text-[10px] text-muted-foreground">{t.type} win rate</p>
                <p className={`text-lg font-bold font-mono ${t.winRate >= 50 ? 'text-emerald-400' : t.winRate >= 30 ? 'text-amber-400' : 'text-red-400'}`}>
                  {t.winRate}%
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Funnel stages */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Funnel de etapas</h3>
          <div className="space-y-3">
            {pipeline.teamStages.map((stage, i) => {
              const total = stage.open + stage.won + stage.lost
              const openPct = total > 0 ? Math.round((stage.open / total) * 100) : 0
              const wonPct  = total > 0 ? Math.round((stage.won  / total) * 100) : 0
              const lostPct = 100 - openPct - wonPct
              const width   = 100 - i * 15  // funnel narrowing
              return (
                <div key={stage.stage} style={{ width: `${width}%` }} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-foreground">{stage.stage}</span>
                    <span className="text-muted-foreground">{total} deals · {fmt(stage.openValue + stage.wonValue)}</span>
                  </div>
                  <div className="h-6 rounded-lg overflow-hidden flex text-[9px] font-bold">
                    {wonPct > 0  && <div className="flex items-center justify-center bg-emerald-400/80 text-emerald-950" style={{ width: `${wonPct}%` }}>{wonPct > 8 ? `${wonPct}%` : ''}</div>}
                    {openPct > 0 && <div className="flex items-center justify-center bg-cyan-400/40 text-cyan-100"   style={{ width: `${openPct}%`}}>{openPct > 8 ? `${openPct}%` : ''}</div>}
                    {lostPct > 0 && <div className="flex items-center justify-center bg-red-400/40 text-red-100"     style={{ width: `${lostPct}%`}}>{lostPct > 8 ? `${lostPct}%` : ''}</div>}
                  </div>
                  <p className="text-[9px] text-muted-foreground">Win rate: <span className="font-bold text-foreground">{stage.winRate}%</span></p>
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-400/80 inline-block"/>Ganado</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-cyan-400/40 inline-block"/>Abierto</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-400/40 inline-block"/>Perdido</span>
          </div>
        </div>
      </div>
    </div>
  )
}
