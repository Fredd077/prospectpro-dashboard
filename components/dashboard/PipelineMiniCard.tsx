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
  { key: 'Cita agendada',                                          label: 'Cita',      color: 'text-blue-400'    },
  { key: 'Reagendar',                                              label: 'Reagendar', color: 'text-rose-400'    },
  { key: 'Primera reu ejecutada/Propuesta en preparación',         label: '1ª Reunión',color: 'text-cyan-400'    },
  { key: 'Propuesta Presentada',                                   label: 'Propuesta', color: 'text-amber-400'   },
  { key: 'Por facturar/cobrar',                                    label: 'Cierre',    color: 'text-emerald-400' },
]

function pct(num: number, den: number) {
  return den > 0 ? Math.round((num / den) * 100) : null
}

function semColor(v: number | null, hi: number, lo: number) {
  if (v === null) return 'text-muted-foreground/40'
  return v >= hi ? 'text-emerald-400' : v >= lo ? 'text-amber-400' : 'text-red-400'
}

export function PipelineMiniCard({ rows, periodLabel, monthlyRevenueGoal = 0 }: PipelineMiniCardProps) {
  if (!rows.length) {
    return (
      <div className="rounded-lg border border-border bg-card overflow-hidden h-full flex flex-col">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
          <span className="text-sm font-semibold text-foreground">Funnel Real — {periodLabel}</span>
          <Link href="/pipeline" className="text-xs text-primary hover:text-primary/80 transition-colors">Ver →</Link>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Sin registros en este período</p>
        </div>
      </div>
    )
  }

  const citas      = rows.filter(r => r.stage === 'Cita agendada')
  const reagendar  = rows.filter(r => r.stage === 'Reagendar')
  const reuniones  = rows.filter(r => r.stage === 'Primera reu ejecutada/Propuesta en preparación')
  const propuestas = rows.filter(r => r.stage === 'Propuesta Presentada')
  const cierres    = rows.filter(r => r.stage === 'Por facturar/cobrar')

  const propAbiertas = propuestas.filter(r => r.status === 'abierto')
  const propGanadas  = propuestas.filter(r => r.status === 'ganado')
  const propPerdidas = propuestas.filter(r => r.status === 'perdido')

  const revenueGanado   = cierres.reduce((s, r) => s + (r.amount_usd ?? 0), 0)
  const revenuePipeline = propAbiertas.reduce((s, r) => s + (r.amount_usd ?? 0), 0)
  const revenuePerdido  = propPerdidas.reduce((s, r) => s + (r.amount_usd ?? 0), 0)
  const totalConAmonto  = rows.filter(r => r.amount_usd != null).length
  const sumaAmonto      = rows.reduce((s, r) => s + (r.amount_usd ?? 0), 0)
  const avgTicket       = totalConAmonto > 0 ? sumaAmonto / totalConAmonto : 0

  const progress  = monthlyRevenueGoal > 0 ? Math.min(Math.round((revenueGanado / monthlyRevenueGoal) * 100), 100) : 0
  const barColor  = progress >= 100 ? 'bg-emerald-500' : progress >= 60 ? 'bg-amber-500' : 'bg-primary'
  const pctColor  = progress >= 100 ? 'text-emerald-400' : progress >= 60 ? 'text-amber-400' : 'text-primary'

  const convReunProp   = pct(propuestas.length, reuniones.length)
  const convPropCierre = pct(cierres.length, propuestas.length)
  const tasaGanado     = pct(propGanadas.length + cierres.length, propuestas.length + cierres.length)

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
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <span className="text-sm font-semibold text-foreground">Funnel Real — {periodLabel}</span>
        <Link href="/pipeline" className="text-xs text-primary hover:text-primary/80 transition-colors font-medium">Ver →</Link>
      </div>

      {/* Stage counts */}
      <div className="grid grid-cols-5 divide-x divide-border/50 border-b border-border/50">
        {STAGES.map((s, i) => (
          <div key={s.key} className="px-2 py-3 text-center">
            <p className={`text-xl font-bold tabular-nums ${s.color}`}>{stageCounts[i]}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="p-4 space-y-4">

        {/* ── Revenue ── */}
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50">Revenue</p>
          {monthlyRevenueGoal > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Progreso hacia meta</span>
                <span className={`font-bold tabular-nums ${pctColor}`}>{progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Ganado',       value: fmtUSD(revenueGanado),   color: 'text-emerald-400' },
              { label: 'Pipeline',     value: fmtUSD(revenuePipeline),  color: 'text-amber-400',  sub: propAbiertas.length > 0 ? `${propAbiertas.length} prop.` : undefined },
              { label: 'Perdido',      value: fmtUSD(revenuePerdido),   color: 'text-red-400'     },
              { label: 'Ticket prom.', value: avgTicket > 0 ? fmtUSD(avgTicket) : '—', color: 'text-foreground' },
            ].map(({ label, value, color, sub }) => (
              <div key={label} className="rounded-md bg-muted/20 p-2 text-center">
                <p className="text-[10px] text-muted-foreground/60 leading-tight mb-1">{label}</p>
                <p className={`text-xs font-bold tabular-nums ${color}`}>{value}</p>
                {sub && <p className="text-[9px] text-muted-foreground/40 mt-0.5">{sub}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* ── Conversión ── */}
        <div className="space-y-3 border-t border-border/40 pt-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50">Conversión</p>

          {/* Rate cards */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Reunión → Propuesta', value: convReunProp,   hi: 80, lo: 50, num: propuestas.length, den: reuniones.length },
              { label: 'Propuesta → Cierre',  value: convPropCierre, hi: 40, lo: 20, num: cierres.length,    den: propuestas.length },
              { label: 'Tasa ganados',         value: tasaGanado,    hi: 60, lo: 30, num: propGanadas.length + cierres.length, den: propuestas.length + cierres.length },
            ].map(({ label, value, hi, lo, num, den }) => (
              <div key={label} className="rounded-md bg-muted/20 p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground/60 leading-tight mb-1.5">{label}</p>
                <p className={`text-2xl font-bold tabular-nums leading-none ${semColor(value, hi, lo)}`}>
                  {value !== null ? `${value}%` : '—'}
                </p>
                <p className="text-[10px] text-muted-foreground/40 mt-1">{num}/{den}</p>
              </div>
            ))}
          </div>

          {/* Estado de propuestas */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Abiertas',  count: propAbiertas.length,                  color: 'text-amber-400',   bg: 'bg-amber-400/5   border-amber-400/20'   },
              { label: 'Ganadas',   count: propGanadas.length + cierres.length,  color: 'text-emerald-400', bg: 'bg-emerald-400/5 border-emerald-400/20' },
              { label: 'Perdidas',  count: propPerdidas.length,                  color: 'text-red-400',     bg: 'bg-red-400/5     border-red-400/20'      },
            ].map(({ label, count, color, bg }) => (
              <div key={label} className={`rounded-md border px-3 py-2 text-center ${bg}`}>
                <p className="text-[10px] text-muted-foreground/60 mb-0.5">{label}</p>
                <p className={`text-lg font-bold tabular-nums ${color}`}>{count}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Por etapa y origen ── */}
        <div className="space-y-2 border-t border-border/40 pt-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50">Por etapa y origen</p>
            <p className="text-xs text-muted-foreground/40 tabular-nums">{rows.length} total</p>
          </div>
          {[
            { label: 'Reuniones',  out: reunionesOut,  inn: reunionesIn,  total: reuniones.length,  color: 'text-cyan-400'    },
            { label: 'Propuestas', out: propuestasOut, inn: propuestasIn, total: propuestas.length, color: 'text-amber-400'   },
            { label: 'Cierres',    out: cierresOut,    inn: cierresIn,    total: cierres.length,    color: 'text-emerald-400' },
          ].map(({ label, out, inn, total, color }) => (
            <div key={label} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
              <span className={`text-sm font-semibold ${color}`}>{label}</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 rounded border bg-orange-500/10 border-orange-500/20 px-2 py-1">
                  <span className="text-[9px] font-bold uppercase text-orange-400/70">OUTBOUND</span>
                  <span className="text-base font-black tabular-nums text-orange-400">{out}</span>
                </div>
                <div className="flex items-center gap-1 rounded border bg-sky-500/10 border-sky-500/20 px-2 py-1">
                  <span className="text-[9px] font-bold uppercase text-sky-400/70">INBOUND</span>
                  <span className="text-base font-black tabular-nums text-sky-400">{inn}</span>
                </div>
                <span className={`text-2xl font-bold tabular-nums min-w-[2rem] text-right ${color}`}>{total}</span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
