-- ============================================================
-- GDD Manager - Tombstone de projetos deletados pelo dono
-- Evita que membros com cópia offline re-criem o projeto e virem owner.
-- Execute no Supabase SQL Editor.
-- ============================================================

create table if not exists public.deleted_projects (
  project_id uuid primary key,
  deleted_at timestamptz default now() not null
);

comment on table public.deleted_projects is 'IDs de projetos deletados pelo dono; membros que tentam sincronizar cópia offline recebem 410 e removem localmente.';

-- Sem FK para projects (o projeto já foi deletado). Opcional: limpeza periódica
-- delete from public.deleted_projects where deleted_at < now() - interval '90 days';
