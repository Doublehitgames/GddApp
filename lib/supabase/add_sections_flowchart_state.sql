-- Adiciona persistência de fluxograma por seção no cloud sync.
-- Um diagrama por seção, salvo em JSONB.

ALTER TABLE public.sections
ADD COLUMN IF NOT EXISTS flowchart_state jsonb;
