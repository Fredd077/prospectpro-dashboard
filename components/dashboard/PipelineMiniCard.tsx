import Link from 'next/link'
import { fmtUSD } from '@/lib/calculations/pipeline'

export interface PipelineMiniRow {
  stage: string
  status: string
  amount_usd: number | null
  origin_activity_id?: string | null
  prospect_type?: string | null
}

interface PipelineMiniCardProps {
  rows: PipelineMiniRow[]
  periodLabel: string
  monthlyRevenueGoal?: number
}

const STAGES = [
  { key: 'Cita agendada',                                          label: 'Citas',    color: 'text-blue-400'    },
  { key: 'Reagendar',                                              label: 'Reag.',    color: 'text-rose-400'    },
  { key: 'Primera reu ejecutada/Propuesta en preparación',         label: '1ra Reu.', color: 'text-cyan-400'    },
  { key: 'Propuesta Presentada',                                   label: 'Prop.',    color: 'text-amber-400'   },
  { key: 'Por facturar/cobrar',                                    label: 'Cierre',   color: 'text-emerald-400' },
]

function pct(num: number, den: number) {
  return den > 0 ? Math.round((num / den) * 100) : null
}

function SemColor(v: number | null, hi = 80, lo = 50) {
  if (v === null) return 'text-muted-foreground/40'
  return v >= hi ? 'text-emerald-400' : v >= lo ? 'text-amber-400' : 'text-red-400'
}

export function PipelineMiniCard({ rows, periodLabel, monthlyRevenueGoal = 0 }: PipelineMiniCardProps) {
  if (!rows.length) {
    return (
      <div className="rounded-lg border border-border bg-card overflow-hidden h-full flex flex-col">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
          <span className="text-xs font-semibold text-foreground">Funnel Real — {periodLabel}</span>
          <Link href="/pipeline" className="text-[10px] text-primary hover:text-primary/80 transition-colors">Ver →</Link>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-muted-foreground">Sin registros en este período</p>
        </div>
      </div>
    )
  }

  // Stage buckets — same definitions as PipelineAnalysis.tsx
  const citas      = rows.filter(r => r.stage === 'Cita agendada')
  const reagendar  = rows.filter(r => r.stage === 'Reagendar')
  const reuniones  = rows.filter(r => r.stage === 'Primera reu ejecutada/Propuesta en preparación')
  const propuestas = rows.filter(r => r.stage === 'Propuesta Presentada')
  const cierres    = rows.filter(r => r.stage === 'Por facturar/cobrar')

  const propAbiertas = propuestas.filter(r => r.status === 'abierto')
  const propGanadas  = propuestas.filter(r => r.status === 'ganado')
  const propPerdidas = propuestas.filter(r => r.status === 'perdido')

  // Revenue — same as PipelineAnalysis.tsx
  const revenueGanado   = cierres.reduce((s, r) => s + (r.amount_usd ?? 0), 0)
  const revenuePipeline = propAbiertas.reduce((s, r) => s + (r.amount_usd ?? 0), 0)
  const revenuePerdido  = propPerdidas.reduce((s, r) => s + (r.amount_usd ?? 0), 0)
  const totalConAmonto  = rows.filter(r => r.amount_usd != null).length
  const sumaAmonto      = rows.reduce((s, r) => s + (r.amount_usd ?? 0), 0)
  const avgTicket       = totalConAmonto > 0 ? sumaAmonto / totalConAmonto : 0

  const progress = monthlyRevenueGoal > 0
    ? Math.min(Math.round((revenueGanado / monthlyRevenueGoal) * 100), 100)
    : 0
  const barColor = progress >= 100 ? 'bg-emerald-500' : progress >= 60 ? 'bg-amber-500' : 'bg-primary'
  const pctColor = progress >= 100 ? 'text-emerald-400' : progress >= 60 ? 'text-amber-400' : 'text-primary'

  // Conversion rates — exact same formulas as PipelineAnalysis.tsx
  const convReunProp   = pct(propuestas.length, reuniones.length)
  const convPropCierre = pct(cierres.length, propuestas.length)
  const tasaGanado     = pct(propGanadas.length + cierres.length, propuestas.length + cierres.length)

  // Origin breakdown
  const reunionesOut  = reuniones.filter(r => r.prospect_type === 'outbound').length
  const reunionesIn   = reuniones.filter(r => r.prospect_type === 'inbound').length
  const propuestasOut = propuestas.filter(r => r.prospect_type === 'outbound').length
  const propuestasIn  = propuestas.filter(r => r.prospect_type === 'inbound').length
  const cierresOut    = cierres.filter(r => r.prospect_type === 'outbound').length
  const cierresIn     = cierres.filter(r => r.prospect_type === 'inbound').length

  const stageCounts = [citas.length, reagendar.length, reuniones.length, propuestas.length, cierres.length]

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
        <span className="text-xs font-semibold text-foreground">Funnel Real — {periodLabel}</span>
        <Link href="/pipeline" className="text-[10px] text-primary hover:text-primary/80 transition-colors">Ver →</Link>
      </div>

      {/* Stage counts */}
      <div className="grid grid-cols-5 divide-x divide-border/50 border-b border-border/50">
        {STAGES.map((s, i) => (
          <div key={s.key} className="px-2 py-2.5 text-center">
            <p className={`text-lg font-bold tabular-nums ${s.color}`}>{stageCounts[i]}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="p-3 space-y-4">
        {/* Revenue */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Revenue</p>
          {monthlyRevenueGoal > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">Progreso hacia meta</span>
                <span className={`font-bold tabular-nums ${pctColor}`}>{progress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-4 gap-1 text-center">
            <div>
              <p className="text-[9px] text-muted-foreground/60">Ganado</p>
              <p className="text-xs font-semibold text-emerald-400 tabular-nums">{fmtUSD(revenueGanado)}</p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground/60">Pipeline</p>
              <p className="text-xs font-semibold text-amber-400 tabular-nums">{fmtUSD(revenuePipeline)}</p>
              {propAbiertas.length > 0 && (
                <p className="text-[8px] text-muted-foreground/40">{propAbiertas.length} prop.</p>
              )}
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground/60">Perdido</p>
              <p className="text-xs font-semibold text-red-400 tabular-nums">{fmtUSD(revenuePerdido)}</p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground/60">Ticket prom.</p>
              <p className="text-xs font-semibold text-foreground tabular-nums">{avgTicket > 0 ? fmtUSD(avgTicket) : '—'}</p>
            </div>
          </div>
        </div>

        {/* Conversion */}
        <div className="space-y-2 border-t border-border/40 pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Conversión</p>
          <div className="grid grid-cols-3 gap-1 text-center">
            <div>
              <p className="text-[9px] text-muted-foreground/60 leading-tight">Reu→Prop</p>
              <p className={`text-sm font-bold tabular-nums mt-0.5 ${SemColor(convReunProp, 80, 50)}`}>
                {convReunProp !== null ? `${convReunProp}%` : '—'}
              </p>
              <p className="text-[8px] text-muted-foreground/40">{propuestas.length}/{reuniones.length}</p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground/60 leading-tight">Prop→Cierre</p>
              <p className={`text-sm font-bold tabular-nums mt-0.5 ${SemColor(convPropCierre, 40, 20)}`}>
                {convPropCierre !== null ? `${convPropCierre}%` : '—'}
              </p>
              <p className="text-[8px] text-muted-foreground/40">{cierres.length}/{propuestas.length}</p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground/60 leading-tight">Tasa ganados</p>
              <p className={`text-sm font-bold tabular-nums mt-0.5 ${SemColor(tasaGanado, 60, 30)}`}>
                {tasaGanado !== null ? `${tasaGanado}%` : '—'}
              </p>
              <p className="text-[8px] text-muted-foreground/40">
                {propGanadas.length + cierres.length}/{propuestas.length + cierres.length}
              </p>
            </div>
          </div>

          {/* Estado de propuestas */}
          <div className="grid grid-cols-3 gap-1 text-center mt-1">
            <div className="rounded bg-muted/20 px-1 py-1">
              <p className="text-[8px] text-muted-foreground/50">Abiertas</p>
              <p className="text-xs font-bold text-amber-400 tabular-nums">{propAbiertas.length}</p>
            </div>
            <div className="rounded bg-muted/20 px-1 py-1">
              <p className="text-[8px] text-muted-foreground/50">Ganadas</p>
              <p className="text-xs font-bold text-emerald-400 tabular-nums">{propGanadas.length + cierres.length}</p>
            </div>
            <div className="rounded bg-muted/20 px-1 py-1">
              <p className="text-[8px] text-muted-foreground/50">Perdidas</p>
              <p className="text-xs font-bold text-red-400 tabular-nums">{propPerdidas.length}</p>
            </div>
          </div>
        </div>

        {/* Activity by stage & origin */}
        <div className="space-y-2 border-t border-border/40 pt-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Por etapa y origen</p>
            <p className="text-[9px] text-muted-foreground/40">{rows.length} total</p>
          </div>
          {[
            { label: 'Reuniones',  out: reunionesOut,  inn: reunionesIn,  total: reuniones.length,  color: 'text-cyan-400'    },
            { label: 'Propuestas', out: propuestasOut, inn: propuestasIn, total: propuestas.length, color: 'text-amber-400'   },
            { label: 'Cierres',    out: cierresOut,    inn: cierresIn,    total: cierres.length,    color: 'text-emerald-400' },
          ].map(({ label, out, inn, total, color }) => (
            <div key={label} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
              <span className={`text-xs font-semibold ${color}`}>{label}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border bg-orange-500/10 text-orange-400 border-orange-500/20">
                  OUT {out}
                </span>
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border bg-sky-500/10 text-sky-400 border-sky-500/20">
                  IN {inn}
                </span>
                <span className="text-xs font-bold tabular-nums text-foreground w-4 text-right">{total}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
