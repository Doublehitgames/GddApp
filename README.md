# 🎮 GDD Manager

<div align="center">

**Uma aplicação moderna e completa para gerenciar Game Design Documents (GDD)**

[![Next.js](https://img.shields.io/badge/Next.js-16.0-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Zustand](https://img.shields.io/badge/Zustand-5.0-orange)](https://zustand-demo.pmnd.rs/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.0-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![CI Status](https://github.com/Doublehitgames/GddApp/actions/workflows/ci.yml/badge.svg)](https://github.com/Doublehitgames/GddApp/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-122%20automated-brightgreen)]()

</div>

---

## 📋 Sobre o Projeto

**GDD Manager** é uma ferramenta profissional desenvolvida para criar, organizar e gerenciar documentos de Game Design de forma estruturada e hierárquica. Ideal para designers de jogos, produtores e equipes de desenvolvimento que precisam documentar mecânicas, narrativas, sistemas e todo o escopo de um projeto de jogo.

### 🎯 Por que usar o GDD Manager?

- ✅ **Organização Hierárquica**: Estruture seu GDD com seções e subseções ilimitadas
- ✅ **Editor Rico**: WYSIWYG e Markdown com suporte a imagens, tabelas, código e muito mais
- ✅ **🤖 IA Integrada**: Gere GDDs completos automaticamente e chat assistente inteligente
- ✅ **Referências Cruzadas**: Links inteligentes entre seções `$[Nome da Seção]`
- ✅ **Busca Inteligente**: Encontre rapidamente qualquer informação no seu documento
- ✅ **Drag & Drop**: Reordene seções com facilidade
- ✅ **Persistência Local**: Seus dados ficam seguros no navegador
- ✅ **Interface Moderna**: Design responsivo e intuitivo
- ✅ **122 Testes Automatizados**: Base sólida de qualidade e confiabilidade

---

## ✨ Funcionalidades

### 🆕 Atualizações recentes

- **Imagem de capa do projeto** com seleção via Google Drive.
- **Capa visível em 3 pontos**: detalhe do projeto, modo documento (DOC) e fundo do card na home.
- **Fallback de render de imagem do Drive** com múltiplas URLs candidatas.
- **Addons de seção** com arquitetura extensível via registry (`lib/addons/*`), incluindo persistência/sync.
- **Atalhos com emojis** para nome do projeto e títulos de seções.

### 🤖 Assistente de IA (NOVO!)

- **Geração Automática de GDD**: Descreva seu jogo e a IA cria toda a estrutura
- **Chat Inteligente**: Assistente lateral em cada projeto
- **Sugestões Contextuais**: IA entende seu GDD e sugere melhorias
- **Análise de Consistência**: Detecta inconsistências e lacunas no documento
- **Múltiplos Providers**: Suporte a Groq (grátis), OpenAI e Claude
- **Geração de Conteúdo**: Preenche seções vazias automaticamente

[📖 **Veja como configurar a IA →**](./docs/AI_SETUP.md)

### � Referências Cruzadas

- **Links entre seções**: Use `$[Nome da Seção]` para criar links automáticos
- **Links por ID**: Use `$[#sectionId]` para links estáveis (sobrevivem renomeação)
- **Validação automática**: Detecta referências quebradas (seções deletadas)
- **Backlinks**: Veja quais seções referenciam a seção atual
- **Visual diferenciado**: Links válidos em azul, inválidos em vermelho com linha ondulada

[📖 **Saiba mais sobre Referências →**](./GUIA_REFERENCIAS.md)

### �📁 Gerenciamento de Projetos

- **Criar múltiplos projetos GDD** com título e descrição
- **Visualização em lista** com estatísticas de seções
- **Edição inline** de informações do projeto
- **Remoção segura** com confirmação

### 📚 Sistema de Seções Hierárquicas

- **Estrutura em árvore ilimitada**: Crie seções, subseções, sub-subseções...
- **Navegação breadcrumb**: Saiba sempre onde você está na hierarquia
- **Contadores inteligentes**: Veja quantas seções e subseções cada projeto possui
- **Expansão/colapso**: Navegue facilmente por estruturas complexas

### ✏️ Editor de Conteúdo Avançado

#### Dois Modos de Edição:

1. **WYSIWYG (What You See Is What You Get)**
   - Editor visual intuitivo
   - Toolbar com todas as ferramentas necessárias
   - Preview em tempo real

2. **Markdown**
   - Sintaxe Markdown completa
   - Suporte a GitHub Flavored Markdown (GFM)
   - Ideal para usuários avançados

#### Recursos de Formatação:

- **Texto**: Negrito, itálico, tachado
- **Títulos**: H1 até H6
- **Listas**: Ordenadas, não-ordenadas e tarefas
- **Links e Imagens**: Suporte completo
- **Tabelas**: Crie tabelas formatadas
- **Blocos de código**: Syntax highlighting
- **Citações**: Blocos de quote
- **Linhas horizontais**: Separadores visuais

### 🖼️ Sistema de Upload de Imagens

- **Upload direto no editor**: Arraste ou selecione imagens
- **Formatos suportados**: JPG, PNG, GIF, WebP
- **Tamanho máximo**: 5MB por imagem
- **Organização automática**: Imagens organizadas por projeto
- **URLs públicas**: Acesso direto via `/uploads/[projectId]/[filename]`
- **Preview automático**: Renderização instantânea no Markdown

### 🔍 Sistema de Busca Avançado

- **Busca em tempo real**: Resultados instantâneos enquanto você digita
- **Busca em título e conteúdo**: Encontre informações em qualquer lugar
- **Busca recursiva**: Pesquisa em toda a hierarquia de seções
- **Highlight de resultados**: Destaque visual das palavras encontradas
- **Snippets de contexto**: Veja trechos do conteúdo onde o termo foi encontrado
- **Badge de match**: Identificação visual de seções que correspondem à busca
- **Expansão automática**: Seções relevantes são automaticamente expandidas

### 🎨 Reordenação com Drag & Drop

- **Arraste seções raiz**: Reordene seções principais do projeto
- **Arraste subseções**: Reorganize subseções dentro de cada seção
- **Feedback visual**: Indicadores claros durante o arraste
- **Persistência automática**: Mudanças salvas instantaneamente

### 🛡️ Validações e Segurança

- **Nomes únicos**: Não permite seções duplicadas no mesmo nível
- **Confirmação de exclusão**: Aviso ao deletar seções com subseções
- **Contador de descendentes**: Veja quantas subseções serão removidas
- **Validação em tempo real**: Feedback imediato sobre erros

### 📝 Edição Inline de Títulos

- **Edição rápida**: Clique no ícone de lápis para editar títulos
- **Atalhos de teclado**: Enter para salvar, Escape para cancelar
- **Validação automática**: Verifica duplicatas ao renomear

### 💾 Persistência de Dados

- **LocalStorage**: Dados salvos localmente no navegador
- **Auto-save**: Todas as alterações são salvas automaticamente
- **Recuperação automática**: Dados carregados ao abrir o app
- **Versionamento**: Sistema de chave `gdd_projects_v1` para futuras migrações

---

## 🚀 Começando

### Pré-requisitos

- **Node.js** 20.x ou superior
- **npm**, **yarn**, **pnpm** ou **bun**

### Instalação

1. **Clone o repositório**

```bash
git clone https://github.com/Doublehitgames/GddApp.git
cd gdd_project
```

2. **Instale as dependências**

```bash
npm install
# ou
yarn install
# ou
pnpm install
```

3. **Execute o servidor de desenvolvimento**

```bash
npm run dev
# ou
yarn dev
# ou
pnpm dev
```

4. **Abra no navegador**

Acesse [http://localhost:3000](http://localhost:3000)

---

## 🏗️ Estrutura do Projeto

```
gdd_project/
├── app/                          # App Router do Next.js
│   ├── page.tsx                 # Página inicial (lista de projetos)
│   ├── layout.tsx               # Layout raiz
│   ├── globals.css              # Estilos globais
│   ├── client-init.tsx          # Inicialização client-side
│   ├── api/
│   │   └── upload/
│   │       └── route.ts         # API de upload de imagens
│   └── projects/
│       ├── page.tsx             # Criar novo projeto
│       └── [id]/
│           ├── page.tsx         # Detalhes do projeto
│           ├── ProjectDetailClient.tsx
│           ├── ProjectEditClient.tsx
│           ├── edit/
│           │   └── page.tsx     # Editar projeto
│           └── sections/
│               ├── SectionDetailClient.tsx
│               ├── SectionEditClient.tsx
│               └── [sectionId]/
│                   ├── page.tsx          # Visualizar seção
│                   └── edit/
│                       └── page.tsx      # Editar seção
├── store/
│   └── projectStore.ts          # Estado global (Zustand)
├── hooks/
│   └── useInitProjects.ts       # Hook de inicialização
├── types/
│   └── toast-ui-editor.d.ts     # Type definitions
├── public/
│   └── uploads/                 # Diretório de imagens
│       └── [projectId]/         # Imagens organizadas por projeto
├── docs/
│   └── IMAGES.md                # Documentação do sistema de imagens
└── package.json                 # Dependências e scripts
```

---

## 🛠️ Tecnologias Utilizadas

### Core

- **[Next.js 16.0](https://nextjs.org/)** - Framework React com App Router
- **[React 19.2](https://reactjs.org/)** - Biblioteca UI
- **[TypeScript 5.0](https://www.typescriptlang.org/)** - Tipagem estática
- **[TailwindCSS 4.0](https://tailwindcss.com/)** - Framework CSS utility-first

### Estado e Dados

- **[Zustand 5.0](https://zustand-demo.pmnd.rs/)** - Gerenciamento de estado global
- **LocalStorage API** - Persistência de dados local

### Editor

- **[@toast-ui/editor](https://ui.toast.com/tui-editor)** - Editor WYSIWYG/Markdown
- **[react-markdown](https://github.com/remarkjs/react-markdown)** - Renderizador Markdown
- **[remark-gfm](https://github.com/remarkjs/remark-gfm)** - GitHub Flavored Markdown
- **[@uiw/react-md-editor](https://uiwjs.github.io/react-md-editor/)** - Editor Markdown alternativo

### UI e Interação

- **[@dnd-kit](https://dndkit.com/)** - Drag and Drop
  - `@dnd-kit/core` - Core functionality
  - `@dnd-kit/sortable` - Listas reordenáveis
  - `@dnd-kit/utilities` - Utilitários

### Desenvolvimento

- **[ESLint](https://eslint.org/)** - Linter
- **[PostCSS](https://postcss.org/)** - Processador CSS

### Testes

- **[Jest](https://jestjs.io/)** - Framework de testes
- **[@testing-library/react](https://testing-library.com/)** - Testes de componentes
- **[@testing-library/jest-dom](https://testing-library.com/docs/ecosystem-jest-dom/)** - Matchers customizados
- **[Playwright](https://playwright.dev/)** - Testes end-to-end

---

## 📦 Scripts Disponíveis


# Testes
npm test             # Executa testes unitários (118 testes)
npm run test:watch   # Testes em modo watch
npm run test:coverage # Testes com cobertura de código
npm run test:e2e     # Testes end-to-end com Playwright
npm run test:e2e:ui  # E2E com interface visual
```

[📖 **Guia Completo de Testes →**](./docs/GUIA_TESTES.md)bash
# Desenvolvimento
npm run dev          # Inicia servidor de desenvolvimento

# Produção
npm run build        # Cria build otimizado
npm run start        # Inicia servidor de produção

# Qualidade de Código
npm run lint         # Executa ESLint
```

---

## 📖 Como Usar

### 1. Criar um Projeto

**Opção A: Criação Manual**
1. Na página inicial, clique em **"Criar novo projeto"**
2. Preencha o **título** e **descrição** (suporta Markdown)
3. Clique em **"Criar Projeto"**

**Opção B: Criação com IA 🤖 (Recomendado para iniciantes)**
1. Na página inicial, clique em **"🤖 Criar com IA"**
2. Descreva seu jogo (tipo, mecânicas, tema)
3. Clique em **"✨ Gerar GDD com IA"**
4. Revise a estrutura gerada e clique em **"🚀 Criar Projeto"**
5. Pronto! Estrutura completa criada em segundos

> ⚙️ [**Configure a IA antes de usar →**](./docs/AI_SETUP.md)

### 2. Adicionar Seções

1. Dentro do projeto, digite o nome da nova seção
2. Clique em **"Adicionar"**
3. A seção será criada e você pode clicar nela para editar

### 3. Criar Subseções

1. Entre em uma seção existente
2. No campo **"Adicionar subseção"**, digite o nome
3. Clique em **"Adicionar"**
4. Subseções podem ter suas próprias subseções (hierarquia ilimitada)

### 4. Editar Conteúdo

1. Clique em uma seção para visualizar
2. Clique em **"Editar no preview"**
3. Use o editor WYSIWYG ou alterne para Markdown
4. Adicione imagens clicando no botão 📷 na toolbar
5. Clique em **"Salvar"** quando terminar

### 5. Usar o Assistente de IA 🤖

1. Dentro de um projeto, clique no botão flutuante **🤖**
2. O chat lateral será aberto
3. Converse naturalmente:
   - "Analise meu GDD"
   - "Sugira seções faltantes"
   - "O que adicionar na seção de Combate?"
   - "Crie uma nova seção sobre Sistema de Progressão"
4. A IA entende todo o contexto do seu projeto!

### 6. Reordenar Seções

1. Use as alças **⋮⋮** ao lado de cada seção
2. Arraste e solte na posição desejada
3. A ordem é salva automaticamente

### 6. Buscar Conteúdo

1. Use o campo de busca **🔍** na página do projeto ou seção
2. Digite o termo que deseja encontrar
3. Seções relevantes serão destacadas e expandidas automaticamente
4. Veja snippets do conteúdo onde o termo aparece

### 7. Upload de Imagens

1. No editor WYSIWYG, clique no botão **📷 "image"**
2. Selecione **"Upload arquivo"**
3. Escolha a imagem (JPG, PNG, GIF, WebP, máx. 5MB)
4. A imagem será inserida automaticamente no formato Markdown

---

## 🎨 Características de Design

- **Interface Dark**: Design moderno em tons escuros
- **Responsivo**: Funciona em desktop, tablet e mobile
- **Feedback Visual**: Animações e transições suaves
- **Acessibilidade**: Labels e aria-labels apropriados
- **Tipografia**: Uso da fonte Geist otimizada

---

- [x] **🧪 122 Testes Automatizados** - Cobertura completa com Jest + Playwright
- [x] **🔗 Referências Cruzadas** - Sistema de links entre seções

### Em Desenvolvimento

- [ ] **Visualização de Documento Completo** - Ver GDD inteiro em uma página
- [ ] **Exportação para PDF** - Gerar documentos completos em PDF
- [ ] **Exportação para DOCX** - Formato Microsoft Word
## 🔮 Roadmap

### ✅ Recém ImplementadoMarkdown** - Baixar GDD em formato .md
- [ ] **🤖 IA: Análise de inconsistências** - Detectar contradições automaticamente
- [ ] **🤖 IA: Sugestões proativas** - IA sugere mudanças baseado em alterações
- [ ] **Backend com Banco de Dados** - PostgreSQL/Supabase
- [ ] **Autenticação** - Login e controle de acesso
- [ ] **Sincronização na Nuvem** - Acesse seus projetos de qualquer lugar
- [ ] **Versionamento** - Histórico de alterações
- [ ] **Colaboração em Tempo Real** - Múltiplos usuários simultâneos
- [ ] **Comentários** - Sistema de anotações em seções
- [ ] **Templates de GDD** - Templates prontos (RPG, FPS, Mobile, etc.)
- [ ] **Dark/Light Mode** - Toggle de tema
- [ ] **Atalhos de Teclado** - Navegação rápida
- [ ] **Anexos diversos** - Upload de PDFs, vídeos, áudios
- [ ] **Galeria de Assets** - Gerenciamento de recursos do projeto
- [ ] **Gráficos e Diagramas** - Integração com ferramentas de diagramaçã
- [ ] **Versionamento** - Histórico de alterações
- [ ] **Colaboração em Tempo Real** - Múltiplos usuários simultâneos
- [ ] **Comentários** - Sistema de anotações em seções
- [ ] **Templates de GDD** - Templates prontos (RPG, FPS, Mobile, etc.)
- [ ] **Dark/Light Mode** - Toggle de tema
- [ ] **Atalhos de Teclado** - Navegação rápida
- [ ] **Anexos diversos** - Upload de PDFs, vídeos, áudios
- [ ] **Galeria de Assets** - Gerenciamento de recursos do projeto

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Se você tem sugestões de melhorias, novos recursos ou encontrou bugs:

1. Faça um Fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

---

## 📄 Licença

Este projeto está sob licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

---

## 👥 Autores

**Doublehit Games**
- GitHub: [@DoDocumentação](./docs/)
  - [Guia de Início Rápido](./docs/QUICKSTART.md)
  - [Configuração da IA](./docs/AI_SETUP.md)
  - [Guia de Testes](./docs/GUIA_TESTES.md)
  - [Sistema de Imagens](./docs/IMAGES.md)
   - [Referências Cruzadas](./GUIA_REFERENCIAS.md)
- Veja a [documentação do Next.js](https://nextjs.org/docs
---

## 📞 Suporte

Se você encontrar problemas ou tiver dúvidas:

- Abra uma [Issue](https://github.com/Doublehitgames/GddApp/issues)
- Consulte a [documentação do Next.js](https://nextjs.org/docs)
- Veja a [documentação de imagens](./docs/IMAGES.md)

---

## 🙏 Agradecimentos

- Next.js team pelo framework incrível
- Toast UI team pelo excelente editor
- Comunidade open-source por todas as bibliotecas utilizadas

---

<div align="center">

**Feito com ❤️ para a comunidade de desenvolvimento de jogos**

[⬆ Voltar ao topo](#-gdd-manager)

</div>
