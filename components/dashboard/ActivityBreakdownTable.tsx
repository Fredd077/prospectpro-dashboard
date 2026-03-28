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

function semaphoreAccent(sem: string): string {
  if (sem === 'green')  return '#00FF9D'
  if (sem === 'yellow') return '#F59E0B'
  return '#FF3B5C'
}

function semaphoreTextClass(sem: string) {
  if (sem === 'green')  return 'text-emerald-400'
  if (sem === 'yellow') return 'text-amber-400'
  return 'text-red-400'
}

function semaphoreBgClass(sem: string) {
  if (sem === 'green')  return 'bg-emerald-400/10 text-emerald-400'
  if (sem === 'yellow') return 'bg-amber-400/10 text-amber-400'
  return 'bg-red-400/10 text-red-400'
}

function Section({ label, rows }: { label: string; rows: ActivityBreakdownRow[] }) {
  if (rows.length === 0) return null

  const totalGoal = rows.reduce((s, r) => s + r.goal, 0)
  const totalReal = rows.reduce((s, r) => s + r.real, 0)
  const totalCompliance = calcCompliance(totalReal, totalGoal)

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b border-border">
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">
          {label}
        </span>
        <span className={cn('ml-auto font-data text-xs font-semibold tabular-nums', semaphoreTextClass(totalCompliance.semaphore))}>
          {totalCompliance.pct.toFixed(1)}%
        </span>
      </div>

      {/* Activity rows — alternating bg */}
      {rows.map((row, idx) => {
        const { pct, semaphore, deviation } = calcCompliance(row.real, row.goal)
        return (
          <div
            key={row.id}
            className={cn(
              'flex items-center gap-4 px-4 py-3 border-b border-border/40 border-l-[3px] last:border-b-0 transition-colors hover:bg-muted/20',
              idx % 2 === 0 ? 'bg-transparent' : 'bg-muted/10',
            )}
            style={{ borderLeftColor: semaphoreAccent(semaphore) }}
          >
            {/* Name + channel */}
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium truncate block">{row.name}</span>
              <span className="text-[11px] text-muted-foreground/60">
                {CHANNEL_LABELS[row.channel] ?? row.channel}
              </span>
            </div>

            {/* Meta */}
            <div className="w-16 text-right shrink-0">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground/50 block">Meta</span>
              <span className="font-data text-sm tabular-nums font-medium">{row.goal}</span>
            </div>

            {/* Real */}
            <div className="w-16 text-right shrink-0">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground/50 block">Real</span>
              <span className={cn('font-data text-sm tabular-nums font-semibold', semaphoreTextClass(semaphore))}>
                {row.real}
              </span>
            </div>

            {/* Desviación */}
            <div className="w-20 text-right shrink-0">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground/50 block">Gap</span>
              <span
                className={cn(
                  'font-data text-sm tabular-nums font-semibold',
                  deviation >= 0 ? 'text-emerald-400' : 'text-red-400'
                )}
              >
                {deviation >= 0 ? '+' : ''}{deviation}
              </span>
            </div>

            {/* % Cumplimiento */}
            <div className="w-20 text-right shrink-0">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground/50 block">Cumpl.</span>
              <span className={cn('font-data text-xs font-bold tabular-nums rounded px-1.5 py-0.5', semaphoreBgClass(semaphore))}>
                {pct.toFixed(1)}%
              </span>
            </div>
          </div>
        )
      })}

      {/* Section totals */}
      <div className="flex items-center gap-4 px-4 py-2.5 bg-muted/20 border-b border-border">
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">Total {label}</span>
        </div>
        <div className="w-16 text-right shrink-0">
          <span className="font-data text-sm tabular-nums font-semibold">{totalGoal}</span>
        </div>
        <div className="w-16 text-right shrink-0">
          <span className={cn('font-data text-sm tabular-nums font-semibold', semaphoreTextClass(totalCompliance.semaphore))}>
            {totalReal}
          </span>
        </div>
        <div className="w-20 text-right shrink-0">
          <span
            className={cn(
              'font-data text-sm tabular-nums font-semibold',
              totalCompliance.deviation >= 0 ? 'text-emerald-400' : 'text-red-400'
            )}
          >
            {totalCompliance.deviation >= 0 ? '+' : ''}{totalCompliance.deviation}
          </span>
        </div>
        <div className="w-20 text-right shrink-0">
          <span className={cn('font-data text-xs font-bold tabular-nums rounded px-1.5 py-0.5', semaphoreBgClass(totalCompliance.semaphore))}>
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
      <div className="flex items-center gap-4 px-4 py-3 border-b border-border bg-muted/20">
        <span className="flex-1 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/70">Actividad</span>
        <span className="w-16 text-right text-[10px] font-bold uppercase tracking-wide text-muted-foreground/50 shrink-0">Meta</span>
        <span className="w-16 text-right text-[10px] font-bold uppercase tracking-wide text-muted-foreground/50 shrink-0">Real</span>
        <span className="w-20 text-right text-[10px] font-bold uppercase tracking-wide text-muted-foreground/50 shrink-0">Gap</span>
        <span className="w-20 text-right text-[10px] font-bold uppercase tracking-wide text-muted-foreground/50 shrink-0">Cumpl.</span>
      </div>

      <Section label="OUTBOUND" rows={outbound} />
      <Section label="INBOUND" rows={inbound} />

      {/* Grand total */}
      <div className="flex items-center gap-4 px-4 py-3 bg-muted/30 border-t border-border">
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/80">Total general</span>
        </div>
        <div className="w-16 text-right shrink-0">
          <span className="font-data text-sm tabular-nums font-bold">{totalGoal}</span>
        </div>
        <div className="w-16 text-right shrink-0">
          <span className={cn('font-data text-sm tabular-nums font-bold', semaphoreTextClass(totalCompliance.semaphore))}>
            {totalReal}
          </span>
        </div>
        <div className="w-20 text-right shrink-0">
          <span
            className={cn(
              'font-data text-sm tabular-nums font-bold',
              totalCompliance.deviation >= 0 ? 'text-emerald-400' : 'text-red-400'
            )}
          >
            {totalCompliance.deviation >= 0 ? '+' : ''}{totalCompliance.deviation}
          </span>
        </div>
        <div className="w-20 text-right shrink-0">
          <span className={cn('font-data text-xs font-bold tabular-nums rounded px-1.5 py-0.5', semaphoreBgClass(totalCompliance.semaphore))}>
            {totalCompliance.pct.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  )
}
