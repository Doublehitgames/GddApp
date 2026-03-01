-- ============================================================
-- CORREÇÃO: Recursão infinita nas políticas RLS
-- Execute no Supabase SQL Editor
-- ============================================================

-- Funções security definer bypassam o RLS ao consultar outras tabelas,
-- quebrando o ciclo: projects → project_members → projects

create or replace function public.is_project_owner(p_project_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.projects
    where id = p_project_id and owner_id = auth.uid()
  );
$$ language sql security definer stable;

create or replace function public.is_project_member(p_project_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = auth.uid()
  );
$$ language sql security definer stable;

create or replace function public.is_project_editor(p_project_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = auth.uid() and role = 'editor'
  );
$$ language sql security definer stable;

-- ── Recriar políticas de projects ────────────────────────────────────────────

drop policy if exists "Dono vê seus projetos" on public.projects;
drop policy if exists "Dono cria projetos" on public.projects;
drop policy if exists "Dono edita seus projetos" on public.projects;
drop policy if exists "Dono deleta seus projetos" on public.projects;

create policy "Dono vê seus projetos"
  on public.projects for select
  using (
    auth.uid() = owner_id
    or public.is_project_member(id)
  );

create policy "Dono cria projetos"
  on public.projects for insert
  with check (auth.uid() = owner_id);

create policy "Dono edita seus projetos"
  on public.projects for update
  using (
    auth.uid() = owner_id
    or public.is_project_editor(id)
  );

create policy "Dono deleta seus projetos"
  on public.projects for delete
  using (auth.uid() = owner_id);

-- ── Recriar políticas de sections ────────────────────────────────────────────

drop policy if exists "Acesso às seções via projeto" on public.sections;
drop policy if exists "Edição de seções via projeto" on public.sections;
drop policy if exists "Update de seções via projeto" on public.sections;
drop policy if exists "Delete de seções via projeto" on public.sections;

create policy "Acesso às seções via projeto"
  on public.sections for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = sections.project_id
      and (p.owner_id = auth.uid() or public.is_project_member(p.id))
    )
  );

create policy "Edição de seções via projeto"
  on public.sections for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = sections.project_id
      and (p.owner_id = auth.uid() or public.is_project_editor(p.id))
    )
  );

create policy "Update de seções via projeto"
  on public.sections for update
  using (
    exists (
      select 1 from public.projects p
      where p.id = sections.project_id
      and (p.owner_id = auth.uid() or public.is_project_editor(p.id))
    )
  );

create policy "Delete de seções via projeto"
  on public.sections for delete
  using (
    exists (
      select 1 from public.projects p
      where p.id = sections.project_id
      and (p.owner_id = auth.uid() or public.is_project_editor(p.id))
    )
  );

-- ── Recriar políticas de project_members ─────────────────────────────────────

drop policy if exists "Dono gerencia membros" on public.project_members;
drop policy if exists "Membro vê sua própria entrada" on public.project_members;

create policy "Dono gerencia membros"
  on public.project_members for all
  using (public.is_project_owner(project_members.project_id));

create policy "Membro vê sua própria entrada"
  on public.project_members for select
  using (auth.uid() = user_id);
