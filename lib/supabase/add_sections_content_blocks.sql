-- Fase 1 da migração da descrição de seção para blocks nativos (BlockNote).
-- `content_blocks` passa a ser a fonte de verdade da descrição (JSONB com a
-- árvore de blocks). A coluna `content` (markdown) continua existindo como
-- espelho derivado para os leitores legados (busca, backlinks, IA, /view, MCP)
-- e será removida na Fase 3, quando todos passarem a ler blocks.

ALTER TABLE public.sections
ADD COLUMN IF NOT EXISTS content_blocks jsonb;
