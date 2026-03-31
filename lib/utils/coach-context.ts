import { endOfWeek, parseISO, subWeeks } from 'date-fns'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { todayISO, toISODate } from '@/lib/utils/dates'

export interface ActivityCompliance {
  name: string
  type: 'OUTBOUND' | 'INBOUND'
  goal: number
  real: number
  pct: number
}

export interface CoachContext {
  userName: string
  period: 'daily' | 'weekly'
  periodDate: string         // ISO date — today for daily, Monday for weekly
  recipe: {
    name: string
    monthly_goal: number
    ticket: number
    outbound_pct: number
    funnel_stages: string[]
    activities_needed_daily: number
    activities_needed_weekly: number
    activities_needed_monthly: number
  } | null
  activities: ActivityCompliance[]
  overallCompliance: number   // %
  streak: number              // consecutive days with check-in (daily) or days this week (weekly)
  weakestActivity: { name: string; pct: number } | null
  strongestActivity: { name: string; pct: number } | null
  trend: 'improving' | 'declining' | 'stable'
  // Weekly-only
  monthlyProgress?: {
    daysElapsed: number
    totalDays: number
    goalPct: number       // % of month elapsed
    achievedPct: number   // % of monthly goal achieved so far
  }
  weeksBelow70?: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toTrend(current: number, previous: number): CoachContext['trend'] {
  if (current > previous + 10) return 'improving'
  if (current < previous - 10) return 'declining'
  return 'stable'
}

// ─── Daily ───────────────────────────────────────────────────────────────────

export async function buildDailyContext(date: string): Promise<CoachContext> {
  const sb = await getSupabaseServerClient()

  const [
    { data: profile },
    { data: activities },
    { data: todayLogs },
    { data: activeScenario },
    { data: recentLogs },
  ] = await Promise.all([
    sb.from('profiles').select('full_name').maybeSingle(),
    sb.from('activities').select('id,name,type,daily_goal').eq('status', 'active'),
    sb.from('vw_daily_compliance').select('activity_id,real_executed,day_goal').eq('log_date', date),
    sb
      .from('recipe_scenarios')
      .select('name,monthly_revenue_goal,average_ticket,outbound_pct,funnel_stages,activities_needed_daily,activities_needed_weekly,activities_needed_monthly')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from('activity_logs')
      .select('log_date')
      .lte('log_date', date)
      .order('log_date', { ascending: false })
      .limit(60),
  ])

  const userName = profile?.full_name ?? 'Campeón'

  // Real per activity
  const realMap: Record<string, number> = {}
  for (const log of todayLogs ?? []) {
    realMap[log.activity_id] = (realMap[log.activity_id] ?? 0) + log.real_executed
  }

  const actCompliance: ActivityCompliance[] = (activities ?? []).map((a) => {
    const goal = a.daily_goal
    const real = realMap[a.id] ?? 0
    const pct  = goal > 0 ? Math.round((real / goal) * 100) : 0
    return { name: a.name, type: a.type, goal, real, pct }
  })

  const totalGoal = actCompliance.reduce((s, a) => s + a.goal, 0)
  const totalReal = actCompliance.reduce((s, a) => s + a.real, 0)
  const overallCompliance = totalGoal > 0 ? Math.round((totalReal / totalGoal) * 100) : 0

  // Streak — consecutive days backward from date with at least one log
  const logDates = new Set((recentLogs ?? []).map((l) => l.log_date as string))
  let streak = 0
  const cur = new Date(date)
  while (logDates.has(toISODate(cur))) {
    streak++
    cur.setDate(cur.getDate() - 1)
  }

  // Yesterday's compliance for trend
  const yesterday = toISODate(new Date(new Date(date).setDate(new Date(date).getDate() - 1)))
  const { data: yestLogs } = await sb
    .from('vw_daily_compliance')
    .select('real_executed,day_goal')
    .eq('log_date', yesterday)
  const yestGoal = (yestLogs ?? []).reduce((s, l) => s + l.day_goal, 0)
  const yestReal = (yestLogs ?? []).reduce((s, l) => s + l.real_executed, 0)
  const yestPct  = yestGoal > 0 ? Math.round((yestReal / yestGoal) * 100) : 0

  const withGoal = actCompliance.filter((a) => a.goal > 0)
  const weakest  = withGoal.length ? withGoal.reduce((m, a) => a.pct < m.pct ? a : m) : null
  const strongest = withGoal.length ? withGoal.reduce((m, a) => a.pct > m.pct ? a : m) : null

  return {
    userName,
    period: 'daily',
    periodDate: date,
    recipe: activeScenario ? {
      name:                       activeScenario.name,
      monthly_goal:               activeScenario.monthly_revenue_goal,
      ticket:                     activeScenario.average_ticket,
      outbound_pct:               activeScenario.outbound_pct,
      funnel_stages:              activeScenario.funnel_stages ?? [],
      activities_needed_daily:    activeScenario.activities_needed_daily   ?? 0,
      activities_needed_weekly:   activeScenario.activities_needed_weekly  ?? 0,
      activities_needed_monthly:  activeScenario.activities_needed_monthly ?? 0,
    } : null,
    activities: actCompliance,
    overallCompliance,
    streak,
    weakestActivity:  weakest   ? { name: weakest.name,   pct: weakest.pct }   : null,
    strongestActivity: strongest ? { name: strongest.name, pct: strongest.pct } : null,
    trend: toTrend(overallCompliance, yestPct),
  }
}

// ─── Weekly ──────────────────────────────────────────────────────────────────

export async function buildWeeklyContext(weekStart: string): Promise<CoachContext> {
  const sb  = await getSupabaseServerClient()
  const weekEnd      = toISODate(endOfWeek(parseISO(weekStart), { weekStartsOn: 1 }))
  const prevWeekStart = toISODate(subWeeks(parseISO(weekStart), 1))
  const prevWeekEnd   = toISODate(endOfWeek(parseISO(prevWeekStart), { weekStartsOn: 1 }))

  const today    = todayISO()
  const monthStart = today.slice(0, 8) + '01'
  const daysInMonth = new Date(
    parseInt(today.slice(0, 4)),
    parseInt(today.slice(5, 7)),
    0
  ).getDate()
  const daysElapsed = parseInt(today.slice(8, 10))

  const [
    { data: profile },
    { data: activities },
    { data: weekLogs },
    { data: prevLogs },
    { data: activeScenario },
    { data: monthLogs },
  ] = await Promise.all([
    sb.from('profiles').select('full_name').maybeSingle(),
    sb.from('activities').select('id,name,type,weekly_goal,monthly_goal').eq('status', 'active'),
    sb.from('activity_logs').select('activity_id,real_executed,log_date').gte('log_date', weekStart).lte('log_date', weekEnd),
    sb.from('activity_logs').select('real_executed').gte('log_date', prevWeekStart).lte('log_date', prevWeekEnd),
    sb
      .from('recipe_scenarios')
      .select('name,monthly_revenue_goal,average_ticket,outbound_pct,funnel_stages,activities_needed_daily,activities_needed_weekly,activities_needed_monthly')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb.from('activity_logs').select('real_executed').gte('log_date', monthStart).lte('log_date', today),
  ])

  const userName = profile?.full_name ?? 'Campeón'

  const realMap: Record<string, number> = {}
  for (const log of weekLogs ?? []) {
    realMap[log.activity_id] = (realMap[log.activity_id] ?? 0) + log.real_executed
  }

  const actCompliance: ActivityCompliance[] = (activities ?? []).map((a) => {
    const goal = a.weekly_goal
    const real = realMap[a.id] ?? 0
    const pct  = goal > 0 ? Math.round((real / goal) * 100) : 0
    return { name: a.name, type: a.type, goal, real, pct }
  })

  const totalGoal = actCompliance.reduce((s, a) => s + a.goal, 0)
  const totalReal = actCompliance.reduce((s, a) => s + a.real, 0)
  const overallCompliance = totalGoal > 0 ? Math.round((totalReal / totalGoal) * 100) : 0

  const prevRealTotal = (prevLogs ?? []).reduce((s, l) => s + l.real_executed, 0)
  const prevCompliance = totalGoal > 0 ? Math.round((prevRealTotal / totalGoal) * 100) : 0

  // Days this week with at least one log (streak for weekly = days active this week)
  const daysWithLogs = new Set((weekLogs ?? []).map((l) => l.log_date)).size

  const withGoal  = actCompliance.filter((a) => a.goal > 0)
  const weakest   = withGoal.length ? withGoal.reduce((m, a) => a.pct < m.pct ? a : m) : null
  const strongest = withGoal.length ? withGoal.reduce((m, a) => a.pct > m.pct ? a : m) : null

  // Monthly progress
  const monthlyGoalTotal = (activities ?? []).reduce((s, a) => s + (a.monthly_goal ?? 0), 0)
  const monthReal = (monthLogs ?? []).reduce((s, l) => s + l.real_executed, 0)
  const achievedPct = monthlyGoalTotal > 0 ? Math.round((monthReal / monthlyGoalTotal) * 100) : 0

  // Consecutive weeks below 70%
  let weeksBelow70 = 0
  if (overallCompliance < 70) {
    weeksBelow70++
    if (prevCompliance < 70) weeksBelow70++
  }

  return {
    userName,
    period: 'weekly',
    periodDate: weekStart,
    recipe: activeScenario ? {
      name:                       activeScenario.name,
      monthly_goal:               activeScenario.monthly_revenue_goal,
      ticket:                     activeScenario.average_ticket,
      outbound_pct:               activeScenario.outbound_pct,
      funnel_stages:              activeScenario.funnel_stages ?? [],
      activities_needed_daily:    activeScenario.activities_needed_daily   ?? 0,
      activities_needed_weekly:   activeScenario.activities_needed_weekly  ?? 0,
      activities_needed_monthly:  activeScenario.activities_needed_monthly ?? 0,
    } : null,
    activities: actCompliance,
    overallCompliance,
    streak: daysWithLogs,
    weakestActivity:   weakest   ? { name: weakest.name,   pct: weakest.pct }   : null,
    strongestActivity: strongest ? { name: strongest.name, pct: strongest.pct } : null,
    trend: toTrend(overallCompliance, prevCompliance),
    monthlyProgress: {
      daysElapsed,
      totalDays:   daysInMonth,
      goalPct:     Math.round((daysElapsed / daysInMonth) * 100),
      achievedPct,
    },
    weeksBelow70,
  }
}

// ─── Context → prompt string ──────────────────────────────────────────────────

export function formatContextForPrompt(ctx: CoachContext): string {
  const lines: string[] = [
    `NOMBRE DEL USUARIO: ${ctx.userName}`,
    '',
  ]

  if (ctx.recipe) {
    lines.push(
      `RECETARIO ACTIVO: ${ctx.recipe.name}`,
      `  Meta mensual: $${ctx.recipe.monthly_goal.toLocaleString('es-CO')}`,
      `  Ticket promedio: $${ctx.recipe.ticket.toLocaleString('es-CO')}`,
      `  Actividades necesarias: ${ctx.recipe.activities_needed_daily}/día | ${ctx.recipe.activities_needed_weekly}/sem | ${ctx.recipe.activities_needed_monthly}/mes`,
      '',
    )
  } else {
    lines.push('RECETARIO ACTIVO: Ninguno', '')
  }

  if (ctx.period === 'daily') {
    lines.push(
      `ANÁLISIS DIARIO — ${ctx.periodDate}`,
      `  Cumplimiento general: ${ctx.overallCompliance}%`,
      `  Racha activa: ${ctx.streak} día(s) consecutivo(s)`,
      `  Tendencia vs ayer: ${ctx.trend}`,
    )
  } else {
    lines.push(
      `ANÁLISIS SEMANAL — semana del ${ctx.periodDate}`,
      `  Cumplimiento semanal: ${ctx.overallCompliance}%`,
      `  Días activos esta semana: ${ctx.streak}/5`,
      `  Tendencia vs semana anterior: ${ctx.trend}`,
    )
    if (ctx.monthlyProgress) {
      const mp = ctx.monthlyProgress
      lines.push(
        `  Progreso mensual: ${mp.achievedPct}% de meta logrado (${mp.daysElapsed}/${mp.totalDays} días del mes = ${mp.goalPct}% transcurrido)`,
      )
    }
    if ((ctx.weeksBelow70 ?? 0) >= 2) {
      lines.push(`  ALERTA: ${ctx.weeksBelow70} semanas consecutivas bajo el 70%`)
    }
  }

  lines.push('')
  lines.push('DESGLOSE POR ACTIVIDAD:')
  for (const a of ctx.activities) {
    lines.push(`  • ${a.name} [${a.type}]: ${a.real}/${a.goal} (${a.pct}%)`)
  }

  if (ctx.weakestActivity) {
    lines.push('', `CANAL MÁS DÉBIL: ${ctx.weakestActivity.name} (${ctx.weakestActivity.pct}%)`)
  }
  if (ctx.strongestActivity) {
    lines.push(`CANAL MÁS FUERTE: ${ctx.strongestActivity.name} (${ctx.strongestActivity.pct}%)`)
  }

  return lines.join('\n')
}
