-- Tabela de entradas KPI por usuário/projeto
CREATE TABLE IF NOT EXISTS public.kpi_entries (
  user_id    UUID NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  entries    JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);

ALTER TABLE public.kpi_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own kpi entries"
  ON public.kpi_entries FOR ALL USING (auth.uid() = user_id);

-- Tabela de configuração KPI por usuário/projeto (gênero, perfil, benchmarks customizados)
CREATE TABLE IF NOT EXISTS public.kpi_configs (
  user_id    UUID NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  config     JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);

ALTER TABLE public.kpi_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own kpi configs"
  ON public.kpi_configs FOR ALL USING (auth.uid() = user_id);
