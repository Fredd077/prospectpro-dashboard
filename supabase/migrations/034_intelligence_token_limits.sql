-- Raise max_tokens for intelligence agent-redactor to prevent JSON truncation
UPDATE ai_prompt_configs
SET max_tokens = 1500
WHERE section_key = 'intelligence_vendedor';

UPDATE ai_prompt_configs
SET max_tokens = 2000
WHERE section_key = 'intelligence_gerente';
