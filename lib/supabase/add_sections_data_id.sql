-- ============================================================
-- GDD Manager - DataID nas secoes (identificador de dados do jogo)
-- Execute no Supabase SQL Editor.
-- ============================================================

alter table public.sections
  add column if not exists data_id text default null;

comment on column public.sections.data_id is 'User-defined data identifier (e.g. FARM_ANIMAL_CHICKEN). Used for game data binding, not internal references.';
