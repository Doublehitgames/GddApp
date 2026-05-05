CREATE TABLE IF NOT EXISTS public.agenda_data (
  user_id   UUID NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  tasks     JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);

ALTER TABLE public.agenda_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own agenda"
  ON public.agenda_data FOR ALL USING (auth.uid() = user_id);
