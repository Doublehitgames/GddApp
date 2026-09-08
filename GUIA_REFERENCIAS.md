# Referências cruzadas (`$[...]`)

Referência cruzada é o que faz o GDD virar uma teia em vez de uma pilha de
páginas. No texto de qualquer descrição — de página ou do próprio projeto —
escrever `$[Nome da Página]` cria um link clicável.

> Este é o documento técnico. A explicação para quem **usa** o app está na doc
> dentro do próprio app (`content/docs/`).

## As duas formas

| Forma | Quando aparece | Como resolve |
|---|---|---|
| `$[Nome da Página]` | **a forma canônica**; é o que você escreve e o que fica gravado | casa por título, sem diferenciar maiúscula de minúscula, com as pontas aparadas |
| `$[#uuid]` | legado, e usado internamente em um caminho de rename | casa pelo id da página |

O casamento por título usa o **título inteiro**, e **emoji faz parte do título**:
se a página se chama `🦴Osso`, então `$[🦴Osso]` acha e `$[Osso]` não.

Nada novo deve gravar `$[#uuid]` — a forma com nome é legível no editor, viaja
bem por markdown e é a que o MCP ensina aos agentes.

## O que acontece quando alguém renomeia uma página

Uma ref por nome aponta para *quem quer que tenha aquele título agora* — então
renomear a página deixaria órfã toda ref escrita com o nome antigo. Para evitar
isso, o rename dispara uma **varredura**: `buildRenameRefPatches`
(`utils/sectionReferences.ts`) reescreve `$[Título Antigo]` → `$[Título Novo]`
em todas as páginas **e** na descrição do projeto.

- No app, a varredura roda em `store/slices/sectionCrudSlice.ts`.
- Na API/MCP, em `lib/api/v1/renameRefs.ts`.

Refs em `$[#uuid]` não precisam de nada: seguem o rename por construção.

**Um detalhe que confunde:** a edição de título *inline* na tela da página
(`SectionDetailClient`) ainda passa o conteúdo daquela página por
`convertReferencesToIds` antes de salvar — congela as refs dela em ids. É
sobra de quando o id era a forma canônica; não é o caminho principal e vale
tratar como legado ao mexer nessa área.

## Onde cada peça vive

| Peça | Arquivo |
|---|---|
| Achar, converter, validar e renomear refs em texto e em blocos | `utils/sectionReferences.ts` |
| Virar link de verdade na leitura (BlockNote) | `lib/richDoc/transformRefs.ts` |
| Varredura de rename no lado da API/MCP | `lib/api/v1/renameRefs.ts` |
| Varredura de rename no lado do app | `store/slices/sectionCrudSlice.ts` |

Funções que valem conhecer em `utils/sectionReferences.ts`:

- `extractSectionReferences(text)` — todas as refs de um texto, com tipo
  (`name` ou `id`), valor e posição.
- `findSection(...)` — resolve uma ref para a página, com a regra de título.
- `convertReferencesToNames` / `convertBlockRefsToNames` — troca `$[#id]` por
  `$[Nome]` ao semear o editor, para o usuário não ver uuid cru.
- `getBacklinks(id, sections)` — quem aponta para esta página. Alimenta o
  "Referenciado por" na página e o mapa mental.
- `buildRenameRefPatches(...)` — os patches da varredura de rename.

## Escrevendo refs por MCP

Funciona igual: `$[Nome]` é texto normal dentro de `content` e dentro do texto de
um nó de `contentBlocks`. O renderizador read-only converte na hora. Confirme o
título com `list_sections` antes de referenciar — a ref quebra silenciosamente
se o título não casar exatamente. A convenção é ensinada ao agente no
`instructions` do handshake (`lib/mcp/instructions.ts` e o gêmeo em
`packages/mcp-server/`).

## Boas práticas de conteúdo

- **Preferir a ref à menção seca**: "moído no $[Moinho]" vale mais que "moído no
  Moinho". Vale também para categorias e páginas-pai.
- **Não inventar página**: se o título não existe, a ref fica quebrada. Criar a
  página ou citar sem ref.
- **Página com muitos backlinks é página central** — antes de mudar algo nela,
  olhar quem depende.
