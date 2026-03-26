import { cn } from '@/lib/utils'
import { calcCompliance } from '@/lib/calculations/compliance'

export interface ActivityBreakdownRow {
  id: string
  name: string
  type: 'OUTBOUND' | 'INBOUND'
  channel: string
  goal: number
  real: number
}

interface ActivityBreakdownTableProps {
  rows: ActivityBreakdownRow[]
}

const CHANNEL_LABELS: Record<string, string> = {
  cold_call: 'Llamada fría',
  cold_message: 'Mensaje frío',
  linkedin_dm: 'DM LinkedIn',
  linkedin_post: 'Post LinkedIn',
  linkedin_comment: 'Comentario LinkedIn',
  networking_event: 'Networking',
  networking_lead: 'Lead Net.',
  referral: 'Referido',
  mkt_lead: 'Lead MKT',
  vsl_lead: 'Lead VSL',
  other: 'Otro',
}

function semaphoreRowClass(sem: string) {
  if (sem === 'green') return 'border-l-emerald-400'
  if (sem === 'yellow') return 'border-l-amber-400'
  return 'border-l-red-400'
}

function semaphoreTextClass(sem: string) {
  if (sem === 'green') return 'text-emerald-400'
  if (sem === 'yellow') return 'text-amber-400'
  return 'text-red-400'
}

function semaphoreBgClass(sem: string) {
  if (sem === 'green') return 'bg-emerald-400/10 text-emerald-400'
  if (sem === 'yellow') return 'bg-amber-400/10 text-amber-400'
  return 'bg-red-400/10 text-red-400'
}

function Section({
  label,
  rows,
}: {
  label: string
  rows: ActivityBreakdownRow[]
}) {
  if (rows.length === 0) return null

  const totalGoal = rows.reduce((s, r) => s + r.goal, 0)
  const totalReal = rows.reduce((s, r) => s + r.real, 0)
  const totalCompliance = calcCompliance(totalReal, totalGoal)

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 py-2 bg-muted/40 border-b border-border">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span className={cn('ml-auto text-xs font-medium tabular-nums', semaphoreTextClass(totalCompliance.semaphore))}>
          {totalCompliance.pct.toFixed(1)}%
        </span>
      </div>

      {/* Activity rows */}
      {rows.map((row) => {
        const { pct, semaphore, deviation } = calcCompliance(row.real, row.goal)
        return (
          <div
            key={row.id}
            className={cn(
              'flex items-center gap-4 px-4 py-3 border-b border-border/50 border-l-2 last:border-b-0',
              semaphoreRowClass(semaphore)
            )}
          >
            {/* Name + channel */}
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium truncate block">{row.name}</span>
              <span className="text-xs text-muted-foreground">
                {CHANNEL_LABELS[row.channel] ?? row.channel}
              </span>
            </div>

            {/* Meta */}
            <div className="w-16 text-right shrink-0">
              <span className="text-[10px] text-muted-foreground block">Meta</span>
              <span className="text-sm tabular-nums font-medium">{row.goal}</span>
            </div>

            {/* Real */}
            <div className="w-16 text-right shrink-0">
              <span className="text-[10px] text-muted-foreground block">Real</span>
              <span className={cn('text-sm tabular-nums font-medium', semaphoreTextClass(semaphore))}>
                {row.real}
              </span>
            </div>

            {/* Desviación */}
            <div className="w-20 text-right shrink-0">
              <span className="text-[10px] text-muted-foreground block">Desviación</span>
              <span
                className={cn(
                  'text-sm tabular-nums font-medium',
                  deviation >= 0 ? 'text-emerald-400' : 'text-red-400'
                )}
              >
                {deviation >= 0 ? '+' : ''}{deviation}
              </span>
            </div>

            {/* % Cumplimiento */}
            <div className="w-20 text-right shrink-0">
              <span className="text-[10px] text-muted-foreground block">Cumplimiento</span>
              <span className={cn('text-xs font-semibold tabular-nums rounded px-1.5 py-0.5', semaphoreBgClass(semaphore))}>
                {pct.toFixed(1)}%
              </span>
            </div>
          </div>
        )
      })}

      {/* Section totals */}
      <div className="flex items-center gap-4 px-4 py-2.5 bg-muted/20 border-b border-border">
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-muted-foreground">Total {label}</span>
        </div>
        <div className="w-16 text-right shrink-0">
          <span className="text-sm tabular-nums font-semibold">{totalGoal}</span>
        </div>
        <div className="w-16 text-right shrink-0">
          <span className={cn('text-sm tabular-nums font-semibold', semaphoreTextClass(totalCompliance.semaphore))}>
            {totalReal}
          </span>
        </div>
        <div className="w-20 text-right shrink-0">
          <span
            className={cn(
              'text-sm tabular-nums font-semibold',
              totalCompliance.deviation >= 0 ? 'text-emerald-400' : 'text-red-400'
            )}
          >
            {totalCompliance.deviation >= 0 ? '+' : ''}{totalCompliance.deviation}
          </span>
        </div>
        <div className="w-20 text-right shrink-0">
          <span className={cn('text-xs font-semibold tabular-nums rounded px-1.5 py-0.5', semaphoreBgClass(totalCompliance.semaphore))}>
            {totalCompliance.pct.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  )
}

export function ActivityBreakdownTable({ rows }: ActivityBreakdownTableProps) {
  const outbound = rows.filter((r) => r.type === 'OUTBOUND')
  const inbound = rows.filter((r) => r.type === 'INBOUND')

  const totalGoal = rows.reduce((s, r) => s + r.goal, 0)
  const totalReal = rows.reduce((s, r) => s + r.real, 0)
  const totalCompliance = calcCompliance(totalReal, totalGoal)

  if (rows.length === 0) return null

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Table header */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-border bg-muted/30">
        <span className="flex-1 text-xs font-semibold text-foreground">Actividad</span>
        <span className="w-16 text-right text-xs font-semibold text-muted-foreground shrink-0">Meta</span>
        <span className="w-16 text-right text-xs font-semibold text-muted-foreground shrink-0">Real</span>
        <span className="w-20 text-right text-xs font-semibold text-muted-foreground shrink-0">Desviación</span>
        <span className="w-20 text-right text-xs font-semibold text-muted-foreground shrink-0">Cumplimiento</span>
      </div>

      <Section label="OUTBOUND" rows={outbound} />
      <Section label="INBOUND" rows={inbound} />

      {/* Grand total */}
      <div className="flex items-center gap-4 px-4 py-3 bg-muted/40 border-t border-border">
        <div className="flex-1 min-w-0">
          <span className="text-xs font-bold text-foreground uppercase tracking-wide">Total general</span>
        </div>
        <div className="w-16 text-right shrink-0">
          <span className="text-sm tabular-nums font-bold">{totalGoal}</span>
        </div>
        <div className="w-16 text-right shrink-0">
          <span className={cn('text-sm tabular-nums font-bold', semaphoreTextClass(totalCompliance.semaphore))}>
            {totalReal}
          </span>
        </div>
        <div className="w-20 text-right shrink-0">
          <span
            className={cn(
              'text-sm tabular-nums font-bold',
              totalCompliance.deviation >= 0 ? 'text-emerald-400' : 'text-red-400'
            )}
          >
            {totalCompliance.deviation >= 0 ? '+' : ''}{totalCompliance.deviation}
          </span>
        </div>
        <div className="w-20 text-right shrink-0">
          <span className={cn('text-xs font-bold tabular-nums rounded px-1.5 py-0.5', semaphoreBgClass(totalCompliance.semaphore))}>
            {totalCompliance.pct.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  )
}
