-- ============================================================
-- GDD Manager - Quota de créditos de sync por hora
-- Execute esse SQL no Supabase SQL Editor
-- ============================================================

create table if not exists public.cloud_sync_usage_hourly (
  user_id uuid references auth.users(id) on delete cascade not null,
  window_start timestamptz not null,
  used_credits integer not null default 0 check (used_credits >= 0),
  updated_at timestamptz default now() not null,
  primary key (user_id, window_start)
);

create index if not exists cloud_sync_usage_hourly_window_start_idx
  on public.cloud_sync_usage_hourly(window_start desc);

alter table public.cloud_sync_usage_hourly enable row level security;

create policy "Usuário vê próprio consumo de sync"
  on public.cloud_sync_usage_hourly for select
  using (auth.uid() = user_id);

create policy "Usuário cria próprio consumo de sync"
  on public.cloud_sync_usage_hourly for insert
  with check (auth.uid() = user_id);

create policy "Usuário atualiza próprio consumo de sync"
  on public.cloud_sync_usage_hourly for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
