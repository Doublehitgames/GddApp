# Contexto para agentes — GDD Manager

Briefing de entrada para qualquer sessão de agente neste repo. É a **única** fonte
de contexto do projeto: não existe regra de Cursor nem instrução de Copilot em
paralelo (foram removidas por divergirem desta).

Números que envelhecem (limites de plano, contagem de testes) **não** ficam aqui —
o texto aponta para onde o valor vive de verdade.

---

## O que é o projeto

- **GDD Manager**: app para escrever e navegar **Game Design Documents**. Um GDD é
  uma **árvore de páginas**; cada página tem título e uma **descrição em blocos**.
- **Stack**: Next.js 16 (App Router, `--webpack` no dev), React 19, TypeScript,
  Zustand, Tailwind 4, Supabase (auth + Postgres), MDX para a doc do usuário.
- **Editor**: **BlockNote** (`@blocknote/react`) na tela da página. O markdown
  continua sendo o formato de intercâmbio, mas o que o usuário edita são blocos.
- **Deploy**: Vercel, auto-deploy na `master`. Env de produção fica no painel da
  Vercel; local, em `.env.local`. Ver `docs/ENV_VERCEL.md`.
- **Offline-first**: tudo vive em `localStorage` e o sync para o Supabase é
  opcional e por projeto.

### O que o app **não** é mais

Em 2026-08-25 os 18 tipos de **addon** saíram do produto inteiro, junto com os
satélites que só existiam para alimentá-los: binding de Google Sheets, Remote
Config (`exportSchema`), `pageTypes` e os wizards de criação de página (~38 mil
linhas). Não sugira nada disso — não existe. Comentários no código que citam
addons são explicações históricas de onde um arquivo morava antes.

---

## Núcleo hoje

| O quê | Onde |
|---|---|
| Árvore de páginas / CRUD de seção | `store/slices/sectionCrudSlice.ts`, `app/projects/[id]/sections/` |
| Descrição em blocos | `lib/richDoc/` (`types.ts`, `serialize.ts`, `transformRefs.ts`) |
| Referências cruzadas `$[...]` | `utils/sectionReferences.ts`, `lib/api/v1/renameRefs.ts` |
| Status de maturidade da página | `lib/pageStatus/` |
| "O que mudou" (changelog) | `lib/changelog/`, `app/projects/[id]/changelog/` |
| Mapa mental (ReactFlow) | `app/projects/[id]/mindmap/`, `lib/mindMapConfig.ts` |
| Modo documento / deck | `app/projects/[id]/view/`, `app/projects/[id]/deck/`, `lib/deck/` |
| Export (md / pdf / docx) | `app/projects/[id]/export/` |
| IA | `utils/ai/`, `app/api/ai/*`, `lib/gameDesignDomains.ts` |
| MCP | `lib/mcp/` (remoto) e `packages/mcp-server/` (local, npm) |
| Biblioteca de imagens (Google Drive) | `lib/googleDriveFolder.ts`, `lib/googleDrivePicker.ts` |
| i18n | `lib/i18n/`, `locales/{pt-BR,en,es}.json` |
| Doc do usuário (MDX) | `content/docs/<locale>/`, servida em `app/(docs)/` |

### Referências cruzadas — a convenção que mais se erra

Ao citar no texto qualquer coisa que tenha página própria, escreve-se
`$[Título Exato da Página]`. É texto normal dentro de `content` e do texto de um
bloco; o renderizador read-only converte em link.

- O casamento é **por título, case-insensitive**, e **emoji faz parte do título**:
  `$[🦴Osso]` acha, `$[Osso]` não.
- O nome é a forma canônica de armazenamento. `$[#uuid]` é legado — ainda
  resolve, mas nada novo deve gravar assim.
- Renomear uma página **reescreve as refs** que apontam para ela
  (`lib/api/v1/renameRefs.ts` e o slice equivalente no store).

Detalhe completo do sistema (funções, varredura de rename, backlinks) em
[`GUIA_REFERENCIAS.md`](GUIA_REFERENCIAS.md).

---

## Limites de plano e créditos de sync

- **Modelo**: N projetos × M páginas **por projeto**. Não existe cota de páginas
  somada entre projetos — o pool total (`FREE_MAX_SECTIONS_TOTAL`) foi removido em
  2026-08-26, porque vazava entre pessoas: página que um membro convidado criava
  consumia o plano do dono e tirava espaço de projetos que o membro nem enxergava.
- **De onde vem o valor**: da tabela `app_config` no Supabase, via
  `lib/remoteConfig.ts` (cache de 5 min). As constantes em `lib/structuralLimits.ts`
  são **só referência histórica**. Servidor: `getRemoteConfig(ownerId)`. Cliente:
  `store.appLimits` / `limitsByOwner` (`store/slices/limits.ts`). Nunca as constantes.
- **Override por pessoa**: linha `<CHAVE>:<user_id>` no `app_config`.
- **Limites são avaliados no DONO do projeto**, não em quem está sincronizando.
- **Crédito de sync = preço do conteúdo**: página nova, texto novo, página apagada.
  **Metadado é grátis** — hoje ordem (posição no mapa) e status de maturidade. Um
  sync que só mexeu nisso custa 0, passa mesmo com a cota da hora esgotada, e numa
  sync parcial vai junto sempre. A conta vive em `app/api/projects/sync/route.ts`
  (`contentUpsertList` vs `metadataOnlyList`); a regra, em `docs/CREDITOS_SYNC.md`.

---

## Sync: como se comporta quando dá errado

- **Fluxo normal**: edição agenda sync com debounce (~1,5 s). Barra fixa na home
  (`components/HomeSyncBar.tsx`) mostra créditos e estimativa; rodapé dentro do
  projeto (`components/ProjectSyncFooter.tsx`) tem o botão de sincronizar.
- **429 `quota_exceeded`**: store seta `cloudSyncPausedUntil` até `windowEndsAt`
  (janela de 1 h, fixa no início da hora). Sem retentativa até expirar.
- **429 `rate_limit`**: a API limita requisições POST de sync por usuário por
  minuto (`SYNC_REQUESTS_PER_MINUTE`, também no `app_config`). Cliente pausa 1 min.
- **Circuit breaker**: 5 falhas em 2 min (timeout, rede, 5xx) → pausa de 5 min,
  `cloudSyncPauseReason: "failures"`. O motivo técnico fica em
  `lastSyncFailureReason` e aparece em Configurações → Persistência.
- **403 estrutural**: não pausa; o app segue local.
- **`profile_missing`**: o usuário está autenticado mas não tem linha em
  `public.profiles`. `ensureUserProfile()` cura isso, desde que a policy de INSERT
  (`lib/supabase/add_profiles_insert_policy.sql`) esteja aplicada.

O Supabase Free tem [limite de Disk I/O](https://supabase.com/docs/guides/troubleshooting/exhaust-disk-io);
créditos, rate limit e debounce existem em boa parte para não estourá-lo.

---

## MCP — a armadilha das duas cópias

O GDD é exposto por MCP em **dois transportes que não compartilham código**:

- **local (stdio)** — `packages/mcp-server/`, publicado no npm como
  `@doublehitgames/gdd-mcp`. Só muda depois de `npm run build` + publish.
- **remoto (`/api/mcp`, conectores do claude.ai)** — `lib/mcp/server.ts`. Só muda
  **depois de deploy na Vercel**.

Toda tool nova entra nas **duas** cópias e nos dois testes-gêmeos
(`__tests__/lib/mcp.instructions.test.ts` e `mcp.collab.test.ts` comparam os
arquivos byte a byte). `lib/mcp/project.ts` e `packages/mcp-server/src/project.ts`
são gêmeos de propósito — o pacote npm precisa ser autocontido.

Formato de resposta, por família: **escritas** devolvem recibo
(`{ok, id, title, updated, updatedAt}`, com `returning: "full"` como escape hatch);
**listagens** devolvem linha de índice; **leituras** (`get_section`) vêm cheias;
**deletes**, `{ok, deleted, id}`. Definição de tool é custo de contexto — vai em
toda request; convenção que vale para toda escrita mora em `instructions` do
handshake (`lib/mcp/instructions.ts` + gêmeo), não na descrição da tool.

Nunca vai direto ao Supabase: MCP → REST `/api/v1/*`. Auth em
`lib/auth/getApiUser.ts` (aceita API key `gdd_sk_`, token OAuth `gdd_at_` e sessão).

---

## Comandos

```bash
npm run dev              # dev server na 3000
npm run build            # build de produção
npm run lint             # eslint
npm test                 # jest
npm run test:e2e         # playwright (:smoke e :critical filtram por tag)
npm run i18n:validate    # check de chaves + audit de hardcode
```

Ao mexer em sync ou quota, rodar os testes de store e de `projectSync`, e o E2E
crítico (`e2e/sync-critical.spec.ts`).

---

## Armadilhas comuns

- **Coluna de ordem**: em `sections` é `sort_order`, nunca `order` (palavra
  reservada no SQL/PostgREST).
- **`content_blocks` derivado**: só é derivado do markdown quando o chamador **não**
  mandou blocos. Se os dois caminhos de escrita divergirem nisso, descrição
  formatada é silenciosamente sobrescrita. `buildSectionUpdates` em
  `lib/api/v1/sectionWrite.ts` é compartilhado justamente por isso.
- **Estimativa de créditos**: quando o conteúdo pendente muda (ex.: usuário deleta
  página), zerar a estimativa na hora e mostrar "Calculando…", senão parece que o
  número "só soma".
- **`.prose`**: a classe é **do projeto**, não do plugin de typography do Tailwind
  — o plugin não está instalado e não deve ser.
- **Tema**: as vars do `:root` são fixas no escuro, mas o app **não** é dark-only —
  existem telas claras de verdade. Não presuma fundo escuro.
- **i18n**: chave nova entra nos **3** arquivos (`pt-BR`, `en`, `es`).
- **E2E**: cookie `gdd_locale=pt-BR` para placeholders em pt-BR; após clique que
  navega, `waitForURL` antes de asserção; sync pode sair em payloads separados
  (debounce) — usar `expect.poll`.
- **Worktree**: não herda `.env.local` (copiar antes de subir o dev server) e o
  `jest.config.ts` ignora `/.claude/`, então `npx jest` de dentro de um worktree
  não acha teste nenhum — sobrescrever `--testPathIgnorePatterns`.
- **UUID em fixture**: zod v4 valida nibble de versão e variante, então
  `1111...-2222-...` é recusado. Usar ids reais.

## Segredo em arquivo

`Doublehitgames/GddApp` é um repositório **público**. Config local lê `${VAR}` do
ambiente e o arquivo fica no `.gitignore`; o que é versionado é um `*.example` com
a forma. Se um diff toca `.mcp.json`, `.env*` ou config de MCP/editor, conferir se
tem segredo dentro antes de commitar — já aconteceu de uma chave viva ficar meses
no histórico. Ao encontrar um segredo versionado, a **revogação** é o conserto;
reescrever histórico de repo público não des-vaza nada.

---

## Documentação

- **Para o usuário** (game designer, dentro do app): `content/docs/`. Linguagem
  humana, tom de colega, zero jargão de dev.
- **Para quem mexe no código**: `docs/`. Ver `docs/QUICKSTART.md` (setup),
  `docs/ENV_VERCEL.md` (env), `docs/CREDITOS_SYNC.md` (regra de crédito),
  `docs/COLLABORATION_STEPS.md` (multi-usuário), `docs/AUTH_FLOW.md`,
  `docs/GUIA_TESTES.md`, `docs/LOCALIZATION.md`.
