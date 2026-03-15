# Créditos de sync: como funciona

## Regra principal

**Cada chamada a `POST /api/projects/sync` cobra pelo *diff* daquela requisição:** diferença entre o estado que você está enviando e o que já está no cloud. Não cobramos por “ações” do usuário (criar, editar, mover, apagar), e sim pelo efeito líquido daquela sync.

- **Seção nova** (não existe no cloud) ou **alterada** (título, conteúdo, cor, pai) → 1 crédito por seção.
- **Só reordenação** (várias seções só mudaram de ordem) → 1 crédito no total (não por seção).
- **Exclusão no cloud** → 1 crédito por seção que **já estava no cloud** e você está removendo.

## Exemplo que você descreveu

1. Criar uma nova seção (local).
2. Editar a descrição dessa seção (local).
3. Mover essa seção (local).
4. **Deletar** essa seção (local).
5. Dar **sync uma vez** no final.

Nesse fluxo você **nunca** enviou a seção para o cloud. Na hora do sync, o payload tem **0 seções**. O cloud também tem 0 seções para esse projeto. Logo:

- `sectionsToUpsert` = 0  
- `removedSectionIds` = 0 (só contamos “delete” para seções que **já estão no cloud**)  
- **Créditos = 0.**

Ou seja: **não se paga por algo que não sobe para o cloud.** A lógica já está desenhada para isso.

## De onde pode vir “3” ou “5” créditos?

Se você vê 3 ou 5 créditos, em geral é um destes casos:

1. **Vários syncs no meio do caminho**  
   Ex.: sync após criar (1), após editar (1), após mover (1) = 3 créditos. Se depois você apaga e dá mais um sync, pode entrar mais 1 (delete no cloud, se a seção já tiver sido enviada). Cada sync cobra pelo diff *daquela* requisição.

2. **Sync automático ligado**  
   Com “Sync automático” ativo, o app pode sincronizar após cada alteração. Aí cada sync consome créditos pelo diff daquele momento.

3. **Outro projeto ou outras seções**  
   A estimativa e a cobrança são por *todos* os projetos pendentes. Se houver mais de um projeto ou mais seções com alterações, o total sobe.

## Como pagar só pelo resultado final

- Preferir **sync manual** (configuração em Ajustes → Persistência).
- Fazer as alterações (criar, editar, mover, até apagar) e clicar em **Sincronizar** uma vez quando terminar.  
Assim você paga apenas pelo **diff final** (ex.: 0 créditos se no fim não sobrou nada no cloud).

## Onde está a lógica no código

- **API:** `app/api/projects/sync/route.ts`  
  - `removedSectionIds`: só inclui IDs que **existem no DB** e não vêm no payload (delete no cloud).  
  - `consumedThisSync = contentChangeCount + (orderOnlyCount > 0 ? 1 : 0) + sectionsDeleted`.

- **Comentários no código** deixam explícito que não cobramos delete de seção que nunca foi para o cloud.
