-- ============================================================
-- GDD Manager - Schema Supabase
-- Execute esse SQL no Supabase SQL Editor (uma vez só)
-- ============================================================

-- Habilitar extensão UUID
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABELA: profiles (vinculada ao auth.users)
-- ============================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz default now() not null
);

-- RLS: cada usuário vê e edita só seu próprio profile
alter table public.profiles enable row level security;

create policy "Usuário vê próprio profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Usuário edita próprio profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Trigger: cria profile automaticamente quando novo usuário se registra
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- TABELA: projects
-- ============================================================
create table public.projects (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text default '',
  mindmap_settings jsonb default '{}'::jsonb,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index projects_owner_id_idx on public.projects(owner_id);

-- ============================================================
-- TABELA: sections
-- ============================================================
create table public.sections (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  parent_id uuid references public.sections(id) on delete cascade,
  title text not null,
  content text default '',
  "order" integer default 0 not null,
  color text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index sections_project_id_idx on public.sections(project_id);
create index sections_parent_id_idx on public.sections(parent_id);

-- ============================================================
-- TABELA: project_members (colaboração)
-- ============================================================
create table public.project_members (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text check (role in ('editor', 'viewer')) default 'viewer' not null,
  invited_by uuid references auth.users(id),
  created_at timestamptz default now() not null,
  unique(project_id, user_id)
);

create index project_members_project_id_idx on public.project_members(project_id);
create index project_members_user_id_idx on public.project_members(user_id);

-- ============================================================
-- RLS: habilitar em todas as tabelas
-- ============================================================
alter table public.projects enable row level security;
alter table public.sections enable row level security;
alter table public.project_members enable row level security;

-- ============================================================
-- RLS POLICIES: projects
-- ============================================================
create policy "Dono vê seus projetos"
  on public.projects for select
  using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.project_members
      where project_id = projects.id and user_id = auth.uid()
    )
  );

create policy "Dono cria projetos"
  on public.projects for insert
  with check (auth.uid() = owner_id);

create policy "Dono edita seus projetos"
  on public.projects for update
  using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.project_members
      where project_id = projects.id and user_id = auth.uid() and role = 'editor'
    )
  );

create policy "Dono deleta seus projetos"
  on public.projects for delete
  using (auth.uid() = owner_id);

-- ============================================================
-- RLS POLICIES: sections
-- ============================================================
create policy "Acesso às seções via projeto"
  on public.sections for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = sections.project_id
      and (
        p.owner_id = auth.uid()
        or exists (
          select 1 from public.project_members pm
          where pm.project_id = p.id and pm.user_id = auth.uid()
        )
      )
    )
  );

create policy "Edição de seções via projeto"
  on public.sections for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = sections.project_id
      and (
        p.owner_id = auth.uid()
        or exists (
          select 1 from public.project_members pm
          where pm.project_id = p.id and pm.user_id = auth.uid() and pm.role = 'editor'
        )
      )
    )
  );

create policy "Update de seções via projeto"
  on public.sections for update
  using (
    exists (
      select 1 from public.projects p
      where p.id = sections.project_id
      and (
        p.owner_id = auth.uid()
        or exists (
          select 1 from public.project_members pm
          where pm.project_id = p.id and pm.user_id = auth.uid() and pm.role = 'editor'
        )
      )
    )
  );

create policy "Delete de seções via projeto"
  on public.sections for delete
  using (
    exists (
      select 1 from public.projects p
      where p.id = sections.project_id
      and (
        p.owner_id = auth.uid()
        or exists (
          select 1 from public.project_members pm
          where pm.project_id = p.id and pm.user_id = auth.uid() and pm.role = 'editor'
        )
      )
    )
  );

-- ============================================================
-- RLS POLICIES: project_members
-- ============================================================
create policy "Dono gerencia membros"
  on public.project_members for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_members.project_id and p.owner_id = auth.uid()
    )
  );

create policy "Membro vê sua própria entrada"
  on public.project_members for select
  using (auth.uid() = user_id);

-- ============================================================
-- Trigger: atualiza updated_at automaticamente
-- ============================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger sections_updated_at
  before update on public.sections
  for each row execute function public.set_updated_at();
