/**
 * Zod schemas for /api/v1/* request validation.
 */

import { z } from "zod";

// ── Projects ──────────────────────────────────────────────────────────

export const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().default(""),
});

export const updateProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  coverImageUrl: z.string().url().nullable().optional(),
  mindmapSettings: z.record(z.string(), z.unknown()).optional(),
  aiInstructions: z.string().max(20000).nullable().optional(),
});

// ── Sections ──────────────────────────────────────────────────────────

export const createSectionSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().max(100_000).optional().default(""),
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
});

export const updateSectionSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  content: z.string().max(100_000).optional(),
  parentId: z.string().uuid().nullable().optional(),
  order: z.number().int().min(0).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  domainTags: z.array(z.string().max(50)).max(20).optional(),
  dataId: z.string().max(200).nullable().optional(),
  thumbImageUrl: z.string().url().nullable().optional(),
  addonGroupNotes: z.record(z.string(), z.string()).optional(),
});

// ── Addons ────────────────────────────────────────────────────────────

const addonTypes = [
  "xpBalance",
  "progressionTable",
  "economyLink",
  "currency",
  "globalVariable",
  "inventory",
  "production",
  "craftTable",
  "dataSchema",
  "attributeDefinitions",
  "attributeProfile",
  "attributeModifiers",
  "fieldLibrary",
  "exportSchema",
  "richDoc",
  "genericStats",
] as const;

export const createAddonSchema = z.object({
  type: z.enum(addonTypes),
  name: z.string().min(1).max(200),
  group: z.string().max(100).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export const updateAddonSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  group: z.string().max(100).nullable().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

// ── Search ────────────────────────────────────────────────────────────

export const searchSchema = z.object({
  q: z.string().min(1).max(200),
  type: z.enum(["all", "projects", "sections"]).optional().default("all"),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});
