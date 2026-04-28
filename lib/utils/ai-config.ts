/**
 * AI Prompt Configuration service.
 * Reads from ai_prompt_configs table (written by admins via /admin/ai-config).
 * Falls back to hardcoded defaults if DB record doesn't exist yet.
 * In-memory cache with 5-minute TTL to avoid a DB round-trip on every request.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { COACH_SYSTEM_PROMPT } from './coach-prompt'

// ── Types ─────────────────────────────────────────────────────────────────────

export type AiTone = 'profesional' | 'motivacional' | 'analítico' | 'directo' | 'amigable'

export interface AiConfig {
  sectionKey:        string
  displayName:       string
  description:       string
  systemPrompt:      string
  maxTokens:         number
  tone:              AiTone
  language:          string
  extraInstructions: string
  /** Section-specific JSON (e.g. coach: { daily_tokens, weekly_tokens, monthly_tokens }) */
  settings:          Record<string, unknown>
  updatedAt:         string | null
  updatedBy:         string | null
}

// ── Section definitions ───────────────────────────────────────────────────────

export const AI_SECTIONS: Array<{
  key:         string
  displayName: string
  description: string
  icon:        string
}> = [
  {
    key:         'coach',
    displayName: 'Coach IA',
    description: 'Reportes de coaching diario, semanal y mensual para cada vendedor.',
    icon:        'Brain',
  },
  {
    key:         'recipe',
    displayName: 'Recetario Comercial',
    description: 'Asistente conversacional para construir el recetario de ventas.',
    icon:        'BookOpen',
  },
  {
    key:         'gerente_chat',
    displayName: 'Gerente AI — Chat',
    description: 'Análisis de equipo y recomendaciones estratégicas para managers.',
    icon:        'BrainCircuit',
  },
  {
    key:         'team_report',
    displayName: 'Reportes de Equipo',
    description: 'Genera reportes automáticos de desempeño del equipo por email.',
    icon:        'FileText',
  },
]

// ── Hardcoded defaults (used when no DB record exists) ────────────────────────

const RECIPE_DEFAULT_PROMPT = `Eres el Asistente de Recetario Comercial de ProspectPro. Tu nombre es "Recipe Pro".
Ayudas a los vendedores a construir su Recetario Comercial — el plan maestro de actividades y metas de ventas.

PERSONALIDAD:
- Guías con preguntas, no con respuestas largas
- Una pregunta a la vez, siempre
- Validás antes de avanzar
- Usas metodología Sandler
- Responde siempre en español

FLUJO:
1. Objetivo de ingresos mensuales
2. Ticket promedio de venta
3. Tasa de conversión por etapa (Reunión → Propuesta → Cierre)
4. Actividades de prospección necesarias (llamadas, emails, LinkedIn)
5. Días laborales disponibles por mes

Al tener todos los datos, genera el recetario estructurado y emite {"action":"save_recipe"}.`

const GERENTE_CHAT_DEFAULT_PROMPT = `Eres el Gerente Virtual AI de ProspectPro — el asistente de inteligencia comercial más avanzado para equipos de ventas. Tu misión es ayudar a los managers a tomar decisiones basadas en datos, identificar patrones ocultos, predecir resultados y dar recomendaciones accionables.

Responde siempre en español. Sé conciso, directo y usa datos reales. Cuando identifiques problemas, da recomendaciones específicas. Usa emojis con moderación para puntos clave.

INSTRUCCIONES DE ANÁLISIS:
- Combina datos de actividad Y pipeline para dar una visión completa
- Identifica correlaciones: ¿Los reps con mayor actividad tienen mejor win rate?
- Si un rep tiene buen momentum de actividad pero mal pipeline, investiga qué está pasando
- Si la proyección de ingresos está por debajo de la meta, sugiere acciones concretas
- Identifica patrones temporales: ¿Hay semanas con caída sistemática?
- Cuando un rep esté "en riesgo", da un plan de coaching específico
- Basa todas las respuestas en los datos reales mostrados arriba`

const TEAM_REPORT_DEFAULT_PROMPT = `Eres el analista de desempeño comercial de ProspectPro. Generates reportes ejecutivos para managers sobre el desempeño de su equipo de ventas.

ESTILO:
- Analítico y orientado a datos
- Diagnóstico honesto con recomendaciones accionables
- Estructura clara: diagnóstico → ranking → patrones → acciones
- En español, tono profesional
- Máximo 900 tokens

SECCIONES DEL REPORTE:
1. Diagnóstico general del equipo
2. Ranking de vendedores (top 3 y bottom 3)
3. Patrones comunes de falla
4. Recomendaciones individuales para vendedores en riesgo
5. Acciones prioritarias para el manager`

export const AI_CONFIG_DEFAULTS: Record<string, Omit<AiConfig, 'updatedAt' | 'updatedBy'>> = {
  coach: {
    sectionKey:        'coach',
    displayName:       'Coach IA',
    description:       'Reportes de coaching diario, semanal y mensual para cada vendedor.',
    systemPrompt:      COACH_SYSTEM_PROMPT,
    maxTokens:         300,
    tone:              'motivacional',
    language:          'es',
    extraInstructions: '',
    settings: {
      daily_tokens:   300,
      weekly_tokens:  500,
      monthly_tokens: 800,
    },
  },
  recipe: {
    sectionKey:        'recipe',
    displayName:       'Recetario Comercial',
    description:       'Asistente conversacional para construir el recetario de ventas.',
    systemPrompt:      RECIPE_DEFAULT_PROMPT,
    maxTokens:         500,
    tone:              'profesional',
    language:          'es',
    extraInstructions: '',
    settings:          {},
  },
  gerente_chat: {
    sectionKey:        'gerente_chat',
    displayName:       'Gerente AI — Chat',
    description:       'Análisis de equipo y recomendaciones estratégicas para managers.',
    systemPrompt:      GERENTE_CHAT_DEFAULT_PROMPT,
    maxTokens:         1500,
    tone:              'analítico',
    language:          'es',
    extraInstructions: '',
    settings:          {},
  },
  team_report: {
    sectionKey:        'team_report',
    displayName:       'Reportes de Equipo',
    description:       'Genera reportes automáticos de desempeño del equipo por email.',
    systemPrompt:      TEAM_REPORT_DEFAULT_PROMPT,
    maxTokens:         900,
    tone:              'analítico',
    language:          'es',
    extraInstructions: '',
    settings:          {},
  },
}

// ── In-memory cache (5 min TTL) ───────────────────────────────────────────────

const cache = new Map<string, { config: AiConfig; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000

export function invalidateAiConfigCache(sectionKey?: string) {
  if (sectionKey) cache.delete(sectionKey)
  else cache.clear()
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Fetch a single section config, with DB override and in-memory cache. */
export async function getAiConfig(
  sectionKey: string,
  service: SupabaseClient,
): Promise<AiConfig> {
  const hit = cache.get(sectionKey)
  if (hit && Date.now() < hit.expiresAt) return hit.config

  const defaults = AI_CONFIG_DEFAULTS[sectionKey]
  if (!defaults) throw new Error(`Unknown AI config section: ${sectionKey}`)

  try {
    const { data } = await service
      .from('ai_prompt_configs')
      .select('*')
      .eq('section_key', sectionKey)
      .maybeSingle()

    const config: AiConfig = data
      ? {
          sectionKey:        data.section_key,
          displayName:       data.display_name,
          description:       data.description ?? defaults.description,
          systemPrompt:      data.system_prompt,
          maxTokens:         data.max_tokens,
          tone:              (data.tone as AiTone) ?? defaults.tone,
          language:          data.language ?? 'es',
          extraInstructions: data.extra_instructions ?? '',
          settings:          (data.settings as Record<string, unknown>) ?? defaults.settings,
          updatedAt:         data.updated_at ?? null,
          updatedBy:         data.updated_by ?? null,
        }
      : { ...defaults, updatedAt: null, updatedBy: null }

    cache.set(sectionKey, { config, expiresAt: Date.now() + CACHE_TTL_MS })
    return config
  } catch {
    return { ...defaults, updatedAt: null, updatedBy: null }
  }
}

/** Build the full system prompt (base + tone prefix + extra instructions). */
export function buildSystemPrompt(config: AiConfig, dataContext?: string): string {
  const tonePrefixes: Record<AiTone, string> = {
    profesional:  'Mantén un tono profesional, preciso y orientado a negocios.',
    motivacional: 'Mantén un tono motivacional, energizante y orientado a la acción.',
    analítico:    'Mantén un tono analítico, detallado y basado en datos concretos.',
    directo:      'Sé directo y conciso. Ve al punto sin rodeos.',
    amigable:     'Mantén un tono cercano, empático y conversacional.',
  }
  const tonePrefix = tonePrefixes[config.tone] ?? ''

  const parts = [
    tonePrefix ? `[TONO]: ${tonePrefix}` : '',
    config.systemPrompt,
    dataContext ?? '',
    config.extraInstructions ? `\nINSTRUCCIONES ADICIONALES:\n${config.extraInstructions}` : '',
  ]
  return parts.filter(Boolean).join('\n\n')
}

/** Fetch all section configs (for the admin editor). */
export async function getAllAiConfigs(service: SupabaseClient): Promise<AiConfig[]> {
  const { data } = await service
    .from('ai_prompt_configs')
    .select('*')
    .order('section_key')

  const dbMap = new Map((data ?? []).map((r: any) => [r.section_key, r]))

  return AI_SECTIONS.map(({ key }) => {
    const defaults = AI_CONFIG_DEFAULTS[key]!
    const row = dbMap.get(key)
    if (!row) return { ...defaults, updatedAt: null, updatedBy: null }
    return {
      sectionKey:        row.section_key,
      displayName:       row.display_name,
      description:       row.description ?? defaults.description,
      systemPrompt:      row.system_prompt,
      maxTokens:         row.max_tokens,
      tone:              (row.tone as AiTone) ?? defaults.tone,
      language:          row.language ?? 'es',
      extraInstructions: row.extra_instructions ?? '',
      settings:          (row.settings as Record<string, unknown>) ?? defaults.settings,
      updatedAt:         row.updated_at ?? null,
      updatedBy:         row.updated_by ?? null,
    }
  })
}
