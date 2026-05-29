-- Adiciona coluna 'detail' à section_activity_log para guardar contexto adicional.
-- Ex: tipo do addon modificado ('economyLink', 'production', etc.)
-- Idempotente.

ALTER TABLE public.section_activity_log
  ADD COLUMN IF NOT EXISTS detail TEXT;
