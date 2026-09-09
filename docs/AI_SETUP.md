# Configuração da IA

A IA do GDD Manager usa a **sua** chave de API, configurada **dentro do app** —
não em variável de ambiente. Cada usuário tem a própria chave, então nada precisa
ser redeployado quando alguém troca de provider.

## Onde configurar

1. Faça login no app.
2. Vá em **Configurações → IA** (`/settings/ai`).
3. Escolha o **provider** (Groq, OpenAI ou Claude), cole a **API key** e salve.

A configuração fica salva no seu perfil (coluna `ai_config` da tabela `profiles`),
com `localStorage` como fallback quando você está offline. A chave viaja no header
`x-ai-key` a cada chamada e **não** fica em log nem em banco de outra pessoa.

> Não existe `AI_PROVIDER`, `GROQ_API_KEY`, `OPENAI_API_KEY` nem
> `ANTHROPIC_API_KEY` no código. Se você achar essas variáveis em algum guia
> antigo, ignore: nenhuma é lida.

## Onde pegar a chave

| Provider | Console | Formato da chave |
|---|---|---|
| **Groq** | <https://console.groq.com/keys> | `gsk_...` |
| **OpenAI** | <https://platform.openai.com/api-keys> | `sk-...` |
| **Claude** | <https://console.anthropic.com/> | `sk-ant-...` |

Groq tem tier gratuito, o que faz dele o caminho mais curto para experimentar.
OpenAI e Anthropic cobram por uso — consulte o preço atual no site de cada um
(preço e nome de modelo mudam com frequência; por isso não ficam anotados aqui).

Os modelos que o app usa no Groq estão em `GROQ_MODELS`, em
[`utils/ai/client.ts`](../utils/ai/client.ts) — um "premium" e um "rápido", usado
como fallback quando o primeiro bate rate limit.

## O que a IA faz no app

| Recurso | Onde |
|---|---|
| Gerar a estrutura inicial de um GDD | `/ai-create-simple` |
| Melhorar o texto de uma página | ações de IA na página |
| Sugerir tags de domínio (economia, combate, progressão…) | ações de IA na página |
| Importar um GDD existente | `/import` |

As rotas ficam em `app/api/ai/*` e os prompts em `utils/ai/prompts.ts`.
Para conversar sobre o GDD com um assistente, o caminho hoje é o MCP — ver a
seção de MCP no [AGENTS.md](../AGENTS.md).

## Quando dá errado

| Sintoma | Causa provável |
|---|---|
| "API key not found" / 400 | nenhuma chave salva em Configurações → IA |
| 401 Unauthorized | chave inválida, revogada ou de outro provider |
| 429 | rate limit ou cota do provider — esperar a janela ou trocar de modelo/provider |
| Resposta vazia ou truncada | documento grande demais para a janela de contexto do modelo escolhido |

O limite da IA é do **provider** e não tem nenhuma relação com os créditos de
sync do GDD Manager — esses são outra coisa, ver
[CREDITOS_SYNC.md](CREDITOS_SYNC.md).
