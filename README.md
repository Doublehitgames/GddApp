# 🎮 GDD Manager

**Um lugar para escrever o Game Design Document e realmente voltar a ele.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-auth%20%2B%20db-3ECF8E?logo=supabase)](https://supabase.com/)
[![CI](https://github.com/Doublehitgames/GddApp/actions/workflows/ci.yml/badge.svg)](https://github.com/Doublehitgames/GddApp/actions/workflows/ci.yml)

App em produção: **[gdd-app.vercel.app](https://gdd-app.vercel.app)**

---

## O que é

Um GDD aqui é uma **árvore de páginas**. Cada página tem um título e uma
descrição escrita em blocos — parágrafo, tabela, callout, imagem — e pode citar
outras páginas por nome. O documento deixa de ser um arquivo de 80 páginas que
ninguém abre e passa a ser algo navegável.

O app é **offline-first**: você escreve no navegador, sem esperar servidor, e
sincroniza com a nuvem quando quiser.

## O que dá para fazer

**Escrever e navegar**

- **Quatro modos** para o mesmo documento: **Editor** (escrever), **Doc**
  (o GDD inteiro formatado, pronto para imprimir ou mostrar), **Graph** (mapa
  mental interativo da árvore) e **Deck** (navegador de níveis, uma carta por
  página).
- **Referências cruzadas**: escreva `$[Nome da Página]` no meio do texto e vira
  link. Renomear a página conserta as citações sozinho.
- **Status de maturidade** por página — de rascunho a "no jogo" — com selo
  automático quando o texto ficou para trás.
- **"O que mudou"**: linha do tempo das edições do projeto, com o diff de cada uma.
- **Ir para página** (busca global) e filtro por tags de domínio.
- **Biblioteca de imagens**: conecte uma pasta do Google Drive e escolha ícones
  de página numa grade, sem sair do app.

**Planejar**

- **Roadmap** e **diagramas** do projeto.

**Trabalhar junto**

- **Membros por projeto** (dono, editor, leitor) e registro de atividade recente.
- **Compartilhamento público** por link, só leitura.
- **Três idiomas**: português, inglês e espanhol.

**Automatizar**

- **IA** para gerar a estrutura inicial do GDD, melhorar o texto de uma página
  e sugerir tags de domínio. Funciona com Groq, OpenAI ou Claude — ver
  [docs/AI_SETUP.md](docs/AI_SETUP.md).
- **MCP**: conecte um assistente de IA direto ao seu GDD e peça "cria uma página
  descrevendo o core loop". Dá para conectar pelo claude.ai (OAuth, sem instalar
  nada) ou rodar local com o pacote
  [`@doublehitgames/gdd-mcp`](https://www.npmjs.com/package/@doublehitgames/gdd-mcp)
  — ver [packages/mcp-server/README.md](packages/mcp-server/README.md).
- **Importar** de `.docx` ou markdown e **exportar** para markdown, PDF ou DOCX.

---

## Rodando localmente

Precisa de **Node 20+** e de um projeto **Supabase**.

```bash
git clone https://github.com/Doublehitgames/GddApp.git
cd gdd_project
npm install
npm run dev
```

Antes do primeiro `npm run dev`, crie um `.env.local` na raiz com as chaves do
seu projeto Supabase — a lista de variáveis está em
[docs/ENV_VERCEL.md](docs/ENV_VERCEL.md). Depois abra
<http://localhost:3000>. O passo a passo completo (Supabase, migrações,
variáveis opcionais) está em [docs/QUICKSTART.md](docs/QUICKSTART.md).

### Scripts

```bash
npm run dev              # servidor de desenvolvimento
npm run build            # build de produção
npm run lint             # eslint
npm test                 # testes unitários (jest)
npm run test:e2e         # end-to-end (playwright)
npm run i18n:validate    # confere as chaves dos 3 idiomas
```

---

## Stack

| Camada | O que usamos |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Estilo | Tailwind CSS 4 |
| Estado | Zustand + `localStorage` (offline-first) |
| Backend | Supabase (auth, Postgres, RLS) |
| Editor | BlockNote |
| Mapa mental | ReactFlow |
| Export | `docx`, `jspdf` |
| Doc do usuário | MDX |
| Testes | Jest, Testing Library, Playwright |
| Deploy | Vercel |

---

## Documentação

- **Usando o app**: a doc para game designers vive dentro do próprio app, em
  `/docs` (fonte em [content/docs/](content/docs/)).
- **Mexendo no código**: [AGENTS.md](AGENTS.md) é o briefing do projeto —
  arquitetura, decisões e armadilhas. Em [docs/](docs/) ficam os guias
  específicos: [setup](docs/QUICKSTART.md),
  [variáveis de ambiente](docs/ENV_VERCEL.md),
  [créditos de sync](docs/CREDITOS_SYNC.md),
  [colaboração](docs/COLLABORATION_STEPS.md),
  [autenticação](docs/AUTH_FLOW.md), [testes](docs/GUIA_TESTES.md),
  [localização](docs/LOCALIZATION.md),
  [imagens do Drive](docs/GOOGLE_DRIVE_IMAGES.md) e
  [referências cruzadas](GUIA_REFERENCIAS.md).

## Contribuindo

Issues e pull requests são bem-vindos. Antes de abrir um PR, rode
`npm run lint`, `npm test` e `npm run i18n:validate`.

## Licença

MIT.

## Autores

**Doublehit Games** — [github.com/Doublehitgames](https://github.com/Doublehitgames)

---

<div align="center">

Feito para quem escreve documento de jogo e quer que ele continue vivo.

</div>
