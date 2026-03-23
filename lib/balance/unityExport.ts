import { generateBalanceCurve } from "@/lib/balance/formulaEngine";
import type { Project, Section } from "@/store/projectStore";
import { sectionAddonToBalanceDraft } from "@/lib/addons/types";

type UnitySectionExport = {
  id: string;
  parentId: string | null;
  title: string;
  balanceAddons: Array<{
    id: string;
    name: string;
    computedTable: Array<{ level: number; value: number }>;
  }>;
};

export type UnityExportV1 = {
  unityExportVersion: 1;
  generatedAt: string;
  project: {
    id: string;
    title: string;
  };
  sections: UnitySectionExport[];
};

export function buildUnityExport(project: Project): UnityExportV1 {
  const sections = (project.sections || []).map((section: Section) => ({
    id: section.id,
    parentId: section.parentId || null,
    title: section.title,
    balanceAddons: (section.addons || [])
      .filter((addon) => addon.type === "xpBalance")
      .map((addon) => {
      const balanceAddon = sectionAddonToBalanceDraft(addon);
      const curve = generateBalanceCurve({
        mode: balanceAddon.mode,
        preset: balanceAddon.preset,
        expression: balanceAddon.expression,
        startLevel: balanceAddon.startLevel,
        endLevel: balanceAddon.endLevel,
        decimals: balanceAddon.decimals,
        clampMin: balanceAddon.clampMin,
        clampMax: balanceAddon.clampMax,
        params: balanceAddon.params,
      });
      return {
        id: balanceAddon.id,
        name: balanceAddon.name,
        computedTable: curve.points,
      };
    }),
  }));

  return {
    unityExportVersion: 1,
    generatedAt: new Date().toISOString(),
    project: {
      id: project.id,
      title: project.title,
    },
    sections,
  };
}
