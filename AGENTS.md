# Contexto para o agente (Cursor)

Este documento resume o projeto, o estado atual e os próximos passos para qualquer sessão do Cursor.

---

## O que é o projeto

- **GDD Manager**: app para criar e gerenciar **Game Design Documents** (GDDs).
- **Stack**: Next.js 16 (App Router), TypeScript, React 19, Zustand, Supabase (auth + DB), i18n (pt-BR, en, es).
- **Deploy**: app implantado na **Vercel**. Variáveis de ambiente de **produção** são configuradas no projeto Vercel (Settings → Environment Variables). Em desenvolvimento local usam-se `.env.local`.
- **Fluxo**: projetos e seções editados em Markdown; mapa mental (ReactFlow); referências entre seções (`$[Nome]` / `$[#id]`); IA para gerar/melhorar conteúdo; **offline-first** com sync opcional para a nuvem (Supabase).

Documentação geral: `docs/QUICKSTART.md`, `docs/TESTES_COMPLETOS.md`, `docs/GUIA_TESTES.md`. Deploy e env: `docs/ENV_VERCEL.md`.

---

## O que já foi feito (últimos commits)

1. **Localização**: 3 idiomas (pt-BR, en, es) para o usuário gerenciar projetos; arquivos em `locales/*.json`; provider em `lib/i18n/`.
2. **Sync com Supabase**: persistência local (localStorage) + sincronização com Supabase; rota `POST /api/projects/sync`; `lib/supabase/projectSync.ts` e `store/projectStore.ts` com debounce, retry e tratamento de erro.
3. **Início da refatoração de limites (quota)**:
   - Tabela `cloud_sync_usage_hourly` e SQL em `lib/supabase/add_cloud_sync_quota.sql` (rodar no Supabase).
   - Na rota de sync: cálculo de créditos pelo **diff** (contentChangeCount + 1 se houver só reordenação + sectionsDeleted); janela por hora; retorno 429 com `quota_exceeded`. **Dry run** (`?dryRun=1`): retorna `estimatedCredits` e `details` (sectionsNew/Updated/Deleted com títulos) sem gravar.
   - No store: ao receber `quota_exceeded`, seta `cloudSyncPausedUntil` (até `windowEndsAt`) e mensagem de limite; `SyncStatusBadge` mostra créditos e estado “pausado”; app continua funcionando localmente.
   - Limite configurável por env: `CLOUD_SYNC_CREDITS_PER_HOUR`; default no código **30** (plano Free). Para Pro/maior, definir a env.

---

## Regras de negócio desejadas (plano Free)

- **Limites estruturais** (implementados):
  - Até **2 projetos** por conta (`lib/structuralLimits.ts` + checagem na API de sync e no store).
  - Até **120 seções/subseções por projeto**.
  - Até **200 seções totais** na conta.
  - API retorna 403 `structural_limit_exceeded` com `reason`; store bloqueia criação (throw) e UI mostra mensagem i18n (`limits.projects`, `limits.sectionsPerProject`, `limits.sectionsTotal`).
- **Limite de escrita na nuvem** (parcialmente implementado):
  - Até **30 créditos de escrita por hora** (para Free: usar `CLOUD_SYNC_CREDITS_PER_HOUR=30` ou ajustar default).
  - Janela: 1 hora (hoje é fixa por hora; “1h deslizante” pode ser evolução).
- **Consumo de créditos**: cobrança pelo **diff** de cada sync (estado enviado vs. cloud), não por "ações". 1 crédito por seção nova/alterada (conteúdo); 1 no total por reordenação; 1 por seção **já no cloud** que é excluída. Criar+editar+mover+apagar sem nunca dar sync → próximo sync 0 seções = 0 créditos. Ver `docs/CREDITOS_SYNC.md`. Tudo que gera escrita (autosync, import, “Sincronizar agora”) consome do mesmo balde.
- **UX ao bater limite**: app segue local; cloud pausa até o reset da janela; mensagem tipo: “Você atingiu o limite de escrita cloud do plano Free.”

---

## Onde está o código relevante

| O quê | Onde |
|-------|------|
| API de sync e quota | `app/api/projects/sync/route.ts` |
| Lógica de sync (client) | `lib/supabase/projectSync.ts` |
| Estado e fila de sync | `store/projectStore.ts` |
| Badge de status e créditos | `components/SyncStatusBadge.tsx` |
| Tabela de uso por hora | `lib/supabase/add_cloud_sync_quota.sql` |
| Config de persistência | `app/settings/persistence/page.tsx` |
| Estimativa e preview do próximo sync | `getSyncPreview()` em `lib/supabase/projectSync.ts` (chama API com dryRun=1) |
| Limpar histórico de syncs | `clearSyncHistory()` no store; botão na página de persistência |
| Doc. regra de créditos | `docs/CREDITOS_SYNC.md` |
| i18n | `lib/i18n/`, `locales/*.json` |

---

## Testes

- **Unitários (Jest)**: 118 testes; `npm test`; ver `docs/TESTES_COMPLETOS.md` e `docs/GUIA_TESTES.md`.
- **Sync/store**: `__tests__/store/projectStore.test.ts`, `__tests__/store/projectStore.sync.test.ts`, `__tests__/lib/projectSync.test.ts`.
- **E2E (Playwright)**: `e2e/smoke-ui.spec.ts` (@smoke), `e2e/sync-critical.spec.ts` (@critical); `npm run test:e2e`, `npm run test:e2e:smoke`, `npm run test:e2e:critical`.

Ao alterar sync ou quota, rodar os testes de store e de projectSync e os E2E críticos.

---

## Próximos passos (prioridade)

1. **Validação de sync + créditos**: garantir que a validação de quota está correta (incl. janela, contagem e 429); ajustar para 30 créditos/hora no plano Free se fizer sentido (env ou constante).
2. **Limites estruturais**: implementar checagens de “máx. 2 projetos”, “máx. 120 seções por projeto” e “máx. 200 seções na conta” (na API de sync e/ou no store antes de criar projeto/seção).
3. **Ajuste fino Free/Pro**: definir valores exatos para Free vs Pro (projeto, seções, créditos/hora) e onde configurar (env, feature flags, etc.).
4. **Checklist de produção**: build, lint, testes unitários + E2E, fluxo manual (login, criar projeto/seção, sync, bater limite, limpar histórico). **Testes**: cobrir `clearSyncHistory`; cenários de estimativa. **Doc na UI**: link para `docs/CREDITOS_SYNC.md` na página de persistência.

---

## Observações técnicas

- **Rate limits de IA** (Groq): são distintos do limite de sync Supabase; ver `docs/RATE_LIMITS.md`.
- **Login/Google quebrado ou página de erro do Supabase:** verificar se o projeto Supabase não está **pausado** (plano Free pausa projetos inativos). Despausar no dashboard resolve. Ver `docs/AUTH_FLOW.md` (seção Troubleshooting).
- **Variáveis de ambiente**: o app usa `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (recomendado; anon em desuso). Fallback: `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Opcionais: `CLOUD_SYNC_CREDITS_PER_HOUR`, `SUPABASE_SERVICE_ROLE_KEY`. Em **produção (Vercel)** essas variáveis ficam em **Vercel** (Dashboard do projeto → Settings → Environment Variables). No **Supabase** você só vê/copia a URL e as chaves do projeto (Project Settings → API); quem “guarda” as vars para o Next.js é o Vercel (e localmente o `.env.local`).
- **Janela de quota**: hoje a janela é “início da hora atual” (ex.: 14:00–15:00). “Janela deslizante de 1h” exigiria mudança no modelo (ex.: uma linha por “bucket” de 1h deslizante ou recalcular com base em `now - 1h`).
- **Mensagem de limite**: já existe texto no store; conferir se as chaves em `locales/*.json` para “limite de escrita cloud do plano Free” estão usadas no SyncStatusBadge e na página de persistência.

### Comportamento do sync e do badge (cotas vs falhas)

- **Fluxo normal**: após edição, o sync é agendado com debounce (ex.: 1,5 s). O badge mostra "Sincronizando" → "Sincronizado" ou "Aguardando". Novas edições disparam novo ciclo.
- **Pausa por limite de créditos (429 `quota_exceeded`)**: a API retorna 429 e `windowEndsAt`. O store seta `cloudSyncPausedUntil` e `cloudSyncPauseReason: "quota"`. O badge mostra "Limite de créditos", o botão "Sincronizar" fica desabilitado até o fim da janela (1 h). Não há retentativas até expirar; ao expirar, o store limpa a pausa.
- **Pausa por falhas repetidas (circuit breaker)**: após **5** falhas em 2 min (timeout, rede, 5xx), o store seta pausa de **5 min** e `cloudSyncPauseReason: "failures"`. O badge mostra "Falhas temporárias". O **último motivo técnico** fica em `lastSyncFailureReason` (ex.: `sync_route_timeout`) e é exibido na página Persistência para debug. Erros 429 (quota/rate_limit) e 403 estrutural não entram no contador.
- **Pausa por rate limit (429 `rate_limit`)**: API limita a 30 requisições POST de sync por usuário por minuto (proteção disk I/O). Cliente pausa 1 min e mostra "Muitas requisições".
- **Erro estrutural (403)**: não pausa por tempo; badge "Erro" e mensagem de limite; app continua local.
- **Badge**: usa `cloudSyncPauseReason` (quota | failures | rate_limit) para mensagem específica. i18n em `settings.persistencePage.syncBadge.*`.

### Disk I/O no Supabase (plano Free)

O Supabase tem [limite de Disk I/O](https://supabase.com/docs/guides/troubleshooting/exhaust-disk-io) (throughput e IOPS). Esgotar o orçamento pode causar lentidão, timeouts e até instabilidade. Para reduzir o impacto dos syncs:

- **Créditos por hora (30)**: limitam a quantidade de escritas (seções alteradas) por usuário.
- **Rate limit na API**: máx. **30 requisições POST** de sync por usuário por minuto (`SYNC_REQUESTS_PER_MINUTE` em `app/api/projects/sync/route.ts`), reduzindo picos de IOPS.
- **Debounce no cliente**: evita uma requisição por keystroke; agrupa em um sync após ~1,5 s sem edição.
- **Timeout do cliente (20 s)**: se o Supabase estiver sob carga (disk I/O alto), respostas lentas podem gerar `sync_route_timeout` → falhas → circuit breaker (pausa 5 min), evitando insistir enquanto o servidor está lento.

Monitorar em **Database Health** (Observability) no dashboard do Supabase. Em caso de alto disk I/O, considerar upgrade de compute ou otimização de queries.

### Tabela `profiles` e usuários “órfãos”

O sync e outras partes do app **dependem de existir uma linha em `public.profiles`** para o usuário autenticado. O trigger `handle_new_user()` cria o profile ao se registrar; se alguém **apagar linhas de `profiles`** mas manter usuários em **Authentication**, o usuário fica “órfão” e o sync pode falhar (ex.: respostas estranhas ou quebra em operações que esperam profile).

**Solução implementada:**

- **`ensureUserProfile(supabase, user)`** (`lib/supabase/ensureUserProfile.ts`): verifica se existe linha em `profiles` para `user.id`; se não existir, insere uma com `id`, `email` e `display_name`. É chamado na rota de sync (após `getUser`) e no `useAuthInit` (ao ter usuário logado), para “curar” usuários órfãos.
- **Policy de INSERT em `profiles`**: por padrão só o trigger (security definer) insere. Para o app poder criar o profile quando faltar, é necessário rodar a migração **`lib/supabase/add_profiles_insert_policy.sql`** no SQL Editor do Supabase (policy “Usuário pode inserir próprio profile” com `WITH CHECK (auth.uid() = id)`).

Se o sync retornar `profile_missing`, o usuário está autenticado mas não tem (ou não consegue criar) profile; conferir se a policy de INSERT foi aplicada.

### Armadilhas comuns (evitar em novas sessões)

- **Créditos**: a cobrança é pelo **diff** da requisição (estado enviado vs. cloud), não por "ações". Seção criada e depois deletada **sem nunca ter dado sync** → próximo sync envia 0 seções → **0 créditos**. Só entram em `removedSectionIds` (delete) seções que **já estão no DB**. Ver `docs/CREDITOS_SYNC.md`.
- **Coluna na DB**: em `sections` usar **`sort_order`**, não `order` (palavra reservada no SQL/PostgREST). Migração: `lib/supabase/migrate_sections_order_to_sort_order.sql`.
- **Estimativa no badge**: quando o conteúdo pendente muda (ex.: usuário deleta seção), **zerar a estimativa na hora** e mostrar "Calculando...", senão o usuário acha que o número "só soma". Dependência do efeito: `pendingSignature` (projects + getPendingProjectIds) para refetch com debounce.
- **Projetos pendentes após refresh**: `dirtyProjectIds` é **persistido** em `SYNC_STATE_KEY` junto com lastQuotaStatus, lastSyncedAt, lastSyncStatsHistory. No `loadFromStorage` restaurar só IDs que ainda existem em `get().projects`.
- **Histórico de syncs**: `lastSyncStatsHistory` (máx. 12), persistido; **limpar** via `clearSyncHistory()` no store (ação exposta na página de persistência). Não confundir "limpar histórico" com limpar dados de projetos.
- **E2E (Playwright)**: usar cookie `gdd_locale=pt-BR` para placeholders em pt-BR; após cliques que navegam, usar `waitForURL` antes de asserções; sync pode enviar em payloads separados (debounce) — usar `expect.poll` com timeout se precisar esperar valor.
- **i18n**: chaves em `settings.persistencePage.*` (incl. `syncBadge.*`, `history.clearButton`). Traduzir nos 3 arquivos: `locales/pt-BR.json`, `locales/en.json`, `locales/es.json`.
