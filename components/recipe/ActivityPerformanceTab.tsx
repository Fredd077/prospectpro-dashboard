'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { saveActivityConversionRates, saveActivityMeetingsExpected } from '@/lib/actions/activities'
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
  convRate: number
  meetingsExpected: number
  citasMetaMes: number
  citasMetaSem: number
  citasMetaDia: number
  reunionesReales: number
  eficienciaCanal: number | null  // null when meetingsExpected = 0
  cierresReales: number
  contribGroupUsd: number
  contribGroupPct: number
  contribGlobalUsd: number
  contribGlobalPct: number
}

function fmtUsd(n: number) {
  return '$' + Math.round(n).toLocaleString('es', { maximumFractionDigits: 0 })
}
function fmtPct(n: number) {
  return n.toFixed(1) + '%'
}
function fmtNum(n: number, decimals = 1) {
  return n.toFixed(decimals)
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

// ── Inline editable cell (shared for Tasa and Esperadas) ──────────────────────

function InlineNumberCell({
  value,
  isEditing,
  editingVal,
  displayText,
  accentClass,
  onStartEdit,
  onChange,
  onCommit,
  onCancel,
}: {
  value: number
  isEditing: boolean
  editingVal: string
  displayText: string
  accentClass: string
  onStartEdit: () => void
  onChange: (v: string) => void
  onCommit: () => void
  onCancel: () => void
}) {
  if (isEditing) {
    return (
      <input
        type="number"
        min={0}
        max={9999}
        value={editingVal}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter')  { e.preventDefault(); onCommit() }
          if (e.key === 'Escape') { onCancel() }
        }}
        autoFocus
        className="w-16 rounded border border-[#00D9FF]/50 bg-zinc-800 px-1.5 py-0.5 text-center text-xs text-[#00D9FF] focus:outline-none focus:border-[#00D9FF]"
      />
    )
  }
  return (
    <button
      onClick={onStartEdit}
      title="Clic para editar"
      className={`group inline-flex items-center gap-1 rounded px-2 py-0.5 transition-colors hover:bg-zinc-700/60 ${accentClass}`}
    >
      <span className="tabular-nums">{displayText}</span>
      <span className="opacity-0 group-hover:opacity-50 text-[8px]">✎</span>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export function ActivityPerformanceTab({ scenario, activities }: ActivityPerformanceTabProps) {
  const COLS = 14

  // ── Local editable state ───────────────────────────────────────────────────
  const [localRates, setLocalRates] = useState<Record<string, number>>(() =>
    Object.fromEntries(activities.map((a) => [a.id, a.conversion_rate_pct ?? 0]))
  )
  const [localExpected, setLocalExpected] = useState<Record<string, number>>(() =>
    Object.fromEntries(activities.map((a) => [a.id, a.meetings_expected ?? 0]))
  )

  useEffect(() => {
    setLocalRates(Object.fromEntries(activities.map((a) => [a.id, a.conversion_rate_pct ?? 0])))
    setLocalExpected(Object.fromEntries(activities.map((a) => [a.id, a.meetings_expected ?? 0])))
  }, [activities])

  // ── Pipeline data ──────────────────────────────────────────────────────────
  const [reunionesMap, setReunionesMap] = useState<Record<string, number>>({})
  const [cierresMap,   setCierresMap]   = useState<Record<string, number>>({})
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    const today      = new Date()
    const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
    const last       = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    const monthEnd   = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`

    const sb = getSupabaseBrowserClient()
    sb.from('pipeline_simple')
      .select('origin_activity_id,status')
      .gte('entry_date', monthStart)
      .lte('entry_date', monthEnd)
      .not('origin_activity_id', 'is', null)
      .then(({ data }) => {
        const rMap: Record<string, number> = {}
        const cMap: Record<string, number> = {}
        for (const row of data ?? []) {
          const aid = row.origin_activity_id
          if (!aid) continue
          rMap[aid] = (rMap[aid] ?? 0) + 1
          if (row.status === 'ganado') cMap[aid] = (cMap[aid] ?? 0) + 1
        }
        setReunionesMap(rMap)
        setCierresMap(cMap)
        setLoading(false)
      })
  }, [])

  // ── Inline edit state — rate ───────────────────────────────────────────────
  const [editingRateId,  setEditingRateId]  = useState<string | null>(null)
  const [editingRateVal, setEditingRateVal] = useState('')
  const [ratePending, startRateTransition]  = useTransition()

  function startEditRate(id: string) {
    setEditingRateId(id)
    setEditingRateVal(String(localRates[id] ?? 0))
  }

  function commitRate(id: string) {
    const parsed = parseInt(editingRateVal, 10)
    const val    = isNaN(parsed) ? 0 : Math.max(0, Math.min(100, parsed))
    const prev   = localRates[id] ?? 0
    setEditingRateId(null)
    if (val === prev) return

    setLocalRates((r) => ({ ...r, [id]: val }))
    startRateTransition(async () => {
      try {
        await saveActivityConversionRates([{ activityId: id, conversionRatePct: val }])
        toast.success('Tasa actualizada')
      } catch {
        setLocalRates((r) => ({ ...r, [id]: prev }))
        toast.error('Error al guardar tasa')
      }
    })
  }

  // ── Inline edit state — meetings expected ─────────────────────────────────
  const [editingExpId,  setEditingExpId]  = useState<string | null>(null)
  const [editingExpVal, setEditingExpVal] = useState('')
  const [expPending, startExpTransition]  = useTransition()

  function startEditExp(id: string) {
    setEditingExpId(id)
    setEditingExpVal(String(localExpected[id] ?? 0))
  }

  function commitExp(id: string) {
    const parsed = parseInt(editingExpVal, 10)
    const val    = isNaN(parsed) ? 0 : Math.max(0, parsed)
    const prev   = localExpected[id] ?? 0
    setEditingExpId(null)
    if (val === prev) return

    setLocalExpected((e) => ({ ...e, [id]: val }))
    startExpTransition(async () => {
      try {
        await saveActivityMeetingsExpected(id, val)
        toast.success('Reuniones esperadas actualizadas')
      } catch {
        setLocalExpected((e) => ({ ...e, [id]: prev }))
        toast.error('Error al guardar reuniones esperadas')
      }
    })
  }

  // ── Calculations ───────────────────────────────────────────────────────────
  const monthlyGoal  = scenario.monthly_revenue_goal
  const avgTicket    = scenario.average_ticket
  const outboundPct  = scenario.outbound_pct / 100
  const inboundPct   = 1 - outboundPct
  const workingDays  = scenario.working_days_per_month ?? 22
  const lastOutRate  = ((scenario.outbound_rates ?? [])[(scenario.outbound_rates?.length ?? 1) - 1] ?? 30) / 100

  const cierresReq    = avgTicket > 0 ? monthlyGoal / avgTicket : 0
  const citasReqTotal = lastOutRate > 0 ? cierresReq / lastOutRate : 0
  const citasReqOut   = citasReqTotal * outboundPct
  const citasReqIn    = citasReqTotal * inboundPct
  const metaOut       = monthlyGoal * outboundPct
  const metaIn        = monthlyGoal * inboundPct

  const outActivities = activities.filter((a) => a.type === 'OUTBOUND')
  const inActivities  = activities.filter((a) => a.type === 'INBOUND')

  function buildRows(
    list: ActivityForSupervision[],
    citasReqGroup: number,
    metaGroup: number,
  ): ActivityRow[] {
    const withRate = list.filter((a) => (localRates[a.id] ?? 0) > 0)
    const sumRates = withRate.reduce((s, a) => s + (localRates[a.id] ?? 0), 0)

    return list.map((a) => {
      const convRate         = localRates[a.id] ?? 0
      const meetingsExpected = localExpected[a.id] ?? 0
      const citasMetaMes     = sumRates > 0 ? citasReqGroup * (convRate / sumRates) : 0
      const citasMetaSem     = workingDays > 0 ? citasMetaMes * 5 / workingDays : 0
      const citasMetaDia     = workingDays > 0 ? citasMetaMes / workingDays : 0
      const reunionesReales  = reunionesMap[a.id] ?? 0
      const eficienciaCanal  = meetingsExpected > 0
        ? (reunionesReales / meetingsExpected) * 100
        : null
      const cierresReales    = cierresMap[a.id] ?? 0
      const contribGroupUsd  = cierresReales * avgTicket
      const contribGroupPct  = metaGroup > 0 ? (contribGroupUsd / metaGroup) * 100 : 0
      const contribGlobalUsd = cierresReales * avgTicket
      const contribGlobalPct = monthlyGoal > 0 ? (contribGlobalUsd / monthlyGoal) * 100 : 0

      return {
        id: a.id, name: a.name, type: a.type,
        convRate, meetingsExpected,
        citasMetaMes, citasMetaSem, citasMetaDia,
        reunionesReales, eficienciaCanal,
        cierresReales, contribGroupUsd, contribGroupPct,
        contribGlobalUsd, contribGlobalPct,
      }
    })
  }

  const outRows = buildRows(outActivities, citasReqOut, metaOut)
  const inRows  = buildRows(inActivities,  citasReqIn,  metaIn)
  const allRows = [...outRows, ...inRows]

  function groupTotals(rows: ActivityRow[], metaGroup: number) {
    const totalCitasMes    = rows.reduce((s, r) => s + r.citasMetaMes, 0)
    const totalReuniones   = rows.reduce((s, r) => s + r.reunionesReales, 0)
    const totalExpected    = rows.reduce((s, r) => s + r.meetingsExpected, 0)
    const totalCierres     = rows.reduce((s, r) => s + r.cierresReales, 0)
    const totalGroupUsd    = totalCierres * avgTicket
    const totalGlobalUsd   = totalCierres * avgTicket
    const eficiencia       = totalExpected > 0 ? (totalReuniones / totalExpected) * 100 : null
    return {
      citasMetaMes:    totalCitasMes,
      citasMetaSem:    workingDays > 0 ? totalCitasMes * 5 / workingDays : 0,
      citasMetaDia:    workingDays > 0 ? totalCitasMes / workingDays : 0,
      meetingsExpected: totalExpected,
      reunionesReales: totalReuniones,
      eficienciaCanal: eficiencia,
      cierresReales:   totalCierres,
      contribGroupUsd: totalGroupUsd,
      contribGroupPct: metaGroup > 0 ? (totalGroupUsd / metaGroup) * 100 : 0,
      contribGlobalUsd: totalGlobalUsd,
      contribGlobalPct: monthlyGoal > 0 ? (totalGlobalUsd / monthlyGoal) * 100 : 0,
    }
  }

  const outTotals = groupTotals(outRows, metaOut)
  const inTotals  = groupTotals(inRows,  metaIn)
  const allTotals = (() => {
    const totalCitasMes  = allRows.reduce((s, r) => s + r.citasMetaMes, 0)
    const totalReuniones = allRows.reduce((s, r) => s + r.reunionesReales, 0)
    const totalExpected  = allRows.reduce((s, r) => s + r.meetingsExpected, 0)
    const totalCierres   = allRows.reduce((s, r) => s + r.cierresReales, 0)
    const totalUsd       = totalCierres * avgTicket
    return {
      citasMetaMes:    totalCitasMes,
      citasMetaSem:    workingDays > 0 ? totalCitasMes * 5 / workingDays : 0,
      citasMetaDia:    workingDays > 0 ? totalCitasMes / workingDays : 0,
      meetingsExpected: totalExpected,
      reunionesReales: totalReuniones,
      eficienciaCanal: totalExpected > 0 ? (totalReuniones / totalExpected) * 100 : null,
      cierresReales:   totalCierres,
      contribGroupUsd: totalUsd,
      contribGroupPct: monthlyGoal > 0 ? (totalUsd / monthlyGoal) * 100 : 0,
      contribGlobalUsd: totalUsd,
      contribGlobalPct: monthlyGoal > 0 ? (totalUsd / monthlyGoal) * 100 : 0,
    }
  })()

  // ── Styles ─────────────────────────────────────────────────────────────────
  const th  = 'px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-center whitespace-nowrap text-zinc-400'
  const thL = 'px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-left whitespace-nowrap text-zinc-400'
  const td  = 'px-3 py-2.5 text-center text-xs font-mono whitespace-nowrap'
  const tdL = 'px-3 py-2.5 text-xs whitespace-nowrap'

  // ── Subcomponents ──────────────────────────────────────────────────────────

  function GroupHeader({ label, color }: { label: string; color: string }) {
    return (
      <tr>
        <td colSpan={COLS} className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest ${color} bg-zinc-900/60`}>
          {label}
        </td>
      </tr>
    )
  }

  type Totals = ReturnType<typeof groupTotals>

  function TotalRow({ totals, label, color }: { totals: Totals; label: string; color: string }) {
    return (
      <tr className="border-t-2 border-zinc-700 bg-zinc-900/40">
        <td className={`${tdL} font-bold ${color}`}>{label}</td>
        <td className={`${td} font-bold ${color}`}>{totals.meetingsExpected || '—'}</td>
        <td className={`${td} text-zinc-500`}>—</td>
        <td className={`${td} font-bold ${color}`}>{fmtNum(totals.citasMetaMes)}</td>
        <td className={`${td} font-bold ${color}`}>{fmtNum(totals.citasMetaSem)}</td>
        <td className={`${td} font-bold ${color}`}>{fmtNum(totals.citasMetaDia)}</td>
        <td className={`${td} font-bold ${color}`}>{totals.reunionesReales}</td>
        <td className={td}>
          {totals.eficienciaCanal !== null ? (
            <div className="flex items-center justify-center gap-1.5">
              <Semaforo pct={totals.eficienciaCanal} />
              <span className={`text-[10px] font-bold ${color}`}>{fmtPct(totals.eficienciaCanal)}</span>
            </div>
          ) : <span className="text-zinc-600">—</span>}
        </td>
        <td className={`${td} font-bold ${color}`}>{totals.cierresReales}</td>
        <td className={`${td} font-bold ${color}`}>{fmtUsd(totals.contribGroupUsd)}</td>
        <td className={`${td} font-bold ${color}`}>{fmtPct(totals.contribGroupPct)}</td>
        <td className={`${td} font-bold ${color}`}>{fmtUsd(totals.contribGlobalUsd)}</td>
        <td className={`${td} font-bold ${color}`}>{fmtPct(totals.contribGlobalPct)}</td>
        <td className={td}>
          {totals.eficienciaCanal !== null
            ? <Semaforo pct={totals.eficienciaCanal} />
            : <span className="text-zinc-600">—</span>}
        </td>
      </tr>
    )
  }

  function ActivityDataRow({ row, groupColor }: { row: ActivityRow; groupColor: string }) {
    const isEditingRate = editingRateId === row.id
    const isEditingExp  = editingExpId  === row.id

    return (
      <tr className="border-b border-zinc-800/60 hover:bg-zinc-800/20 transition-colors">
        {/* Actividad */}
        <td className={`${tdL} font-medium text-zinc-200`}>{row.name}</td>

        {/* Reuniones Esperadas — inline editable */}
        <td className={td}>
          <InlineNumberCell
            value={row.meetingsExpected}
            isEditing={isEditingExp}
            editingVal={editingExpVal}
            displayText={row.meetingsExpected > 0 ? String(row.meetingsExpected) : '—'}
            accentClass={row.meetingsExpected > 0 ? 'text-zinc-200' : 'text-zinc-600'}
            onStartEdit={() => startEditExp(row.id)}
            onChange={setEditingExpVal}
            onCommit={() => commitExp(row.id)}
            onCancel={() => setEditingExpId(null)}
          />
        </td>

        {/* Tasa % — inline editable */}
        <td className={td}>
          <InlineNumberCell
            value={row.convRate}
            isEditing={isEditingRate}
            editingVal={editingRateVal}
            displayText={row.convRate > 0 ? `${row.convRate}%` : '—'}
            accentClass={row.convRate > 0 ? 'text-[#00D9FF]' : 'text-zinc-600'}
            onStartEdit={() => startEditRate(row.id)}
            onChange={setEditingRateVal}
            onCommit={() => commitRate(row.id)}
            onCancel={() => setEditingRateId(null)}
          />
        </td>

        {/* Citas Meta /mes */}
        <td className={`${td} text-zinc-300`}>{fmtNum(row.citasMetaMes)}</td>

        {/* Citas Meta /sem */}
        <td className={`${td} text-zinc-400`}>{fmtNum(row.citasMetaSem)}</td>

        {/* Citas Meta /día */}
        <td className={`${td} text-zinc-400`}>{fmtNum(row.citasMetaDia)}</td>

        {/* Reuniones Reales */}
        <td className={`${td} font-semibold ${row.reunionesReales > 0 ? 'text-zinc-100' : 'text-zinc-600'}`}>
          {row.reunionesReales}
        </td>

        {/* Eficiencia Canal % */}
        <td className={td}>
          {row.eficienciaCanal !== null ? (
            <div className="flex items-center justify-center gap-1.5">
              <Semaforo pct={row.eficienciaCanal} />
              <span className="text-[10px] tabular-nums text-zinc-300">{fmtPct(row.eficienciaCanal)}</span>
            </div>
          ) : <span className="text-zinc-600">—</span>}
        </td>

        {/* Cierres Reales */}
        <td className={`${td} font-semibold ${row.cierresReales > 0 ? 'text-emerald-400' : 'text-zinc-600'}`}>
          {row.cierresReales}
        </td>

        {/* Contrib. Grupo $ */}
        <td className={`${td} ${groupColor}`}>
          {row.contribGroupUsd > 0 ? fmtUsd(row.contribGroupUsd) : <span className="text-zinc-600">—</span>}
        </td>

        {/* Contrib. Grupo % */}
        <td className={`${td} ${groupColor}`}>
          {row.contribGroupPct > 0 ? fmtPct(row.contribGroupPct) : <span className="text-zinc-600">—</span>}
        </td>

        {/* Contrib. Global $ */}
        <td className={`${td} text-zinc-300`}>
          {row.contribGlobalUsd > 0 ? fmtUsd(row.contribGlobalUsd) : <span className="text-zinc-600">—</span>}
        </td>

        {/* Contrib. Global % */}
        <td className={`${td} text-zinc-300`}>
          {row.contribGlobalPct > 0 ? fmtPct(row.contribGlobalPct) : <span className="text-zinc-600">—</span>}
        </td>

        {/* Semáforo */}
        <td className={td}>
          {row.eficienciaCanal !== null
            ? <Semaforo pct={row.eficienciaCanal} />
            : <span className="text-zinc-600">—</span>}
        </td>
      </tr>
    )
  }

  // ── Early returns ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-zinc-500">Cargando datos del pipeline…</p>
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center">
        <p className="text-sm text-zinc-500">No hay actividades activas configuradas.</p>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Citas meta (mes)', value: fmtNum(citasReqTotal), color: 'text-zinc-200' },
          {
            label: 'Reuniones reales',
            value: String(allTotals.reunionesReales),
            color: allTotals.eficienciaCanal !== null
              ? allTotals.eficienciaCanal >= 100 ? 'text-emerald-400'
              : allTotals.eficienciaCanal >= 70  ? 'text-amber-400'
              : 'text-red-400'
              : 'text-zinc-400',
          },
          {
            label: 'Eficiencia global',
            value: allTotals.eficienciaCanal !== null ? fmtPct(allTotals.eficienciaCanal) : '—',
            color: allTotals.eficienciaCanal !== null
              ? allTotals.eficienciaCanal >= 100 ? 'text-emerald-400'
              : allTotals.eficienciaCanal >= 70  ? 'text-amber-400'
              : 'text-red-400'
              : 'text-zinc-500',
          },
          {
            label: 'Cierres reales',
            value: String(allTotals.cierresReales),
            color: allTotals.cierresReales > 0 ? 'text-emerald-400' : 'text-zinc-400',
          },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">{c.label}</p>
            <p className={`text-xl font-bold font-mono tabular-nums ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {(ratePending || expPending) && (
        <p className="text-[10px] text-zinc-500 animate-pulse">Guardando…</p>
      )}

      {/* Main table */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 overflow-x-auto">
        <table className="w-full text-xs min-w-[1380px]">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80">
              <th className={`${thL} min-w-[140px]`}>Actividad</th>
              <th className={th}>Reuniones<br />Esperadas</th>
              <th className={th}>Tasa %</th>
              <th className={th}>Citas Meta<br />/mes</th>
              <th className={th}>Citas Meta<br />/sem</th>
              <th className={th}>Citas Meta<br />/día</th>
              <th className={th}>Reuniones<br />Reales</th>
              <th className={th}>Eficiencia<br />Canal %</th>
              <th className={th}>Cierres<br />Reales</th>
              <th className={th}>Contrib.<br />Grupo $</th>
              <th className={th}>Contrib.<br />Grupo %</th>
              <th className={th}>Contrib.<br />Global $</th>
              <th className={th}>Contrib.<br />Global %</th>
              <th className={th}>Semáforo</th>
            </tr>
          </thead>
          <tbody>
            {outRows.length > 0 && (
              <>
                <GroupHeader label="⬆ OUTBOUND" color="text-[#00D9FF]" />
                {outRows.map((row) => (
                  <ActivityDataRow key={row.id} row={row} groupColor="text-[#00D9FF]" />
                ))}
                <TotalRow totals={outTotals} label="Total Outbound" color="text-[#00D9FF]" />
              </>
            )}
            {inRows.length > 0 && (
              <>
                <GroupHeader label="⬇ INBOUND" color="text-violet-400" />
                {inRows.map((row) => (
                  <ActivityDataRow key={row.id} row={row} groupColor="text-violet-400" />
                ))}
                <TotalRow totals={inTotals} label="Total Inbound" color="text-violet-400" />
              </>
            )}
            <TotalRow totals={allTotals} label="TOTAL GLOBAL" color="text-zinc-100" />
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-zinc-600">
        Reuniones Reales y Cierres Reales = registros en Pipeline del mes actual con actividad de origen asignada.
        Haz clic en Reuniones Esperadas o Tasa % para editar inline.
      </p>
    </div>
  )
}
