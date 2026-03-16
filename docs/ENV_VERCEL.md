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

- **`NEXT_PUBLIC_SUPABASE_URL`** – URL do projeto (ex.: `https://xxxxx.supabase.co`). No Supabase: Project Settings → API → Project URL.
- **`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`** – Chave pública (`sb_publishable_...`). Seguro expor no client (web, mobile). No Supabase: **API Keys** → Publishable key. Fallback legado: `NEXT_PUBLIC_SUPABASE_ANON_KEY` (JWT anon).
- **`CLOUD_SYNC_CREDITS_PER_HOUR`** (opcional) – Créditos de sync por hora; default: 30.
- **`SUPABASE_SECRET_KEY`** ou **`SUPABASE_SERVICE_ROLE_KEY`** (opcional) – Só em backend (ex.: share público, admin). Preferir a **secret key** (`sb_secret_...`) no Supabase → API Keys; alternativa legada: JWT `service_role`. **Nunca** expor no client ou em repositório público. No código, a chave é lida apenas em `lib/supabase/env.server.ts` (importado só por `admin.ts` e rotas server-side), para não entrar no bundle do client.
- **`NEXT_PUBLIC_GOOGLE_CLIENT_ID`** (opcional) – **Valor:** o ID do cliente OAuth 2.0 (Aplicativo da Web) do Google Cloud, copiado em Credenciais (o texto que termina em `.apps.googleusercontent.com`). Usado pelo botão **Inserir imagem do Google Drive** no editor de seções. Sem essa variável, o botão aparece mas ao clicar mostra aviso. **Configuração completa passo a passo:** `docs/GOOGLE_DRIVE_IMAGES.md` (Google Cloud, origens autorizadas, Vercel e redeploy).

## Depois de alterar no Vercel

Após adicionar ou mudar variáveis no Vercel, é necessário **redeploy** (novo deploy) para as mudanças valerem. Pode ser um redeploy manual (Deployments → ⋮ → Redeploy) ou um novo push que dispare o deploy.
