-- ============================================================
-- GDD Manager - Notas por grupo de addons (A/B testing)
-- Execute no Supabase SQL Editor.
-- ============================================================

alter table public.sections
  add column if not exists addon_group_notes jsonb default null;

comment on column public.sections.addon_group_notes is 'Notas por grupo de addons (ex.: hipotese do teste A/B). Chave = nome do grupo, valor = texto.';
