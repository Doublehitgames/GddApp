-- Adiciona coluna ai_config na tabela profiles
-- Execute no Supabase SQL Editor

alter table public.profiles
  add column if not exists ai_config jsonb default null;
