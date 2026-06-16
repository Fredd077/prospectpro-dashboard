import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { getMiDiaData, resolveRefDate } from '@/lib/queries/mi-dia'
import { getAiConfig, buildSystemPrompt } from '@/lib/utils/ai-config'
import { todayISO } from '@/lib/utils/dates'

export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function GET(req: Request) {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const today = todayISO()
  const { searchParams } = new URL(req.url)
  const date = resolveRefDate(searchParams.get('date') ?? undefined) // válido, no futuro; si no, hoy

  // 1. ¿Ya existe el brief de ese día? Devolverlo de inmediato (1 llamada IA/usuario/día).
  try {
    const { data: existing } = await sb
      .from('daily_briefs')
      .select('content')
      .eq('user_id', user.id)
      .eq('brief_date', date)
      .maybeSingle()
    if (existing?.content) return Response.json({ brief: existing.content, cached: true })
  } catch {
    // Tabla daily_briefs aún no aplicada — seguimos y devolvemos sin cachear.
  }

  // Días pasados: solo se muestra el brief guardado ese día; nunca se genera uno nuevo.
  if (date !== today) return Response.json({ brief: null })

  // 2. Reunir el contexto (mismos datos que la página).
  const data = await getMiDiaData(sb, user.id)
  if (!data.hasScenario) return Response.json({ brief: null })

  const recoveryLine = data.recovery && data.recovery.unitsNeeded > 0
    ? `Para cerrar la semana al 100% faltan ${data.recovery.unitsNeeded} de ${data.recovery.activityName}.`
    : 'La semana va al día en la actividad más efectiva.'
  const channelLine = data.topChannel
    ? `Canal a priorizar hoy: ${data.topChannel.name} (${data.topChannel.conversionToMeeting}% conversión a cita).`
    : 'Sin datos de efectividad de canal todavía.'
  const alertsLine = data.alerts.length > 0
    ? `${data.alerts.length} oportunidad(es) frenada(s) >7 días por un total de $${data.alertsTotalAmount.toLocaleString('es-CO')}.`
    : 'Sin oportunidades frenadas en el pipeline.'

  const context = [
    `Vendedor: ${data.userName}.`,
    `Semana: cumplimiento ${data.weekCompliancePct}% de la meta semanal (desviación ${data.weekDeviationPct}%). ${recoveryLine}`,
    channelLine,
    alertsLine,
    `Proyección de cierre del mes al ritmo actual: ${data.projectionPct}% de la meta mensual.`,
  ].join('\n')

  // 3. Una sola llamada corta a Claude.
  let brief = ''
  try {
    const service = getSupabaseServiceClient()
    const config = await getAiConfig('mi_dia', service)
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: config.maxTokens,
      system: buildSystemPrompt(config),
      messages: [{ role: 'user', content: `Datos de hoy:\n${context}\n\nGenera el brief del día (máximo 3 frases).` }],
    })
    brief = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join(' ')
      .trim()
  } catch (err) {
    console.error('[api/mi-dia] AI error:', err)
    // Fallback determinista si la IA falla — la página nunca se queda sin brief.
    brief = `${recoveryLine} ${channelLine} ${alertsLine}`
  }

  // 4. Guardar (idempotente por user_id + brief_date). Si la tabla no existe, no rompemos.
  try {
    await sb.from('daily_briefs').upsert(
      { user_id: user.id, brief_date: today, content: brief },
      { onConflict: 'user_id,brief_date' },
    )
  } catch (err) {
    console.error('[api/mi-dia] save skipped:', err)
  }

  return Response.json({ brief })
}
