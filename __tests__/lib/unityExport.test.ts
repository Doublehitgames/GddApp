import { buildUnityExport } from "@/lib/balance/unityExport";
import { createDefaultBalanceAddon } from "@/lib/balance/formulaEngine";
import { balanceDraftToSectionAddon } from "@/lib/addons/types";

describe("unity export", () => {
  it("exports computed LV -> XP table for section balance addons", () => {
    const addon = createDefaultBalanceAddon("addon-1");
    addon.startLevel = 1;
    addon.endLevel = 10;

    const project = {
      id: "project-1",
      title: "My Project",
      sections: [
        {
          id: "section-1",
          parentId: null,
          title: "Progression",
          addons: [balanceDraftToSectionAddon(addon)],
        },
      ],
    } as any;

    const payload = buildUnityExport(project);
    expect(payload.unityExportVersion).toBe(1);
    expect(payload.sections).toHaveLength(1);
    expect(payload.sections[0].balanceAddons).toHaveLength(1);
    expect(payload.sections[0].balanceAddons[0].computedTable).toHaveLength(10);
    expect(payload.sections[0].balanceAddons[0].computedTable[0]).toEqual(
      expect.objectContaining({ level: 1 })
    );
  });
});

