'use client'

import { useState, useEffect } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { RecipeScenario } from '@/lib/types/database'
import type { ActivityForSupervision } from '@/components/recipe/SupervisionPanel'

// ── Shared types ──────────────────────────────────────────────────────────────

export interface ActivityRow {
  id: string
  name: string
  type: 'OUTBOUND' | 'INBOUND'
  convRate: number
  meetingsExpected: number
  actReqMes: number | null
  actReqSem: number | null
  actReqDia: number | null
  reunionesReales: number
  eficienciaCanal: number | null
  cierresReales: number
  contribGroupUsd: number
  contribGroupPct: number
  contribGlobalUsd: number
  contribGlobalPct: number
}

export interface GroupTotals {
  actReqMes: number | null
  actReqSem: number | null
  actReqDia: number | null
  meetingsExpected: number
  reunionesReales: number
  eficienciaCanal: number | null
  cierresReales: number
  contribGroupUsd: number
  contribGroupPct: number
  contribGlobalUsd: number
  contribGlobalPct: number
  avgConvRate: number | null
}

// ── Month helpers (exported so consumers can use them if needed) ───────────────

export function buildMonthOptions(n = 18): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const raw   = d.toLocaleDateString('es', { month: 'long', year: 'numeric' })
    opts.push({ value, label: raw.charAt(0).toUpperCase() + raw.slice(1) })
  }
  return opts
}

export function monthRange(ym: string): { start: string; end: string } {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(y, m, 0)
  return {
    start: `${ym}-01`,
    end:   `${y}-${String(m).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`,
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePerformanceData(
  activities: ActivityForSupervision[],
  scenario: RecipeScenario,
) {
  const monthOptions  = buildMonthOptions(18)
  const currentMonth  = monthOptions[0].value

  const [selectedMonth,  setSelectedMonth]  = useState(currentMonth)
  const [localRates,     setLocalRates]     = useState<Record<string, number>>(
    () => Object.fromEntries(activities.map((a) => [a.id, a.conversion_rate_pct ?? 0])),
  )
  const [localExpected,  setLocalExpected]  = useState<Record<string, number>>(
    () => Object.fromEntries(activities.map((a) => [a.id, a.meetings_expected ?? 0])),
  )
  const [reunionesMap,   setReunionesMap]   = useState<Record<string, number>>({})
  const [cierresMap,     setCierresMap]     = useState<Record<string, number>>({})
  const [montoMap,       setMontoMap]       = useState<Record<string, number>>({})
  const [loading,        setLoading]        = useState(true)

  // Sync editable state when activities list changes
  useEffect(() => {
    setLocalRates(Object.fromEntries(activities.map((a) => [a.id, a.conversion_rate_pct ?? 0])))
    setLocalExpected(Object.fromEntries(activities.map((a) => [a.id, a.meetings_expected ?? 0])))
  }, [activities])

  // Fetch pipeline data for selected month
  useEffect(() => {
    setLoading(true)
    const { start, end } = monthRange(selectedMonth)
    getSupabaseBrowserClient()
      .from('pipeline_simple')
      .select('origin_activity_id,status,amount_usd,stage')
      .gte('entry_date', start)
      .lte('entry_date', end)
      .not('origin_activity_id', 'is', null)
      .then(({ data }) => {
        const rMap: Record<string, number> = {}
        const cMap: Record<string, number> = {}
        const mMap: Record<string, number> = {}
        // Stages where a meeting actually happened (past the scheduling stage)
        const REUNION_STAGES = new Set([
          'Primera reu ejecutada/Propuesta en preparación',
          'Propuesta Presentada',
          'Por facturar/cobrar',
        ])

        for (const row of data ?? []) {
          const aid = row.origin_activity_id
          if (!aid) continue
          // Only count as "reunión real" if the deal reached an executed-meeting stage.
          // Cita agendada and Reagendar are scheduled, not yet executed.
          if (REUNION_STAGES.has(row.stage)) {
            rMap[aid] = (rMap[aid] ?? 0) + 1
          }
          if (row.stage === 'Por facturar/cobrar') {
            cMap[aid] = (cMap[aid] ?? 0) + 1
            mMap[aid] = (mMap[aid] ?? 0) + (row.amount_usd ?? 0)
          }
        }
        setReunionesMap(rMap)
        setCierresMap(cMap)
        setMontoMap(mMap)
        setLoading(false)
      })
  }, [selectedMonth])

  // ── Scenario-derived constants ─────────────────────────────────────────────
  const monthlyGoal = scenario.monthly_revenue_goal
  const avgTicket   = scenario.average_ticket
  const outboundPct = scenario.outbound_pct / 100
  const inboundPct  = 1 - outboundPct
  const workingDays = scenario.working_days_per_month ?? 22
  const metaOut     = monthlyGoal * outboundPct
  const metaIn      = monthlyGoal * inboundPct

  const outActivities = activities.filter((a) => a.type === 'OUTBOUND')
  const inActivities  = activities.filter((a) => a.type === 'INBOUND')

  // ── Row builder ────────────────────────────────────────────────────────────
  function buildRows(list: ActivityForSupervision[], metaGroup: number): ActivityRow[] {
    return list.map((a) => {
      const convRate         = localRates[a.id] ?? 0
      const meetingsExpected = localExpected[a.id] ?? 0
      const actReqMes        = convRate > 0 ? meetingsExpected / (convRate / 100) : null
      const actReqSem        = actReqMes !== null ? actReqMes / 4 : null
      const actReqDia        = actReqMes !== null && workingDays > 0 ? actReqMes / workingDays : null
      const reunionesReales  = reunionesMap[a.id] ?? 0
      const eficienciaCanal  = meetingsExpected > 0 ? (reunionesReales / meetingsExpected) * 100 : null
      const cierresReales    = cierresMap[a.id] ?? 0
      const contribGroupUsd  = montoMap[a.id] ?? 0
      const contribGroupPct  = metaGroup > 0 ? (contribGroupUsd / metaGroup) * 100 : 0
      const contribGlobalUsd = montoMap[a.id] ?? 0
      const contribGlobalPct = monthlyGoal > 0 ? (contribGlobalUsd / monthlyGoal) * 100 : 0
      return {
        id: a.id, name: a.name, type: a.type,
        convRate, meetingsExpected,
        actReqMes, actReqSem, actReqDia,
        reunionesReales, eficienciaCanal,
        cierresReales, contribGroupUsd, contribGroupPct,
        contribGlobalUsd, contribGlobalPct,
      }
    })
  }

  // ── Totals ─────────────────────────────────────────────────────────────────
  function computeTotals(rows: ActivityRow[], metaGroup: number): GroupTotals {
    const hasActReq      = rows.filter((r) => r.actReqMes !== null)
    const totalActReqMes = hasActReq.length > 0 ? hasActReq.reduce((s, r) => s + r.actReqMes!, 0) : null
    const totalActReqSem = totalActReqMes !== null ? totalActReqMes / 4 : null
    const totalActReqDia = totalActReqMes !== null && workingDays > 0 ? totalActReqMes / workingDays : null
    const totalReuniones = rows.reduce((s, r) => s + r.reunionesReales, 0)
    const totalExpected  = rows.reduce((s, r) => s + r.meetingsExpected, 0)
    const totalCierres   = rows.reduce((s, r) => s + r.cierresReales, 0)
    const totalGroupUsd  = rows.reduce((s, r) => s + r.contribGroupUsd, 0)
    const nonZeroRates   = rows.filter((r) => r.convRate > 0)
    const avgConvRate    = nonZeroRates.length > 0
      ? nonZeroRates.reduce((s, r) => s + r.convRate, 0) / nonZeroRates.length
      : null
    return {
      actReqMes: totalActReqMes,
      actReqSem: totalActReqSem,
      actReqDia: totalActReqDia,
      meetingsExpected: totalExpected,
      reunionesReales: totalReuniones,
      eficienciaCanal: totalExpected > 0 ? (totalReuniones / totalExpected) * 100 : null,
      cierresReales:   totalCierres,
      contribGroupUsd: totalGroupUsd,
      contribGroupPct: metaGroup > 0 ? (totalGroupUsd / metaGroup) * 100 : 0,
      contribGlobalUsd: totalGroupUsd,
      contribGlobalPct: monthlyGoal > 0 ? (totalGroupUsd / monthlyGoal) * 100 : 0,
      avgConvRate,
    }
  }

  const outRows  = buildRows(outActivities, metaOut)
  const inRows   = buildRows(inActivities,  metaIn)
  const allRows  = [...outRows, ...inRows]
  const outTotals = computeTotals(outRows, metaOut)
  const inTotals  = computeTotals(inRows,  metaIn)
  const allTotals = computeTotals(allRows, monthlyGoal)

  return {
    // Month picker
    monthOptions,
    currentMonth,
    selectedMonth,
    setSelectedMonth,
    isCurrentMonth: selectedMonth === currentMonth,
    // Editable state
    localRates,
    setLocalRates,
    localExpected,
    setLocalExpected,
    // Loading
    loading,
    // Computed
    outRows,
    inRows,
    allRows,
    outTotals,
    inTotals,
    allTotals,
    // Scenario
    monthlyGoal,
    avgTicket,
    outboundPct,
    inboundPct,
    workingDays,
    metaOut,
    metaIn,
    outActivities,
    inActivities,
  }
}
