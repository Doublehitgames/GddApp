# 🚀 Início Rápido - GDD Manager

## Pré-requisitos

- Node.js 20+
- npm 10+
- Projeto Supabase já criado

---

## Setup Local (5 minutos)

### 1) Clonar e instalar

```bash
git clone https://github.com/Doublehitgames/GddApp.git
cd gdd_project
npm install
```

### 2) Configurar variáveis de ambiente

Crie o arquivo `.env.local` na raiz com:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Compatibilidade (opcional):

```env
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

> A `service_role` nunca deve ficar no frontend.

### 3) Rodar em desenvolvimento

```bash
npm run dev
```

Acesse: http://localhost:3000

---

## Configuração opcional de IA

A IA **não** usa variável de ambiente: cada usuário cola a própria chave em
**Configurações → IA** (`/settings/ai`) depois de logar. Veja
[AI_SETUP.md](AI_SETUP.md).

---

## Comandos principais

```bash
npm run dev
npm run build
npm run start
npm test
npm run test:e2e
npm run test:e2e:smoke
npm run test:e2e:critical
```

---

## Deploy (Vercel)

No Vercel, configure em **Settings → Environment Variables**:

- `NEXT_PUBLIC_SITE_URL` = `https://gdd-app.vercel.app`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (compatibilidade)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

No Supabase, configure em **Auth → URL Configuration**:

- **Site URL**: `https://gdd-app.vercel.app`
- **Redirect URLs**:
	- `https://gdd-app.vercel.app/auth/callback`
	- `http://localhost:3000/auth/callback`
	- `https://*.vercel.app/auth/callback`

Depois faça redeploy do último commit.

---

## Validação mínima após subir

1. Login
2. Criar projeto
3. Criar seção/subseção
4. Confirmar persistência no Supabase sem refresh manual

---

## Leitura recomendada

- [README.md](../README.md)
- [GUIA_TESTES.md](GUIA_TESTES.md)
- [DEPLOY_VERCEL.md](DEPLOY_VERCEL.md)
