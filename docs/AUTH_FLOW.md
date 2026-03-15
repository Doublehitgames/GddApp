# Fluxo de autenticação (proxy / middleware)

## Onde está a proteção

- **Arquivo:** `proxy.ts` na raiz (Next.js usa como middleware/proxy).
- **Rotas públicas:** `/login`, `/auth/callback`, `/s/`, `/public/` — acessíveis sem login.
- **Demais rotas:** exigem usuário autenticado; caso contrário o proxy redireciona para `/login`.

## Fluxo atual (resumido)

1. Request chega → bypass E2E? → path é `/api/*`? → segue sem checar auth.
2. Cria cliente Supabase (cookies do request).
3. `getUserWithTimeout(supabase)` (máx. 4s):
   - **Sucesso:** `{ user, timedOut: false, hadError: false }`
   - **Timeout:** `{ user: null, timedOut: true }`
   - **Erro (rede/Supabase):** `{ user: null, hadError: true }`
4. **Problema que quebrou o fluxo:**
   - Se `timedOut === true` e não é rota pública → **deixa passar** (`NextResponse.next()`).
   - Se `hadError === true` e não é rota pública → **deixa passar** (`NextResponse.next()`).
   - Só redireciona para `/login` quando `!user && !isPublicRoute` **e** não deu timeout/erro.

Ou seja: quando a verificação de auth demora ou falha (rede, Supabase lento), o usuário **não logado** acaba vendo a home e os projetos (localStorage) em vez de ser mandado para o login.

## Comportamento desejado

- **Sem login:** sempre redirecionar para `/login` em rotas protegidas.
- **Com login:** home e app normais; ao acessar `/login` já logado, redirecionar para `/`.

## Correção aplicada

- Em rotas não públicas, tratar **timeout** e **erro** como “não autenticado” e redirecionar para `/login`, em vez de deixar passar.
- Assim, o fluxo fica coerente de novo: só vê projetos quem está logado; quem não está vai para a tela de login.

---

## Troubleshooting (login / Google)

### Supabase em modo pausado

No plano Free, projetos inativos ficam **pausados** após um tempo. Enquanto estiver pausado:

- Auth (email e **Google**) deixa de funcionar.
- O usuário pode ser redirecionado para uma **página de erro** do Supabase ao clicar em “Login com Google” (URL tipo `.../auth/v1/authorize?provider=google&...`).

**Solução:** no [Supabase Dashboard](https://supabase.com/dashboard), abrir o projeto e **reativar/despausar** o projeto. Após alguns minutos, login e sync voltam ao normal.

### Redirect URL / Google

Se o erro for de “Redirect URL not allowed” ou “redirect_uri_mismatch”, conferir:

- **Supabase** → Authentication → URL Configuration → **Redirect URLs**: incluir `http://localhost:3000/auth/callback` (e a URL de produção se houver).
- **Google Cloud Console** → Credentials → OAuth 2.0 → **Authorized redirect URIs**: incluir `https://<seu-projeto>.supabase.co/auth/v1/callback`.
