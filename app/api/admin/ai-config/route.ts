import { NextResponse } from 'next/server'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { getAllAiConfigs, invalidateAiConfigCache, AI_SECTIONS } from '@/lib/utils/ai-config'

// ── Auth guard ────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}

// ── GET /api/admin/ai-config — fetch all section configs ─────────────────────

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = getSupabaseServiceClient()
  const configs = await getAllAiConfigs(service)
  return NextResponse.json({ configs })
}

// ── PUT /api/admin/ai-config — upsert a section config ───────────────────────

export async function PUT(req: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const sectionKey = String(body.section_key ?? '')
  if (!AI_SECTIONS.some((s) => s.key === sectionKey)) {
    return NextResponse.json({ error: `Unknown section: ${sectionKey}` }, { status: 400 })
  }

  const maxTokens = Number(body.max_tokens)
  if (!Number.isInteger(maxTokens) || maxTokens < 100 || maxTokens > 4000) {
    return NextResponse.json({ error: 'max_tokens must be 100–4000' }, { status: 400 })
  }

  const validTones = ['profesional', 'motivacional', 'analítico', 'directo', 'amigable']
  const tone = String(body.tone ?? 'profesional')
  if (!validTones.includes(tone)) {
    return NextResponse.json({ error: `Invalid tone: ${tone}` }, { status: 400 })
  }

  const service = getSupabaseServiceClient()
  const section = AI_SECTIONS.find((s) => s.key === sectionKey)!

  const payload = {
    section_key:        sectionKey,
    display_name:       section.displayName,
    description:        section.description,
    system_prompt:      String(body.system_prompt ?? ''),
    max_tokens:         maxTokens,
    tone,
    language:           String(body.language ?? 'es'),
    extra_instructions: String(body.extra_instructions ?? ''),
    settings:           (body.settings as Record<string, unknown>) ?? {},
    updated_by:         user.id,
  }

  const { error } = await service
    .from('ai_prompt_configs')
    .upsert(payload, { onConflict: 'section_key' })

  if (error) {
    console.error('[ai-config PUT]', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  invalidateAiConfigCache(sectionKey)
  return NextResponse.json({ ok: true })
}

// ── POST /api/admin/ai-config/reset — restore section to default ──────────────

export async function DELETE(req: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const sectionKey = String(body.section_key ?? '')
  const service = getSupabaseServiceClient()

  await service.from('ai_prompt_configs').delete().eq('section_key', sectionKey)
  invalidateAiConfigCache(sectionKey)
  return NextResponse.json({ ok: true })
}
