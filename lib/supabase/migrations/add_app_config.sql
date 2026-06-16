-- Remote config: tabela key/value para limites e configurações ajustáveis sem redeploy.
-- Gerenciada via Supabase Studio. Apenas service_role tem acesso (RLS habilitado, sem policies).
CREATE TABLE IF NOT EXISTS public.app_config (
  key         text        PRIMARY KEY,
  value       text        NOT NULL,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_config (key, value, description) VALUES
  ('FREE_MAX_PROJECTS',             '2',   'Número máximo de projetos por usuário (plano free)'),
  ('FREE_MAX_SECTIONS_PER_PROJECT', '300', 'Número máximo de seções por projeto (plano free)'),
  ('FREE_MAX_SECTIONS_TOTAL',       '400', 'Número máximo de seções totais por usuário (plano free)'),
  ('SYNC_REQUESTS_PER_MINUTE',      '30',  'Limite de requests de sync por minuto por usuário')
ON CONFLICT (key) DO NOTHING;
