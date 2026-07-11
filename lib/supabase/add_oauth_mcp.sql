-- ============================================================
-- OAuth 2.1 para o MCP remoto (/api/mcp)
-- Permite que clientes MCP (claude.ai, Claude Desktop, etc.)
-- se conectem via OAuth com Dynamic Client Registration.
--
-- Rodar no Supabase SQL Editor.
-- ============================================================

-- Clientes registrados dinamicamente (RFC 7591).
-- Clientes públicos (PKCE obrigatório), sem client_secret.
create table public.oauth_clients (
  id uuid default gen_random_uuid() primary key,   -- client_id
  client_name text,
  redirect_uris jsonb not null,                    -- array de URIs exatas
  client_uri text,
  logo_uri text,
  created_at timestamptz default now() not null
);

-- Authorization codes (curta duração, uso único).
create table public.oauth_codes (
  code_hash text primary key,                      -- SHA-256 hex do code
  client_id uuid references public.oauth_clients(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  redirect_uri text not null,
  code_challenge text not null,                    -- PKCE S256
  scope text,
  expires_at timestamptz not null,
  created_at timestamptz default now() not null
);

-- Access + refresh tokens (armazenados como hash, como user_api_keys).
create table public.oauth_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  client_id uuid references public.oauth_clients(id) on delete cascade not null,
  access_token_hash text not null unique,
  refresh_token_hash text unique,
  scope text,
  access_expires_at timestamptz not null,
  refresh_expires_at timestamptz,
  revoked_at timestamptz,                          -- soft-revoke (null = ativo)
  last_used_at timestamptz,
  created_at timestamptz default now() not null
);

create index oauth_codes_expires_idx on public.oauth_codes(expires_at);
create index oauth_tokens_user_id_idx on public.oauth_tokens(user_id);
create index oauth_tokens_access_idx on public.oauth_tokens(access_token_hash);
create index oauth_tokens_refresh_idx on public.oauth_tokens(refresh_token_hash);

-- RLS ligado sem policies: só o service role (backend) acessa.
alter table public.oauth_clients enable row level security;
alter table public.oauth_codes enable row level security;
alter table public.oauth_tokens enable row level security;

-- Usuário pode ver/revogar as próprias conexões (futuro painel em /settings).
create policy "Usuário vê seus tokens OAuth"
  on public.oauth_tokens for select
  using (auth.uid() = user_id);

create policy "Usuário revoga seus tokens OAuth"
  on public.oauth_tokens for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
