-- ============================================================
-- GDD Manager - Histórico de versões por seção
-- Execute no Supabase SQL Editor. Cada edição (title/content) grava uma versão.
-- ============================================================

create table if not exists public.section_versions (
  id uuid default gen_random_uuid() primary key,
  section_id uuid not null references public.sections(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  content text default '',
  sort_order integer default 0,
  color text,
  created_at timestamptz default now() not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_by_name text
);

create index if not exists section_versions_section_id_created_at_idx
  on public.section_versions(section_id, created_at desc);
create index if not exists section_versions_project_id_idx on public.section_versions(project_id);

comment on table public.section_versions is 'Snapshot de cada alteração de título/conteúdo de seção para histórico e restauração.';

alter table public.section_versions enable row level security;

-- Ver projeto: dono ou membro
create policy "Membros do projeto podem ver versões"
  on public.section_versions for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = section_versions.project_id
      and (p.owner_id = auth.uid() or exists (select 1 from public.project_members pm where pm.project_id = p.id and pm.user_id = auth.uid()))
    )
  );

-- Inserir: dono ou editor (via service role ou mesmo usuário que fez o sync)
create policy "Dono e editores podem inserir versões"
  on public.section_versions for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = section_versions.project_id
      and (
        p.owner_id = auth.uid()
        or exists (select 1 from public.project_members pm where pm.project_id = p.id and pm.user_id = auth.uid() and pm.role = 'editor')
      )
    )
  );

-- Sem update/delete em versões (histórico imutável)
