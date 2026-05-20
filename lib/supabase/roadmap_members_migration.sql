-- Migração: permite que membros do projeto visualizem o roadmap do dono
-- Execute este script no Supabase SQL Editor

-- ── roadmap_roadmaps_data ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users manage own roadmaps" ON public.roadmap_roadmaps_data;

CREATE POLICY "roadmap roadmaps select"
  ON public.roadmap_roadmaps_data FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = roadmap_roadmaps_data.project_id
        AND pm.user_id    = auth.uid()
    )
  );

CREATE POLICY "roadmap roadmaps insert"
  ON public.roadmap_roadmaps_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "roadmap roadmaps update"
  ON public.roadmap_roadmaps_data FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "roadmap roadmaps delete"
  ON public.roadmap_roadmaps_data FOR DELETE
  USING (auth.uid() = user_id);


-- ── roadmap_phases_data ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users manage own roadmap phases" ON public.roadmap_phases_data;

CREATE POLICY "roadmap phases select"
  ON public.roadmap_phases_data FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = roadmap_phases_data.project_id
        AND pm.user_id    = auth.uid()
    )
  );

CREATE POLICY "roadmap phases insert"
  ON public.roadmap_phases_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "roadmap phases update"
  ON public.roadmap_phases_data FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "roadmap phases delete"
  ON public.roadmap_phases_data FOR DELETE
  USING (auth.uid() = user_id);


-- ── roadmap_themes_data ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users manage own roadmap themes" ON public.roadmap_themes_data;

CREATE POLICY "roadmap themes select"
  ON public.roadmap_themes_data FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = roadmap_themes_data.project_id
        AND pm.user_id    = auth.uid()
    )
  );

CREATE POLICY "roadmap themes insert"
  ON public.roadmap_themes_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "roadmap themes update"
  ON public.roadmap_themes_data FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "roadmap themes delete"
  ON public.roadmap_themes_data FOR DELETE
  USING (auth.uid() = user_id);


-- ── roadmap_items_data ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users manage own roadmap items" ON public.roadmap_items_data;

CREATE POLICY "roadmap items select"
  ON public.roadmap_items_data FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = roadmap_items_data.project_id
        AND pm.user_id    = auth.uid()
    )
  );

CREATE POLICY "roadmap items insert"
  ON public.roadmap_items_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "roadmap items update"
  ON public.roadmap_items_data FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "roadmap items delete"
  ON public.roadmap_items_data FOR DELETE
  USING (auth.uid() = user_id);
