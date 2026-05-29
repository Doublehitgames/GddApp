-- Adiciona o tipo 'modified' ao CHECK constraint da tabela section_activity_log.
-- Idempotente: pode ser re-executado sem erros.

ALTER TABLE public.section_activity_log
  DROP CONSTRAINT IF EXISTS section_activity_log_action_check;

ALTER TABLE public.section_activity_log
  ADD CONSTRAINT section_activity_log_action_check
  CHECK (action IN ('created', 'deleted', 'renamed', 'modified'));
