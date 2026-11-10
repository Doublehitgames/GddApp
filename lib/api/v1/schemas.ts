/**
 * Zod schemas for /api/v1/* request validation.
 */

import { z } from "zod";
import { PAGE_STATUSES } from "@/lib/pageStatus/types";
import { DECK_LAYOUTS } from "@/lib/deck/deck";
import { TABLE_COLUMN_TYPES, sameTableName } from "@/lib/tableRule/tableRule";
import {
  FLOWCHART_DIRECTIONS,
  MAX_FLOWCHART_EDGES,
  MAX_FLOWCHART_NODES,
} from "@/lib/flowchart/flowchart";
import { GAME_DESIGN_DOMAIN_IDS } from "@/lib/gameDesignDomains";
import { IMAGE_LIBRARY_LIMIT } from "@/lib/googleDriveFolder";

/**
 * Categoria da página. A lista é fechada: é ela que decide em que card da
 * Visão geral e da Documentação a página aparece. Antes a API aceitava texto
 * livre, e um agente que escrevia "personagens" tinha a escrita aceita e a
 * página caindo em "other", sem erro nenhum que dissesse o porquê.
 * Caixa e espaço são perdoados; valor fora da lista é recusado.
 */
export const domainTagSchema = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
  z.enum(GAME_DESIGN_DOMAIN_IDS)
);
const domainTagsSchema = z.array(domainTagSchema).max(20);

/** Maturidade da página. Enviar null tira o estado e apaga o carimbo. */
export const pageStatusSchema = z.enum(
  PAGE_STATUSES as unknown as [string, ...string[]]
);

/**
 * Como a página mostra as filhas no modo Deck. Enviar null devolve ao
 * automático, que decide pela quantidade de filhas.
 */
export const deckLayoutSchema = z.enum(
  DECK_LAYOUTS as unknown as [string, ...string[]]
);

/**
 * A regra de tabelas de uma página-mãe (lib/tableRule/tableRule.ts). Enviar
 * null tira a regra — e só a regra: as tabelas das filhas não são tocadas.
 *
 * O nome é a identidade da tabela e da coluna, então nome repetido é recusado
 * aqui em vez de virar duas leituras do mesmo cabeçalho mais adiante.
 */
const tableRuleColumnSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(TABLE_COLUMN_TYPES as unknown as [string, ...string[]]),
  unit: z.string().trim().max(40).optional(),
  required: z.boolean().optional(),
});

const withoutRepeatedNames =
  (what: string) =>
  (items: Array<{ name: string }>, ctx: z.RefinementCtx) => {
    items.forEach((item, index) => {
      if (items.findIndex((other) => sameTableName(other.name, item.name)) !== index) {
        ctx.addIssue({ code: "custom", path: [index, "name"], message: `Repeated ${what} name: ${item.name}` });
      }
    });
  };

export const tableRuleSchema = z.object({
  tables: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        columns: z.array(tableRuleColumnSchema).min(1).max(40).superRefine(withoutRepeatedNames("column")),
        multiRow: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(20)
    .superRefine(withoutRepeatedNames("table")),
});

/**
 * O fluxograma da página, na forma que se descreve por escrito: os nós e quem
 * aponta para quem. Posição é opcional — sem ela o servidor calcula o layout
 * (lib/flowchart/flowchart.ts). Enviar null apaga o fluxograma.
 *
 * A validação aqui é de forma; quem checa se uma aresta aponta para um nó que
 * existe é o construtor, que tem os dois lados na mão.
 */
export const flowchartSchema = z.object({
  direction: z
    .enum(FLOWCHART_DIRECTIONS as unknown as [string, ...string[]])
    .optional(),
  nodes: z
    .array(
      z.object({
        id: z.string().min(1).max(80).optional(),
        label: z.string().max(200),
        shape: z.string().max(30).optional(),
        note: z.string().max(2000).optional(),
        color: z.string().max(9).optional(),
        position: z.object({ x: z.number(), y: z.number() }).optional(),
        width: z.number().min(40).max(1200).optional(),
        height: z.number().min(24).max(1200).optional(),
      }),
    )
    .min(1)
    .max(MAX_FLOWCHART_NODES),
  edges: z
    .array(
      z.object({
        from: z.string().min(1).max(200),
        to: z.string().min(1).max(200),
        label: z.string().max(120).optional(),
        dashed: z.boolean().optional(),
      }),
    )
    .max(MAX_FLOWCHART_EDGES)
    .optional(),
});

// ── Projects ──────────────────────────────────────────────────────────

export const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().default(""),
});

/** A "Visão" do jogo. Toda chave é opcional: um PATCH mescla no que já existe. */
export const projectVisionSchema = z.object({
  logline: z.string().max(2000).optional(),
  playerVerb: z.string().max(2000).optional(),
  feeling: z.string().max(2000).optional(),
  pillars: z.array(z.string().max(2000)).max(8).optional(),
  genre: z.string().max(2000).optional(),
  starter: z
    .object({
      answered: z.array(z.string().max(200)).max(100),
      skipped: z.array(z.string().max(200)).max(100),
      doneAt: z.string().max(100).optional(),
    })
    .optional(),
});

export const updateProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  contentBlocks: z.array(z.record(z.string(), z.unknown())).optional(),
  coverImageUrl: z.string().url().nullable().optional(),
  mindmapSettings: z.record(z.string(), z.unknown()).optional(),
  aiInstructions: z.string().max(20000).nullable().optional(),
  vision: projectVisionSchema.nullable().optional(),
});

// ── Sections ──────────────────────────────────────────────────────────

export const createSectionSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().max(100_000).optional().default(""),
  contentBlocks: z.array(z.record(z.string(), z.unknown())).optional(),
  parentId: z.string().uuid().nullable().optional().default(null),
  order: z.number().int().min(0).optional().default(0),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional()
    .default(null),
  domainTags: domainTagsSchema.optional().default([]),
  dataId: z.string().max(200).nullable().optional().default(null),
  status: pageStatusSchema.nullable().optional().default(null),
  deckLayout: deckLayoutSchema.nullable().optional().default(null),
  tableRule: tableRuleSchema.nullable().optional().default(null),
  thumbImageUrl: z.string().url().nullable().optional().default(null),
  flowchart: flowchartSchema.nullable().optional(),
});

export const updateSectionSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  content: z.string().max(100_000).optional(),
  contentBlocks: z.array(z.record(z.string(), z.unknown())).optional(),
  parentId: z.string().uuid().nullable().optional(),
  order: z.number().int().min(0).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  domainTags: domainTagsSchema.optional(),
  dataId: z.string().max(200).nullable().optional(),
  status: pageStatusSchema.nullable().optional(),
  deckLayout: deckLayoutSchema.nullable().optional(),
  tableRule: tableRuleSchema.nullable().optional(),
  thumbImageUrl: z.string().url().nullable().optional(),
  flowchart: flowchartSchema.nullable().optional(),
});
// ── Images ────────────────────────────────────────────────────────────

/** Um arquivo do Drive como o índice da biblioteca guarda: o id é o que vale. */
const projectImageSchema = z.object({
  fileId: z.string().regex(/^[a-zA-Z0-9_-]{10,200}$/, "fileId must be a Google Drive file id"),
  name: z.string().trim().min(1).max(300),
  path: z.string().trim().max(500).optional(),
});

/**
 * POST /projects/:id/images: acrescenta ao índice arquivos que o chamador já
 * conhece (que acabou de subir, por exemplo). `folderUrl` só é usado quando o
 * projeto ainda não tem pasta ligada.
 */
export const addProjectImagesSchema = z.object({
  files: z.array(projectImageSchema).min(1).max(IMAGE_LIBRARY_LIMIT),
  folderUrl: z.string().max(500).optional(),
});

// ── Search ────────────────────────────────────────────────────────────


export const searchSchema = z.object({
  q: z.string().min(1).max(200),
  type: z.enum(["all", "projects", "sections"]).optional().default("all"),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});
