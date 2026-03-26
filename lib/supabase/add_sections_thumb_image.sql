-- Adiciona thumbnail (ícone) por seção/subseção para exibição ao lado do título.
-- Execute no SQL Editor do Supabase.

alter table if exists public.sections
add column if not exists thumb_image_url text;
