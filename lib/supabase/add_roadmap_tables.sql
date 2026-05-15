-- Tabelas de sync do Roadmap
-- Padrão: uma linha por (user_id, project_id), dados como JSONB array

CREATE TABLE IF NOT EXISTS public.roadmap_roadmaps_data (
  user_id    UUID NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  data       JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);
ALTER TABLE public.roadmap_roadmaps_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own roadmaps"
  ON public.roadmap_roadmaps_data FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.roadmap_phases_data (
  user_id    UUID NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  data       JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);
ALTER TABLE public.roadmap_phases_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own roadmap phases"
  ON public.roadmap_phases_data FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.roadmap_themes_data (
  user_id    UUID NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  data       JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);
ALTER TABLE public.roadmap_themes_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own roadmap themes"
  ON public.roadmap_themes_data FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.roadmap_items_data (
  user_id    UUID NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  data       JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);
ALTER TABLE public.roadmap_items_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own roadmap items"
  ON public.roadmap_items_data FOR ALL USING (auth.uid() = user_id);
