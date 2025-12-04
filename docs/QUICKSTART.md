# 🚀 Início Rápido - GDD Manager com IA

## 📋 Pré-requisitos

- Node.js 18+ instalado
- Uma conta em um provider de IA (recomendado: Groq - grátis)

---

## ⚡ Setup em 5 Minutos

### 1️⃣ Clone e Instale

```bash
# Clone o repositório
git clone <repo-url>
cd gdd_project

# Instale as dependências
npm install
```

### 2️⃣ Configure a IA (IMPORTANTE!)

#### Opção A: Groq (Grátis - Recomendado)

1. Acesse: https://console.groq.com
2. Crie conta (grátis)
3. Vá em "API Keys" → "Create API Key"
4. Copie a chave

```bash
# Crie o arquivo .env.local
Copy-Item .env.example .env.local

# Edite .env.local e adicione:
NEXT_PUBLIC_AI_PROVIDER=groq
GROQ_API_KEY=gsk_sua_chave_aqui
```

#### Opção B: OpenAI (Pago, mas barato)

```env
NEXT_PUBLIC_AI_PROVIDER=openai
OPENAI_API_KEY=sk-sua_chave_aqui
```

### 3️⃣ Inicie o Projeto

```bash
npm run dev
```

Acesse: http://localhost:3000

---

## 🎯 Primeiro Uso

### Criar seu Primeiro GDD com IA

1. Clique em **"🤖 Criar com IA"**
2. Preencha:
   - **Tipo:** "RPG 2D"
   - **Descrição:** "Um jogo de aventura com combate por turnos e exploração de dungeons"
3. Clique em **"✨ Gerar GDD com IA"**
4. Aguarde ~10 segundos
5. Revise a estrutura gerada
6. Clique em **"🚀 Criar Projeto"**

**Pronto!** 🎉 Você tem um GDD completo com 5-8 seções preenchidas!

---

## 💡 Usando o Chat Assistente

1. Entre no projeto criado
2. Clique no botão flutuante **🤖** (canto inferior direito)
3. Experimente perguntar:

```
"Analise meu GDD e sugira melhorias"
```

```
"O que posso adicionar na seção de Combate?"
```

```
"Crie uma nova seção sobre Sistema de Progressão"
```

---

## 🛠️ Comandos Úteis

```bash
# Desenvolvimento
npm run dev           # Inicia em http://localhost:3000

# Produção
npm run build         # Build otimizado
npm run start         # Servidor de produção

# Qualidade
npm run lint          # Verifica código
```

---

## 📚 Documentação Completa

- [📖 README Completo](../README.md)
- [🤖 Configuração Detalhada da IA](./AI_SETUP.md)
- [🔗 Sistema de Referências Cruzadas](../GUIA_REFERENCIAS.md)
- [🖼️ Upload de Imagens](./IMAGES.md)
- [🧪 Como Testar](../COMO_TESTAR.md)

---

## ❓ Problemas Comuns

### ❌ Erro: "API key not found"

**Solução:**
1. Verifique se `.env.local` existe na raiz do projeto
2. Verifique se a variável está correta (sem espaços)
3. Reinicie o servidor: Ctrl+C → `npm run dev`

### ❌ Erro: "Failed to generate template"

**Solução:**
1. Verifique se a API key é válida
2. Para Groq: pode ter atingido rate limit (30/min)
3. Tente novamente em alguns segundos

### ❌ IA não responde

**Solução:**
1. Abra o console do navegador (F12)
2. Procure por erros
3. Verifique conexão com internet
4. Confirme que `.env.local` está configurado

---

## 🎉 Está Pronto!

Agora você pode:

- ✅ Criar GDDs completos em segundos com IA
- ✅ Conversar com o assistente para expandir ideias
- ✅ Organizar documentos hierarquicamente
- ✅ Usar referências cruzadas inteligentes
- ✅ Upload de imagens
- ✅ Busca avançada

**Dica:** Explore os documentos de teste em `COMO_TESTAR.md` para ver todos os recursos!

---

## 💬 Precisa de Ajuda?

- Leia a [documentação completa](../README.md)
- Veja os [exemplos de uso](../COMO_TESTAR.md)
- Consulte o [guia de configuração da IA](./AI_SETUP.md)

Bom trabalho! 🚀
