# Variáveis de ambiente e Vercel

O app é implantado na **Vercel**. As variáveis de ambiente **não** ficam no Supabase; elas são configuradas em dois lugares, conforme o ambiente:

## Onde configurar

| Ambiente        | Onde configurar |
|----------------|------------------|
| **Produção**   | **Vercel**: Dashboard do projeto → **Settings** → **Environment Variables**. Adicione as variáveis (Production, Preview, Development conforme quiser). |
| **Local**      | Arquivo **`.env.local`** na raiz do projeto (não commitar; já deve estar no `.gitignore`). |

No **Supabase** você só **copia** a URL e as chaves do projeto (Project Settings → API). Quem “guarda” essas informações para o app Next.js em produção é o **Vercel**.

## Variáveis usadas pelo app

Segue a [documentação oficial de API keys do Supabase](https://supabase.com/docs/guides/api/api-keys):

### Obrigatórias para auth + sync

- **`NEXT_PUBLIC_SUPABASE_URL`** – URL do projeto (ex.: `https://xxxxx.supabase.co`). No Supabase: Project Settings → API → Project URL.
- **`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`** – Chave pública (`sb_publishable_...`). No Supabase: **API Keys** → Publishable key. Fallback legado: `NEXT_PUBLIC_SUPABASE_ANON_KEY` (JWT anon).

### Obrigatória no Vercel para colaboração (convite de membros)

Se você usa **convite de membros por e-mail** (Compartilhar projeto → Adicionar como editor), a API precisa de uma chave de backend para buscar usuários em `profiles` e inserir em `project_members`. **No Vercel você precisa configurar uma das duas:**

- **`SUPABASE_SECRET_KEY`** (recomendado) – Secret key (`sb_secret_...`). No Supabase: **API Keys** → Secret key.
- **`SUPABASE_SERVICE_ROLE_KEY`** (alternativa) – JWT `service_role` (legado). No Supabase: **API Keys** → service_role.

**Sem essa variável no Vercel**, o convite por e-mail retorna erro 500 em produção. Em local, use a mesma variável no `.env.local`.

**Nunca** expor essa chave no client ou em repositório; ela é usada só no servidor (`lib/supabase/admin.ts`).

### Opcionais

- **`CLOUD_SYNC_CREDITS_PER_HOUR`** – Créditos de sync por hora; default: 30.
- **`NEXT_PUBLIC_GOOGLE_CLIENT_ID`** – ID do cliente OAuth 2.0 do Google (termina em `.apps.googleusercontent.com`). Usado pelo botão **Inserir imagem do Google Drive**. Configuração completa: `docs/GOOGLE_DRIVE_IMAGES.md`.

## Depois de alterar no Vercel

Após adicionar ou mudar variáveis no Vercel, é necessário **redeploy** (novo deploy) para as mudanças valerem. Pode ser um redeploy manual (Deployments → ⋮ → Redeploy) ou um novo push que dispare o deploy.
