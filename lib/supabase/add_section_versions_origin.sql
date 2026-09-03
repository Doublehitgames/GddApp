-- Adiciona a coluna 'origin' à section_versions: quem escreveu aquele snapshot.
--
--   'app' → alguém salvou pelo navegador (rota /api/projects/sync)
--   'mcp' → um agente salvou pela API (/api/v1, chave de API ou OAuth do MCP)
--
-- NULL nas linhas antigas, que são todas do app — só o sync gravava versões
-- até agora. O changelog trata NULL como 'app'.
--
-- Idempotente: pode ser re-executado sem erros.

ALTER TABLE public.section_versions
  ADD COLUMN IF NOT EXISTS origin TEXT;

ALTER TABLE public.section_versions
  DROP CONSTRAINT IF EXISTS section_versions_origin_check;

ALTER TABLE public.section_versions
  ADD CONSTRAINT section_versions_origin_check
  CHECK (origin IS NULL OR origin IN ('app', 'mcp'));

-- O changelog varre o projeto inteiro por data; o índice existente é por seção.
CREATE INDEX IF NOT EXISTS section_versions_project_id_created_at_idx
  ON public.section_versions(project_id, created_at DESC);
