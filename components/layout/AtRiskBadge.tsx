'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { todayISO, elapsedDays, totalDays } from '@/lib/utils/dates'

export function AtRiskBadge() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function compute() {
      try {
        const sb = getSupabaseBrowserClient()
        const today = todayISO()

        // 1. Fetch goals whose period includes today
        const { data: goals } = await sb
          .from('goals')
          .select('id,activity_id,period_start,period_end,target_value')
          .lte('period_start', today)
          .gte('period_end', today)

        if (!goals || goals.length === 0) return

        // 2. Fetch compliance logs for the broadest date range
        const minStart = goals.reduce((m, g) => (g.period_start < m ? g.period_start : m), goals[0].period_start)
        const { data: logs } = await sb
          .from('vw_daily_compliance')
          .select('activity_id,real_executed,log_date')
          .gte('log_date', minStart)
          .lte('log_date', today)

        if (cancelled) return

        // 3. Compute real per (activity_id, period) combination
        const realMap: Record<string, number> = {}
        for (const log of logs ?? []) {
          const key = log.activity_id
          realMap[key] = (realMap[key] ?? 0) + log.real_executed
        }
        // total real (for global goals)
        const totalReal = Object.values(realMap).reduce((s, v) => s + v, 0)

        // 4. Count at-risk goals (elapsed > 50% AND compliance < 70%)
        let atRisk = 0
        for (const goal of goals) {
          const elapsed  = elapsedDays(goal.period_start, goal.period_end)
          const total    = totalDays(goal.period_start, goal.period_end)
          const pctElapsed = (elapsed / total) * 100
          if (pctElapsed < 50) continue // not enough time elapsed

          // real for this goal
          const real = goal.activity_id
            ? (realMap[goal.activity_id] ?? 0)
            : totalReal
          const compliance = goal.target_value > 0 ? (real / goal.target_value) * 100 : 100
          if (compliance < 70) atRisk++
        }

        setCount(atRisk)
      } catch {
        // silently ignore — badge is non-critical
      }
    }

    compute()
    return () => { cancelled = true }
  }, [])

  if (count === 0) return null

  return (
    <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-red-400 px-1 text-[10px] font-bold text-white tabular-nums">
      {count}
    </span>
  )
}
