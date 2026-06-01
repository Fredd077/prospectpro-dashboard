import Link from 'next/link'
import { fmtUSD } from '@/lib/calculations/pipeline'

export interface PipelineMiniRow {
  stage: string
  status: string
  amount_usd: number | null
}

interface PipelineMiniCardProps {
  rows: PipelineMiniRow[]
  periodLabel: string
}

const STAGES = [
  { key: 'Cita agendada',                                          label: 'Citas',    color: 'text-blue-400'    },
  { key: 'Reagendar',                                              label: 'Reag.',    color: 'text-rose-400'    },
  { key: 'Primera reu ejecutada/Propuesta en preparación',         label: '1ra Reu.', color: 'text-cyan-400'    },
  { key: 'Propuesta Presentada',                                   label: 'Prop.',    color: 'text-amber-400'   },
  { key: 'Por facturar/cobrar',                                    label: 'Cierre',   color: 'text-emerald-400' },
]

export function PipelineMiniCard({ rows, periodLabel }: PipelineMiniCardProps) {
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

  const counts = Object.fromEntries(
    STAGES.map(s => [s.key, rows.filter(r => r.stage === s.key).length])
  )

  const enPropuesta = rows
    .filter(r => r.stage === 'Propuesta Presentada' && r.status === 'abierto')
    .reduce((s, r) => s + (r.amount_usd ?? 0), 0)

  const cerrado = rows
    .filter(r => r.stage === 'Por facturar/cobrar')
    .reduce((s, r) => s + (r.amount_usd ?? 0), 0)

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
        <span className="text-xs font-semibold text-foreground">Funnel Real — {periodLabel}</span>
        <Link href="/pipeline" className="text-[10px] text-primary hover:text-primary/80 transition-colors">Ver →</Link>
      </div>

      {/* Stage counts */}
      <div className="grid grid-cols-5 divide-x divide-border/50">
        {STAGES.map(s => (
          <div key={s.key} className="px-2 py-3 text-center">
            <p className={`text-lg font-bold tabular-nums ${s.color}`}>{counts[s.key] ?? 0}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Revenue row */}
      <div className="px-4 py-2.5 border-t border-border/50 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">En propuesta</span>
          <span className="font-semibold text-amber-400 tabular-nums">{fmtUSD(enPropuesta)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Cerrado 💰</span>
          <span className="font-semibold text-emerald-400 tabular-nums">{fmtUSD(cerrado)}</span>
        </div>
      </div>
    </div>
  )
}
