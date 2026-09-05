-- A descrição do projeto passa a ser blocks nativos (BlockNote), do mesmo jeito
-- que a descrição de seção já é desde `add_sections_content_blocks.sql`.
-- `content_blocks` é a fonte de verdade; `description` (markdown) continua
-- existindo como espelho derivado para quem lê texto puro — busca, IA, MCP e
-- os leitores legados.
--
-- Sem backfill: uma descrição que só tem markdown é semeada em blocks pelo
-- editor na primeira vez que a tela é aberta, e gravada como blocks no salvar.

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS content_blocks jsonb;
