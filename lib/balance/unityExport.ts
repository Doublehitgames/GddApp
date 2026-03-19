import { generateBalanceCurve } from "@/lib/balance/formulaEngine";
import type { Project, Section } from "@/store/projectStore";

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
    balanceAddons: (section.balanceAddons || []).map((addon) => {
      const curve = generateBalanceCurve({
        mode: addon.mode,
        preset: addon.preset,
        expression: addon.expression,
        startLevel: addon.startLevel,
        endLevel: addon.endLevel,
        decimals: addon.decimals,
        clampMin: addon.clampMin,
        clampMax: addon.clampMax,
        params: addon.params,
      });
      return {
        id: addon.id,
        name: addon.name,
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
