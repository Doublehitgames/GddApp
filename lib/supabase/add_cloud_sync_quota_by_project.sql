-- ============================================================
-- GDD Manager - Quota de créditos de sync por hora POR PROJETO
-- Dono e membros compartilham a mesma cota do projeto.
-- Execute no Supabase SQL Editor (após schema + fix_rls_recursion).
-- ============================================================

create table if not exists public.cloud_sync_usage_hourly_by_project (
  project_id uuid references public.projects(id) on delete cascade not null,
  window_start timestamptz not null,
  used_credits integer not null default 0 check (used_credits >= 0),
  updated_at timestamptz default now() not null,
  primary key (project_id, window_start)
);

create index if not exists cloud_sync_usage_by_project_window_idx
  on public.cloud_sync_usage_hourly_by_project(window_start desc);

alter table public.cloud_sync_usage_hourly_by_project enable row level security;

-- Dono ou membro do projeto pode ver/inserir/atualizar a cota daquele projeto
create policy "Dono ou membro vê cota do projeto"
  on public.cloud_sync_usage_hourly_by_project for select
  using (
    public.is_project_owner(project_id) or public.is_project_member(project_id)
  );

create policy "Dono ou membro insere cota do projeto"
  on public.cloud_sync_usage_hourly_by_project for insert
  with check (
    public.is_project_owner(project_id) or public.is_project_member(project_id)
  );

create policy "Dono ou membro atualiza cota do projeto"
  on public.cloud_sync_usage_hourly_by_project for update
  using (
    public.is_project_owner(project_id) or public.is_project_member(project_id)
  )
  with check (
    public.is_project_owner(project_id) or public.is_project_member(project_id)
  );
