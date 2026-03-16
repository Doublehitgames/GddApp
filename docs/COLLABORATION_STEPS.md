# Colaboração (multi-usuário por GDD) – passos sem realtime

## Regra dos limites (dono vs membro)

**Tudo é atrelado ao DONO do projeto:**

- **Limites estruturais** (2 projetos, 120 seções por projeto, 200 seções totais): aplicam ao **dono**. Os membros estão sujeitos aos limites do dono do projeto em que atuam — ou seja, ao sincronizar o projeto X validamos contra os projetos e seções do **owner** do projeto X, não do usuário que está fazendo o sync.
- **Créditos de sync** (30/hora): um pool **por projeto**; dono e membros **compartilham** esse pool. Ao sincronizar o projeto X, qualquer um (dono ou membro) consome dos 30 créditos/hora daquele projeto (que é o limite aplicado ao dono para aquele projeto).

Resumo: membros estão sujeitos aos limites do dono do projeto do qual são membros; no sync, todos consomem da mesma cota do projeto.

---

## Estado atual (implementado)

- **Tabelas:** `projects`, `sections`, `profiles`, **`project_members`** (project_id, user_id, role, invited_by), **`cloud_sync_usage_hourly_by_project`** (project_id, window_start, used_credits). A antiga `cloud_sync_usage_hourly` (por usuário) permanece no DB mas não é usada no fluxo atual.
- **RLS:** Dono ou membro (editor) veem/editam projetos e seções; só o dono deleta projeto e gerencia membros (convite/remoção).
- **Sync:** POST /api/projects/sync — acesso dono ou editor; limites estruturais validados pelo **dono** do projeto; cota por **projeto** (cloud_sync_usage_hourly_by_project); membro não altera owner_id; compartilhamento público (sharing) só é atualizado pelo dono (membro preserva o sharing existente no merge).
- **Home:** Duas áreas — “Meus projetos” (owner_id === currentUserId) e “Projetos compartilhados comigo”; contadores/limites só para “Meus projetos”.
- **Quota:** GET /api/projects/sync/quota?projectId=uuid retorna cota do projeto; na home não se exibe barra de créditos (decisão **B**); no rodapé do projeto (ProjectSyncFooter) exibe créditos daquele projeto.
- **Membros:** GET/POST/DELETE /api/projects/[id]/members — dono convida por e-mail (POST), remove (DELETE); dono e membros veem lista completa (dono + membros, role owner/editor).
- **Compartilhamento público:** Apenas o dono cria/altera token e link; membros veem e copiam o link se o dono já tiver gerado.

---

## Decisão aplicada: cota na home

**Escolha:** **B** – Não mostrar cota na home; ao abrir um projeto, no rodapé mostrar “Créditos deste projeto: X/30” (cota compartilhada do projeto). Implementado: HomeSyncBar exibe apenas hint “Créditos por projeto ao abrir um projeto”; ProjectSyncFooter exibe a cota do projeto atual.

---

## Passos implementados (referência)

### Step 1 – Cota por projeto (DB + API sync) ✅ Implementado

- **1.1** Criar tabela `cloud_sync_usage_hourly_by_project`:
  - `project_id` (uuid, FK projects), `window_start` (timestamptz), `used_credits` (int), `updated_at`;
  - PK `(project_id, window_start)`; RLS: só quem é dono ou membro do projeto pode SELECT/INSERT/UPDATE.
- **1.2** Na API **POST /api/projects/sync**: antes de gravar, verificar se o usuário é **dono ou editor** do projeto (owner_id = user.id OU existe em `project_members` com role = 'editor'). Se não for, retornar 403.
  - No upsert do projeto: **não** enviar `owner_id` no payload de update (ou enviar só se for o dono). Ou: fazer upsert apenas dos campos que membros podem alterar (title, description, mindmap_settings, updated_at) e manter owner_id inalterado.
- **1.3** Trocar leitura/escrita de cota de `cloud_sync_usage_hourly` (user_id) para `cloud_sync_usage_hourly_by_project` (project_id) **no fluxo de sync**: ao sincronizar o projeto X, ler/atualizar a linha (project_id = X, window_start).
- **1.4** **GET /api/projects/sync/quota**: passar a aceitar `?projectId=uuid`. Se vier `projectId`, retornar a cota **daquele projeto** (janela atual). Se não vier, pode retornar 404 ou um payload “global” legado (ex.: primeiro projeto do usuário), conforme a decisão da cota na home; se escolhermos **B**, na home não chamamos o GET de quota (ou chamamos sem projectId e não exibimos nada).

Deixar a tabela antiga `cloud_sync_usage_hourly` intacta por enquanto (sem uso no novo fluxo), para não quebrar deploys já existentes; depois pode ser removida em migração opcional.

---

### Step 2 – API de sync: dono vs membro ✅ Implementado

- **2.1** Na **POST /api/projects/sync**:
  - **Acesso:** usuário precisa ser **dono ou editor** do projeto (owner_id = user.id OU existe em project_members com role = 'editor'). Caso contrário, 403.
  - **Limites estruturais:** sempre validar em nome do **dono do projeto** (owner_id do projeto sendo sincronizado). Buscar projetos e seções onde `owner_id = project.owner_id` e aplicar FREE_MAX_PROJECTS, FREE_MAX_SECTIONS_PER_PROJECT, FREE_MAX_SECTIONS_TOTAL. Assim, membros ficam sujeitos aos limites do dono.
  - **Criar projeto novo:** só se o usuário for o dono (payload com project_id novo ou inexistente → só owner pode “criar”; membro só sincroniza projetos já existentes em que foi adicionado).
- **2.2** No upsert do projeto: se o usuário for **membro** (não dono), fazer **update** apenas de title, description, mindmap_settings, updated_at; **não** atualizar owner_id. Se for dono, manter comportamento atual (upsert completo incluindo owner_id).

Isso evita tabelas obsoletas e usa só `project_members` e `projects`.

---

### Step 3 – Listagem: “Meus projetos” vs “Compartilhados comigo” ✅ Implementado

- **3.1** Garantir que, ao carregar projetos do Supabase (fetch que já usa RLS), cada projeto venha com `owner_id`. No cliente, ter acesso ao `userId` atual (ex.: `useAuthStore` ou contexto) para classificar:
  - `owner_id === currentUserId` → “Meus projetos”;
  - `owner_id !== currentUserId` → “Compartilhados comigo”.
- **3.2** Na **home** (tela inicial):
  - Duas áreas: “Meus projetos” e “Projetos compartilhados comigo” (títulos localizados).
  - Contadores e limites (ex.: X/2 projetos, Y/200 seções) podem considerar só “Meus projetos” para o plano Free (limite de criação é do dono); compartilhados só entram na listagem e no sync.
- **3.3** Store: manter um único array `projects` com `owner_id` em cada item (ou derivar do payload do Supabase). A separação “meus” vs “compartilhados” fica na apresentação (filter por owner_id === me ou !== me).

Sem novas tabelas; só uso de `owner_id` e da lista que o RLS já retorna.

---

### Step 4 – Convidar membros (UI + backend mínimo) ✅ Implementado

- **4.1** Tela ou modal “Compartilhar projeto” (acessível só para o **dono**): campo para e-mail (ou identificador do usuário) e botão “Convidar” / “Adicionar como editor”.
- **4.2** Backend: **POST /api/projects/[id]/members** (ou PATCH) que:
  - Verifica se o usuário autenticado é dono do projeto.
  - Resolve o convidado (por e-mail, buscando em `profiles` ou `auth.users` se disponível) e insere em `project_members` com role `editor` (ou `viewer`, conforme regra).
- **4.3** Opcional: tabela `project_invites` (token, project_id, email, expires_at) para “convite por link” em vez de adicionar direto; pode ficar para um passo posterior para reduzir atrito.

Prioridade: adicionar membro por e-mail já cadastrado (busca em profiles por email), sem realtime.

---

### Step 5 – Ajustes de UX e quota na home (conforme decisão) ✅ Implementado

- **5.1** Se decisão for **B** (não mostrar cota na home): na home não exibir barra de créditos; ao abrir um projeto, no rodapé (ProjectSyncFooter) buscar e exibir a cota do projeto (GET quota?projectId=...).
- **5.2** Se decisão for **A** ou **C**: implementar o endpoint e a UI correspondente (lista por projeto ou “projeto em foco”).
- **5.3** Persistência e merge do store: ao fazer fetch de projetos do Supabase, mesclar “projetos compartilhados” no mesmo store (com owner_id preenchido) para que a home e as contagens fiquem corretas.

---

## Ordem sugerida de implementação

1. **Step 1** – Cota por projeto (tabela nova + uso no sync + GET quota por projectId).
2. **Step 2** – Sync: verificar dono/membro e não sobrescrever owner_id.
3. **Step 3** – Home: duas áreas (meus / compartilhados) usando owner_id.
4. **Step 4** – Convidar membros (API + UI “Compartilhar projeto”).
5. **Step 5** – Ajustes de exibição de cota (e eventualmente remover uso da tabela antiga por usuário).

---

## Extras implementados

- **Remover membro:** DELETE /api/projects/[id]/members?userId=uuid (apenas dono); botão “Remover” na lista de membros; membro removido perde acesso (RLS).
- **Compartilhamento público:** Só o dono vê controles (gerar token, ativar link); membros veem o link em somente leitura + “Copiar” quando o dono já tiver gerado. Sync de membro não sobrescreve sharing (merge preserva token no servidor).
- **Lista de membros para todos:** Dono e membros veem a lista completa (dono com role “owner” + demais com editor/viewer). Dono vê formulário de convite e botão Remover; membros só visualizam.

---

## Próximos passos (opcionais, para depois)

- **Convite por link (Step 4.3):** Tabela `project_invites` (token, project_id, email, expires_at); link para pessoa se cadastrar e ser adicionada ao projeto.
- **Role viewer na UI:** Permitir convidar como “só leitura” e bloquear edição/sync para esse role.
- **Realtime:** Sincronização em tempo real (Supabase Realtime ou similar) em etapa futura.

Cada passo pode ser feito em um PR e testado separadamente para evitar regressões e bugs.
