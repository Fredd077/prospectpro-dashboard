/**
 * Team report generator — shared between manual API and weekly cron.
 * Aggregates per-user weekly context, calls Claude for team analysis,
 * sends HTML email via Resend, and saves to coach_messages.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import { buildWeeklyContextForCron, type ActivityCompliance } from './coach-context'
import { todayISO, toISODate } from './dates'
import { startOfWeek, endOfWeek } from 'date-fns'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

type SbClient = SupabaseClient<Database>

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface TeamReportOptions {
  scope: 'team' | 'at_risk'
  weekStart: string
  adminUserId: string
  adminEmail: string
  triggeredBy: 'auto' | 'manual'
  /** Pre-filter: only include these user IDs (undefined = all) */
  filterUserIds?: string[]
  /** Pre-filter: only include users from this company (undefined = all) */
  filterCompany?: string
  /** at_risk threshold — users below this % are considered at risk (default 70) */
  threshold?: number
}

export interface TeamReportResult {
  success: boolean
  sentTo: string
  generatedAt: string
  id: string | null
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
}

// ─── Timezone-safe week range ─────────────────────────────────────────────────
// Uses the same UTC-noon anchor pattern as dashboard/page.tsx to avoid
// the UTC-to-Bogota rollback that turns Monday into Sunday.

function safeWeekRange(isoWeekStart: string): { weekStart: string; weekEnd: string } {
  // If caller already provides a weekStart, derive weekEnd from it using anchor
  const [y, m, d] = isoWeekStart.split('-').map(Number)
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  return {
    weekStart: toISODate(startOfWeek(anchor, { weekStartsOn: 1 })),
    weekEnd:   toISODate(endOfWeek(anchor,   { weekStartsOn: 1 })),
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function generateTeamReport(
  opts: TeamReportOptions,
  sb: SbClient,
): Promise<TeamReportResult> {
  const { scope, adminUserId, adminEmail, triggeredBy,
          filterUserIds, filterCompany, threshold = 70 } = opts

  // ── Problem 1 fix: recompute weekStart/weekEnd with timezone-safe anchor ──
  const { weekStart, weekEnd } = safeWeekRange(opts.weekStart)

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

  // 2. Build weekly context for each user (sequential to avoid DB overload)
  const summaries: UserSummary[] = []
  for (const user of users) {
    try {
      // ── Problem 2 fix: pass corrected weekStart so context queries right range
      const ctx = await buildWeeklyContextForCron(user.id, weekStart, sb)
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
  const weekLabel    = format(parseISO(weekStart), "d 'de' MMMM", { locale: es })
  const weekEndLabel = format(parseISO(weekEnd),   "d 'de' MMMM yyyy", { locale: es })

  const repLines = sorted
    .map((u, i) => {
      const actBreakdown = u.activities
        .map((a) => `${a.name}: ${a.real}/${a.goal} (${a.pct}%)`)
        .join(' | ')
      return (
        `${i + 1}. ${u.userName} — ${u.overallCompliance}% cumplimiento | ` +
        `Tendencia: ${u.trend} | Días activos: ${u.daysActive}/5\n` +
        `   Actividades: ${actBreakdown}\n` +
        `   Canal fuerte: ${u.strongest ?? 'N/A'} | Canal débil: ${u.weakest ?? 'N/A'} | ` +
        `Meta mensual: ${u.monthlyAchievedPct}%`
      )
    })
    .join('\n\n')

  const prompt = `ANÁLISIS DE EQUIPO — ProspectPro
Período: ${weekLabel} – ${weekEndLabel}
Scope: ${scope === 'at_risk' ? `Solo reps en riesgo (<${threshold}%)` : 'Equipo completo'}

MÉTRICAS DEL EQUIPO:
- Reps analizados: ${filtered.length}
- Cumplimiento promedio: ${avgCompliance}%
- Reps en riesgo (<${threshold}%): ${atRisk.length}
- Tendencia positiva (↑): ${improvingCount} | Tendencia negativa (↓): ${decliningCount}
- Actividad con mejor cumplimiento del equipo: ${bestActivity ? `${bestActivity.name} (${bestActivity.avgPct}%)` : 'N/A'}
- Actividad con peor cumplimiento del equipo: ${worstActivity ? `${worstActivity.name} (${worstActivity.avgPct}%)` : 'N/A'}

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

ANÁLISIS INDIVIDUAL — REQUIEREN ATENCIÓN: Para cada rep bajo ${threshold}%, UNA recomendación específica y accionable. Nombra la actividad exacta y el número concreto que deben alcanzar.

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
    weekLabel,
    weekEndLabel,
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
  })

  // 8. Send via Resend
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'ProspectPro Reports <onboarding@resend.dev>',
      to: adminEmail,
      subject: `Reporte de equipo — ${weekLabel}–${weekEndLabel} (${scope === 'at_risk' ? 'En riesgo' : 'Completo'})`,
      html,
    }),
  })

  if (!resendRes.ok) {
    const errText = await resendRes.text()
    throw new Error(`[team-report] Resend failed: ${errText}`)
  }

  // 9. Save to coach_messages under admin user
  const generatedAt = new Date().toISOString()
  let savedId: string | null = null
  try {
    const { data } = await sb
      .from('coach_messages')
      .insert({
        user_id:       adminUserId,
        type:          'team_report',
        message:       aiAnalysis,
        period_date:   generatedAt,
        is_read:       false,
        triggered_by:  triggeredBy,
        report_scope:  scope,
        sent_to_email: adminEmail,
      } as never)
      .select('id')
      .single()
    savedId = (data as { id: string } | null)?.id ?? null
  } catch (err) {
    console.error('[team-report] Failed to save record:', err)
  }

  return { success: true, sentTo: adminEmail, generatedAt, id: savedId }
}

// ─── Email builder ────────────────────────────────────────────────────────────

function buildTeamReportEmail(p: {
  weekLabel:      string
  weekEndLabel:   string
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
}): string {
  const { weekLabel, weekEndLabel, scope, threshold, summaries, atRiskCount, avgCompliance,
          improvingCount, decliningCount, top3, bottom3, bestActivity, worstActivity,
          aiAnalysis } = p

  const trendIcon  = (t: string) => (t === 'improving' ? '↑' : t === 'declining' ? '↓' : '→')
  const trendColor = (t: string) =>
    t === 'improving' ? '#34d399' : t === 'declining' ? '#f87171' : '#94a3b8'

  // Main ranking table rows
  const sorted = [...summaries].sort((a, b) => b.overallCompliance - a.overallCompliance)
  const repRows = sorted
    .map((u, i) => {
      const barW     = Math.min(100, Math.max(0, u.overallCompliance))
      const barColor = u.overallCompliance >= 80 ? '#34d399' : u.overallCompliance >= 60 ? '#fbbf24' : '#f87171'
      const isRisk   = u.overallCompliance < threshold

      // Per-user activity mini bars
      const actBars = u.activities
        .filter((a) => a.goal > 0)
        .map((a) => {
          const w  = Math.min(100, Math.max(0, a.pct))
          const bc = a.pct >= 80 ? '#34d399' : a.pct >= 60 ? '#fbbf24' : '#f87171'
          return `<div style="display:flex; align-items:center; gap:6px; margin-bottom:3px;">
            <span style="font-size:10px; color:#64748b; min-width:80px;">${a.name}</span>
            <div style="background:#1a1a1a; border-radius:2px; overflow:hidden; width:70px; height:5px; flex-shrink:0;">
              <div style="width:${w}%; background:${bc}; height:5px;"></div>
            </div>
            <span style="font-size:10px; color:${bc};">${a.pct}%</span>
          </div>`
        })
        .join('')

      return `
      <tr style="border-bottom:1px solid #1e1e1e; ${isRisk ? 'background:#1a0a0a;' : ''}">
        <td style="padding:10px 12px; font-size:13px; color:#e2e8f0; white-space:nowrap;">
          <span style="color:#475569; font-size:11px; margin-right:6px;">${i + 1}.</span>
          ${u.userName}
          ${isRisk ? '<span style="margin-left:6px; background:#f87171/15; color:#f87171; font-size:9px; font-weight:700; padding:1px 5px; border-radius:999px; border:1px solid #f8717140;">RIESGO</span>' : ''}
        </td>
        <td style="padding:10px 12px; vertical-align:top;">
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
            <div style="background:#1a1a1a; border-radius:4px; overflow:hidden; width:100px; height:8px;">
              <div style="width:${barW}%; background:${barColor}; height:8px; border-radius:4px;"></div>
            </div>
            <span style="font-size:12px; color:${barColor}; font-weight:700;">${u.overallCompliance}%</span>
          </div>
          ${actBars}
        </td>
        <td style="padding:10px 12px; font-size:13px; color:${trendColor(u.trend)}; text-align:center; vertical-align:top;">${trendIcon(u.trend)}</td>
        <td style="padding:10px 12px; font-size:12px; color:#94a3b8; text-align:center; vertical-align:top;">${u.daysActive}/5</td>
      </tr>`
    })
    .join('')

  // Top/Bottom spotlight rows
  const spotlightRow = (u: UserSummary, rank: string, color: string) => `
    <tr style="border-bottom:1px solid #1e1e1e;">
      <td style="padding:8px 12px; font-size:11px; color:${color}; font-weight:700; white-space:nowrap;">${rank}</td>
      <td style="padding:8px 12px; font-size:13px; color:#e2e8f0;">${u.userName}</td>
      <td style="padding:8px 12px; font-size:12px; color:${u.overallCompliance >= 80 ? '#34d399' : u.overallCompliance >= 60 ? '#fbbf24' : '#f87171'}; font-weight:700;">${u.overallCompliance}%</td>
      <td style="padding:8px 12px; font-size:12px; color:${trendColor(u.trend)};">${trendIcon(u.trend)}</td>
    </tr>`

  const top3Rows    = top3.map((u, i)    => spotlightRow(u, `#${i + 1}`, '#34d399')).join('')
  const bottom3Rows = bottom3.map((u, i) => spotlightRow(u, `⚠ ${i + 1}`, '#f87171')).join('')

  // AI analysis — detect section headers (all-caps lines ending in colon)
  const aiParagraphs = aiAnalysis
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => {
      const isHeader = l.trimEnd().endsWith(':') && l === l.toUpperCase()
      return isHeader
        ? `<p style="margin:16px 0 6px 0; font-size:11px; font-weight:700; color:#00D9FF; text-transform:uppercase; letter-spacing:0.08em;">${l}</p>`
        : `<p style="margin:0 0 8px 0; font-size:13px; color:#cbd5e1; line-height:1.6;">${l}</p>`
    })
    .join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0; padding:0; background:#0a0a0a; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:660px; margin:0 auto; padding:24px 16px;">

  <!-- Header -->
  <div style="background:#0f0f0f; border:1px solid #1e1e1e; border-top:3px solid #00D9FF; border-radius:8px; padding:24px; margin-bottom:20px;">
    <div style="margin-bottom:8px;">
      <span style="font-size:18px; font-weight:800; color:#00D9FF; letter-spacing:0.05em;">PROSPECTPRO</span>
      <span style="margin-left:10px; background:#00D9FF22; color:#00D9FF; font-size:10px; font-weight:700; padding:2px 8px; border-radius:999px; letter-spacing:0.1em; text-transform:uppercase;">Reporte de Equipo</span>
    </div>
    <p style="margin:0; font-size:13px; color:#94a3b8;">
      ${scope === 'at_risk' ? `Solo reps en riesgo (&lt;${threshold}%)` : 'Equipo completo'} &nbsp;·&nbsp;
      <strong style="color:#e2e8f0;">${weekLabel} – ${weekEndLabel}</strong>
    </p>
  </div>

  <!-- KPI bar -->
  <table style="width:100%; border-collapse:separate; border-spacing:10px; margin-bottom:20px;">
    <tr>
      <td style="background:#0f0f0f; border:1px solid #1e1e1e; border-top:2px solid #00D9FF; border-radius:8px; padding:14px 12px; text-align:center;">
        <div style="font-size:26px; font-weight:800; color:#00D9FF;">${avgCompliance}%</div>
        <div style="font-size:9px; color:#64748b; text-transform:uppercase; letter-spacing:0.1em; margin-top:3px;">Cumpl. promedio</div>
      </td>
      <td style="background:#0f0f0f; border:1px solid #1e1e1e; border-top:2px solid #34d399; border-radius:8px; padding:14px 12px; text-align:center;">
        <div style="font-size:26px; font-weight:800; color:#34d399;">${summaries.length}</div>
        <div style="font-size:9px; color:#64748b; text-transform:uppercase; letter-spacing:0.1em; margin-top:3px;">Reps analizados</div>
      </td>
      <td style="background:#0f0f0f; border:1px solid #1e1e1e; border-top:2px solid #f87171; border-radius:8px; padding:14px 12px; text-align:center;">
        <div style="font-size:26px; font-weight:800; color:${atRiskCount > 0 ? '#f87171' : '#34d399'};">${atRiskCount}</div>
        <div style="font-size:9px; color:#64748b; text-transform:uppercase; letter-spacing:0.1em; margin-top:3px;">En riesgo</div>
      </td>
      <td style="background:#0f0f0f; border:1px solid #1e1e1e; border-top:2px solid #fbbf24; border-radius:8px; padding:14px 12px; text-align:center;">
        <div style="font-size:26px; font-weight:800; color:#fbbf24;">${decliningCount}</div>
        <div style="font-size:9px; color:#64748b; text-transform:uppercase; letter-spacing:0.1em; margin-top:3px;">Tendencia ↓</div>
      </td>
      <td style="background:#0f0f0f; border:1px solid #1e1e1e; border-top:2px solid #34d399; border-radius:8px; padding:14px 12px; text-align:center;">
        <div style="font-size:26px; font-weight:800; color:#34d399;">${improvingCount}</div>
        <div style="font-size:9px; color:#64748b; text-transform:uppercase; letter-spacing:0.1em; margin-top:3px;">Tendencia ↑</div>
      </td>
    </tr>
  </table>

  <!-- Best/Worst activity pills -->
  ${(bestActivity || worstActivity) ? `
  <div style="display:flex; gap:10px; margin-bottom:20px; flex-wrap:wrap;">
    ${bestActivity ? `<div style="background:#0f0f0f; border:1px solid #34d39940; border-radius:6px; padding:8px 14px; flex:1; min-width:180px;">
      <div style="font-size:9px; color:#64748b; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:3px;">Mejor actividad del equipo</div>
      <div style="font-size:13px; color:#34d399; font-weight:700;">${bestActivity.name} <span style="font-weight:400;">(${bestActivity.avgPct}%)</span></div>
    </div>` : ''}
    ${worstActivity ? `<div style="background:#0f0f0f; border:1px solid #f8717140; border-radius:6px; padding:8px 14px; flex:1; min-width:180px;">
      <div style="font-size:9px; color:#64748b; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:3px;">Actividad más débil del equipo</div>
      <div style="font-size:13px; color:#f87171; font-weight:700;">${worstActivity.name} <span style="font-weight:400;">(${worstActivity.avgPct}%)</span></div>
    </div>` : ''}
  </div>` : ''}

  <!-- Spotlight: Top 3 / Bottom 3 -->
  <table style="width:100%; border-collapse:separate; border-spacing:10px; margin-bottom:20px;">
    <tr>
      <td style="vertical-align:top; width:50%;">
        <div style="background:#0f0f0f; border:1px solid #1e1e1e; border-top:2px solid #34d399; border-radius:8px; overflow:hidden;">
          <div style="padding:10px 12px; border-bottom:1px solid #1e1e1e;">
            <span style="font-size:10px; font-weight:700; color:#34d399; text-transform:uppercase; letter-spacing:0.1em;">Top rendimiento</span>
          </div>
          <table style="width:100%; border-collapse:collapse;">${top3Rows}</table>
        </div>
      </td>
      <td style="vertical-align:top; width:50%;">
        <div style="background:#0f0f0f; border:1px solid #f8717130; border-top:2px solid #f87171; border-radius:8px; overflow:hidden;">
          <div style="padding:10px 12px; border-bottom:1px solid #1e1e1e;">
            <span style="font-size:10px; font-weight:700; color:#f87171; text-transform:uppercase; letter-spacing:0.1em;">Requieren atención</span>
          </div>
          <table style="width:100%; border-collapse:collapse;">${bottom3Rows}</table>
        </div>
      </td>
    </tr>
  </table>

  <!-- Full rep table with activity breakdown -->
  <div style="background:#0f0f0f; border:1px solid #1e1e1e; border-radius:8px; overflow:hidden; margin-bottom:20px;">
    <div style="padding:12px 16px; border-bottom:1px solid #1e1e1e;">
      <span style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.1em;">Desglose por representante</span>
    </div>
    <table style="width:100%; border-collapse:collapse;">
      <thead>
        <tr style="background:#111111;">
          <th style="padding:8px 12px; text-align:left; font-size:9px; color:#475569; text-transform:uppercase; letter-spacing:0.1em;">Rep</th>
          <th style="padding:8px 12px; text-align:left; font-size:9px; color:#475569; text-transform:uppercase; letter-spacing:0.1em;">Cumplimiento por actividad</th>
          <th style="padding:8px 12px; text-align:center; font-size:9px; color:#475569; text-transform:uppercase; letter-spacing:0.1em;">Tend.</th>
          <th style="padding:8px 12px; text-align:center; font-size:9px; color:#475569; text-transform:uppercase; letter-spacing:0.1em;">Días</th>
        </tr>
      </thead>
      <tbody>${repRows}</tbody>
    </table>
  </div>

  <!-- AI Analysis -->
  <div style="background:#0f0f0f; border:1px solid #1e1e1e; border-left:3px solid #00D9FF; border-radius:8px; padding:20px; margin-bottom:20px;">
    <p style="margin:0 0 14px 0; font-size:10px; font-weight:700; color:#00D9FF; text-transform:uppercase; letter-spacing:0.12em;">Análisis de IA · Coach Pro</p>
    ${aiParagraphs}
  </div>

  <!-- Footer -->
  <p style="text-align:center; font-size:11px; color:#334155; margin-top:20px;">
    ProspectPro · Reporte generado automáticamente<br>
    <span style="color:#1e293b;">Para dejar de recibir estos reportes, configúralo en el Admin Dashboard.</span>
  </p>

</div>
</body>
</html>`
}

// ─── Helper: resolve weekStart for "now" (timezone-safe) ─────────────────────

export function currentWeekStart(): string {
  // Uses today in Bogota timezone + UTC-noon anchor to avoid UTC→local rollback
  const today = todayISO()
  const [y, m, d] = today.split('-').map(Number)
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  return toISODate(startOfWeek(anchor, { weekStartsOn: 1 }))
}
