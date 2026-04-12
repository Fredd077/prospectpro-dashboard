/**
 * Team report generator — shared between manual API and weekly cron.
 * Aggregates per-user weekly context, calls Claude for team analysis,
 * sends HTML email via Resend, and saves to coach_messages.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import { buildWeeklyContextForCron } from './coach-context'
import { toISODate } from './dates'
import { startOfWeek, parseISO } from 'date-fns'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

type SbClient = SupabaseClient<Database>

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface TeamReportOptions {
  scope: 'team' | 'at_risk'
  weekStart: string
  adminUserId: string
  adminEmail: string
  triggeredBy: 'auto' | 'manual'
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
  daysActive: number
  monthlyAchievedPct: number
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function generateTeamReport(
  opts: TeamReportOptions,
  sb: SbClient,
): Promise<TeamReportResult> {
  const { scope, weekStart, adminUserId, adminEmail, triggeredBy } = opts

  // 1. Fetch all active + admin users
  const { data: users, error: usersErr } = await sb
    .from('profiles')
    .select('id, full_name')
    .in('role', ['active', 'admin'])

  if (usersErr || !users?.length) {
    throw new Error(`[team-report] Could not fetch users: ${usersErr?.message ?? 'empty'}`)
  }

  // 2. Build weekly context for each user (parallel, cap at 10 concurrent)
  const summaries: UserSummary[] = []
  for (const user of users) {
    try {
      const ctx = await buildWeeklyContextForCron(user.id, weekStart, sb)
      summaries.push({
        userId: user.id,
        userName: ctx.userName,
        overallCompliance: ctx.overallCompliance,
        trend: ctx.trend,
        weakest: ctx.weakestActivity?.name ?? null,
        daysActive: ctx.streak,
        monthlyAchievedPct: ctx.monthlyProgress?.achievedPct ?? 0,
      })
    } catch (err) {
      console.error(`[team-report] Context failed for ${user.id}:`, err)
    }
  }

  if (!summaries.length) throw new Error('[team-report] No user summaries generated')

  // 3. Filter by scope
  const filtered =
    scope === 'at_risk' ? summaries.filter((u) => u.overallCompliance < 70) : summaries

  const atRisk = summaries.filter((u) => u.overallCompliance < 70)
  const avgCompliance =
    filtered.length
      ? Math.round(filtered.reduce((s, u) => s + u.overallCompliance, 0) / filtered.length)
      : 0

  // 4. Build prompt for Claude
  const weekLabel = format(parseISO(weekStart), "d 'de' MMMM yyyy", { locale: es })
  const repLines = filtered
    .sort((a, b) => b.overallCompliance - a.overallCompliance)
    .map(
      (u) =>
        `• ${u.userName}: ${u.overallCompliance}% cumplimiento | Tendencia: ${u.trend} | ` +
        `Canal débil: ${u.weakest ?? 'N/A'} | Días activos: ${u.daysActive}/5 | ` +
        `Meta mensual: ${u.monthlyAchievedPct}%`,
    )
    .join('\n')

  const prompt = `ANÁLISIS DE EQUIPO — ProspectPro
Período: semana del ${weekLabel}
Scope: ${scope === 'at_risk' ? 'Solo reps en riesgo (<70%)' : 'Equipo completo'}

RESUMEN:
- Reps analizados: ${filtered.length}
- Cumplimiento promedio del equipo: ${avgCompliance}%
- Reps en riesgo (<70%): ${atRisk.length}

DETALLE POR REP:
${repLines}

Genera un análisis del equipo para el manager en 5 secciones claramente separadas:
1. DIAGNÓSTICO GENERAL (2 líneas): estado del equipo esta semana.
2. FORTALEZA DEL EQUIPO: qué patrón positivo comparte la mayoría.
3. BRECHA PRINCIPAL: el problema más común entre los reps.
4. REPS EN RIESGO: análisis específico de quienes están bajo 70%, con nombres.
5. RECOMENDACIÓN PARA EL MANAGER: UNA acción concreta y medible para esta semana.

Reglas: sin markdown (* o #). Sección en mayúsculas seguida de dos puntos. Máximo 500 palabras. Responde en español.`

  // 5. Call Claude
  const aiResp = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  })
  const aiAnalysis = aiResp.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  // 6. Build HTML email
  const html = buildTeamReportEmail({
    weekLabel,
    scope,
    summaries: filtered,
    atRiskCount: atRisk.length,
    avgCompliance,
    aiAnalysis,
  })

  // 7. Send via Resend
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'ProspectPro Reports <onboarding@resend.dev>',
      to: adminEmail,
      subject: `Reporte de equipo — ${weekLabel} (${scope === 'at_risk' ? 'En riesgo' : 'Completo'})`,
      html,
    }),
  })

  if (!resendRes.ok) {
    const errText = await resendRes.text()
    throw new Error(`[team-report] Resend failed: ${errText}`)
  }

  // 8. Save to coach_messages under admin user
  const generatedAt = new Date().toISOString()
  let savedId: string | null = null
  try {
    const { data } = await sb
      .from('coach_messages')
      .insert({
        user_id: adminUserId,
        type: 'team_report',
        message: aiAnalysis,
        period_date: generatedAt,         // full timestamp = always unique
        is_read: false,
        triggered_by: triggeredBy,
        report_scope: scope,
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
  weekLabel: string
  scope: 'team' | 'at_risk'
  summaries: UserSummary[]
  atRiskCount: number
  avgCompliance: number
  aiAnalysis: string
}): string {
  const { weekLabel, scope, summaries, atRiskCount, avgCompliance, aiAnalysis } = p

  const trendIcon = (t: string) => (t === 'improving' ? '↑' : t === 'declining' ? '↓' : '→')
  const trendColor = (t: string) =>
    t === 'improving' ? '#34d399' : t === 'declining' ? '#f87171' : '#94a3b8'

  const repRows = summaries
    .sort((a, b) => b.overallCompliance - a.overallCompliance)
    .map((u) => {
      const barW = Math.min(100, Math.max(0, u.overallCompliance))
      const barColor =
        u.overallCompliance >= 80 ? '#34d399' : u.overallCompliance >= 60 ? '#fbbf24' : '#f87171'
      return `
      <tr style="border-bottom:1px solid #1e1e1e;">
        <td style="padding:10px 12px; font-size:13px; color:#e2e8f0;">${u.userName}</td>
        <td style="padding:10px 12px;">
          <div style="background:#1a1a1a; border-radius:4px; overflow:hidden; width:120px; height:8px;">
            <div style="width:${barW}%; background:${barColor}; height:8px; border-radius:4px;"></div>
          </div>
          <span style="font-size:11px; color:${barColor}; margin-left:6px;">${u.overallCompliance}%</span>
        </td>
        <td style="padding:10px 12px; font-size:12px; color:${trendColor(u.trend)}; text-align:center;">
          ${trendIcon(u.trend)}
        </td>
        <td style="padding:10px 12px; font-size:12px; color:#94a3b8; text-align:center;">
          ${u.daysActive}/5
        </td>
        <td style="padding:10px 12px; font-size:12px; color:#94a3b8;">${u.weakest ?? '—'}</td>
      </tr>`
    })
    .join('')

  const aiParagraphs = aiAnalysis
    .split('\n')
    .filter((l) => l.trim())
    .map(
      (l) =>
        `<p style="margin:0 0 10px 0; font-size:14px; color:${l === l.toUpperCase() && l.includes(':') ? '#00D9FF' : '#cbd5e1'}; ${l === l.toUpperCase() && l.includes(':') ? 'font-weight:700; margin-top:16px;' : ''}">${l}</p>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0; padding:0; background:#0a0a0a; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:640px; margin:0 auto; padding:24px 16px;">

    <!-- Header -->
    <div style="background:#0f0f0f; border:1px solid #1e1e1e; border-top:3px solid #00D9FF; border-radius:8px; padding:24px; margin-bottom:20px;">
      <div style="display:flex; align-items:center; margin-bottom:6px;">
        <span style="font-size:18px; font-weight:800; color:#00D9FF; letter-spacing:0.05em;">PROSPECTPRO</span>
        <span style="margin-left:10px; background:#00D9FF22; color:#00D9FF; font-size:10px; font-weight:700; padding:2px 8px; border-radius:999px; letter-spacing:0.1em; text-transform:uppercase;">Reporte de Equipo</span>
      </div>
      <p style="margin:0; font-size:13px; color:#64748b;">
        ${scope === 'at_risk' ? 'Solo reps en riesgo' : 'Equipo completo'} · Semana del ${weekLabel}
      </p>
    </div>

    <!-- KPIs -->
    <div style="display:table; width:100%; border-spacing:12px; margin-bottom:20px;">
      <div style="display:table-cell; background:#0f0f0f; border:1px solid #1e1e1e; border-top:2px solid #00D9FF; border-radius:8px; padding:16px; text-align:center;">
        <div style="font-size:28px; font-weight:800; color:#00D9FF;">${avgCompliance}%</div>
        <div style="font-size:10px; color:#64748b; text-transform:uppercase; letter-spacing:0.1em; margin-top:4px;">Cumplimiento promedio</div>
      </div>
    </div>
    <table style="width:100%; border-spacing:12px; border-collapse:separate; margin-bottom:20px;">
      <tr>
        <td style="background:#0f0f0f; border:1px solid #1e1e1e; border-top:2px solid #34d399; border-radius:8px; padding:16px; text-align:center;">
          <div style="font-size:24px; font-weight:800; color:#34d399;">${summaries.length}</div>
          <div style="font-size:10px; color:#64748b; text-transform:uppercase; letter-spacing:0.1em; margin-top:4px;">Reps analizados</div>
        </td>
        <td style="background:#0f0f0f; border:1px solid #1e1e1e; border-top:2px solid #f87171; border-radius:8px; padding:16px; text-align:center;">
          <div style="font-size:24px; font-weight:800; color:${atRiskCount > 0 ? '#f87171' : '#34d399'};">${atRiskCount}</div>
          <div style="font-size:10px; color:#64748b; text-transform:uppercase; letter-spacing:0.1em; margin-top:4px;">En riesgo (&lt;70%)</div>
        </td>
        <td style="background:#0f0f0f; border:1px solid #1e1e1e; border-top:2px solid #fbbf24; border-radius:8px; padding:16px; text-align:center;">
          <div style="font-size:24px; font-weight:800; color:#fbbf24;">${summaries.filter((u) => u.trend === 'declining').length}</div>
          <div style="font-size:10px; color:#64748b; text-transform:uppercase; letter-spacing:0.1em; margin-top:4px;">Tendencia negativa</div>
        </td>
      </tr>
    </table>

    <!-- Rep table -->
    <div style="background:#0f0f0f; border:1px solid #1e1e1e; border-radius:8px; overflow:hidden; margin-bottom:20px;">
      <div style="padding:14px 16px; border-bottom:1px solid #1e1e1e;">
        <span style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.1em;">Estado por representante</span>
      </div>
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="background:#111;">
            <th style="padding:8px 12px; text-align:left; font-size:10px; color:#475569; text-transform:uppercase; letter-spacing:0.1em;">Rep</th>
            <th style="padding:8px 12px; text-align:left; font-size:10px; color:#475569; text-transform:uppercase; letter-spacing:0.1em;">Cumplimiento</th>
            <th style="padding:8px 12px; text-align:center; font-size:10px; color:#475569; text-transform:uppercase; letter-spacing:0.1em;">Tendencia</th>
            <th style="padding:8px 12px; text-align:center; font-size:10px; color:#475569; text-transform:uppercase; letter-spacing:0.1em;">Días activos</th>
            <th style="padding:8px 12px; text-align:left; font-size:10px; color:#475569; text-transform:uppercase; letter-spacing:0.1em;">Canal débil</th>
          </tr>
        </thead>
        <tbody>${repRows}</tbody>
      </table>
    </div>

    <!-- AI Analysis -->
    <div style="background:#0f0f0f; border:1px solid #1e1e1e; border-left:3px solid #00D9FF; border-radius:8px; padding:20px; margin-bottom:20px;">
      <p style="margin:0 0 16px 0; font-size:11px; font-weight:700; color:#00D9FF; text-transform:uppercase; letter-spacing:0.1em;">Análisis de IA · Coach Pro</p>
      ${aiParagraphs}
    </div>

    <!-- Footer -->
    <p style="text-align:center; font-size:11px; color:#334155; margin-top:24px;">
      ProspectPro · Reporte generado automáticamente<br>
      <span style="color:#1e293b;">Para dejar de recibir estos reportes, configúralo en el Admin Dashboard.</span>
    </p>

  </div>
</body>
</html>`
}

// ─── Helper: resolve weekStart for "now" ─────────────────────────────────────

export function currentWeekStart(): string {
  return toISODate(startOfWeek(new Date(), { weekStartsOn: 1 }))
}
