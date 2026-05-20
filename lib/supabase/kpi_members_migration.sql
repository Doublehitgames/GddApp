-- Migração: permite que membros do projeto visualizem os KPIs do dono
-- Execute este script no Supabase SQL Editor

-- ── kpi_entries ──────────────────────────────────────────────────────────────

-- Remove a política antiga (ALL → só dono)
DROP POLICY IF EXISTS "Users manage own kpi entries" ON public.kpi_entries;

-- SELECT: dono da linha OU membro do projeto
CREATE POLICY "kpi entries select"
  ON public.kpi_entries FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = kpi_entries.project_id
        AND pm.user_id    = auth.uid()
    )
  );

-- INSERT: apenas o dono pode criar
CREATE POLICY "kpi entries insert"
  ON public.kpi_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: apenas o dono pode editar
CREATE POLICY "kpi entries update"
  ON public.kpi_entries FOR UPDATE
  USING (auth.uid() = user_id);

-- DELETE: apenas o dono pode excluir
CREATE POLICY "kpi entries delete"
  ON public.kpi_entries FOR DELETE
  USING (auth.uid() = user_id);


-- ── kpi_configs ───────────────────────────────────────────────────────────────

-- Remove a política antiga
DROP POLICY IF EXISTS "Users manage own kpi configs" ON public.kpi_configs;

-- SELECT: dono da linha OU membro do projeto
CREATE POLICY "kpi configs select"
  ON public.kpi_configs FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = kpi_configs.project_id
        AND pm.user_id    = auth.uid()
    )
  );

-- INSERT: apenas o dono pode criar
CREATE POLICY "kpi configs insert"
  ON public.kpi_configs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: apenas o dono pode editar
CREATE POLICY "kpi configs update"
  ON public.kpi_configs FOR UPDATE
  USING (auth.uid() = user_id);

-- DELETE: apenas o dono pode excluir
CREATE POLICY "kpi configs delete"
  ON public.kpi_configs FOR DELETE
  USING (auth.uid() = user_id);
