import type { SupabaseClient } from '@supabase/supabase-js'
import { startOfWeek, subWeeks, endOfWeek, format } from 'date-fns'
import { es } from 'date-fns/locale'

export interface RepWeekStat {
  weekStart: string
  real: number
  goal: number
  pct: number
}

export interface ActivityPerformance {
  activityId: string
  name: string
  type: string
  channel: string
  totalReal: number
  totalGoal: number
  pct: number
}

export interface RepAnalytics {
  userId: string
  name: string
  email: string
  weeklyTrend: RepWeekStat[]
  avgCompliance: number
  activities: ActivityPerformance[]
  bestActivity: ActivityPerformance | null
  worstActivity: ActivityPerformance | null
  totalCheckIns: number
  lastCheckIn: string | null
}

export interface GerenteAnalytics {
  weekLabels: string[]
  reps: RepAnalytics[]
  teamTrend: { weekStart: string; label: string; avgPct: number }[]
  summary: {
    totalReps: number
    avgCompliance: number
    onTrackCount: number
    atRiskCount: number
    criticalCount: number
    mostConsistentRep: string | null
    mostStrugglingRep: string | null
  }
}

function toISOWeekStart(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function fetchGerenteAnalytics(
  service: SupabaseClient,
  userIds: string[],
  weeksBack = 12,
): Promise<GerenteAnalytics> {
  if (userIds.length === 0) {
    return {
      weekLabels: [],
      reps: [],
      teamTrend: [],
      summary: {
        totalReps: 0,
        avgCompliance: 0,
        onTrackCount: 0,
        atRiskCount: 0,
        criticalCount: 0,
        mostConsistentRep: null,
        mostStrugglingRep: null,
      },
    }
  }

  const now = new Date()
  const thisMonday = startOfWeek(now, { weekStartsOn: 1 })

  // Build week boundaries for the last N weeks
  const weeks: { start: string; end: string; label: string }[] = []
  for (let i = weeksBack - 1; i >= 0; i--) {
    const monday = subWeeks(thisMonday, i)
    const friday = endOfWeek(monday, { weekStartsOn: 1 })
    weeks.push({
      start: toISOWeekStart(monday),
      end:   toISOWeekStart(friday),
      label: format(monday, "d MMM", { locale: es }),
    })
  }

  const rangeStart = weeks[0].start
  const rangeEnd   = weeks[weeks.length - 1].end

  // Fetch all data in parallel
  const [profilesRes, activitiesRes, logsRes] = await Promise.all([
    service
      .from('profiles')
      .select('id,full_name,email')
      .in('id', userIds),
    service
      .from('activities')
      .select('id,name,type,channel,weekly_goal,user_id')
      .eq('status', 'active')
      .in('user_id', userIds),
    service
      .from('activity_logs')
      .select('user_id,activity_id,real_executed,log_date')
      .gte('log_date', rangeStart)
      .lte('log_date', rangeEnd)
      .in('user_id', userIds),
  ])

  const profiles   = profilesRes.data  ?? []
  const activities = activitiesRes.data ?? []
  const logs       = logsRes.data       ?? []

  // Index activities by user
  const actsByUser: Record<string, typeof activities> = {}
  for (const act of activities) {
    if (!actsByUser[act.user_id]) actsByUser[act.user_id] = []
    actsByUser[act.user_id].push(act)
  }

  // Index logs by user
  const logsByUser: Record<string, typeof logs> = {}
  for (const log of logs) {
    if (!logsByUser[log.user_id]) logsByUser[log.user_id] = []
    logsByUser[log.user_id].push(log)
  }

  const weekLabels = weeks.map((w) => w.label)

  const reps: RepAnalytics[] = profiles.map((p) => {
    const userActs = actsByUser[p.id] ?? []
    const userLogs = logsByUser[p.id] ?? []

    // Weekly compliance trend
    const weeklyTrend: RepWeekStat[] = weeks.map(({ start, end }) => {
      // Total weekly goal = sum of all activities weekly_goal
      const goal = userActs.reduce((s, a) => s + (a.weekly_goal ?? 0), 0)

      // Total real executed in this week
      const real = userLogs
        .filter((l) => l.log_date >= start && l.log_date <= end)
        .reduce((s, l) => s + (l.real_executed ?? 0), 0)

      const pct = goal > 0 ? Math.round((real / goal) * 100) : 0
      return { weekStart: start, real, goal, pct }
    })

    const avgCompliance = weeklyTrend.length > 0
      ? Math.round(weeklyTrend.reduce((s, w) => s + w.pct, 0) / weeklyTrend.length)
      : 0

    // Per-activity performance (across the full period)
    const actPerf: ActivityPerformance[] = userActs.map((act) => {
      const actLogs = userLogs.filter((l) => l.activity_id === act.id)
      const totalReal = actLogs.reduce((s, l) => s + (l.real_executed ?? 0), 0)
      // goal per period = weekly_goal * weeksBack
      const totalGoal = (act.weekly_goal ?? 0) * weeksBack
      const pct = totalGoal > 0 ? Math.round((totalReal / totalGoal) * 100) : 0
      return { activityId: act.id, name: act.name, type: act.type, channel: act.channel, totalReal, totalGoal, pct }
    }).sort((a, b) => b.pct - a.pct)

    const activitiesWithGoal = actPerf.filter((a) => a.totalGoal > 0)
    const bestActivity  = activitiesWithGoal[0] ?? null
    const worstActivity = activitiesWithGoal[activitiesWithGoal.length - 1] ?? null

    // Check-in days (unique dates with logs)
    const checkInDates = [...new Set(userLogs.map((l) => l.log_date))]
    const totalCheckIns = checkInDates.length
    const lastCheckIn = checkInDates.sort().reverse()[0] ?? null

    return {
      userId:       p.id,
      name:         p.full_name ?? p.email,
      email:        p.email,
      weeklyTrend,
      avgCompliance,
      activities:   actPerf,
      bestActivity,
      worstActivity,
      totalCheckIns,
      lastCheckIn,
    }
  })

  // Sort reps by avg compliance desc
  reps.sort((a, b) => b.avgCompliance - a.avgCompliance)

  // Team trend (avg per week)
  const teamTrend = weeks.map(({ start, label }) => {
    const weekPcts = reps.map((r) => r.weeklyTrend.find((w) => w.weekStart === start)?.pct ?? 0)
    const avgPct = weekPcts.length > 0
      ? Math.round(weekPcts.reduce((s, p) => s + p, 0) / weekPcts.length)
      : 0
    return { weekStart: start, label, avgPct }
  })

  const totalReps     = reps.length
  const avgCompliance = totalReps > 0 ? Math.round(reps.reduce((s, r) => s + r.avgCompliance, 0) / totalReps) : 0
  const onTrackCount  = reps.filter((r) => r.avgCompliance >= 70).length
  const atRiskCount   = reps.filter((r) => r.avgCompliance >= 40 && r.avgCompliance < 70).length
  const criticalCount = reps.filter((r) => r.avgCompliance < 40).length

  return {
    weekLabels,
    reps,
    teamTrend,
    summary: {
      totalReps,
      avgCompliance,
      onTrackCount,
      atRiskCount,
      criticalCount,
      mostConsistentRep:  reps[0]?.name ?? null,
      mostStrugglingRep:  reps[reps.length - 1]?.name ?? null,
    },
  }
}

export function buildGerenteContext(analytics: GerenteAnalytics, company?: string): string {
  const { summary, reps, teamTrend } = analytics
  const lines: string[] = [
    `Empresa: ${company ?? 'N/A'}`,
    `Período analizado: últimas ${analytics.weekLabels.length} semanas`,
    ``,
    `=== RESUMEN DEL EQUIPO ===`,
    `Total vendedores: ${summary.totalReps}`,
    `Cumplimiento promedio: ${summary.avgCompliance}%`,
    `En meta (≥70%): ${summary.onTrackCount}`,
    `En riesgo (40-69%): ${summary.atRiskCount}`,
    `Críticos (<40%): ${summary.criticalCount}`,
    `Más consistente: ${summary.mostConsistentRep ?? 'N/A'}`,
    `Más rezagado: ${summary.mostStrugglingRep ?? 'N/A'}`,
    ``,
    `=== TENDENCIA SEMANAL DEL EQUIPO ===`,
    teamTrend.map((t) => `${t.label}: ${t.avgPct}%`).join(' | '),
    ``,
    `=== DESEMPEÑO POR VENDEDOR ===`,
  ]

  for (const rep of reps) {
    lines.push(``)
    lines.push(`--- ${rep.name} (${rep.email}) ---`)
    lines.push(`Cumplimiento promedio: ${rep.avgCompliance}%`)
    lines.push(`Check-ins totales: ${rep.totalCheckIns}`)
    lines.push(`Último check-in: ${rep.lastCheckIn ?? 'nunca'}`)
    if (rep.bestActivity)  lines.push(`Actividad más fácil: ${rep.bestActivity.name} (${rep.bestActivity.pct}%)`)
    if (rep.worstActivity && rep.worstActivity.activityId !== rep.bestActivity?.activityId) {
      lines.push(`Actividad más difícil: ${rep.worstActivity.name} (${rep.worstActivity.pct}%)`)
    }
    lines.push(`Tendencia: ${rep.weeklyTrend.map((w) => `${w.pct}%`).join(', ')}`)
    if (rep.activities.length > 0) {
      lines.push(`Actividades: ${rep.activities.map((a) => `${a.name}(${a.pct}%)`).join(', ')}`)
    }
  }

  return lines.join('\n')
}
