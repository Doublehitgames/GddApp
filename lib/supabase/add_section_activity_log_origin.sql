-- Adiciona a coluna 'origin' à section_activity_log: de onde veio a escrita.
--
--   'app' → alguém mexeu pelo navegador
--   'mcp' → um agente mexeu pela API (chave de API ou OAuth do MCP)
--
-- NULL em linhas antigas, que são todas do app (o log só existia no cliente
-- até agora). O widget trata NULL como 'app'.
--
-- Idempotente: pode ser re-executado sem erros.

ALTER TABLE public.section_activity_log
  ADD COLUMN IF NOT EXISTS origin TEXT;

ALTER TABLE public.section_activity_log
  DROP CONSTRAINT IF EXISTS section_activity_log_origin_check;

ALTER TABLE public.section_activity_log
  ADD CONSTRAINT section_activity_log_origin_check
  CHECK (origin IS NULL OR origin IN ('app', 'mcp'));
