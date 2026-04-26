import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { fetchGerenteAnalytics, buildGerenteContext } from '@/lib/utils/gerente-ai'

export const maxDuration = 60

const client = new Anthropic()

export async function POST(req: Request) {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await sb
    .from('profiles')
    .select('role, org_role, company, full_name')
    .eq('id', user.id)
    .single()

  const isAdmin   = profile?.role === 'admin'
  const isManager = profile?.org_role === 'manager'
  if (!isAdmin && !isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let messages: { role: 'user' | 'assistant'; content: string }[] = []
  let userIds: string[] = []
  let weeksBack = 12

  try {
    const body = await req.json()
    if (Array.isArray(body.messages)) messages = body.messages
    if (Array.isArray(body.userIds) && body.userIds.length > 0) userIds = body.userIds
    if (typeof body.weeksBack === 'number' && body.weeksBack > 0) weeksBack = body.weeksBack
  } catch { /* defaults */ }

  const service = getSupabaseServiceClient()

  // If no userIds provided, fetch all team members
  if (userIds.length === 0) {
    let q = service.from('profiles').select('id').in('role', ['active', 'admin'])
    if (isManager && !isAdmin) q = q.eq('company', profile!.company as string)
    const { data: members } = await q
    userIds = (members ?? []).map((m) => m.id)
  }

  const analytics = await fetchGerenteAnalytics(service, userIds, weeksBack)
  const context   = buildGerenteContext(analytics, isManager ? profile!.company ?? undefined : undefined)

  const systemPrompt = `Eres el Gerente Virtual AI de ProspectPro, un asistente especializado en análisis de equipos de ventas. Tu rol es ayudar a los managers a entender el desempeño de su equipo, identificar patrones, y tomar decisiones basadas en datos.

Responde siempre en español, de forma concisa, directa y accionable. Usa emojis con moderación para resaltar puntos clave. Cuando identifiques problemas, sugiere acciones concretas.

DATOS ACTUALES DEL EQUIPO:
${context}

Instrucciones:
- Basa todas tus respuestas en los datos reales del equipo mostrados arriba
- Si te preguntan sobre un vendedor específico, da datos precisos de esa persona
- Identifica patrones de comportamiento, no solo números
- Sé proactivo: si ves algo preocupante en los datos, mencionalo
- Cuando hagas comparaciones, usa los datos reales de cumplimiento
- Si no tienes datos suficientes para responder algo, dilo claramente`

  const stream = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 1024,
    system:     systemPrompt,
    messages,
    stream:     true,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
      } finally {
        controller.close()
      }
    },
  })

  return new NextResponse(readable, {
    headers: {
      'Content-Type':      'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'X-Accel-Buffering': 'no',
    },
  })
}
