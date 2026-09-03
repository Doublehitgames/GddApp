-- ============================================================
-- GDD Manager - Estado de maturidade das paginas
-- Execute no Supabase SQL Editor. Idempotente.
--
--   draft       - rascunho
--   review      - em revisao
--   approved    - aprovado
--   implemented - no jogo
--   obsolete    - obsoleto
--
-- NULL e o estado normal de uma pagina que ninguem classificou ainda.
-- ============================================================

alter table public.sections
  add column if not exists status text default null;

alter table public.sections
  add column if not exists status_at timestamptz default null;

alter table public.sections
  drop constraint if exists sections_status_check;

alter table public.sections
  add constraint sections_status_check
  check (status is null or status in ('draft', 'review', 'approved', 'implemented', 'obsolete'));

comment on column public.sections.status is 'Maturidade da pagina: draft, review, approved, implemented, obsolete. NULL = sem estado.';
comment on column public.sections.status_at is 'Quando o estado atual foi carimbado. Base do selo de "pode estar desatualizada".';

-- A cobertura do projeto e a varredura de pendencias filtram por estado.
create index if not exists sections_project_id_status_idx
  on public.sections(project_id, status);
