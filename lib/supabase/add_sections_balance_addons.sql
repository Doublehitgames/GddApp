-- Adiciona coluna para armazenar addons de balanceamento por seção.
-- Execute no SQL Editor do Supabase.

alter table if exists public.sections
  add column if not exists balance_addons jsonb not null default '[]'::jsonb;

comment on column public.sections.balance_addons is
  'Lista de addons de balanceamento da seção (jsonb).';
