# 🤖 Configuração da IA

## Passo 1: Escolha seu Provider

Você tem 3 opções:

### 🆓 Opção 1: Groq (RECOMENDADO - GRÁTIS)

**Melhor para começar!**

1. Acesse: https://console.groq.com
2. Crie uma conta (grátis)
3. Vá em "API Keys" e crie uma nova chave
4. Copie a chave

**Vantagens:**
- 100% gratuito
- Velocidade extremamente rápida
- Limite generoso: 30 req/minuto
- Modelo: Llama 3.1 70B (excelente qualidade)

---

### 💰 Opção 2: OpenAI (Pago, mas barato)

1. Acesse: https://platform.openai.com
2. Crie uma conta
3. Adicione créditos (mínimo $5)
4. Vá em "API Keys" e crie uma nova chave
5. Copie a chave

**Custos:**
- $5 grátis para novos usuários
- gpt-4o-mini: $0.15/1M tokens (super barato)
- Gerar um GDD completo: ~$0.01-0.05

---

### 💎 Opção 3: Claude (Premium)

1. Acesse: https://console.anthropic.com
2. Crie uma conta
3. Adicione créditos
4. Vá em "API Keys" e crie uma nova chave
5. Copie a chave

**Custos:**
- Claude 3.5 Sonnet: $3/1M tokens input
- Melhor para documentos longos e complexos

---

## Passo 2: Configurar no Projeto

### 2.1. Criar arquivo `.env.local`

Na raiz do projeto, crie um arquivo chamado `.env.local`:

```bash
# Windows PowerShell
Copy-Item .env.example .env.local
```

### 2.2. Editar `.env.local`

Abra o arquivo e configure:

**Para Groq (recomendado):**
```env
NEXT_PUBLIC_AI_PROVIDER=groq
GROQ_API_KEY=gsk_sua_chave_aqui
```

**Para OpenAI:**
```env
NEXT_PUBLIC_AI_PROVIDER=openai
OPENAI_API_KEY=sk-sua_chave_aqui
```

**Para Claude:**
```env
NEXT_PUBLIC_AI_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-sua_chave_aqui
```

### 2.3. Reiniciar o servidor

```bash
# Pare o servidor (Ctrl+C)
# Inicie novamente
npm run dev
```

---

## Passo 3: Testar

1. Acesse http://localhost:3000
2. Clique em **"🤖 Criar com IA"**
3. Preencha:
   - Tipo: "RPG 2D"
   - Descrição: "Um jogo de RPG com combate por turnos"
4. Clique em **"✨ Gerar GDD com IA"**

Se funcionar, você verá um template completo gerado em segundos! 🎉

---

## Solução de Problemas

### Erro: "API key not found"
- Verifique se o arquivo `.env.local` está na raiz do projeto
- Verifique se a variável está escrita corretamente
- Reinicie o servidor Next.js

### Erro: "Failed to generate template"
- Verifique se a API key está correta
- Para Groq: verifique se não atingiu o rate limit (30/min)
- Para OpenAI: verifique se tem créditos na conta

### Erro: "401 Unauthorized"
- A API key está inválida ou expirada
- Gere uma nova chave no console do provider

---

## Funcionalidades Disponíveis

### ✨ 1. Criar GDD com IA
- Página: `/ai-create`
- Gera estrutura completa de GDD
- Cria seções e subseções automaticamente
- Preenche com conteúdo inicial

### 💬 2. Chat Assistente
- Botão flutuante em cada projeto (🤖)
- Conversa sobre o GDD
- Sugere melhorias
- Analisa consistência
- Ajuda a expandir seções

### 📝 3. Comandos Úteis no Chat
- "Analise meu GDD"
- "Sugira seções faltantes"
- "O que devo adicionar em [Nome da Seção]?"
- "Crie uma nova seção sobre [Tema]"
- "Revise a consistência do documento"

---

## Comparação de Providers

| Feature | Groq | OpenAI | Claude |
|---------|------|--------|--------|
| **Custo** | Grátis | $0.15/1M | $3/1M |
| **Velocidade** | ⚡⚡⚡ | ⚡⚡ | ⚡ |
| **Qualidade** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Docs Longos** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Rate Limit** | 30/min | 500/min | 50/min |

**Recomendação:**
- **Desenvolvimento/Testes:** Groq (grátis e rápido)
- **Produção pequena:** OpenAI gpt-4o-mini (barato e bom)
- **Produção premium:** Claude 3.5 Sonnet (melhor qualidade)

---

## Dúvidas?

Caso tenha problemas, verifique:
1. Arquivo `.env.local` existe e está correto
2. Servidor Next.js foi reiniciado após criar `.env.local`
3. API key é válida e tem créditos (se aplicável)
4. Conexão com internet está funcionando

🎉 Agora você tem IA integrada no seu GDD Manager!
