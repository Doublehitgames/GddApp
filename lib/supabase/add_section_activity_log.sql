-- ─────────────────────────────────────────────────────────────────────────────
-- section_activity_log
-- Registra criações, deleções e renomeações de seções por projeto.
-- Política de retenção: 90 dias de TTL + máximo de 200 eventos por projeto,
-- aplicada automaticamente via trigger a cada INSERT.
--
-- Script idempotente: pode ser re-executado sem erros.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.section_activity_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  section_id    UUID        NOT NULL,
  section_title TEXT        NOT NULL,
  action        TEXT        NOT NULL CHECK (action IN ('created', 'deleted', 'renamed')),
  old_title     TEXT,                    -- preenchido apenas em 'renamed'
  user_id       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS section_activity_log_project_created_at_idx
  ON public.section_activity_log (project_id, created_at DESC);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE public.section_activity_log ENABLE ROW LEVEL SECURITY;

-- Remove políticas anteriores antes de recriar (idempotência)
DROP POLICY IF EXISTS "Members can read section activity log"   ON public.section_activity_log;
DROP POLICY IF EXISTS "Members can insert section activity log" ON public.section_activity_log;

-- Leitura: dono do projeto e membros convidados
CREATE POLICY "Members can read section activity log"
  ON public.section_activity_log FOR SELECT
  USING (
    project_id IN (
      SELECT id          FROM public.projects        WHERE owner_id = auth.uid()
      UNION
      SELECT project_id  FROM public.project_members WHERE user_id  = auth.uid()
    )
  );

-- Escrita: dono do projeto e membros convidados
CREATE POLICY "Members can insert section activity log"
  ON public.section_activity_log FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id          FROM public.projects        WHERE owner_id = auth.uid()
      UNION
      SELECT project_id  FROM public.project_members WHERE user_id  = auth.uid()
    )
  );

-- ─── Prune: TTL 90 dias + teto 200 eventos por projeto ───────────────────────

CREATE OR REPLACE FUNCTION public.prune_section_activity_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Remove eventos com mais de 90 dias para este projeto
  DELETE FROM public.section_activity_log
  WHERE project_id = NEW.project_id
    AND created_at < now() - INTERVAL '90 days';

  -- 2. Mantém apenas os 200 eventos mais recentes por projeto
  DELETE FROM public.section_activity_log
  WHERE project_id = NEW.project_id
    AND id NOT IN (
      SELECT id
      FROM public.section_activity_log
      WHERE project_id = NEW.project_id
      ORDER BY created_at DESC
      LIMIT 200
    );

  RETURN NEW;
END;
$$;

-- Remove trigger anterior antes de recriar (idempotência)
DROP TRIGGER IF EXISTS trg_prune_section_activity_log ON public.section_activity_log;

CREATE TRIGGER trg_prune_section_activity_log
  AFTER INSERT ON public.section_activity_log
  FOR EACH ROW EXECUTE FUNCTION public.prune_section_activity_log();
