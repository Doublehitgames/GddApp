-- ============================================================
-- GDD Manager - Tags de domínio nas seções (sync / compartilhamento)
-- Execute no Supabase SQL Editor. Usado para análise IA e mapa mental.
-- ============================================================

alter table public.sections
  add column if not exists domain_tags jsonb default '[]'::jsonb;

comment on column public.sections.domain_tags is 'Tags de domínio da seção (ex.: combat, economy). Array JSON.';
