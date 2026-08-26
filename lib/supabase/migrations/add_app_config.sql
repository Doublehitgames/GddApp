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

-- ─────────────────────────────────────────────────────────────────────────────
-- OVERRIDE POR USUÁRIO
-- Além das chaves globais acima, app_config aceita uma linha por usuário no
-- formato `<CHAVE>:<user_id>`. Ela vale só para aquele usuário; quem não tem
-- linha própria continua no valor global. Os limites estruturais são sempre
-- avaliados no DONO do projeto, então o override do dono também vale para os
-- membros convidados dele.
--
-- Monte a chave a partir do e-mail, sem precisar caçar o uuid:
--
--   INSERT INTO public.app_config (key, value, description)
--   SELECT 'FREE_MAX_SECTIONS_TOTAL:' || id, '500', 'Override individual: fulano@exemplo.com'
--   FROM auth.users WHERE email = 'fulano@exemplo.com'
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
--
-- Conferir quem tem override:
--   SELECT key, value FROM public.app_config WHERE key LIKE '%:%';
--
-- Para voltar ao global, basta apagar a linha. O cache do servidor tem TTL de
-- 5 minutos, então a mudança aparece no máximo 5 min depois (ou no próximo deploy).
