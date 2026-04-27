'use client'

import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ScatterChart, Scatter, ZAxis,
  BarChart, Bar, Cell, Legend,
} from 'recharts'
import { parseISO, differenceInDays } from 'date-fns'
import type { TeamPipelineAnalytics } from '@/lib/utils/gerente-pipeline'
import type { GerenteAnalytics, RepAnalytics } from '@/lib/utils/gerente-ai'
import { TrendingUp, TrendingDown, AlertTriangle, Target, Zap, ArrowUpRight, ChevronRight } from 'lucide-react'
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
  if (pct >= 100) return 'text-emerald-400'
  if (pct >= 70)  return 'text-amber-400'
  return 'text-red-400'
}

const axisProps = { tick: { fontSize: 9, fill: 'rgba(148,163,184,0.45)' }, tickLine: false, axisLine: false }

const ForecastTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded border border-white/10 bg-[#0d1117] px-3 py-2 text-xs shadow-xl shadow-black/50 space-y-1">
      <p className="font-mono font-bold text-white/60 text-[9px] uppercase tracking-wider">{label}</p>
      {payload.map((p: any) => p.value != null && (
        <p key={p.name} className="flex items-center gap-2" style={{ color: p.color ?? p.stroke }}>
          <span className="h-1.5 w-1.5 rounded-full inline-block shrink-0" style={{ background: p.color ?? p.stroke }} />
          {p.name}: <span className="font-mono font-bold">{fmt(Math.round(p.value))}</span>
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
    <div className="rounded border border-white/10 bg-[#0d1117] px-3 py-2 text-xs shadow-xl shadow-black/50">
      <p className="font-bold text-white/80 font-mono text-[11px]">{d.repName}</p>
      <p className="text-white/40 text-[10px]">Actividad: <span className="text-white/70 font-bold">{d.compliance}%</span></p>
      <p className="text-white/40 text-[10px]">Ganado: <span className="text-emerald-400 font-bold">{fmt(d.wonValue)}</span></p>
    </div>
  )
}

export function PredictivePanel({ pipeline, activity, visibleReps }: Props) {
  const repsToShow = visibleReps ?? activity.reps
  const goalPct = pipeline.revenueGoal
    ? Math.min(150, Math.round((pipeline.projectedRevenue / pipeline.revenueGoal) * 100))
    : null

  // ── End-of-period intelligence ──────────────────────────────────────────────
  const today      = new Date()
  const startDate  = parseISO(activity.startISO)
  const endDate    = parseISO(activity.endISO)
  const totalDays  = Math.max(1, differenceInDays(endDate, startDate) + 1)
  const elapsedDays   = Math.max(1, Math.min(totalDays, differenceInDays(today, startDate) + 1))
  const remainingDays = Math.max(0, differenceInDays(endDate, today))
  const periodProgress = elapsedDays / totalDays

  const elapsedWeeks   = elapsedDays / 7
  const remainingWeeks = remainingDays / 7

  // Current run rate (won per elapsed week)
  const runRatePerWeek = elapsedWeeks > 0 ? pipeline.teamWonValue / elapsedWeeks : 0

  // Estimated at end of period at current run rate
  const estimatedEndOfPeriod = Math.round(pipeline.teamWonValue + runRatePerWeek * remainingWeeks)

  // Goal gap analysis
  const goalGap       = pipeline.revenueGoal ? pipeline.revenueGoal - estimatedEndOfPeriod : null
  const onTrackForGoal = goalGap !== null && goalGap <= 0

  const dealsNeeded = goalGap && goalGap > 0 && pipeline.teamAvgDealSize > 0
    ? Math.ceil(goalGap / pipeline.teamAvgDealSize)
    : 0

  // Required run rate to hit goal
  const requiredRunRate = pipeline.revenueGoal && remainingWeeks > 0
    ? Math.round((pipeline.revenueGoal - pipeline.teamWonValue) / remainingWeeks)
    : null

  const runRateGap = requiredRunRate !== null ? requiredRunRate - runRatePerWeek : null
  const runRateBoostPct = runRateGap && runRatePerWeek > 0
    ? Math.round((runRateGap / runRatePerWeek) * 100)
    : null

  const hasForecast = pipeline.forecastWeeks.length > 0
  const splitIdx    = pipeline.forecastWeeks.findIndex((f) => f.actual === null)

  return (
    <div className="space-y-4 p-5 bg-[#080b12]">

      {/* ── END-OF-PERIOD INTELLIGENCE CARD ─────────────────────────────── */}
      <div className={cn(
        'rounded-lg border p-5 relative overflow-hidden',
        onTrackForGoal
          ? 'border-emerald-500/25 bg-emerald-500/[0.04]'
          : 'border-amber-500/25 bg-amber-500/[0.03]'
      )}>
        {/* Subtle radial glow */}
        <div className={cn(
          'absolute inset-0 pointer-events-none',
          onTrackForGoal
            ? 'bg-[radial-gradient(ellipse_at_top_right,rgba(52,211,153,0.06),transparent_60%)]'
            : 'bg-[radial-gradient(ellipse_at_top_right,rgba(251,191,36,0.06),transparent_60%)]'
        )} />

        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/30 mb-1">
              Análisis predictivo · cierre del período
            </p>
            <div className="flex items-center gap-3">
              <div>
                <span className="text-3xl font-black font-mono text-white">{fmt(estimatedEndOfPeriod)}</span>
                <span className="text-white/30 text-xs ml-2">estimado al cierre</span>
              </div>
              {pipeline.revenueGoal && (
                <div className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-black font-mono',
                  onTrackForGoal
                    ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-400'
                    : 'border-amber-400/40 bg-amber-400/10 text-amber-400'
                )}>
                  {onTrackForGoal
                    ? <><TrendingUp className="h-3 w-3" /> En camino</>
                    : <><TrendingDown className="h-3 w-3" /> Brecha detectada</>
                  }
                </div>
              )}
            </div>
          </div>
          <div className="text-right text-[9px] text-white/30">
            <p className="font-mono font-bold text-white/50 text-sm">{Math.round(periodProgress * 100)}%</p>
            <p>del período</p>
            <p className="mt-0.5">{remainingDays}d restantes</p>
          </div>
        </div>

        {/* Progress toward goal */}
        {pipeline.revenueGoal && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-[9px] text-white/30 mb-1.5">
              <span>Meta: <span className="font-mono font-bold text-white/50">{fmt(pipeline.revenueGoal)}</span></span>
              <span>Estimado: <span className={cn('font-mono font-bold', onTrackForGoal ? 'text-emerald-400' : 'text-amber-400')}>{fmt(estimatedEndOfPeriod)}</span></span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden relative">
              {/* Won portion */}
              <div className="absolute left-0 top-0 h-full rounded-full bg-emerald-400 transition-all duration-700"
                style={{ width: `${Math.min(100, Math.round((pipeline.teamWonValue / pipeline.revenueGoal) * 100))}%` }} />
              {/* Projected portion */}
              <div className="absolute top-0 h-full bg-cyan-400/40 transition-all duration-700"
                style={{
                  left: `${Math.min(100, Math.round((pipeline.teamWonValue / pipeline.revenueGoal) * 100))}%`,
                  width: `${Math.min(
                    100 - Math.round((pipeline.teamWonValue / pipeline.revenueGoal) * 100),
                    Math.round(((estimatedEndOfPeriod - pipeline.teamWonValue) / pipeline.revenueGoal) * 100)
                  )}%`,
                }}
              />
              {/* Goal marker */}
              <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-white/20" />
            </div>
            <div className="flex items-center gap-4 mt-1.5 text-[8px] text-white/25">
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-sm bg-emerald-400 inline-block" />Real confirmado {fmt(pipeline.teamWonValue)}</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-sm bg-cyan-400/50 inline-block" />Proyección run rate</span>
            </div>
          </div>
        )}

        {/* Gap analysis grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
            <p className="text-[8px] font-bold uppercase tracking-wider text-white/30 mb-1">Run rate actual</p>
            <p className="text-lg font-black font-mono text-cyan-400">{fmt(Math.round(runRatePerWeek))}</p>
            <p className="text-[8px] text-white/25">por semana</p>
          </div>
          {requiredRunRate !== null && (
            <div className={cn('rounded border px-3 py-2.5', onTrackForGoal ? 'bg-emerald-500/[0.05] border-emerald-500/20' : 'bg-amber-500/[0.05] border-amber-500/20')}>
              <p className="text-[8px] font-bold uppercase tracking-wider text-white/30 mb-1">Run rate necesario</p>
              <p className={cn('text-lg font-black font-mono', onTrackForGoal ? 'text-emerald-400' : 'text-amber-400')}>{fmt(requiredRunRate)}</p>
              <p className="text-[8px] text-white/25">por semana para meta</p>
            </div>
          )}
          {goalGap !== null && (
            <div className={cn('rounded border px-3 py-2.5', onTrackForGoal ? 'bg-emerald-500/[0.05] border-emerald-500/20' : 'bg-red-500/[0.05] border-red-500/20')}>
              <p className="text-[8px] font-bold uppercase tracking-wider text-white/30 mb-1">
                {onTrackForGoal ? 'Superávit' : 'Brecha con meta'}
              </p>
              <p className={cn('text-lg font-black font-mono', onTrackForGoal ? 'text-emerald-400' : 'text-red-400')}>
                {onTrackForGoal ? '+' : ''}{fmt(Math.abs(goalGap))}
              </p>
              <p className="text-[8px] text-white/25">
                {onTrackForGoal ? 'por encima del objetivo' : `${dealsNeeded} deal${dealsNeeded !== 1 ? 's' : ''} adicional${dealsNeeded !== 1 ? 'es' : ''}`}
              </p>
            </div>
          )}
          <div className="rounded bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
            <p className="text-[8px] font-bold uppercase tracking-wider text-white/30 mb-1">Ritmo del período</p>
            <p className="text-lg font-black font-mono text-violet-400">{Math.round(periodProgress * 100)}%</p>
            <p className="text-[8px] text-white/25">{remainingDays} días restantes</p>
          </div>
        </div>

        {/* Recommendation banner */}
        {goalGap !== null && goalGap > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded bg-amber-500/[0.06] border border-amber-500/20 px-3 py-2.5">
            <ChevronRight className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-300/80">
              <span className="font-bold">Acción recomendada:</span>{' '}
              {runRateBoostPct !== null && runRateBoostPct > 0
                ? `Aumentar el ritmo de cierre en ${runRateBoostPct}% — de ${fmt(Math.round(runRatePerWeek))}/sem a ${fmt(requiredRunRate!)}/sem. `
                : ''}
              Cerrar <span className="font-black text-amber-400">{dealsNeeded} deal{dealsNeeded !== 1 ? 's' : ''}</span> adicional{dealsNeeded !== 1 ? 'es' : ''} con ticket promedio {fmt(pipeline.teamAvgDealSize)} en las próximas <span className="font-black text-amber-400">{remainingDays} días</span>.
            </p>
          </div>
        )}
        {goalGap !== null && goalGap <= 0 && (
          <div className="mt-3 flex items-start gap-2 rounded bg-emerald-500/[0.06] border border-emerald-500/20 px-3 py-2.5">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-emerald-300/80">
              <span className="font-bold">En camino a superar la meta.</span>{' '}
              Al ritmo actual de {fmt(Math.round(runRatePerWeek))}/semana, el equipo terminará el período con <span className="font-black text-emerald-400">{fmt(Math.abs(goalGap))}</span> por encima del objetivo.
            </p>
          </div>
        )}
      </div>

      {/* ── TOP KPI ROW ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          {
            icon: Target, label: 'PROYECCIÓN EQUIPO',
            value: fmt(pipeline.projectedRevenue),
            sub: pipeline.revenueGoal ? `Meta: ${fmt(pipeline.revenueGoal)}` : 'Sin meta',
            extra: goalPct != null ? <span className={cn('text-[10px] font-black font-mono', pctColor(goalPct))}>{goalPct}% meta</span> : null,
            accent: '#22d3ee',
          },
          {
            icon: Zap, label: 'PIPELINE ABIERTO',
            value: fmt(pipeline.teamOpenValue),
            sub: `${pipeline.byRep.reduce((s,r) => s + r.openCount, 0)} deals · todos los stages`,
            accent: '#a78bfa',
          },
          {
            icon: TrendingUp, label: 'WIN RATE GENERAL',
            value: `${pipeline.teamWinRate}%`,
            sub: `Ticket prom. ${fmt(pipeline.teamAvgDealSize)}`,
            accent: '#34d399',
          },
          {
            icon: AlertTriangle, label: 'EN RIESGO',
            value: `${pipeline.atRiskRepIds.length}`,
            sub: `de ${pipeline.byRep.length} vendedores`,
            accent: pipeline.atRiskRepIds.length > 0 ? '#f87171' : '#34d399',
          },
        ].map(({ icon: Icon, label, value, sub, accent, extra }) => (
          <div key={label} className="rounded-lg bg-[#0d1117] border border-white/[0.06] p-4 relative overflow-hidden"
            style={{ borderLeft: `2px solid ${accent}40`, boxShadow: `inset 2px 0 16px ${accent}08` }}
          >
            <div className="flex items-start justify-between mb-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/30">{label}</p>
              <Icon className="h-3 w-3 text-white/15" />
            </div>
            <p className="text-2xl font-black font-mono" style={{ color: accent }}>{value}</p>
            <p className="text-[9px] text-white/25 mt-1">{sub}</p>
            {extra && <div className="mt-1">{extra}</div>}
          </div>
        ))}
      </div>

      {/* ── CHARTS ROW ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* Revenue forecast chart */}
        {hasForecast && (
          <div className="rounded-lg bg-[#0d1117] border border-white/[0.06] p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="h-[3px] w-4 rounded-full bg-cyan-400 inline-block" />
                <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">Forecast de ingresos</h3>
              </div>
              <span className="text-[9px] rounded px-2 py-0.5 bg-violet-500/10 border border-violet-500/20 text-violet-400 font-bold uppercase tracking-wider">
                IA predictiva
              </span>
            </div>
            <ResponsiveContainer width="100%" height={210}>
              <ComposedChart data={pipeline.forecastWeeks} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                <defs>
                  <linearGradient id="wonGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#34d399" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={(v) => fmt(v)} />
                <Tooltip content={<ForecastTooltip />} />
                <Area dataKey="upper" stroke="none" fill="rgba(34,211,238,0.04)" legendType="none" name="Máximo" />
                <Area dataKey="lower" stroke="none" fill="rgba(34,211,238,0)"    legendType="none" name="Mínimo" />
                <Area dataKey="actual" stroke="#34d399" strokeWidth={2} fill="url(#wonGrad2)" dot={false} activeDot={{ r: 3 }} name="Real ganado" connectNulls={false} />
                <Line dataKey="forecast" stroke="#22d3ee" strokeWidth={1.5} strokeDasharray="4 3" dot={false} activeDot={{ r: 3 }} name="Proyección IA" />
                {splitIdx > 0 && (
                  <ReferenceLine x={pipeline.forecastWeeks[splitIdx - 1]?.label} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 2"
                    label={{ value: 'HOY', fill: 'rgba(148,163,184,0.4)', fontSize: 8 }} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
            <p className="text-[8px] text-white/20 mt-2 text-center font-mono">
              Banda sombreada = confianza · Línea cyan = proyección regresión lineal
            </p>
          </div>
        )}

        {/* Activity vs Results scatter */}
        <div className="rounded-lg bg-[#0d1117] border border-white/[0.06] p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="h-[3px] w-4 rounded-full bg-amber-400 inline-block" />
            <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">Actividad vs Resultados</h3>
          </div>
          <p className="text-[9px] text-white/25 mb-4">Correlación cumplimiento de actividad → valor ganado</p>
          <ResponsiveContainer width="100%" height={195}>
            <ScatterChart margin={{ top: 4, right: 16, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
              <XAxis type="number" dataKey="compliance" name="Actividad" domain={[0, 110]} {...axisProps}
                tickFormatter={(v) => `${v}%`}
                label={{ value: 'Cumpl. actividad', position: 'insideBottom', offset: -2, fontSize: 8, fill: 'rgba(148,163,184,0.35)' }}
              />
              <YAxis type="number" dataKey="wonValue" name="Ganado" {...axisProps} tickFormatter={(v) => fmt(v)} />
              <ZAxis range={[50, 200]} />
              <Tooltip content={<ScatterTooltip />} />
              <Scatter data={pipeline.scatterData} fill="#22d3ee" fillOpacity={0.75} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── MOMENTUM SCORES ──────────────────────────────────────────── */}
      <div className="rounded-lg bg-[#0d1117] border border-white/[0.06] p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="h-[3px] w-4 rounded-full bg-violet-400 inline-block" />
            <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">Momentum Score por vendedor</h3>
          </div>
          <p className="text-[9px] text-white/25 font-mono">Actividad 40% · Win rate 35% · Tendencia 25%</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {pipeline.byRep.map((rep) => {
            const actRep = repsToShow.find((r) => r.userId === rep.userId)
            const riskMeta = {
              low:    { border: '#34d399', bg: 'rgba(52,211,153,0.05)',  text: '#34d399', label: 'BAJO RIESGO'  },
              medium: { border: '#fbbf24', bg: 'rgba(251,191,36,0.05)',  text: '#fbbf24', label: 'RIESGO MEDIO' },
              high:   { border: '#f87171', bg: 'rgba(248,113,113,0.05)', text: '#f87171', label: 'ALTO RIESGO'  },
            }[rep.riskLevel]

            return (
              <div key={rep.userId}
                className="rounded-lg border p-4 space-y-3"
                style={{ borderColor: `${riskMeta.border}30`, background: riskMeta.bg, borderLeft: `2px solid ${riskMeta.border}60` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white/80 truncate">{rep.name}</p>
                    <p className="text-[8px] font-black uppercase tracking-wider mt-0.5" style={{ color: riskMeta.text }}>
                      {riskMeta.label}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-black font-mono leading-none" style={{ color: riskMeta.text }}>{rep.momentumScore}</p>
                    <p className="text-[8px] text-white/20 font-mono">/ 100</p>
                  </div>
                </div>

                <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${rep.momentumScore}%`, background: riskMeta.border, opacity: 0.8 }} />
                </div>

                <div className="grid grid-cols-3 gap-2 text-[9px]">
                  <div className="text-center">
                    <p className="text-white/25 text-[8px] uppercase tracking-wider mb-0.5">Actividad</p>
                    <p className="font-black font-mono text-white/70">{actRep?.avgCompliance ?? 0}%</p>
                  </div>
                  <div className="text-center border-x border-white/[0.06]">
                    <p className="text-white/25 text-[8px] uppercase tracking-wider mb-0.5">Win rate</p>
                    <p className="font-black font-mono text-white/70">{rep.winRate}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-white/25 text-[8px] uppercase tracking-wider mb-0.5">Pipeline</p>
                    <p className="font-black font-mono text-white/70">{fmt(rep.openValue)}</p>
                  </div>
                </div>

                {pipeline.atRiskRepIds.includes(rep.userId) && (
                  <div className="flex items-center gap-1.5 rounded bg-red-500/10 border border-red-500/20 px-2 py-1.5 text-[9px] text-red-400">
                    <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                    Necesita atención — actividad y pipeline estancados
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── INBOUND VS OUTBOUND + FUNNEL ─────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-lg bg-[#0d1117] border border-white/[0.06] p-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="h-[3px] w-4 rounded-full bg-emerald-400 inline-block" />
            <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">Inbound vs Outbound</h3>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={pipeline.inboundVsOutbound} margin={{ top: 0, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="type" tick={{ fontSize: 9, fill: 'rgba(148,163,184,0.5)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'rgba(148,163,184,0.5)' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, fontSize: 10 }} />
              <Bar dataKey="won"  name="Ganados"  stackId="a" fill="#34d399" fillOpacity={0.85} radius={[0,0,0,0]} />
              <Bar dataKey="open" name="Abiertos" stackId="a" fill="#22d3ee" fillOpacity={0.45} radius={[0,0,0,0]} />
              <Bar dataKey="lost" name="Perdidos" stackId="a" fill="#f87171" fillOpacity={0.65} radius={[2,2,0,0]} />
              <Legend iconSize={7} wrapperStyle={{ fontSize: 9, opacity: 0.6 }} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-3 mt-3">
            {pipeline.inboundVsOutbound.map((t) => (
              <div key={t.type} className="flex-1 rounded bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-center">
                <p className="text-[8px] text-white/30 uppercase tracking-wider">{t.type} win rate</p>
                <p className={cn('text-lg font-black font-mono', t.winRate >= 50 ? 'text-emerald-400' : t.winRate >= 30 ? 'text-amber-400' : 'text-red-400')}>
                  {t.winRate}%
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Funnel stages */}
        <div className="rounded-lg bg-[#0d1117] border border-white/[0.06] p-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="h-[3px] w-4 rounded-full bg-cyan-400 inline-block" />
            <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">Funnel de etapas</h3>
          </div>
          <div className="space-y-3">
            {pipeline.teamStages.map((stage, i) => {
              const total = stage.open + stage.won + stage.lost
              const openPct = total > 0 ? Math.round((stage.open / total) * 100) : 0
              const wonPct  = total > 0 ? Math.round((stage.won  / total) * 100) : 0
              const lostPct = 100 - openPct - wonPct
              const width   = 100 - i * 12
              return (
                <div key={stage.stage} style={{ width: `${width}%` }} className="space-y-1">
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="font-bold text-white/60">{stage.stage}</span>
                    <span className="text-white/25 font-mono">{total} deals · {fmt(stage.openValue + stage.wonValue)}</span>
                  </div>
                  <div className="h-5 rounded overflow-hidden flex text-[8px] font-black">
                    {wonPct > 0  && <div className="flex items-center justify-center bg-emerald-400/75 text-emerald-950" style={{ width: `${wonPct}%` }}>{wonPct > 10 ? `${wonPct}%` : ''}</div>}
                    {openPct > 0 && <div className="flex items-center justify-center bg-cyan-400/35 text-cyan-100"   style={{ width: `${openPct}%`}}>{openPct > 10 ? `${openPct}%` : ''}</div>}
                    {lostPct > 0 && <div className="flex items-center justify-center bg-red-400/35 text-red-100"     style={{ width: `${lostPct}%`}}>{lostPct > 10 ? `${lostPct}%` : ''}</div>}
                  </div>
                  <p className="text-[8px] text-white/25 font-mono">Win rate: <span className="font-black text-white/50">{stage.winRate}%</span></p>
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 text-[8px] text-white/25">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-sm bg-emerald-400/75 inline-block" />Ganado</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-sm bg-cyan-400/35 inline-block" />Abierto</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-sm bg-red-400/35 inline-block" />Perdido</span>
          </div>
        </div>
      </div>
    </div>
  )
}
