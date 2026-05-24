-- Intelligence engine AI config sections
-- These rows let admins configure tone, max_tokens and extra_instructions for
-- the report redactor agent (agent-redactor.ts). The system_prompt column is
-- intentionally left as an informational note — the agents use internal
-- optimized prompts and the column value is never read by the engine.

INSERT INTO public.ai_prompt_configs (
  section_key, display_name, description,
  system_prompt, max_tokens, tone, language,
  extra_instructions, settings
)
VALUES
  (
    'intelligence_vendedor',
    'Reporte Vendedor IA',
    'Motor de inteligencia: reporte narrativo para vendedores. Configura tono, longitud e instrucciones de estilo.',
    'NOTA: Este motor usa prompts internos optimizados para garantizar una salida JSON estructurada. El system prompt no se aplica aquí. Usa Tono, Tokens máximos e Instrucciones adicionales para personalizar el estilo de redacción.',
    900,
    'motivacional',
    'es',
    '',
    '{}'
  ),
  (
    'intelligence_gerente',
    'Reporte Gerente IA',
    'Motor de inteligencia: reporte narrativo para gerentes de equipo. Configura tono, longitud e instrucciones de estilo.',
    'NOTA: Este motor usa prompts internos optimizados para garantizar una salida JSON estructurada. El system prompt no se aplica aquí. Usa Tono, Tokens máximos e Instrucciones adicionales para personalizar el estilo de redacción.',
    900,
    'analítico',
    'es',
    '',
    '{}'
  )
ON CONFLICT (section_key) DO NOTHING;
