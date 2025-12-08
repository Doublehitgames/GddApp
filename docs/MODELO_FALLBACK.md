# Sistema de Fallback de Modelos IA

## 🎯 Objetivo

Garantir que o chat AI continue funcionando mesmo quando o modelo premium (Llama 3.3 70B) atinge o limite diário de tokens, alternando automaticamente para o modelo econômico (Llama 3.1 8B).

## 🚀 Como Usar

### Seleção Manual

No chat, você verá um dropdown no topo da área de input:

```
🤖 Modelo: [Dropdown ▼]
  • Llama 3.3 70B (Premium) - Melhor qualidade
  • Llama 3.1 8B (Rápido) - Mais econômico
```

**Para trocar manualmente:**
1. Clique no dropdown
2. Selecione o modelo desejado
3. Sua preferência é salva automaticamente
4. Continue a conversa normalmente - o histórico permanece!

### Fallback Automático

O sistema tem **3 pontos de detecção**:

#### 1. Ao Abrir o Chat (Detecção Inicial)
```
🔍 Sistema testa modelo premium em background
   ├─ Disponível → Usa 70B
   └─ Rate limit → Troca para 8B automaticamente
```

**Mensagem exibida:**
```
⚡ Modelo premium atingiu limite diário. Usando Llama 3.1 8B (rápido e funcional)!

Olá! Estou aqui para ajudar com o projeto...
```

#### 2. Durante a Conversação
Se você está usando 70B e atinge o limite:

```
[Usuário envia mensagem]
   ↓
[Sistema detecta erro 429]
   ↓
[Troca automaticamente para 8B]
   ↓
[Exibe mensagem de troca]
   ↓
[Usuário reenvia mensagem com novo modelo]
```

**Mensagem exibida:**
```
⚡ Modelo premium atingiu limite. Mudando automaticamente para Llama 3.1 8B 
(mais rápido e econômico). Você pode mudar manualmente depois.
```

#### 3. Troca Manual Preventiva
Você pode trocar antes de atingir o limite:
- Use o dropdown para selecionar 8B
- Economize tokens do 70B para tarefas mais complexas
- 8B é 3x mais rápido!

## 📊 Comparação de Modelos

### Llama 3.3 70B (Premium)

**Quando usar:**
- ✅ Projetos complexos com muitas seções
- ✅ Precisa de explicações muito detalhadas
- ✅ Primeira vez criando estrutura de GDD
- ✅ Quer sugestões mais elaboradas

**Características:**
- 70 bilhões de parâmetros
- Respostas mais longas e detalhadas
- Melhor compreensão de contexto
- ~14K tokens por minuto
- Ideal para brainstorming

**Exemplo de resposta:**
```
Dahora! Vou estruturar o sistema de combate considerando 
a arquitetura do seu jogo e as melhores práticas de GDD.

📊 Sistema de Combate (seção principal)
   ├─ ⚔️ Mecânicas Básicas
   │   └─ Ataques, defesa, esquiva, stamina
   ├─ 🎯 Sistema de Alvo
   │   └─ Mira assistida, troca rápida, priorização
   ├─ 💥 Combos e Habilidades Especiais
   │   └─ Encadeamento, inputs, cooldowns
   └─ ⚖️ Balanceamento
       └─ Curva de dificuldade, progressão de dano

Por que essa estrutura? [explicação detalhada...]

Vou criar conteúdo rico com exemplos de mecânicas similares 
em outros jogos e referências cruzadas com $[Sistema de Itens].

Digite 'sim' para eu executar! ✨
```

### Llama 3.1 8B (Rápido)

**Quando usar:**
- ✅ Já conhece o sistema, só quer executar
- ✅ Tarefas simples (criar, editar, remover)
- ✅ Precisa de velocidade
- ✅ Quer economizar tokens
- ✅ Modelo premium atingiu limite

**Características:**
- 8 bilhões de parâmetros
- Respostas mais diretas e concisas
- 3x mais rápido
- ~30K tokens por minuto
- Mesma funcionalidade de comandos

**Exemplo de resposta:**
```
Show! Vou criar sistema de combate:

📊 Sistema de Combate
   ├─ ⚔️ Mecânicas Básicas
   ├─ 🎯 Sistema de Alvo  
   ├─ 💥 Combos
   └─ ⚖️ Balanceamento

Estrutura padrão com referências ao $[Sistema de Itens].

Digite 'sim' pra eu criar! ✨
```

**Ambos executam comandos perfeitamente:**
```
[EXECUTAR]
CRIAR: Sistema de Combate | Conteúdo...
SUBSECAO: Mecânicas Básicas | Sistema de Combate | Conteúdo...
```

## 🔄 Fluxo Completo

### Cenário 1: Primeiro Uso (70B disponível)

```
1. Usuário: Abre projeto "Meu RPG"
2. Sistema: Testa 70B em background
3. Sistema: 70B disponível ✅
4. Chat: "Olá! Estou aqui para ajudar com Meu RPG..."
5. Dropdown: Mostra "Llama 3.3 70B (Premium)" selecionado
6. Usuário: "Cria seções sobre combate"
7. IA 70B: [Resposta detalhada com estrutura completa]
```

### Cenário 2: 70B Atingiu Limite (Detecção Inicial)

```
1. Usuário: Abre projeto "Meu RPG"
2. Sistema: Testa 70B em background
3. Sistema: 70B retorna erro 429 ❌
4. Sistema: Troca automaticamente para 8B
5. Chat: "⚡ Modelo premium atingiu limite. Usando 8B..."
6. Dropdown: Mostra "Llama 3.1 8B (Rápido)" + badge "⚡ Mudado automaticamente"
7. Usuário: "Cria seções sobre combate"
8. IA 8B: [Resposta concisa mas funcional]
```

### Cenário 3: Rate Limit Durante Conversa

```
1. Usuário: Está conversando com 70B
2. Usuário: "Adiciona mais detalhes ao combate"
3. Sistema: Envia requisição para 70B
4. API: Retorna erro 429 (rate limit)
5. Sistema: Detecta erro, troca para 8B
6. Chat: Mostra mensagem "⚡ Limite atingido, mudando para 8B..."
7. Sistema: Remove mensagem de "Pensando..."
8. Usuário: Reenvia mensagem
9. IA 8B: Responde com 8B agora
```

### Cenário 4: Troca Manual

```
1. Usuário: Está conversando com 70B
2. Usuário: Clica no dropdown
3. Usuário: Seleciona "Llama 3.1 8B (Rápido)"
4. Sistema: Salva preferência no localStorage
5. Sistema: Remove badge "Mudado automaticamente" se existir
6. Chat: Continua normalmente
7. Próximas mensagens: Usam 8B
8. Histórico: Mantido completamente
```

## 💾 Persistência

### O que é salvo?

```javascript
// localStorage
{
  "ai-model-preference": "llama-3.1-8b-instant"
}
```

### Quando é salvo?

- ✅ Ao trocar manualmente via dropdown
- ❌ NÃO salva quando troca automática (fallback)
  - Motivo: Quando 70B resetar, usuário vai querer usá-lo novamente

### Quando é carregado?

- Ao abrir o chat
- Após recarregar a página
- Em nova sessão do navegador (mesmo domínio)

### Como resetar?

1. **Via UI:** Selecione o modelo desejado no dropdown
2. **Via DevTools:**
   ```javascript
   localStorage.removeItem('ai-model-preference');
   location.reload();
   ```

## 🐛 Troubleshooting

### "Sempre usa 8B mesmo sem rate limit"

**Causa:** Preferência salva no localStorage  
**Solução:** Troque manualmente para 70B via dropdown

### "Não detecta rate limit"

**Verificar:**
1. Console do navegador - deve mostrar: `API Error: 429`
2. Terminal do servidor - deve mostrar erro Groq
3. Mensagem de erro no chat

**Se não detectar:**
- Verifique se `response.status === 429`
- Confirme que erro contém `rate_limit_exceeded`

### "Dropdown não aparece"

**Verificar:**
1. Componente AIChat renderizado?
2. CSS carregado corretamente?
3. Estado `selectedModel` inicializado?

### "Conversa some ao trocar modelo"

**Isso não deveria acontecer!**  
Estado `messages` é mantido ao trocar modelo.

**Debug:**
```javascript
// Em AIChat.tsx
console.log('Messages:', messages);
console.log('Selected model:', selectedModel);
```

### "Teste inicial demora muito"

Normal! O teste inicial:
- Faz requisição para API
- Espera resposta ou timeout
- Não bloqueia UI
- Acontece apenas uma vez

**Para acelerar:**
- Use modelo 8B manualmente desde o início
- Ou desabilite teste inicial (não recomendado)

## 🛠️ Personalização

### Desabilitar Detecção Automática Inicial

Em `AIChat.tsx`, comente o useEffect:

```typescript
// useEffect(() => {
//   const testModelAvailability = async () => {
//     ...
//   };
//   testModelAvailability();
// }, []);
```

### Adicionar Novos Modelos

1. Em `utils/ai/client.ts`:
```typescript
export const GROQ_MODELS = {
  PREMIUM: 'llama-3.3-70b-versatile',
  FAST: 'llama-3.1-8b-instant',
  NOVO: 'novo-modelo-groq', // Adicione aqui
} as const;
```

2. Em `AIChat.tsx`, adicione option:
```tsx
<option value="novo-modelo-groq">
  Novo Modelo - Descrição
</option>
```

### Mudar Ordem de Fallback

Em `AIChat.tsx`, troque ordem:

```typescript
// Fallback: 70B → 8B (atual)
if (selectedModel === 'llama-3.3-70b-versatile') {
  setSelectedModel('llama-3.1-8b-instant');
}

// Fallback: 8B → 70B (reverso)
if (selectedModel === 'llama-3.1-8b-instant') {
  setSelectedModel('llama-3.3-70b-versatile');
}
```

## 📈 Métricas

### Como Monitorar Uso

1. **Groq Console:**
   - https://console.groq.com/
   - Dashboard → Usage
   - Gráfico de tokens por modelo

2. **Logs do Servidor:**
   ```
   Error: API error: 429 - {
     "error": {
       "message": "Rate limit reached...",
       "Used": 98949,
       "Requested": 3477
     }
   }
   ```

3. **Console do Navegador:**
   ```
   API Error: 429 [detalhes do erro]
   Rate limit no modelo premium, tentando modelo rápido...
   ```

### Calcular Economia

```
Tokens economizados = (Msgs com 8B) × (Avg tokens 70B - Avg tokens 8B)

Exemplo:
- 10 mensagens com 70B: ~500 tokens cada = 5000 tokens
- 10 mensagens com 8B: ~200 tokens cada = 2000 tokens
- Economia: 3000 tokens (60%)
```

## 🎓 Boas Práticas

### Use 70B para:
- 🎨 Brainstorming inicial
- 📚 Aprender sobre GDD
- 🏗️ Estruturar projeto novo
- 🤔 Decisões de design complexas

### Use 8B para:
- ⚡ Criar seções simples
- ✏️ Editar conteúdo
- 🗑️ Remover seções
- 🔄 Tarefas repetitivas
- 💰 Economizar tokens

### Estratégia Híbrida:
1. **Início do dia:** Use 70B para planejamento
2. **Durante o dia:** Use 8B para execução
3. **Fim do dia:** Volte para 70B se necessário
4. **Próximo dia:** Rate limit resetou, comece com 70B

## 🔒 Segurança

### Dados Sensíveis

Ambos os modelos:
- ✅ Rodam na API Groq (não localmente)
- ✅ Seguem políticas de privacidade Groq
- ✅ Não armazenam conversas permanentemente
- ✅ localStorage apenas guarda preferência de modelo (não conteúdo)

### API Key

- ⚠️ Nunca comite `.env.local`
- ⚠️ Use variáveis de ambiente
- ⚠️ Rotacione keys periodicamente
- ✅ Keys são server-side apenas (Next.js API routes)

## 📚 Referências

- [Groq Documentation](https://console.groq.com/docs)
- [Llama 3.3 70B Model Card](https://huggingface.co/meta-llama/Llama-3.3-70B-Instruct)
- [Llama 3.1 8B Model Card](https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct)
- [Rate Limits Guide](./RATE_LIMITS.md)
