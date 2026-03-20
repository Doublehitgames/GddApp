import type { BalanceAddonDraft } from "@/lib/balance/types";
import type { SectionAddon } from "@/lib/addons/types";
import { balanceDraftToSectionAddon } from "@/lib/addons/types";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asBalanceDraft(value: unknown): BalanceAddonDraft | null {
  if (!isObject(value)) return null;
  if (typeof value.id !== "string") return null;
  if (typeof value.name !== "string") return null;
  return value as unknown as BalanceAddonDraft;
}

function asSectionAddon(value: unknown): SectionAddon | null {
  if (!isObject(value)) return null;
  if (typeof value.id !== "string") return null;
  if (typeof value.name !== "string") return null;
  if (value.type !== "balance") return null;
  if (!isObject(value.data)) return null;
  return value as unknown as SectionAddon;
}

export function normalizeSectionAddons(raw: unknown): SectionAddon[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: SectionAddon[] = [];
  for (const item of raw) {
    const addon = asSectionAddon(item);
    if (addon) {
      out.push(addon);
      continue;
    }
    const maybeLegacyDraft = asBalanceDraft(item);
    if (maybeLegacyDraft) {
      out.push(balanceDraftToSectionAddon(maybeLegacyDraft));
    }
  }
  return out.length > 0 ? out : undefined;
}

export function stableAddonsForCompare(raw: unknown): string {
  const normalized = normalizeSectionAddons(raw) || [];
  const sorted = [...normalized].sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify(sorted);
}

