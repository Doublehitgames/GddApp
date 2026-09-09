/**
 * Zod schemas for /api/v1/* request validation.
 */

import { z } from "zod";
import { PAGE_STATUSES } from "@/lib/pageStatus/types";
import { DECK_LAYOUTS } from "@/lib/deck/deck";
import {
  FLOWCHART_DIRECTIONS,
  MAX_FLOWCHART_EDGES,
  MAX_FLOWCHART_NODES,
} from "@/lib/flowchart/flowchart";

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

export const updateProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  contentBlocks: z.array(z.record(z.string(), z.unknown())).optional(),
  coverImageUrl: z.string().url().nullable().optional(),
  mindmapSettings: z.record(z.string(), z.unknown()).optional(),
  aiInstructions: z.string().max(20000).nullable().optional(),
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
  domainTags: z.array(z.string().max(50)).max(20).optional().default([]),
  dataId: z.string().max(200).nullable().optional().default(null),
  status: pageStatusSchema.nullable().optional().default(null),
  deckLayout: deckLayoutSchema.nullable().optional().default(null),
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
  domainTags: z.array(z.string().max(50)).max(20).optional(),
  dataId: z.string().max(200).nullable().optional(),
  status: pageStatusSchema.nullable().optional(),
  deckLayout: deckLayoutSchema.nullable().optional(),
  thumbImageUrl: z.string().url().nullable().optional(),
  flowchart: flowchartSchema.nullable().optional(),
});
// ── Search ────────────────────────────────────────────────────────────


export const searchSchema = z.object({
  q: z.string().min(1).max(200),
  type: z.enum(["all", "projects", "sections"]).optional().default("all"),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});
