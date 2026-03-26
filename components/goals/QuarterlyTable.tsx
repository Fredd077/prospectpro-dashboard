import { cn } from '@/lib/utils'
import { calcCompliance } from '@/lib/calculations/compliance'
import { semaphoreBgClass } from '@/lib/utils/colors'

export interface QuarterlyMonth {
  label: string       // e.g. "Enero", "Febrero"
  start: string       // ISO date
  end: string
}

export interface QuarterlyActivityRow {
  id: string
  name: string
  type: 'OUTBOUND' | 'INBOUND'
  months: Array<{
    goal: number    // monthly_goal × working days in month (approx: monthly_goal)
    real: number    // sum of real_executed for that activity in that month
  }>
}

interface QuarterlyTableProps {
  months: [QuarterlyMonth, QuarterlyMonth, QuarterlyMonth]
  rows: QuarterlyActivityRow[]
  quarterLabel: string
}

function Cell({ goal, real }: { goal: number; real: number }) {
  const { pct, semaphore, deviation } = calcCompliance(real, goal)
  return (
    <td className="px-4 py-3 text-right">
      <div className="space-y-0.5">
        <div className="flex items-center justify-end gap-1.5">
          <span className={cn(
            'tabular-nums text-sm font-semibold',
            semaphore === 'green' ? 'text-emerald-400'
            : semaphore === 'yellow' ? 'text-amber-400'
            : real > 0 ? 'text-red-400' : 'text-muted-foreground'
          )}>
            {real}
          </span>
          <span className="text-xs text-muted-foreground">/ {goal}</span>
        </div>
        {goal > 0 && (
          <div className="flex items-center justify-end gap-1">
            <span className={cn(
              'text-[10px] tabular-nums',
              deviation >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'
            )}>
              {deviation >= 0 ? '+' : ''}{deviation}
            </span>
            <span className={cn(
              'rounded px-1 py-0.5 text-[10px] font-medium tabular-nums',
              semaphoreBgClass(semaphore)
            )}>
              {pct.toFixed(0)}%
            </span>
          </div>
        )}
      </div>
    </td>
  )
}

export function QuarterlyTable({ months, rows, quarterLabel }: QuarterlyTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card py-16 text-center">
        <p className="text-sm text-muted-foreground">
          No hay actividades con datos en este trimestre.
        </p>
      </div>
    )
  }

  // Compute per-month totals
  const monthTotals = months.map((_, mi) => ({
    goal: rows.reduce((s, r) => s + (r.months[mi]?.goal ?? 0), 0),
    real: rows.reduce((s, r) => s + (r.months[mi]?.real ?? 0), 0),
  }))
  const quarterTotal = {
    goal: monthTotals.reduce((s, m) => s + m.goal, 0),
    real: monthTotals.reduce((s, m) => s + m.real, 0),
  }
  const quarterCompliance = calcCompliance(quarterTotal.real, quarterTotal.goal)

  const outbound = rows.filter((r) => r.type === 'OUTBOUND')
  const inbound  = rows.filter((r) => r.type === 'INBOUND')

  const renderSection = (sectionRows: QuarterlyActivityRow[], label: string, labelColor: string) => {
    if (sectionRows.length === 0) return null
    return (
      <>
        <tr>
          <td colSpan={5} className="px-4 py-1.5 bg-muted/20">
            <span className={cn('text-[10px] font-semibold uppercase tracking-widest', labelColor)}>
              {label}
            </span>
          </td>
        </tr>
        {sectionRows.map((row) => {
          const rowTotal = {
            goal: row.months.reduce((s, m) => s + m.goal, 0),
            real: row.months.reduce((s, m) => s + m.real, 0),
          }
          return (
            <tr key={row.id} className="border-b border-border/40 hover:bg-muted/10">
              <td className="px-4 py-3">
                <span className="text-sm font-medium text-foreground">{row.name}</span>
              </td>
              {row.months.map((m, mi) => (
                <Cell key={mi} goal={m.goal} real={m.real} />
              ))}
              <Cell goal={rowTotal.goal} real={rowTotal.real} />
            </tr>
          )
        })}
      </>
    )
  }

  return (
    <div className="space-y-4">
      {/* Quarter summary badge */}
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-foreground">{quarterLabel}</h2>
        <span className={cn(
          'rounded px-2 py-0.5 text-xs font-semibold tabular-nums',
          semaphoreBgClass(quarterCompliance.semaphore)
        )}>
          {quarterCompliance.pct.toFixed(1)}% del trimestre
        </span>
        <span className={cn(
          'text-xs tabular-nums font-medium',
          quarterCompliance.deviation >= 0 ? 'text-emerald-400' : 'text-red-400'
        )}>
          {quarterCompliance.deviation >= 0 ? '+' : ''}{quarterCompliance.deviation} total
        </span>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground w-48">
                  Actividad
                </th>
                {months.map((m) => (
                  <th key={m.start} className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">
                    {m.label}
                  </th>
                ))}
                <th className="text-right px-4 py-3 text-xs font-semibold text-foreground">
                  Total Q
                </th>
              </tr>
            </thead>
            <tbody>
              {renderSection(outbound, 'OUTBOUND', 'text-blue-400')}
              {renderSection(inbound,  'INBOUND',  'text-violet-400')}

              {/* Totals row */}
              <tr className="border-t-2 border-border bg-muted/20 font-semibold">
                <td className="px-4 py-3 text-xs font-bold text-foreground uppercase tracking-wide">
                  Total
                </td>
                {monthTotals.map((m, mi) => (
                  <Cell key={mi} goal={m.goal} real={m.real} />
                ))}
                <Cell goal={quarterTotal.goal} real={quarterTotal.real} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
