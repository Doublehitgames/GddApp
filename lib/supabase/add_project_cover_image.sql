-- Adiciona campo opcional de imagem de capa para o projeto.
-- Usado na home do projeto e na capa do modo DOC.
alter table if exists public.projects
  add column if not exists cover_image_url text;
