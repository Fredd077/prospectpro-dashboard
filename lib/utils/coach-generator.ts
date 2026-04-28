/**
 * Shared coach message generator.
 * Used by cron routes to generate & persist coach messages for any user.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import { formatContextForPrompt, type CoachContext } from './coach-context'
import { COACH_SYSTEM_PROMPT } from './coach-prompt'

export { COACH_SYSTEM_PROMPT }

type SbClient = SupabaseClient<Database>

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface GenerateResult {
  message: string
  id: string | null
}

/**
 * Generate a coach message for the given context and save it to the DB.
 * Returns { message, id } on success.
 * Uses the provided Supabase client (can be service role for cron use).
 */
export async function generateAndSaveCoachMessage(
  ctx: CoachContext,
  type: 'daily' | 'weekly' | 'monthly',
  periodDate: string,
  sb: SbClient,
  maxTokens = 300,
): Promise<GenerateResult> {
  const userContent = formatContextForPrompt(ctx)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system: COACH_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  })

  const message = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  // Save to DB
  let savedId: string | null = null
  try {
    const { data } = await sb
      .from('coach_messages')
      .insert({
        type,
        message,
        context: JSON.parse(JSON.stringify(ctx)),
        period_date: periodDate,
        is_read: false,
      })
      .select('id')
      .single()
    savedId = data?.id ?? null
  } catch (err) {
    console.error('[coach-generator] Failed to save message:', err)
  }

  return { message, id: savedId }
}
