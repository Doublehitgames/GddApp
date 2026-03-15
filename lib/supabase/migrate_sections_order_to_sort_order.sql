-- Migração: renomear coluna reservada "order" para "sort_order" na tabela sections.
-- O PostgREST/Supabase pode falhar em INSERT/UPDATE quando a coluna se chama "order".
-- Execute no SQL Editor do Supabase (uma vez). Depois disso, o sync de seções deve funcionar.

-- Renomeia a coluna
ALTER TABLE public.sections RENAME COLUMN "order" TO sort_order;
