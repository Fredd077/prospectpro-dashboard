'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { semaphoreBgClass } from '@/lib/utils/colors'
import { getSemaphoreColor } from '@/lib/utils/colors'

export interface DetailRow {
  period: string   // e.g. "Semana 12" or "Lun 24"
  goal: number
  real: number
  deviation: number
  compliancePct: number
}

interface DetailTableProps {
  rows: DetailRow[]
  periodLabel?: string
}

export function DetailTable({ rows, periodLabel = 'Período' }: DetailTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Sin datos para mostrar
      </div>
    )
  }

  const totalGoal = rows.reduce((s, r) => s + r.goal, 0)
  const totalReal = rows.reduce((s, r) => s + r.real, 0)
  const totalDev = totalReal - totalGoal
  const totalPct = totalGoal > 0 ? (totalReal / totalGoal) * 100 : 0

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead>{periodLabel}</TableHead>
            <TableHead className="text-right">Meta</TableHead>
            <TableHead className="text-right">Real</TableHead>
            <TableHead className="text-right">Desviación</TableHead>
            <TableHead className="text-right">% Cumpl.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => {
            const sem = getSemaphoreColor(row.compliancePct)
            return (
              <TableRow key={i} className="border-border">
                <TableCell className="font-medium">{row.period}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {row.goal}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.real}</TableCell>
                <TableCell
                  className={cn(
                    'text-right tabular-nums',
                    row.deviation >= 0 ? 'text-emerald-400' : 'text-red-400'
                  )}
                >
                  {row.deviation >= 0 ? '+' : ''}{row.deviation}
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-xs font-medium tabular-nums',
                      semaphoreBgClass(sem)
                    )}
                  >
                    {row.compliancePct.toFixed(1)}%
                  </span>
                </TableCell>
              </TableRow>
            )
          })}

          {/* Totals row */}
          <TableRow className="border-t-2 border-border font-semibold bg-muted/30">
            <TableCell>Total</TableCell>
            <TableCell className="text-right tabular-nums">{totalGoal}</TableCell>
            <TableCell className="text-right tabular-nums">{totalReal}</TableCell>
            <TableCell
              className={cn(
                'text-right tabular-nums',
                totalDev >= 0 ? 'text-emerald-400' : 'text-red-400'
              )}
            >
              {totalDev >= 0 ? '+' : ''}{totalDev}
            </TableCell>
            <TableCell className="text-right">
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-xs font-medium tabular-nums',
                  semaphoreBgClass(getSemaphoreColor(totalPct))
                )}
              >
                {totalPct.toFixed(1)}%
              </span>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
