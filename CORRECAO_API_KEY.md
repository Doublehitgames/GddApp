# ⚠️ CORREÇÃO URGENTE - Variáveis de Ambiente

## Problema Identificado

O erro `API key not found for provider: groq` acontece porque as variáveis de ambiente estavam configuradas incorretamente.

## ✅ SOLUÇÃO

### 1. Atualize seu `.env.local`

Abra o arquivo `.env.local` na raiz do projeto e use este formato:

```env
# AI Provider (SEM o prefixo NEXT_PUBLIC_)
AI_PROVIDER=groq

# API Key (SEM o prefixo NEXT_PUBLIC_)
GROQ_API_KEY=gsk_sua_chave_aqui
```

### 2. Reinicie o Servidor

```powershell
# Pare o servidor (Ctrl+C)
# Inicie novamente
npm run dev
```

## 📝 Explicação Técnica

No Next.js:
- `NEXT_PUBLIC_*` = Exposto no cliente (navegador) ❌ Inseguro para API keys
- Sem prefixo = Apenas no servidor ✅ Seguro para API keys

## ✅ Checklist

- [ ] Arquivo `.env.local` existe na raiz do projeto
- [ ] Contém `AI_PROVIDER=groq` (SEM NEXT_PUBLIC_)
- [ ] Contém `GROQ_API_KEY=sua_chave` (SEM NEXT_PUBLIC_)
- [ ] Servidor foi reiniciado após alterar .env.local

## 🎯 Exemplo de .env.local Correto

```env
AI_PROVIDER=groq
GROQ_API_KEY=gsk_abc123def456ghi789jkl
```

## 🚀 Teste Novamente

Após configurar e reiniciar, tente criar um projeto com IA novamente!
