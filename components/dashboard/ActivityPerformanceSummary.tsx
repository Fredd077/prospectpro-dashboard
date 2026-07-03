import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface ActivityPerfRow {
  id: string
  name: string
  type: 'OUTBOUND' | 'INBOUND'
  meetingsExpected: number
  conversionRatePct: number
  reunionesReales: number
  cierresReales: number
  /** Ingreso real = suma de montos reales de oportunidades GANADAS (no cierres × ticket). */
  montoReal: number
}

interface ActivityPerformanceSummaryProps {
  rows: ActivityPerfRow[]
  scenario: {
    monthly_revenue_goal: number
    average_ticket: number
    outbound_pct: number
  } | null
}

function eficiencia(reales: number, esperadas: number): number | null {
  return esperadas > 0 ? (reales / esperadas) * 100 : null
}

function semaphore(efic: number | null): 'green' | 'amber' | 'red' | 'none' {
  if (efic === null) return 'none'
  return efic >= 100 ? 'green' : efic >= 70 ? 'amber' : 'red'
}

const SEM_DOT: Record<string, string> = {
  green: 'bg-emerald-400',
  amber: 'bg-amber-400',
  red:   'bg-red-400',
  none:  'bg-muted-foreground/30',
}
const SEM_TEXT: Record<string, string> = {
  green: 'text-emerald-400',
  amber: 'text-amber-400',
  red:   'text-red-400',
  none:  'text-muted-foreground/40',
}

interface GroupTotalRowProps {
  rows: ActivityPerfRow[]
}

function GroupTotalRow({ rows }: GroupTotalRowProps) {
  const totalEsp     = rows.reduce((s, r) => s + r.meetingsExpected, 0)
  const totalReales  = rows.reduce((s, r) => s + r.reunionesReales, 0)
  const totalCierres = rows.reduce((s, r) => s + r.cierresReales, 0)
  const totalContrib = rows.reduce((s, r) => s + r.montoReal, 0)
  const efic         = eficiencia(totalReales, totalEsp)
  const sem          = semaphore(efic)

  return (
    <tr className="border-t border-border/60 bg-muted/10">
      <td className="py-1.5 pr-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Total</p>
      </td>
      <td className="py-1.5 px-2 text-right tabular-nums text-xs font-semibold text-foreground">{totalEsp || '—'}</td>
      <td className="py-1.5 px-2 text-right tabular-nums text-xs font-semibold text-foreground">{totalReales}</td>
      <td className="py-1.5 px-2 text-right tabular-nums">
        {efic !== null
          ? <span className={cn('text-xs font-bold', SEM_TEXT[sem])}>{efic.toFixed(0)}%</span>
          : <span className="text-xs text-muted-foreground/40">—</span>
        }
      </td>
      <td className="py-1.5 px-2 text-right tabular-nums text-xs font-semibold text-emerald-400">{totalCierres || '—'}</td>
      <td className="py-1.5 pl-2 text-right tabular-nums">
        {totalContrib > 0
          ? <span className="text-xs font-semibold text-emerald-400">${Math.round(totalContrib).toLocaleString('es')}</span>
          : <span className="text-xs text-muted-foreground/40">—</span>
        }
      </td>
      <td className="py-1.5 pl-2">
        <div className={cn('w-2 h-2 rounded-full mx-auto', SEM_DOT[sem])} />
      </td>
    </tr>
  )
}

const HEADERS = ['Actividad', 'Esp.', 'Real', 'Efic.%', 'Cierres', 'Contrib.$', '']

export function ActivityPerformanceSummary({ rows }: ActivityPerformanceSummaryProps) {
  const outbound  = rows.filter(r => r.type === 'OUTBOUND')
  const inbound   = rows.filter(r => r.type === 'INBOUND')
  const hasData   = rows.length > 0

  if (!hasData) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Rendimiento de actividades</h2>
        <p className="text-xs text-muted-foreground">Sin actividades configuradas.</p>
      </div>
    )
  }

  const noConvRates = rows.every(r => r.conversionRatePct === 0 && r.meetingsExpected === 0)

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
        <h2 className="text-xs font-semibold text-foreground">Rendimiento de actividades</h2>
        <Link href="/recipe" className="text-[10px] text-primary hover:text-primary/80 transition-colors">
          Configurar →
        </Link>
      </div>

      {noConvRates && (
        <div className="px-4 py-2 bg-amber-400/5 border-b border-amber-400/20">
          <p className="text-[10px] text-amber-400">
            Configura las tasas de conversión y reuniones esperadas en el{' '}
            <Link href="/recipe" className="underline">Recetario</Link>{' '}
            para ver la eficiencia real de cada canal.
          </p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50">
              {HEADERS.map((h, i) => (
                <th
                  key={i}
                  className={cn(
                    'py-2 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60',
                    i === 0 ? 'text-left pr-2 pl-4' : i === HEADERS.length - 1 ? 'pl-2 pr-4' : 'text-right px-2'
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {outbound.length > 0 && (
              <>
                <tr>
                  <td colSpan={7} className="px-4 pt-2 pb-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-cyan-400/60">Outbound</span>
                  </td>
                </tr>
                {outbound.map(row => (
                  <tr key={row.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    <td className="py-2 pr-2 pl-4">
                      <p className="text-xs text-foreground truncate max-w-[160px]">{row.name}</p>
                      {row.conversionRatePct > 0 && (
                        <p className="text-[10px] text-cyan-400/70">{row.conversionRatePct}% conv.</p>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {row.meetingsExpected > 0 ? <span className="text-xs text-foreground">{row.meetingsExpected}</span> : <span className="text-xs text-muted-foreground/40">—</span>}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      <span className={cn('text-xs font-medium', row.reunionesReales > 0 ? 'text-foreground' : 'text-muted-foreground/40')}>{row.reunionesReales}</span>
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {(() => { const e = eficiencia(row.reunionesReales, row.meetingsExpected); const s = semaphore(e); return e !== null ? <span className={cn('text-xs font-semibold', SEM_TEXT[s])}>{e.toFixed(0)}%</span> : <span className="text-xs text-muted-foreground/40">—</span> })()}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {row.cierresReales > 0 ? <span className="text-xs text-emerald-400">{row.cierresReales}</span> : <span className="text-xs text-muted-foreground/40">0</span>}
                    </td>
                    <td className="py-2 pl-2 text-right tabular-nums">
                      {row.montoReal > 0 ? <span className="text-xs text-emerald-400">${Math.round(row.montoReal).toLocaleString('es')}</span> : <span className="text-xs text-muted-foreground/40">—</span>}
                    </td>
                    <td className="py-2 pl-2 pr-4">
                      {(() => { const e = eficiencia(row.reunionesReales, row.meetingsExpected); const s = semaphore(e); return <div className={cn('w-2 h-2 rounded-full mx-auto', SEM_DOT[s])} /> })()}
                    </td>
                  </tr>
                ))}
                <GroupTotalRow rows={outbound} />
              </>
            )}
            {inbound.length > 0 && (
              <>
                <tr>
                  <td colSpan={7} className="px-4 pt-3 pb-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-violet-400/60">Inbound</span>
                  </td>
                </tr>
                {inbound.map(row => (
                  <tr key={row.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    <td className="py-2 pr-2 pl-4">
                      <p className="text-xs text-foreground truncate max-w-[160px]">{row.name}</p>
                      {row.conversionRatePct > 0 && (
                        <p className="text-[10px] text-violet-400/70">{row.conversionRatePct}% conv.</p>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {row.meetingsExpected > 0 ? <span className="text-xs text-foreground">{row.meetingsExpected}</span> : <span className="text-xs text-muted-foreground/40">—</span>}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      <span className={cn('text-xs font-medium', row.reunionesReales > 0 ? 'text-foreground' : 'text-muted-foreground/40')}>{row.reunionesReales}</span>
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {(() => { const e = eficiencia(row.reunionesReales, row.meetingsExpected); const s = semaphore(e); return e !== null ? <span className={cn('text-xs font-semibold', SEM_TEXT[s])}>{e.toFixed(0)}%</span> : <span className="text-xs text-muted-foreground/40">—</span> })()}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {row.cierresReales > 0 ? <span className="text-xs text-emerald-400">{row.cierresReales}</span> : <span className="text-xs text-muted-foreground/40">0</span>}
                    </td>
                    <td className="py-2 pl-2 text-right tabular-nums">
                      {row.montoReal > 0 ? <span className="text-xs text-emerald-400">${Math.round(row.montoReal).toLocaleString('es')}</span> : <span className="text-xs text-muted-foreground/40">—</span>}
                    </td>
                    <td className="py-2 pl-2 pr-4">
                      {(() => { const e = eficiencia(row.reunionesReales, row.meetingsExpected); const s = semaphore(e); return <div className={cn('w-2 h-2 rounded-full mx-auto', SEM_DOT[s])} /> })()}
                    </td>
                  </tr>
                ))}
                <GroupTotalRow rows={inbound} />
              </>
            )}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-border/30">
        <p className="text-[9px] text-muted-foreground/40">
          Esp. = Reuniones esperadas/mes · Efic. = Reuniones reales / Esperadas · Cierres y Contrib. desde pipeline del período
        </p>
      </div>
    </div>
  )
}
