/**
 * Team report generator — shared between manual API and weekly cron.
 * Aggregates per-user weekly context, calls Claude for team analysis,
 * sends HTML email via Resend, and saves to coach_messages.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import { buildWeeklyContextForCron, buildMonthlyContextForCron, type ActivityCompliance } from './coach-context'
import { todayISO, toISODate } from './dates'
import { startOfWeek } from 'date-fns'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

type SbClient = SupabaseClient<Database>

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Pipeline summary helper ──────────────────────────────────────────────────

interface PipelineSummary {
  wonCount: number
  lostCount: number
  openCount: number
  wonAmount: number
  openAmount: number
  lostAmount: number
  stageCounts: Record<string, number>
  totalDeals: number
}

async function fetchPipelineSummary(
  userId: string,
  periodStart: string,
  periodEnd: string,
  sb: SbClient,
): Promise<PipelineSummary> {
  const { data: rows } = await sb
    .from('pipeline_simple')
    .select('stage, status, amount_usd')
    .eq('user_id', userId)
    .gte('entry_date', periodStart)
    .lte('entry_date', periodEnd)

  const all = rows ?? []
  const lastStage  = 'Cierre'
  const wonAmount  = all.filter(r => r.stage === lastStage && r.amount_usd != null).reduce((s, r) => s + (r.amount_usd ?? 0), 0)
  const openAmount = all.filter(r => r.status === 'abierto' && r.stage !== 'Reunión' && r.amount_usd != null).reduce((s, r) => s + (r.amount_usd ?? 0), 0)
  const lostAmount = all.filter(r => r.status === 'perdido' && r.amount_usd != null).reduce((s, r) => s + (r.amount_usd ?? 0), 0)
  const wonCount   = all.filter(r => r.stage === lastStage && r.status === 'ganado').length
  const lostCount  = all.filter(r => r.status === 'perdido').length
  const openCount  = all.filter(r => r.status === 'abierto' && r.stage !== 'Reunión').length
  const stageCounts: Record<string, number> = {}
  for (const r of all) { stageCounts[r.stage] = (stageCounts[r.stage] ?? 0) + 1 }

  return {
    wonCount,
    lostCount,
    openCount,
    wonAmount,
    openAmount,
    lostAmount,
    stageCounts,
    totalDeals: all.length,
  }
}

export interface TeamReportOptions {
  scope: 'team' | 'at_risk'
  weekStart: string
  /** Inclusive end of the report period (ISO date). Defaults to Friday of weekStart's week. */
  periodEnd?: string
  /** 'monthly' | 'quarterly' changes context builder and labels. Default: 'weekly'. */
  reportPeriodType?: 'weekly' | 'monthly' | 'quarterly'
  adminUserId: string
  adminEmail: string
  triggeredBy: 'auto' | 'manual'
  /** Pre-filter: only include these user IDs (undefined = all) */
  filterUserIds?: string[]
  /** Pre-filter: only include users from this company (undefined = all) */
  filterCompany?: string
  /** at_risk threshold — users below this % are considered at risk (default 70) */
  threshold?: number
  /** Override the email recipient (default: adminEmail) */
  recipientEmail?: string
  /** When filtering by a specific member, their display name for subject/header */
  memberName?: string
  /** When true, skip email and DB save — return HTML directly for PDF download */
  downloadOnly?: boolean
}

export interface TeamReportResult {
  success: boolean
  sentTo: string
  generatedAt: string
  id: string | null
  /** Populated only when downloadOnly=true */
  html?: string
}

interface UserSummary {
  userId: string
  userName: string
  overallCompliance: number
  trend: 'improving' | 'declining' | 'stable'
  weakest: string | null
  strongest: string | null
  daysActive: number
  monthlyAchievedPct: number
  activities: ActivityCompliance[]
  pipeline: PipelineSummary
}

// ─── Timezone-safe week range ─────────────────────────────────────────────────
// date-fns startOfWeek/endOfWeek return midnight UTC.
// toISODate converts to Bogota (UTC-5), rolling midnight back to previous day.
// Fix: after startOfWeek, re-anchor to noon UTC before calling toISODate.
// weekEnd = Monday + 4 days (Friday) — working week Mon–Fri.

function safeWeekRange(isoWeekStart: string): { weekStart: string; weekEnd: string } {
  const [y, m, d] = isoWeekStart.split('-').map(Number)
  // Re-anchor the given Monday to noon UTC so toISODate doesn't roll back
  const mondayNoon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  // Friday = Monday + 4 days, also at noon (millisecond-safe across month boundaries)
  const fridayNoon = new Date(mondayNoon.getTime() + 4 * 24 * 60 * 60 * 1000)
  return {
    weekStart: toISODate(mondayNoon),
    weekEnd:   toISODate(fridayNoon),
  }
}

// ─── Scope label builder ─────────────────────────────────────────────────────

function buildScopeLabel(opts: {
  filterCompany?: string
  filterUserIds?: string[]
  scope: 'team' | 'at_risk'
  threshold: number
}): string {
  const { filterCompany, filterUserIds, scope, threshold } = opts
  let label: string
  if (filterCompany && filterUserIds?.length) {
    label = `${filterCompany} · ${filterUserIds.length} representantes seleccionados`
  } else if (filterCompany) {
    label = `${filterCompany} · Equipo completo`
  } else if (filterUserIds?.length) {
    label = `${filterUserIds.length} representantes seleccionados`
  } else {
    label = 'Toda la plataforma'
  }
  if (scope === 'at_risk') label += ` · Solo en riesgo (<${threshold}%)`
  return label
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function generateTeamReport(
  opts: TeamReportOptions,
  sb: SbClient,
): Promise<TeamReportResult> {
  const { scope, adminUserId, adminEmail, triggeredBy,
          filterUserIds, filterCompany, threshold = 70,
          recipientEmail, memberName, downloadOnly } = opts
  const intendedEmail = recipientEmail ?? adminEmail
  const toEmail = intendedEmail

  const isMonthly = opts.reportPeriodType === 'monthly'

  // ── Period range: monthly uses full month; weekly uses Mon–Fri ──
  let weekStart: string
  let weekEnd: string
  if (isMonthly) {
    weekStart = opts.weekStart   // already '2026-04-01' (month start)
    weekEnd   = opts.periodEnd ?? opts.weekStart  // '2026-04-30'
  } else {
    // ── Problem 1 fix: recompute weekStart/weekEnd with timezone-safe anchor ──
    const range = safeWeekRange(opts.weekStart)
    weekStart = range.weekStart
    weekEnd   = range.weekEnd
  }

  // 1. Fetch all active + admin users
  const { data: allUsers, error: usersErr } = await sb
    .from('profiles')
    .select('id, full_name, company')
    .in('role', ['active', 'admin'])

  if (usersErr || !allUsers?.length) {
    throw new Error(`[team-report] Could not fetch users: ${usersErr?.message ?? 'empty'}`)
  }

  // Apply pre-filters (company / explicit userIds)
  let users = allUsers as { id: string; full_name: string | null; company: string | null }[]
  if (filterCompany) {
    users = users.filter((u) => (u.company ?? '').toLowerCase() === filterCompany.toLowerCase())
  }
  if (filterUserIds?.length) {
    users = users.filter((u) => filterUserIds.includes(u.id))
  }
  if (!users.length) throw new Error('[team-report] No users match the applied filters')

  // Build descriptive scope label from applied filters
  const scopeLabel = buildScopeLabel({ filterCompany, filterUserIds, scope, threshold })

  // 2. Build weekly context for each user (sequential to avoid DB overload)
  const summaries: UserSummary[] = []
  for (const user of users) {
    try {
      const pipelineStart = isMonthly ? weekStart : weekEnd.slice(0, 8) + '01'
      const [ctx, pipeline] = await Promise.all([
        isMonthly
          ? buildMonthlyContextForCron(user.id, weekStart, sb)
          : buildWeeklyContextForCron(user.id, weekStart, sb),
        fetchPipelineSummary(user.id, pipelineStart, weekEnd, sb),
      ])
      summaries.push({
        userId:            user.id,
        userName:          ctx.userName,
        overallCompliance: ctx.overallCompliance,
        trend:             ctx.trend,
        weakest:           ctx.weakestActivity?.name ?? null,
        strongest:         ctx.strongestActivity?.name ?? null,
        daysActive:        ctx.streak,
        monthlyAchievedPct: ctx.monthlyProgress?.achievedPct ?? 0,
        activities:        ctx.activities,
        pipeline,
      })
    } catch (err) {
      console.error(`[team-report] Context failed for ${user.id}:`, err)
    }
  }

  if (!summaries.length) throw new Error('[team-report] No user summaries generated')

  // 3. Filter by scope (at_risk uses configurable threshold)
  const filtered =
    scope === 'at_risk' ? summaries.filter((u) => u.overallCompliance < threshold) : summaries

  const atRisk = summaries.filter((u) => u.overallCompliance < threshold)
  const avgCompliance =
    filtered.length
      ? Math.round(filtered.reduce((s, u) => s + u.overallCompliance, 0) / filtered.length)
      : 0

  // 4. Team-level aggregates (Problem 3)
  const sorted = [...filtered].sort((a, b) => b.overallCompliance - a.overallCompliance)
  const top3    = sorted.slice(0, 3)
  const bottom3 = sorted.slice(-3).reverse()

  // Activity aggregate across team: avg compliance per activity name
  const actMap: Record<string, { goal: number; real: number; count: number }> = {}
  for (const u of filtered) {
    for (const a of u.activities) {
      if (!actMap[a.name]) actMap[a.name] = { goal: 0, real: 0, count: 0 }
      actMap[a.name].goal  += a.goal
      actMap[a.name].real  += a.real
      actMap[a.name].count += 1
    }
  }
  const actSummaries = Object.entries(actMap)
    .map(([name, v]) => ({
      name,
      avgPct: v.goal > 0 ? Math.round((v.real / v.goal) * 100) : 0,
    }))
    .sort((a, b) => b.avgPct - a.avgPct)
  const bestActivity   = actSummaries[0] ?? null
  const worstActivity  = actSummaries[actSummaries.length - 1] ?? null

  const decliningCount = filtered.filter((u) => u.trend === 'declining').length
  const improvingCount = filtered.filter((u) => u.trend === 'improving').length

  // 5. Build enriched prompt for Claude
  const weekLabel    = isMonthly
    ? format(parseISO(weekStart), "MMMM yyyy", { locale: es })
    : format(parseISO(weekStart), "d 'de' MMMM", { locale: es })
  const weekEndLabel = isMonthly
    ? ''
    : format(parseISO(weekEnd), "d 'de' MMMM yyyy", { locale: es })

  // Team pipeline aggregates (CAMBIO 4)
  const teamWonAmount  = filtered.reduce((s, u) => s + u.pipeline.wonAmount, 0)
  const teamOpenAmount = filtered.reduce((s, u) => s + u.pipeline.openAmount, 0)
  const teamWonCount   = filtered.reduce((s, u) => s + u.pipeline.wonCount, 0)

  const repLines = sorted
    .map((u, i) => {
      const actBreakdown = u.activities
        .map((a) => `${a.name}: ${a.real}/${a.goal} (${a.pct}%)`)
        .join(' | ')
      const stageStr = Object.entries(u.pipeline.stageCounts)
        .map(([s, n]) => `${s}: ${n}`)
        .join(' | ') || 'sin deals activos'
      const pipelineLine = [
        `   Pipeline: ${u.pipeline.wonCount} ganados ($${u.pipeline.wonAmount.toLocaleString('es-CO')})`,
        `| ${u.pipeline.openCount} en curso ($${u.pipeline.openAmount.toLocaleString('es-CO')})`,
        `| ${u.pipeline.lostCount} perdidos`,
        u.pipeline.openCount > 0 ? `| Etapas: ${stageStr}` : '',
      ].filter(Boolean).join(' ')
      return (
        `${i + 1}. ${u.userName} — ${u.overallCompliance}% cumplimiento | ` +
        `Tendencia: ${u.trend} | Días activos: ${u.daysActive}/5\n` +
        `   Actividades: ${actBreakdown}\n` +
        pipelineLine + '\n' +
        `   Canal fuerte: ${u.strongest ?? 'N/A'} | Canal débil: ${u.weakest ?? 'N/A'} | ` +
        `Meta mensual: ${u.monthlyAchievedPct}%`
      )
    })
    .join('\n\n')

  const periodRangeLabel = isMonthly ? weekLabel : `${weekLabel} – ${weekEndLabel}`
  const prompt = `ANÁLISIS DE EQUIPO — ProspectPro
Período: ${periodRangeLabel}
Scope: ${scope === 'at_risk' ? `Solo reps en riesgo (<${threshold}%)` : 'Equipo completo'}

MÉTRICAS DEL EQUIPO:
- Reps analizados: ${filtered.length}
- Cumplimiento promedio: ${avgCompliance}%
- Reps en riesgo (<${threshold}%): ${atRisk.length}
- Tendencia positiva (↑): ${improvingCount} | Tendencia negativa (↓): ${decliningCount}
- Actividad con mejor cumplimiento del equipo: ${bestActivity ? `${bestActivity.name} (${bestActivity.avgPct}%)` : 'N/A'}
- Actividad con peor cumplimiento del equipo: ${worstActivity ? `${worstActivity.name} (${worstActivity.avgPct}%)` : 'N/A'}
- Pipeline total ganado: ${teamWonCount} deals ($${teamWonAmount.toLocaleString('es-CO')})
- Pipeline total en curso: $${teamOpenAmount.toLocaleString('es-CO')}

TOP 3 DEL EQUIPO:
${top3.map((u, i) => `${i + 1}. ${u.userName} — ${u.overallCompliance}%`).join('\n')}

REQUIEREN MÁS ATENCIÓN:
${bottom3.map((u) => `• ${u.userName} — ${u.overallCompliance}% | Canal débil: ${u.weakest ?? 'N/A'} | Tendencia: ${u.trend}`).join('\n')}

DETALLE COMPLETO POR REP:
${repLines}

Genera un análisis del equipo para el manager en estas secciones:

DIAGNÓSTICO GENERAL: Estado del equipo esta semana en 2 líneas — qué tan cerca están del objetivo colectivo.

RANKING DEL EQUIPO: Tabla simple (sin asteriscos) con los 3 mejores y 3 que más necesitan atención. Usa formato: "1. [Nombre] — [%] (↑/↓/→)"

PATRÓN COMÚN DE FALLO: La actividad o comportamiento donde más reps fallan simultáneamente.

ANÁLISIS INDIVIDUAL — REQUIEREN ATENCIÓN: Para cada rep bajo ${threshold}%, UNA recomendación específica y accionable. Nombra la actividad exacta y el número concreto que deben alcanzar. Si el rep tiene pipeline en curso, menciona si el monto abierto puede salvar su mes. Si tiene 0 deals en las últimas etapas del funnel, señálalo como señal de alerta temprana.

ACCIÓN PRIORITARIA PARA EL MANAGER: UNA acción concreta, medible y con deadline esta semana.

Reglas: sin markdown (* o # o **). Secciones en MAYÚSCULAS seguidas de dos puntos. Máximo 600 palabras. Responde en español.`

  // 6. Call Claude
  const aiResp = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 900,
    messages: [{ role: 'user', content: prompt }],
  })
  const aiAnalysis = aiResp.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  // 7. Build HTML email
  const html = buildTeamReportEmail({
    weekStart,
    weekLabel,
    weekEndLabel,
    isMonthly,
    scopeLabel,
    scope,
    threshold,
    summaries: filtered,
    atRiskCount: atRisk.length,
    avgCompliance,
    improvingCount,
    decliningCount,
    top3,
    bottom3,
    bestActivity,
    worstActivity,
    aiAnalysis,
    memberName,
  })

  const generatedAt = new Date().toISOString()

  // downloadOnly mode: return HTML directly, skip DB + email
  if (downloadOnly) {
    return { success: true, sentTo: '', generatedAt, id: null, html }
  }

  // 8. Save to coach_messages first — ensures analysis is persisted even if email fails
  let savedId: string | null = null
  try {
    const { data } = await sb
      .from('coach_messages')
      .insert({
        user_id:       adminUserId,
        type:          'team_report',
        message:       aiAnalysis,
        period_date:   weekStart,
        is_read:       false,
        triggered_by:  triggeredBy,
        report_scope:  scopeLabel,
        sent_to_email: toEmail ?? '',
      } as never)
      .select('id')
      .single()
    savedId = (data as { id: string } | null)?.id ?? null
  } catch (err) {
    console.error('[team-report] Failed to save record:', err)
  }

  // 9. Send via Resend — skip if no recipient address
  if (!toEmail) {
    console.warn('[team-report] No recipient email — skipping Resend')
    return { success: true, sentTo: '', generatedAt, id: savedId }
  }

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'ProspectPro Reports <reportes@prospectpro.cloud>',
      to: toEmail,
      subject: memberName
        ? `ProspectPro · Reporte de equipo — ${scopeLabel} · ${memberName} · ${periodRangeLabel}`
        : `ProspectPro · Reporte de equipo — ${scopeLabel} · ${periodRangeLabel}`,
      html,
    }),
  })

  if (!resendRes.ok) {
    const errText = await resendRes.text()
    console.error(`[team-report] Resend failed: ${errText}`)
    return { success: true, sentTo: toEmail, generatedAt, id: savedId }
  }

  return { success: true, sentTo: adminEmail ?? toEmail, generatedAt, id: savedId }
}

// ─── Email builder ────────────────────────────────────────────────────────────

function buildTeamReportEmail(p: {
  weekStart:      string
  weekLabel:      string
  weekEndLabel:   string
  isMonthly?:     boolean
  scopeLabel:     string
  scope:          'team' | 'at_risk'
  threshold:      number
  summaries:      UserSummary[]
  atRiskCount:    number
  avgCompliance:  number
  improvingCount: number
  decliningCount: number
  top3:           UserSummary[]
  bottom3:        UserSummary[]
  bestActivity:   { name: string; avgPct: number } | null
  worstActivity:  { name: string; avgPct: number } | null
  aiAnalysis:     string
  memberName?:    string
}): string {
  const { weekStart, weekLabel, weekEndLabel, isMonthly, scopeLabel, threshold, summaries,
          atRiskCount, avgCompliance, improvingCount, decliningCount,
          bestActivity, worstActivity, aiAnalysis, memberName } = p

  // ── Helpers ────────────────────────────────────────────────────────────────
  const trendIcon  = (t: string) => t === 'improving' ? '&#8593;' : t === 'declining' ? '&#8595;' : '&#8594;'
  const trendColor = (t: string) => t === 'improving' ? '#34d399' : t === 'declining' ? '#f87171' : '#94a3b8'
  const semColor   = (pct: number) => pct >= 70 ? '#34d399' : pct >= 40 ? '#fbbf24' : '#f87171'
  const semBg      = (pct: number) => pct >= 70 ? '#34d39915' : pct >= 40 ? '#fbbf2415' : '#f8717115'
  const semBorder  = (pct: number) => pct >= 70 ? '#34d39940' : pct >= 40 ? '#fbbf2440' : '#f8717140'
  const initials   = (name: string) => name.split(' ').slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase()

  // ── Pre-computed aggregates ────────────────────────────────────────────────
  const allActs   = summaries.flatMap((u) => u.activities)
  const totalReal = allActs.reduce((s, a) => s + a.real, 0)
  const totalGoal = allActs.reduce((s, a) => s + a.goal, 0)
  const streakReps = summaries.filter((u) => u.daysActive >= 4).length
  const criticalReps = summaries.filter((u) => u.overallCompliance < 40)
  const weekNum   = isMonthly ? null : format(parseISO(weekStart), 'w')
  const generatedAt = format(new Date(), "d 'de' MMMM yyyy 'a las' HH:mm", { locale: es })
  const sorted    = [...summaries].sort((a, b) => b.overallCompliance - a.overallCompliance)

  // ── Company badge from scopeLabel ─────────────────────────────────────────
  const companyName = scopeLabel.split('·')[0].trim()

  // ── AI analysis paragraphs ─────────────────────────────────────────────────
  const aiParagraphs = aiAnalysis
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => {
      const isHeader = /^[A-ZÁÉÍÓÚÑ\s]+:$/.test(l.trim())
      return isHeader
        ? `<p style="margin:18px 0 6px; font-size:10px; font-weight:700; color:#00D9FF; text-transform:uppercase; letter-spacing:0.1em; border-bottom:1px solid #00D9FF22; padding-bottom:4px;">${l}</p>`
        : `<p style="margin:0 0 10px; font-size:13px; color:#cbd5e1; line-height:1.65;">${l}</p>`
    })
    .join('')

  // ── Horizontal bar chart rows ──────────────────────────────────────────────
  const barRows = sorted.map((u) => {
    const w   = Math.min(100, Math.max(0, u.overallCompliance))
    const col = semColor(u.overallCompliance)
    const ini = initials(u.userName)
    return `
    <tr>
      <td style="padding:6px 12px 6px 16px; white-space:nowrap; vertical-align:middle; width:1%;">
        <div style="width:28px; height:28px; border-radius:50%; background:${semBg(u.overallCompliance)}; border:1px solid ${semBorder(u.overallCompliance)}; display:inline-block; text-align:center; line-height:28px; font-size:10px; font-weight:700; color:${col};">${ini}</div>
      </td>
      <td style="padding:6px 8px; white-space:nowrap; vertical-align:middle; font-size:12px; color:#e2e8f0; width:130px;">${u.userName}</td>
      <td style="padding:6px 8px; vertical-align:middle;">
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="padding:0;">
              <div style="background:#1a1a1a; border-radius:3px; height:10px; overflow:hidden;">
                <div style="width:${w}%; background:${col}; height:10px; border-radius:3px;"></div>
              </div>
            </td>
            <td style="padding:0 0 0 8px; white-space:nowrap; font-size:12px; font-weight:700; color:${col}; width:36px;">${u.overallCompliance}%</td>
          </tr>
        </table>
      </td>
      <td style="padding:6px 8px; text-align:center; vertical-align:middle; font-size:13px; color:${trendColor(u.trend)}; width:24px;">${trendIcon(u.trend)}</td>
    </tr>`
  }).join('')

  // ── Full detail table rows ─────────────────────────────────────────────────
  const detailRows = sorted.map((u, i) => {
    const ini = initials(u.userName)
    const col = semColor(u.overallCompliance)
    const actBreakdown = u.activities
      .filter((a) => a.goal > 0)
      .map((a) => {
        const ac = semColor(a.pct)
        const aw = Math.min(100, Math.max(0, a.pct))
        return `<table style="width:100%; border-collapse:collapse; margin-bottom:3px;"><tr>
          <td style="font-size:10px; color:#64748b; white-space:nowrap; padding-right:6px; width:90px;">${a.name}</td>
          <td style="padding:0;"><div style="background:#1a1a1a; border-radius:2px; height:5px; overflow:hidden;"><div style="width:${aw}%; background:${ac}; height:5px;"></div></div></td>
          <td style="font-size:10px; color:${ac}; white-space:nowrap; padding-left:5px; width:32px;">${a.pct}%</td>
        </tr></table>`
      }).join('')

    return `
    <tr style="border-bottom:1px solid #1a1a1a; ${u.overallCompliance < threshold ? 'background:#140a0a;' : i % 2 === 1 ? 'background:#0d0d0d;' : ''}">
      <td style="padding:10px 8px 10px 16px; vertical-align:top; white-space:nowrap;">
        <table style="border-collapse:collapse;"><tr>
          <td style="padding:0; padding-right:8px; vertical-align:middle;">
            <div style="width:30px; height:30px; border-radius:50%; background:${semBg(u.overallCompliance)}; border:1px solid ${semBorder(u.overallCompliance)}; text-align:center; line-height:30px; font-size:10px; font-weight:700; color:${col};">${ini}</div>
          </td>
          <td style="padding:0; vertical-align:middle;">
            <div style="font-size:12px; color:#e2e8f0; font-weight:500;">${u.userName}</div>
            <div style="font-size:10px; color:#475569; margin-top:1px;">${u.daysActive}/5 días activos</div>
          </td>
        </tr></table>
      </td>
      <td style="padding:10px 8px; vertical-align:top;">
        <table style="border-collapse:collapse; margin-bottom:4px;"><tr>
          <td style="padding:0; padding-right:6px;">
            <div style="background:${semBg(u.overallCompliance)}; border:1px solid ${semBorder(u.overallCompliance)}; border-radius:999px; padding:2px 8px; font-size:11px; font-weight:700; color:${col}; white-space:nowrap;">${u.overallCompliance}%</div>
          </td>
          <td style="padding:0; font-size:11px; color:${trendColor(u.trend)};">${trendIcon(u.trend)} ${u.trend === 'improving' ? 'Mejorando' : u.trend === 'declining' ? 'Bajando' : 'Estable'}</td>
        </tr></table>
        ${actBreakdown}
      </td>
      <td style="padding:10px 12px; vertical-align:top; border-left:1px solid #1a1a1a; min-width:160px;">
        <!-- Stage counts row -->
        <table style="border-collapse:collapse; width:100%; margin-bottom:8px;"><tr>
          <td style="padding:0 6px 0 0; text-align:center;">
            <div style="font-size:16px; font-weight:800; color:#00D9FF; line-height:1;">${u.pipeline.stageCounts['Reunión'] ?? 0}</div>
            <div style="font-size:8px; color:#334155; text-transform:uppercase; letter-spacing:0.08em; margin-top:2px;">Reuniones</div>
          </td>
          <td style="padding:0 6px; text-align:center; border-left:1px solid #1a1a1a;">
            <div style="font-size:16px; font-weight:800; color:#fbbf24; line-height:1;">${u.pipeline.stageCounts['Propuesta'] ?? 0}</div>
            <div style="font-size:8px; color:#334155; text-transform:uppercase; letter-spacing:0.08em; margin-top:2px;">Propuestas</div>
          </td>
          <td style="padding:0 0 0 6px; text-align:center; border-left:1px solid #1a1a1a;">
            <div style="font-size:16px; font-weight:800; color:#34d399; line-height:1;">${u.pipeline.stageCounts['Cierre'] ?? 0}</div>
            <div style="font-size:8px; color:#334155; text-transform:uppercase; letter-spacing:0.08em; margin-top:2px;">Cierres</div>
          </td>
        </tr></table>
        <!-- Amounts -->
        <div style="font-size:10px; color:#94a3b8; margin-bottom:2px;">
          <span style="color:#34d399; font-weight:600;">$${u.pipeline.wonAmount.toLocaleString('es-CO')}</span>
          <span style="color:#475569;"> ganado</span>
        </div>
        <div style="font-size:10px; color:#94a3b8; margin-bottom:2px;">
          <span style="color:#fbbf24; font-weight:600;">$${u.pipeline.openAmount.toLocaleString('es-CO')}</span>
          <span style="color:#475569;"> en curso</span>
        </div>
        ${u.pipeline.lostAmount > 0 ? `<div style="font-size:10px; color:#94a3b8;">
          <span style="color:#f87171; font-weight:600;">$${u.pipeline.lostAmount.toLocaleString('es-CO')}</span>
          <span style="color:#475569;"> perdido</span>
        </div>` : ''}
      </td>
    </tr>`
  }).join('')

  // ── Alert rows for critical reps (<40%) ───────────────────────────────────
  const criticalAlerts = criticalReps.length > 0 ? `
  <div style="background:#140606; border:1px solid #f8717140; border-left:3px solid #f87171; border-radius:8px; padding:16px 20px; margin-bottom:20px;">
    <table style="border-collapse:collapse; width:100%; margin-bottom:10px;"><tr>
      <td style="padding:0; vertical-align:middle;">
        <span style="font-size:10px; font-weight:700; color:#f87171; text-transform:uppercase; letter-spacing:0.1em;">&#9888; Alerta — Reps con cumplimiento critico (&lt;40%)</span>
      </td>
    </tr></table>
    ${criticalReps.map((u) => `
    <table style="border-collapse:collapse; width:100%; margin-top:8px;"><tr>
      <td style="padding:0; width:30px; vertical-align:middle; padding-right:10px;">
        <div style="width:28px; height:28px; border-radius:50%; background:#f8717115; border:1px solid #f8717140; text-align:center; line-height:28px; font-size:10px; font-weight:700; color:#f87171;">${initials(u.userName)}</div>
      </td>
      <td style="padding:0; vertical-align:middle;">
        <span style="font-size:12px; color:#f87171; font-weight:600;">${u.userName}</span>
        <span style="font-size:11px; color:#f8717180; margin-left:8px;">${u.overallCompliance}% &nbsp;·&nbsp; ${u.weakest ? `Canal debil: ${u.weakest}` : 'Sin canal debil identificado'}</span>
      </td>
    </tr></table>`).join('')}
  </div>` : ''

  // ── Declining trend alert ──────────────────────────────────────────────────
  const decliningAlert = decliningCount > 0 ? `
  <div style="background:#110e00; border:1px solid #fbbf2440; border-left:3px solid #fbbf24; border-radius:8px; padding:14px 20px; margin-bottom:20px;">
    <span style="font-size:10px; font-weight:700; color:#fbbf24; text-transform:uppercase; letter-spacing:0.1em;">&#9660; Tendencia descendente — ${decliningCount} rep${decliningCount > 1 ? 's' : ''} bajando esta semana</span>
    <p style="margin:6px 0 0; font-size:12px; color:#fbbf2480; line-height:1.5;">
      ${summaries.filter((u) => u.trend === 'declining').map((u) => u.userName).join(', ')}
    </p>
  </div>` : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>Reporte ${isMonthly ? 'Mensual' : 'Semanal'} ProspectPro</title>
  <style>
    #pp-download-bar { position:fixed; top:0; left:0; right:0; z-index:9999; display:flex; align-items:center; justify-content:space-between; padding:10px 24px; background:#0f0f0f; border-bottom:1px solid #1e1e1e; box-shadow:0 2px 12px rgba(0,0,0,0.6); }
    #pp-download-bar span { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:13px; color:#64748b; }
    #pp-download-bar strong { color:#ffffff; }
    #pp-btn-pdf { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; display:inline-flex; align-items:center; gap:8px; padding:8px 20px; background:#00D9FF; color:#0a0a0a; border:none; border-radius:7px; font-size:13px; font-weight:700; cursor:pointer; letter-spacing:-0.01em; transition:opacity 0.15s; }
    #pp-btn-pdf:hover { opacity:0.85; }
    #pp-btn-pdf svg { flex-shrink:0; }
    body { padding-top:56px; }
    @media print {
      #pp-download-bar { display:none !important; }
      body { padding-top:0 !important; background:#ffffff !important; }
      * { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; color-adjust:exact !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background:#0a0a0a; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; -webkit-font-smoothing:antialiased;">

<!-- ── DOWNLOAD BAR ──────────────────────────────────────────────────────── -->
<div id="pp-download-bar">
  <span>ProspectPro &nbsp;·&nbsp; <strong>Reporte ${isMonthly ? 'Mensual' : 'Semanal'}</strong> &nbsp;·&nbsp; ${isMonthly ? weekLabel : `${weekLabel} – ${weekEndLabel}`}</span>
  <button id="pp-btn-pdf" onclick="window.print()">
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    Descargar PDF
  </button>
</div>

<div style="background:#0a0a0a; padding:32px 16px;">
<div style="max-width:660px; margin:0 auto;">

  <!-- ── HEADER ───────────────────────────────────────────────────────────── -->
  <table style="width:100%; border-collapse:collapse; margin-bottom:6px;">
    <tr>
      <td style="padding:28px 32px 24px; background:#0f0f0f; border:1px solid #1e1e1e; border-top:3px solid #00D9FF; border-radius:10px 10px 0 0;">
        <!-- Logo row -->
        <table style="border-collapse:collapse; margin-bottom:16px; width:100%;"><tr>
          <td style="padding:0; vertical-align:middle;">
            <table style="border-collapse:collapse;"><tr>
              <td style="padding:0; padding-right:8px; vertical-align:middle;">
                <div style="width:8px; height:8px; border-radius:50%; background:#00D9FF; display:inline-block;"></div>
              </td>
              <td style="padding:0; vertical-align:middle;">
                <span style="font-size:16px; font-weight:800; color:#ffffff; letter-spacing:0.08em; text-transform:uppercase;">ProspectPro</span>
              </td>
            </tr></table>
          </td>
          <td style="padding:0; text-align:right; vertical-align:middle;">
            <span style="background:#00D9FF18; color:#00D9FF; font-size:9px; font-weight:700; padding:3px 10px; border-radius:999px; border:1px solid #00D9FF35; letter-spacing:0.12em; text-transform:uppercase;">${isMonthly ? 'Reporte Mensual' : 'Reporte Semanal'}</span>
          </td>
        </tr></table>
        <!-- Title -->
        <h1 style="margin:0 0 8px; font-size:26px; font-weight:800; color:#ffffff; line-height:1.15; letter-spacing:-0.02em;">Reporte del Equipo</h1>
        <p style="margin:0 0 14px; font-size:14px; color:#64748b;">
          ${weekNum ? `Semana <strong style="color:#00D9FF;">${weekNum}</strong>&nbsp;&#183;&nbsp;` : ''}
          <strong style="color:#e2e8f0;">${isMonthly ? weekLabel : `${weekLabel} – ${weekEndLabel}`}</strong>
        </p>
        <!-- Badges row -->
        <table style="border-collapse:collapse;"><tr>
          <td style="padding:0; padding-right:8px;">
            <span style="background:#00D9FF12; color:#00D9FF; font-size:10px; font-weight:600; padding:3px 10px; border-radius:999px; border:1px solid #00D9FF30;">${companyName}</span>
          </td>
          <td style="padding:0; padding-right:8px;">
            <span style="background:#a78bfa15; color:#a78bfa; font-size:10px; font-weight:600; padding:3px 10px; border-radius:999px; border:1px solid #a78bfa40;">${memberName ?? 'Equipo completo'}</span>
          </td>
          ${atRiskCount > 0 ? `<td style="padding:0;">
            <span style="background:#f8717115; color:#f87171; font-size:10px; font-weight:600; padding:3px 10px; border-radius:999px; border:1px solid #f8717140;">${atRiskCount} en riesgo</span>
          </td>` : ''}
        </tr></table>
      </td>
    </tr>
  </table>

  <!-- ── KPI CARDS (4) ────────────────────────────────────────────────────── -->
  <table style="width:100%; border-collapse:separate; border-spacing:0; margin-bottom:20px;">
    <tr>
      <td style="padding:1px;">
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            <!-- Cumplimiento promedio -->
            <td style="padding:0; width:25%;">
              <div style="background:#0f0f0f; border:1px solid #1e1e1e; border-top:2px solid #00D9FF; padding:16px 14px; text-align:center; border-radius:0 0 0 8px; margin-right:1px;">
                <div style="font-size:28px; font-weight:800; color:#00D9FF; line-height:1;">${avgCompliance}%</div>
                <div style="font-size:9px; color:#475569; text-transform:uppercase; letter-spacing:0.1em; margin-top:5px;">Cumpl. promedio</div>
              </div>
            </td>
            <!-- Actividades realizadas -->
            <td style="padding:0; width:25%;">
              <div style="background:#0f0f0f; border:1px solid #1e1e1e; border-top:2px solid #34d399; padding:16px 14px; text-align:center; margin-right:1px;">
                <div style="font-size:28px; font-weight:800; color:#34d399; line-height:1;">${totalReal}</div>
                <div style="font-size:9px; color:#475569; text-transform:uppercase; letter-spacing:0.1em; margin-top:5px;">/ ${totalGoal} actividades</div>
              </div>
            </td>
            <!-- En racha -->
            <td style="padding:0; width:25%;">
              <div style="background:#0f0f0f; border:1px solid #1e1e1e; border-top:2px solid #a78bfa; padding:16px 14px; text-align:center; margin-right:1px;">
                <div style="font-size:28px; font-weight:800; color:#a78bfa; line-height:1;">${streakReps}</div>
                <div style="font-size:9px; color:#475569; text-transform:uppercase; letter-spacing:0.1em; margin-top:5px;">En racha (4-5d)</div>
              </div>
            </td>
            <!-- En riesgo -->
            <td style="padding:0; width:25%;">
              <div style="background:#0f0f0f; border:1px solid #1e1e1e; border-top:2px solid #f87171; padding:16px 14px; text-align:center; border-radius:0 0 8px 0;">
                <div style="font-size:28px; font-weight:800; color:${atRiskCount > 0 ? '#f87171' : '#34d399'}; line-height:1;">${atRiskCount}</div>
                <div style="font-size:9px; color:#475569; text-transform:uppercase; letter-spacing:0.1em; margin-top:5px;">En riesgo (&lt;${p.threshold}%)</div>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- ── ACTIVITY INSIGHTS ─────────────────────────────────────────────────── -->
  ${(bestActivity || worstActivity) ? `
  <table style="width:100%; border-collapse:separate; border-spacing:8px; margin-bottom:20px;">
    <tr>
      ${bestActivity ? `<td style="background:#0f0f0f; border:1px solid #34d39930; border-radius:8px; padding:12px 16px; vertical-align:top;">
        <div style="font-size:9px; color:#64748b; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px;">Mejor actividad del equipo</div>
        <div style="font-size:14px; color:#34d399; font-weight:700;">${bestActivity.name}</div>
        <div style="font-size:11px; color:#34d39980; margin-top:2px;">${bestActivity.avgPct}% cumplimiento promedio</div>
      </td>` : '<td></td>'}
      ${worstActivity ? `<td style="background:#0f0f0f; border:1px solid #f8717130; border-radius:8px; padding:12px 16px; vertical-align:top;">
        <div style="font-size:9px; color:#64748b; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px;">Actividad mas debil</div>
        <div style="font-size:14px; color:#f87171; font-weight:700;">${worstActivity.name}</div>
        <div style="font-size:11px; color:#f8717180; margin-top:2px;">${worstActivity.avgPct}% cumplimiento promedio</div>
      </td>` : '<td></td>'}
      <td style="background:#0f0f0f; border:1px solid #1e1e1e; border-radius:8px; padding:12px 16px; vertical-align:top;">
        <div style="font-size:9px; color:#64748b; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px;">Tendencias</div>
        <div style="font-size:13px; color:#34d399; font-weight:600;">&#8593; ${improvingCount} mejorando</div>
        <div style="font-size:13px; color:#f87171; font-weight:600; margin-top:3px;">&#8595; ${decliningCount} bajando</div>
      </td>
    </tr>
  </table>` : ''}

  <!-- ── ALERTAS ───────────────────────────────────────────────────────────── -->
  ${criticalAlerts}
  ${decliningAlert}

  <!-- ── GRÁFICA DE BARRAS HORIZONTAL ────────────────────────────────────── -->
  <div style="background:#0f0f0f; border:1px solid #1e1e1e; border-radius:8px; overflow:hidden; margin-bottom:20px;">
    <div style="padding:12px 16px; border-bottom:1px solid #1a1a1a; background:#111111;">
      <span style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.1em;">Cumplimiento por representante</span>
    </div>
    <table style="width:100%; border-collapse:collapse;">
      ${barRows}
    </table>
  </div>

  <!-- ── TABLA DETALLE COMPLETO ────────────────────────────────────────────── -->
  <div style="background:#0f0f0f; border:1px solid #1e1e1e; border-radius:8px; overflow:hidden; margin-bottom:20px;">
    <div style="padding:12px 16px; border-bottom:1px solid #1a1a1a; background:#111111;">
      <span style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.1em;">Desglose de actividades por representante</span>
    </div>
    <table style="width:100%; border-collapse:collapse;">
      <thead>
        <tr style="background:#111111; border-bottom:1px solid #1e1e1e;">
          <th style="padding:8px 16px; text-align:left; font-size:9px; color:#334155; text-transform:uppercase; letter-spacing:0.08em; font-weight:600;">Representante</th>
          <th style="padding:8px 8px; text-align:left; font-size:9px; color:#334155; text-transform:uppercase; letter-spacing:0.08em; font-weight:600;">Actividades</th>
          <th style="padding:8px 12px; text-align:left; font-size:9px; color:#334155; text-transform:uppercase; letter-spacing:0.08em; font-weight:600; border-left:1px solid #1a1a1a;">Pipeline</th>
        </tr>
      </thead>
      <tbody>${detailRows}</tbody>
    </table>
  </div>

  <!-- ── ANÁLISIS AI ───────────────────────────────────────────────────────── -->
  <div style="background:#050505; border:1px solid #1e1e1e; border-left:3px solid #00D9FF; border-radius:8px; padding:24px; margin-bottom:20px;">
    <table style="border-collapse:collapse; width:100%; margin-bottom:16px;"><tr>
      <td style="padding:0; vertical-align:middle; padding-right:10px;">
        <div style="width:6px; height:6px; border-radius:50%; background:#00D9FF; display:inline-block;"></div>
      </td>
      <td style="padding:0; vertical-align:middle;">
        <span style="font-size:10px; font-weight:700; color:#00D9FF; text-transform:uppercase; letter-spacing:0.14em;">Análisis Coach Pro &nbsp;&#183;&nbsp; IA</span>
      </td>
    </tr></table>
    ${aiParagraphs}
  </div>

  <!-- ── FOOTER ────────────────────────────────────────────────────────────── -->
  <div style="border-top:1px solid #1a1a1a; padding-top:20px; margin-top:8px;">
    <table style="width:100%; border-collapse:collapse;"><tr>
      <td style="padding:0; vertical-align:middle;">
        <div style="font-size:11px; color:#334155; line-height:1.6;">
          <strong style="color:#475569; letter-spacing:0.05em;">PROSPECTPRO</strong> &nbsp;&#183;&nbsp; Generado automaticamente<br>
          ${generatedAt} (hora Colombia)
        </div>
      </td>
      <td style="padding:0; text-align:right; vertical-align:middle;">
        <a href="https://app.prospectpro.cloud/dashboard" style="display:inline-block; background:#00D9FF12; color:#00D9FF; font-size:11px; font-weight:600; padding:7px 14px; border-radius:6px; border:1px solid #00D9FF30; text-decoration:none;">
          Ver dashboard &#8594;
        </a>
      </td>
    </tr></table>
  </div>

</div>
</div>
</body>
</html>`
}

// ─── Helper: resolve weekStart for "now" (timezone-safe) ─────────────────────

export function currentWeekStart(): string {
  // Step 1: today in Bogota — avoids UTC date being "tomorrow" at night
  const today = todayISO()
  const [y, m, d] = today.split('-').map(Number)
  // Step 2: anchor to noon UTC so date-fns works on the correct calendar day
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  // Step 3: startOfWeek returns midnight UTC — must re-anchor to noon before toISODate
  // otherwise toISODate subtracts 5h (Bogota) and rolls back to Sunday
  const mondayMidnightUTC = startOfWeek(anchor, { weekStartsOn: 1 })
  const mondayNoonUTC = new Date(Date.UTC(
    mondayMidnightUTC.getUTCFullYear(),
    mondayMidnightUTC.getUTCMonth(),
    mondayMidnightUTC.getUTCDate(),
    12, 0, 0,
  ))
  return toISODate(mondayNoonUTC)
}
