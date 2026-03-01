# 🚀 Guia de Deploy na Vercel

## ⏱️ Tempo Estimado: 5 minutos

---

## 📋 Passo a Passo

### 1️⃣ Criar Conta na Vercel

1. Acesse: https://vercel.com/signup
2. Clique em **"Continue with GitHub"**
3. Autorize a Vercel a acessar sua conta GitHub
4. Pronto! Conta criada ✅

**Por que usar GitHub?** Deploy automático toda vez que você fizer push!

---

### 2️⃣ Importar Projeto

1. No dashboard da Vercel, clique em **"Add New..."** → **"Project"**
2. Na lista de repositórios, encontre **"Doublehitgames/GddApp"**
3. Clique em **"Import"**

**Screenshot esperado:**
```
┌─────────────────────────────────┐
│  Import Git Repository          │
│                                  │
│  🔍 Search repositories...       │
│                                  │
│  ✓ Doublehitgames/GddApp        │
│    [Import] ←─── CLIQUE AQUI    │
└─────────────────────────────────┘
```

---

### 3️⃣ Configurar Projeto

**Vercel vai detectar automaticamente:**
- ✅ Framework: Next.js
- ✅ Build Command: `next build`
- ✅ Output Directory: `.next`
- ✅ Install Command: `npm install`

**Você NÃO precisa mudar NADA!** ✨

#### ⚙️ Variáveis de Ambiente (Opcional - Para IA)

Se quiser usar a IA no projeto online:

1. Clique em **"Environment Variables"**
2. Adicione:

```
Name: AI_PROVIDER
Value: groq

Name: GROQ_API_KEY
Value: sua_chave_aqui
```

**Importante:** Sem essas variáveis, o app funciona normalmente, mas sem IA.

---

### 4️⃣ Deploy!

1. Clique em **"Deploy"** (botão azul)
2. Aguarde ~2 minutos ⏳
3. Veja a mágica acontecer! ✨

**O que acontece:**
```
Installing dependencies... ✓
Building application... ✓
Deploying to Edge Network... ✓
🎉 Deployment ready!
```

---

### 5️⃣ Acessar Seu Projeto

Quando terminar, você verá:

```
🎉 Congratulations!

Your project is live at:
https://gdd-manager-xyz123.vercel.app

[Visit Site] [Go to Dashboard]
```

**Clique em "Visit Site"** e veja seu projeto online! 🌐

---

## 🎯 Resultado Final

Você terá:

### URL de Produção
```
https://gdd-manager-[seu-nome].vercel.app
```
- Deploy automático da branch `master`
- Atualiza em ~1 minuto após cada push

### URLs de Preview
Cada branch/PR terá seu próprio link:
```
https://gdd-manager-git-[branch].vercel.app
```

---

## 🔄 Deploy Automático Configurado!

### Como Funciona Agora:

```
Você → git push → GitHub → CI roda testes → Vercel faz deploy
                                  ↓
                            Se falhar ❌ → Deploy bloqueado
                            Se passar ✅ → Deploy automático
```

**Nunca mais precisa fazer deploy manual!** 🎉

---

## 📊 Monitoramento

### Dashboard da Vercel
- Ver logs de deploy
- Métricas de uso
- Tempo de build
- Visitantes

### Acesse: https://vercel.com/dashboard

---

## 🔧 Comandos Úteis (Opcional)

### Instalar CLI da Vercel (se quiser)
```bash
npm i -g vercel
```

### Deploy via CLI
```bash
vercel
```

### Ver logs em tempo real
```bash
vercel logs
```

**Mas não é necessário!** O deploy automático já funciona via GitHub.

---

## 🎨 Domínio Customizado (Opcional)

Quer usar `seuprojeto.com` ao invés de `.vercel.app`?

1. No dashboard da Vercel → Seu projeto
2. Settings → Domains
3. Add Domain
4. Siga instruções (precisa ter domínio registrado)

**Custo:** Domínio varia (Vercel não cobra pela hospedagem)

---

## ⚠️ Troubleshooting

### Erro: "Build Failed"
1. Verifique se `npm run build` funciona localmente
2. Veja logs no dashboard da Vercel
3. Geralmente é dependência faltando

### IA Não Funciona
1. Verifique se adicionou variáveis de ambiente
2. `AI_PROVIDER` e `GROQ_API_KEY` corretos?
3. Redeploy após adicionar variáveis

### Site Não Carrega
1. Aguarde ~2 minutos após deploy
2. Limpe cache do navegador (Ctrl+F5)
3. Tente em aba anônima

---

## ✅ Checklist

Após seguir o guia:

- [ ] Conta criada na Vercel
- [ ] Projeto importado do GitHub
- [ ] Deploy concluído com sucesso
- [ ] Site acessível via URL .vercel.app
- [ ] Variáveis de ambiente configuradas (se usar IA)
- [ ] Testado criar projeto no site online

### ✅ Checklist de Produção (Supabase + CI)

Antes de liberar para usuários, confirme também:

- [ ] Variáveis de ambiente no projeto Vercel:
      - [ ] `NEXT_PUBLIC_SITE_URL` = `https://gdd-app.vercel.app`
      - [ ] `NEXT_PUBLIC_SUPABASE_URL`
      - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
      - [ ] `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- [ ] Supabase Auth → URL Configuration:
      - [ ] **Site URL** = `https://gdd-app.vercel.app`
      - [ ] Redirect URL: `https://gdd-app.vercel.app/auth/callback`
      - [ ] Redirect URL: `http://localhost:3000/auth/callback`
      - [ ] Redirect URL: `https://*.vercel.app/auth/callback`
- [ ] Schema SQL aplicado no Supabase (`profiles`, `projects`, `sections`, `project_members`)
- [ ] Fix de RLS aplicado (`fix_rls_recursion.sql`)
- [ ] Coluna de IA aplicada em `profiles` (`add_ai_config.sql`)
- [ ] Google OAuth configurado no Supabase (se habilitado no app)
- [ ] Workflow de CI verde em push/PR (`tsc`, `jest`, `playwright`)
- [ ] E2E crítico passou (`npm run test:e2e:critical`)
- [ ] Smoke E2E passou (`npm run test:e2e:smoke`)
- [ ] Fluxo manual validado: criar projeto → seção/subseção → sem refresh → dados no cloud

---

## ⚠️ Risco Conhecido (Acompanhar)

- Dependência `@toast-ui/editor` (versão atual oficial) ainda referencia `dompurify@^2.x`.
- Isso mantém um alerta `moderate` no `npm audit --omit=dev`.
- Decisão atual: **não forçar override** de `dompurify` para evitar regressão no editor em produção.
- Mitigação já aplicada: `next` e `jspdf` atualizados; risco crítico removido.
- Ação futura: planejar migração/atualização do editor em uma sprint dedicada e revalidar `npm audit`.

---

## 🎉 Próximos Passos

Agora que está online:

1. **Compartilhe o link** com amigos/equipe
2. **Teste em celular** - acesse o link no mobile
3. **Monitore deploys** - veja no dashboard
4. **Continue desenvolvendo** - push → deploy automático!

---

## 📞 Suporte

**Vercel Docs:** https://vercel.com/docs
**Comunidade:** https://github.com/vercel/vercel/discussions

**Problemas com o projeto?** Abra issue no GitHub!

---

**Tudo pronto! Agora é só seguir os passos acima.** 🚀
