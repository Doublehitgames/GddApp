import type { BalanceAddonDraft } from "@/lib/balance/types";

export type SectionAddonType = "balance";

export type SectionAddon = {
  id: string;
  type: SectionAddonType;
  name: string;
  data: BalanceAddonDraft;
};

export function balanceDraftToSectionAddon(draft: BalanceAddonDraft): SectionAddon {
  return {
    id: draft.id,
    type: "balance",
    name: draft.name,
    data: draft,
  };
}

export function sectionAddonToBalanceDraft(addon: SectionAddon): BalanceAddonDraft {
  return {
    ...addon.data,
    id: addon.id,
    name: addon.name,
  };
}

