# 📸 Guia Visual - IA no GDD Manager

## 🎯 Fluxo de Uso

### 1. Homepage - Botões de Criação

```
┌─────────────────────────────────────────────┐
│            🎮 GDD App                       │
├─────────────────────────────────────────────┤
│                                             │
│   ┌────────────────┐  ┌──────────────────┐ │
│   │ Criar novo     │  │ 🤖 Criar com IA │ │
│   │ projeto        │  │ (NOVO!)         │ │
│   └────────────────┘  └──────────────────┘ │
│                                             │
│   📁 Projeto: RPG Demo                     │
│      📑 5   📄 12   ∑ 17                   │
│                                             │
└─────────────────────────────────────────────┘
```

---

### 2. Página de Criação com IA

#### Etapa 1: Input
```
┌─────────────────────────────────────────────┐
│   🤖 Criar GDD com IA                       │
│   Descreva seu jogo e deixe a IA criar...  │
├─────────────────────────────────────────────┤
│                                             │
│  🎮 Tipo de Jogo *                         │
│  ┌─────────────────────────────────────┐   │
│  │ Roguelike 2D                        │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  📝 Descrição do Jogo *                    │
│  ┌─────────────────────────────────────┐   │
│  │ Jogo de exploração de dungeons     │   │
│  │ com combate tático e itens         │   │
│  │ aleatórios. Progressão permanente  │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ✨ Informações Adicionais                 │
│  ┌─────────────────────────────────────┐   │
│  │ Pixel art, tema medieval           │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  [Cancelar]  [✨ Gerar GDD com IA]        │
│                                             │
└─────────────────────────────────────────────┘
```

#### Etapa 2: Gerando
```
┌─────────────────────────────────────────────┐
│                                             │
│               🤖 (animando)                 │
│                                             │
│         Gerando seu GDD...                  │
│   A IA está criando uma estrutura          │
│   personalizada para seu projeto            │
│                                             │
│          ● ● ●  (pulsando)                 │
│                                             │
└─────────────────────────────────────────────┘
```

#### Etapa 3: Preview
```
┌─────────────────────────────────────────────┐
│   ✅ Template Gerado!                       │
│   Revise a estrutura e clique em...        │
├─────────────────────────────────────────────┤
│                                             │
│  📋 Roguelike Medieval                      │
│     Jogo de exploração com combate...      │
│                                             │
│  📚 Seções (7):                            │
│  ├─ 📖 Overview                            │
│  │  └─ Conceito                            │
│  │  └─ Pilares do Design                   │
│  ├─ ⚔️ Sistema de Combate                  │
│  │  └─ Mecânicas de Ataque                │
│  │  └─ Sistema de Skills                   │
│  ├─ 🎲 Geração Procedural                  │
│  ├─ 📈 Progressão                          │
│  ├─ 🎨 Arte e Visual                       │
│  ├─ 🔊 Audio                               │
│  └─ 💻 Tecnologia                          │
│                                             │
│  [← Voltar]  [🚀 Criar Projeto]           │
│                                             │
└─────────────────────────────────────────────┘
```

---

### 3. Projeto com Chat Assistente

```
┌──────────────────────────┬──────────────────┐
│ Voltar para Home         │ 🤖 Assistente AI │
├──────────────────────────┤ Powered by IA  X │
│                          ├──────────────────┤
│ 🎮 Roguelike Medieval    │                  │
│    [Editar]              │ 🤖 Olá! Estou   │
│                          │ aqui para ajudar │
│ Jogo de exploração...    │ com o projeto... │
│                          │                  │
│ 🔍 Buscar seções...      │ ──────────────── │
│                          │                  │
│ Seções                   │ 👤 Analise meu  │
│ ├─ 📖 Overview          │ GDD e sugira    │
│ ├─ ⚔️ Sistema Combat    │ melhorias       │
│ ├─ 🎲 Geração Proc.     │                  │
│ ├─ 📈 Progressão        │ ──────────────── │
│ └─ 🎨 Arte              │                  │
│                          │ 🤖 Analisando...│
│ Nova seção               │                  │
│ [___________] [Adicionar]│ [Digite msg...] │
│                          │ [    Enviar    ] │
└──────────────────────────┴──────────────────┘
```

#### Com botão flutuante fechado:
```
┌─────────────────────────────────────────────┐
│                                             │
│  Conteúdo do projeto...                    │
│                                             │
│                                             │
│                                        🤖   │ ← Botão flutuante
│                                    [Assistente]
└─────────────────────────────────────────────┘
```

---

## 🎨 Elementos Visuais

### Cores e Gradientes

#### Botão "Criar com IA"
- **Fundo:** Gradiente purple-600 → pink-600
- **Hover:** purple-700 → pink-700
- **Ícone:** 🤖 (emoji)

#### Header do Chat
- **Fundo:** Gradiente blue-50 → purple-50
- **Ícone:** 🤖 (emoji)

#### Botão Flutuante
- **Fundo:** Gradiente blue-600 → purple-600
- **Hover:** Scale 1.1 + Shadow aumentada
- **Posição:** Bottom-right (24px margin)

#### Mensagens do Chat
- **Usuário:** bg-blue-600, text-white, align-right
- **Assistente:** bg-gray-100, text-gray-900, align-left
- **Loading:** bg-gray-100, animate-pulse

---

## 📱 Responsividade

### Desktop (≥1024px)
```
┌────────────────────┬────────────┐
│                    │            │
│   Conteúdo         │   Chat     │
│   Principal        │   384px    │
│   (flex-1)         │   fixo     │
│                    │            │
└────────────────────┴────────────┘
```

### Mobile (<1024px)
```
┌──────────────────────┐
│                      │
│   Conteúdo           │
│   Principal          │
│   (full width)       │
│                      │
│                      │
│              🤖      │ ← Botão flutuante
└──────────────────────┘

Chat abre em overlay fullscreen
```

---

## 🎭 Animações

### Botão Flutuante
- **Hover:** `transform: scale(1.1)`
- **Transição:** `all 300ms ease`

### Loading da IA
- **Texto:** Fade in/out
- **Dots:** Pulse com delay em cascata
- **Ícone 🤖:** Bounce animation

### Mensagens do Chat
- **Entrada:** Slide from bottom
- **Scroll:** Smooth scroll para última mensagem

---

## 🔤 Tipografia

### Títulos
- **H1:** `text-4xl font-bold`
- **H2:** `text-2xl font-bold`
- **H3:** `text-xl font-semibold`

### Chat
- **Mensagem:** `text-sm` ou `text-base`
- **Timestamp:** `text-xs text-gray-400`

### Botões
- **Primary:** `font-semibold`
- **Secondary:** `font-medium`

---

## 📐 Espaçamentos

### Containers
- **Padding:** `p-4` a `p-8`
- **Gap entre elementos:** `gap-4` ou `gap-6`

### Chat
- **Mensagens:** `space-y-4`
- **Padding mensagem:** `px-4 py-2`
- **Input padding:** `px-4 py-2`

---

## 🎯 Estados Visuais

### Botões
```
[Normal]    bg-blue-600
[Hover]     bg-blue-700
[Disabled]  bg-gray-300 opacity-50
[Loading]   bg-blue-600 + spinner
```

### Input
```
[Normal]    border-gray-300
[Focus]     ring-2 ring-blue-500
[Error]     border-red-500
```

### Chat Messages
```
[Normal]    static
[Loading]   animate-pulse
[Error]     bg-red-50 border-red-200
```

---

## 🎨 Ícones e Emojis

### Emojis Usados
- 🤖 - Assistente de IA
- 🎮 - Jogos
- ✨ - Geração/Mágica
- 🚀 - Criar/Lançar
- 📖 - Overview
- ⚔️ - Combate
- 🎲 - Aleatoriedade
- 📈 - Progressão
- 🎨 - Arte
- 🔊 - Audio
- 💻 - Tecnologia
- 📝 - Descrição
- 🔍 - Busca
- ✅ - Sucesso
- ❌ - Erro

---

## 🎬 Fluxo Completo em ASCII

```
    [Homepage]
         │
         ├──→ [Criar Normal] ──→ [Formulário] ──→ [Projeto]
         │
         └──→ [🤖 Criar IA]
                   │
                   ↓
            [Input Form]
              🎮 Tipo
              📝 Descrição
              ✨ Info Extra
                   │
                   ↓
            [🤖 Gerando...]
              (10-20s)
                   │
                   ↓
            [Preview Template]
              7 seções
              conteúdo
                   │
                   ├──→ [← Voltar] ──→ [Input Form]
                   │
                   └──→ [🚀 Criar] ──→ [Projeto Criado]
                                           │
                                           ↓
                                    [🤖 Chat Disponível]
```

---

## 💡 Dicas de UX

### Feedback Visual
- ✅ Loading states em todas operações assíncronas
- ✅ Animações suaves (300ms transitions)
- ✅ Cores consistentes com brand
- ✅ Ícones/emojis para identificação rápida

### Acessibilidade
- ✅ `aria-label` em botões sem texto
- ✅ Contraste de cores adequado
- ✅ Focus visible em elementos interativos
- ✅ Mensagens de erro claras

### Mobile First
- ✅ Chat em overlay no mobile
- ✅ Botão flutuante sempre acessível
- ✅ Touch targets ≥44px
- ✅ Scroll suave

---

**Agora você tem uma visão completa da interface!** 🎨
