'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { RecipeScenario } from '@/lib/types/database'
import type { ActivityForSupervision } from './SupervisionPanel'

interface ActivityPerformanceTabProps {
  scenario: RecipeScenario
  activities: ActivityForSupervision[]
}

interface ActivityRow {
  id: string
  name: string
  type: 'OUTBOUND' | 'INBOUND'
  channel: string
  convRate: number
  citasMeta: number
  citasReales: number
  cumplimiento: number
  contribGroupPct: number
  contribGroupUsd: number
  contribGlobalPct: number
  contribGlobalUsd: number
}

function fmtUsd(n: number) {
  return '$' + Math.round(n).toLocaleString('es', { maximumFractionDigits: 0 })
}
function fmtPct(n: number) {
  return n.toFixed(1) + '%'
}

function Semaforo({ pct }: { pct: number }) {
  const cls =
    pct >= 100 ? 'bg-emerald-400/10 text-emerald-400 border-emerald-500/20' :
    pct >= 70  ? 'bg-amber-400/10 text-amber-400 border-amber-500/20' :
                 'bg-red-400/10 text-red-400 border-red-500/20'
  const label = pct >= 100 ? 'En meta' : pct >= 70 ? 'En rango' : 'Brecha'
  return (
    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  )
}

function GroupHeader({ label, color }: { label: string; color: string }) {
  return (
    <tr>
      <td colSpan={9} className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest ${color} bg-muted/10`}>
        {label}
      </td>
    </tr>
  )
}

export function ActivityPerformanceTab({ scenario, activities }: ActivityPerformanceTabProps) {
  const [citasRealesMap, setCitasRealesMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  // Fetch current-month pipeline_simple entries grouped by origin_activity_id
  useEffect(() => {
    const today = new Date()
    const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
    const monthEnd   = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    const monthEndStr = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, '0')}-${String(monthEnd.getDate()).padStart(2, '0')}`

    const sb = getSupabaseBrowserClient()
    sb.from('pipeline_simple')
      .select('origin_activity_id')
      .gte('entry_date', monthStart)
      .lte('entry_date', monthEndStr)
      .not('origin_activity_id', 'is', null)
      .then(({ data }) => {
        const map: Record<string, number> = {}
        for (const row of data ?? []) {
          if (row.origin_activity_id) {
            map[row.origin_activity_id] = (map[row.origin_activity_id] ?? 0) + 1
          }
        }
        setCitasRealesMap(map)
        setLoading(false)
      })
  }, [])

  // ── Calculations ────────────────────────────────────────────────────────────

  const monthlyGoal = scenario.monthly_revenue_goal
  const avgTicket   = scenario.average_ticket
  const outboundPct = scenario.outbound_pct / 100
  const inboundPct  = 1 - outboundPct
  const lastOutRate = ((scenario.outbound_rates ?? [])[( scenario.outbound_rates?.length ?? 1) - 1] ?? 30) / 100
  const lastInRate  = ((scenario.inbound_rates  ?? [])[(scenario.inbound_rates?.length  ?? 1) - 1] ?? 30) / 100

  const cierresReq    = avgTicket > 0 ? monthlyGoal / avgTicket : 0
  const citasReqTotal = lastOutRate > 0 ? cierresReq / lastOutRate : 0
  const citasReqOut   = citasReqTotal * outboundPct
  const citasReqIn    = citasReqTotal * inboundPct

  const metaOut = monthlyGoal * outboundPct
  const metaIn  = monthlyGoal * inboundPct

  const outActivities = activities.filter((a) => a.type === 'OUTBOUND')
  const inActivities  = activities.filter((a) => a.type === 'INBOUND')

  function buildRows(
    list: ActivityForSupervision[],
    citasReqGroup: number,
    metaGroup: number,
  ): ActivityRow[] {
    const withRate   = list.filter((a) => (a.conversion_rate_pct ?? 0) > 0)
    const sumRates   = withRate.reduce((s, a) => s + (a.conversion_rate_pct ?? 0), 0)
    const citasRealesGroupTotal = list.reduce((s, a) => s + (citasRealesMap[a.id] ?? 0), 0)

    return list.map((a) => {
      const convRate   = a.conversion_rate_pct ?? 0
      const citasMeta  = sumRates > 0 ? citasReqGroup * (convRate / sumRates) : 0
      const citasReales = citasRealesMap[a.id] ?? 0
      const cumplimiento = citasMeta > 0 ? (citasReales / citasMeta) * 100 : 0
      const contribGroupPct = citasRealesGroupTotal > 0 ? (citasReales / citasRealesGroupTotal) * 100 : 0
      const contribGroupUsd = contribGroupPct / 100 * metaGroup

      return {
        id: a.id, name: a.name, type: a.type, channel: a.channel,
        convRate, citasMeta, citasReales, cumplimiento,
        contribGroupPct, contribGroupUsd,
        // global contribution computed below after both groups
        contribGlobalPct: 0, contribGlobalUsd: 0,
      }
    })
  }

  const outRows = buildRows(outActivities, citasReqOut, metaOut)
  const inRows  = buildRows(inActivities,  citasReqIn,  metaIn)
  const allRows = [...outRows, ...inRows]
  const totalCitasRealesGlobal = allRows.reduce((s, r) => s + r.citasReales, 0)

  // Patch global contribution
  for (const row of allRows) {
    row.contribGlobalPct = totalCitasRealesGlobal > 0 ? (row.citasReales / totalCitasRealesGlobal) * 100 : 0
    row.contribGlobalUsd = row.contribGlobalPct / 100 * monthlyGoal
  }

  // Group totals
  function groupTotals(rows: ActivityRow[]) {
    return {
      citasMeta:    rows.reduce((s, r) => s + r.citasMeta, 0),
      citasReales:  rows.reduce((s, r) => s + r.citasReales, 0),
      cumplimiento: rows.reduce((s, r) => s + r.citasMeta, 0) > 0
        ? (rows.reduce((s, r) => s + r.citasReales, 0) / rows.reduce((s, r) => s + r.citasMeta, 0)) * 100
        : 0,
      contribGroupPct: rows.reduce((s, r) => s + r.contribGroupPct, 0),
      contribGroupUsd: rows.reduce((s, r) => s + r.contribGroupUsd, 0),
      contribGlobalPct: rows.reduce((s, r) => s + r.contribGlobalPct, 0),
      contribGlobalUsd: rows.reduce((s, r) => s + r.contribGlobalUsd, 0),
    }
  }

  const outTotals = groupTotals(outRows)
  const inTotals  = groupTotals(inRows)
  const allTotals = groupTotals(allRows)

  const colHeader = 'px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70 text-center whitespace-nowrap'
  const cell      = 'px-3 py-2.5 text-center text-xs font-mono'
  const cellL     = 'px-3 py-2.5 text-xs'

  function TotalRow({ totals, label, color }: { totals: ReturnType<typeof groupTotals>; label: string; color: string }) {
    return (
      <tr className="border-t border-border bg-muted/10">
        <td className={`${cellL} font-semibold ${color}`} colSpan={2}>{label}</td>
        <td className={cell}>—</td>
        <td className={`${cell} ${color}`}>{totals.citasMeta.toFixed(1)}</td>
        <td className={`${cell} font-semibold ${color}`}>{totals.citasReales}</td>
        <td className={cell}>
          <Semaforo pct={totals.cumplimiento} />
          <span className="ml-1 text-[10px]">{fmtPct(totals.cumplimiento)}</span>
        </td>
        <td className={`${cell} ${color}`}>{fmtPct(totals.contribGroupPct)}</td>
        <td className={`${cell} ${color}`}>{fmtUsd(totals.contribGroupUsd)}</td>
        <td className={`${cell} ${color}`}>{fmtPct(totals.contribGlobalPct)}</td>
        <td className={`${cell} ${color}`}>{fmtUsd(totals.contribGlobalUsd)}</td>
        <td />
      </tr>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">Cargando datos del pipeline…</p>
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">No hay actividades activas configuradas.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Citas meta (mes)',   value: citasReqTotal.toFixed(1),         color: 'text-foreground' },
          { label: 'Citas reales',       value: String(totalCitasRealesGlobal),    color: totalCitasRealesGlobal >= citasReqTotal * 0.95 ? 'text-emerald-400' : totalCitasRealesGlobal >= citasReqTotal * 0.7 ? 'text-amber-400' : 'text-red-400' },
          { label: 'Cumplimiento global', value: fmtPct(allTotals.cumplimiento),   color: allTotals.cumplimiento >= 100 ? 'text-emerald-400' : allTotals.cumplimiento >= 70 ? 'text-amber-400' : 'text-red-400' },
          { label: 'Meta mensual',       value: fmtUsd(monthlyGoal),              color: 'text-foreground' },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-card p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{c.label}</p>
            <p className={`text-lg font-bold font-mono tabular-nums ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Main table */}
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-xs min-w-[900px]">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className={`${colHeader} text-left`}>Actividad</th>
              <th className={colHeader}>Canal</th>
              <th className={colHeader}>Tasa %</th>
              <th className={colHeader}>Citas Meta</th>
              <th className={colHeader}>Citas Reales</th>
              <th className={colHeader}>Cumplimiento</th>
              <th className={colHeader}>Contrib. Grupo %</th>
              <th className={colHeader}>Contrib. Grupo $</th>
              <th className={colHeader}>Contrib. Global %</th>
              <th className={colHeader}>Contrib. Global $</th>
              <th className={colHeader}>Sem.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {/* OUTBOUND */}
            {outRows.length > 0 && (
              <>
                <GroupHeader label="⬆ Outbound" color="text-blue-400" />
                {outRows.map((row, i) => (
                  <tr key={row.id} className={`hover:bg-muted/5 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/[0.02]'}`}>
                    <td className={cellL}>
                      <p className="font-medium text-foreground/90">{row.name}</p>
                    </td>
                    <td className={`${cell} text-muted-foreground`}>{row.channel}</td>
                    <td className={`${cell} ${row.convRate >= 20 ? 'text-cyan-400' : row.convRate > 0 ? 'text-amber-400' : 'text-muted-foreground/40'}`}>
                      {row.convRate > 0 ? `${row.convRate}%` : '—'}
                    </td>
                    <td className={`${cell} text-muted-foreground`}>{row.citasMeta.toFixed(1)}</td>
                    <td className={`${cell} font-semibold ${row.citasReales > 0 ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                      {row.citasReales}
                    </td>
                    <td className={cell}>
                      {row.citasMeta > 0 ? (
                        <div className="flex items-center justify-center gap-1">
                          <Semaforo pct={row.cumplimiento} />
                          <span className="text-[10px]">{fmtPct(row.cumplimiento)}</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td className={`${cell} text-blue-400`}>{row.contribGroupPct > 0 ? fmtPct(row.contribGroupPct) : '—'}</td>
                    <td className={`${cell} text-blue-400`}>{row.contribGroupUsd > 0 ? fmtUsd(row.contribGroupUsd) : '—'}</td>
                    <td className={`${cell} text-foreground/70`}>{row.contribGlobalPct > 0 ? fmtPct(row.contribGlobalPct) : '—'}</td>
                    <td className={`${cell} text-foreground/70`}>{row.contribGlobalUsd > 0 ? fmtUsd(row.contribGlobalUsd) : '—'}</td>
                    <td className={cell}><Semaforo pct={row.cumplimiento} /></td>
                  </tr>
                ))}
                <TotalRow totals={outTotals} label="Total Outbound" color="text-blue-400" />
              </>
            )}

            {/* INBOUND */}
            {inRows.length > 0 && (
              <>
                <GroupHeader label="⬇ Inbound" color="text-violet-400" />
                {inRows.map((row, i) => (
                  <tr key={row.id} className={`hover:bg-muted/5 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/[0.02]'}`}>
                    <td className={cellL}>
                      <p className="font-medium text-foreground/90">{row.name}</p>
                    </td>
                    <td className={`${cell} text-muted-foreground`}>{row.channel}</td>
                    <td className={`${cell} ${row.convRate >= 20 ? 'text-cyan-400' : row.convRate > 0 ? 'text-amber-400' : 'text-muted-foreground/40'}`}>
                      {row.convRate > 0 ? `${row.convRate}%` : '—'}
                    </td>
                    <td className={`${cell} text-muted-foreground`}>{row.citasMeta.toFixed(1)}</td>
                    <td className={`${cell} font-semibold ${row.citasReales > 0 ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                      {row.citasReales}
                    </td>
                    <td className={cell}>
                      {row.citasMeta > 0 ? (
                        <div className="flex items-center justify-center gap-1">
                          <Semaforo pct={row.cumplimiento} />
                          <span className="text-[10px]">{fmtPct(row.cumplimiento)}</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td className={`${cell} text-violet-400`}>{row.contribGroupPct > 0 ? fmtPct(row.contribGroupPct) : '—'}</td>
                    <td className={`${cell} text-violet-400`}>{row.contribGroupUsd > 0 ? fmtUsd(row.contribGroupUsd) : '—'}</td>
                    <td className={`${cell} text-foreground/70`}>{row.contribGlobalPct > 0 ? fmtPct(row.contribGlobalPct) : '—'}</td>
                    <td className={`${cell} text-foreground/70`}>{row.contribGlobalUsd > 0 ? fmtUsd(row.contribGlobalUsd) : '—'}</td>
                    <td className={cell}><Semaforo pct={row.cumplimiento} /></td>
                  </tr>
                ))}
                <TotalRow totals={inTotals} label="Total Inbound" color="text-violet-400" />
              </>
            )}

            {/* Global total */}
            <TotalRow totals={allTotals} label="TOTAL GLOBAL" color="text-foreground font-bold" />
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-muted-foreground/50">
        Citas Reales = registros en Pipeline este mes con actividad de origen asignada. Contribución calculada sobre meta mensual activa.
      </p>
    </div>
  )
}
