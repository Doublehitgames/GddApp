import { collectReverseRefUpdates } from "@/lib/addons/refs";
import type { SectionAddon } from "@/lib/addons/types";

type Section = { id: string; addons: SectionAddon[] };

function attrDefs(id: string): SectionAddon {
  return {
    id,
    type: "attributeDefinitions",
    name: "Defs",
    data: {
      id,
      name: "Defs",
      attributes: [
        { id: "a1", key: "str", label: "STR", valueType: "int", defaultValue: 0 },
      ],
    },
  };
}

function attrProfile(id: string, refId: string): SectionAddon {
  return {
    id,
    type: "attributeProfile",
    name: "Profile",
    data: {
      id,
      name: "Profile",
      definitionsRef: refId,
      values: [{ id: "v1", attributeKey: "str", value: 10 }],
    },
  };
}

function attrModifiers(id: string, refId: string): SectionAddon {
  return {
    id,
    type: "attributeModifiers",
    name: "Mods",
    data: {
      id,
      name: "Mods",
      definitionsRef: refId,
      modifiers: [{ id: "m1", attributeKey: "str", mode: "add", value: 5 }],
    },
  };
}

function currency(id: string): SectionAddon {
  return {
    id,
    type: "currency",
    name: "GLD",
    data: { id, name: "GLD", code: "GLD", displayName: "Gold", kind: "soft", decimals: 0 },
  };
}

function economyLink(
  id: string,
  overrides: Partial<Record<"buyCurrencyRef" | "sellCurrencyRef" | "producedItemRef" | "unlockRef", string>>
): SectionAddon {
  return {
    id,
    type: "economyLink",
    name: "Eco",
    data: {
      id,
      name: "Eco",
      buyModifiers: [],
      sellModifiers: [],
      ...overrides,
    },
  };
}

describe("collectReverseRefUpdates", () => {
  describe("attributeDefinitions", () => {
    it("updates definitionsRef on profile and modifiers in other sections", () => {
      const sections: Section[] = [
        { id: "A", addons: [] /* moved addon already removed */ },
        { id: "B", addons: [attrProfile("pr-1", "A"), attrModifiers("mo-1", "A")] },
        { id: "C", addons: [] },
      ];
      const { updatedSections, count } = collectReverseRefUpdates(
        sections,
        "attributeDefinitions",
        "A",
        "C"
      );
      expect(count).toBe(2);
      const bAddons = updatedSections.find((s) => s.id === "B")!.addons!;
      expect((bAddons[0].data as { definitionsRef: string }).definitionsRef).toBe("C");
      expect((bAddons[1].data as { definitionsRef: string }).definitionsRef).toBe("C");
    });

  });

  describe("currency", () => {
    it("updates buyCurrencyRef and sellCurrencyRef on economyLink", () => {
      const sections: Section[] = [
        { id: "A", addons: [] },
        {
          id: "B",
          addons: [economyLink("eco-1", { buyCurrencyRef: "A", sellCurrencyRef: "A" })],
        },
      ];
      const { updatedSections, count } = collectReverseRefUpdates(sections, "currency", "A", "C");
      expect(count).toBe(2);
      const eco = updatedSections[1].addons![0];
      if (eco.type === "economyLink") {
        expect(eco.data.buyCurrencyRef).toBe("C");
        expect(eco.data.sellCurrencyRef).toBe("C");
      }
    });
  });

  describe("inventory", () => {
    it("updates outputRef + ingredients + outputs on production", () => {
      const prod: SectionAddon = {
        id: "prod-1",
        type: "production",
        name: "P",
        data: {
          id: "prod-1",
          name: "P",
          mode: "recipe",
          ingredients: [{ itemRef: "A", quantity: 2 }],
          outputs: [{ itemRef: "A", quantity: 1 }],
          outputRef: "A",
          craftTimeSeconds: 60,
        },
      };
      const sections: Section[] = [
        { id: "A", addons: [] },
        { id: "B", addons: [prod, economyLink("eco-1", { producedItemRef: "A" })] },
      ];
      const { count, updatedSections } = collectReverseRefUpdates(
        sections,
        "inventory",
        "A",
        "C"
      );
      expect(count).toBe(4);
      const nextProd = updatedSections[1].addons![0];
      if (nextProd.type === "production") {
        expect(nextProd.data.outputRef).toBe("C");
        expect(nextProd.data.ingredients[0].itemRef).toBe("C");
        expect(nextProd.data.outputs[0].itemRef).toBe("C");
      }
      const nextEco = updatedSections[1].addons![1];
      if (nextEco.type === "economyLink") {
        expect(nextEco.data.producedItemRef).toBe("C");
      }
    });
  });

  describe("xpBalance", () => {
    it("updates unitXpRef on dataSchema entries and unlockRef on economyLink", () => {
      const ds: SectionAddon = {
        id: "ds-1",
        type: "dataSchema",
        name: "S",
        data: {
          id: "ds-1",
          name: "S",
          entries: [
            { id: "e1", key: "xp", label: "XP", valueType: "int", value: 0, unitXpRef: "A" },
          ],
        },
      };
      const sections: Section[] = [
        { id: "A", addons: [] },
        { id: "B", addons: [ds, economyLink("eco-1", { unlockRef: "A" })] },
      ];
      const { count, updatedSections } = collectReverseRefUpdates(
        sections,
        "xpBalance",
        "A",
        "C"
      );
      expect(count).toBe(2);
      const nextDs = updatedSections[1].addons![0];
      if (nextDs.type === "dataSchema") {
        expect(nextDs.data.entries[0].unitXpRef).toBe("C");
      }
      const nextEco = updatedSections[1].addons![1];
      if (nextEco.type === "economyLink") {
        expect(nextEco.data.unlockRef).toBe("C");
      }
    });
  });

  describe("economyLink", () => {
    it("updates economyLinkRef on dataSchema entries", () => {
      const ds: SectionAddon = {
        id: "ds-1",
        type: "dataSchema",
        name: "S",
        data: {
          id: "ds-1",
          name: "S",
          entries: [
            { id: "e1", key: "x", label: "X", valueType: "int", value: 0, economyLinkRef: "A" },
          ],
        },
      };
      const sections: Section[] = [
        { id: "A", addons: [] },
        { id: "B", addons: [ds] },
      ];
      const { count, updatedSections } = collectReverseRefUpdates(
        sections,
        "economyLink",
        "A",
        "C"
      );
      expect(count).toBe(1);
      const nextDs = updatedSections[1].addons![0];
      if (nextDs.type === "dataSchema") {
        expect(nextDs.data.entries[0].economyLinkRef).toBe("C");
      }
    });
  });

  describe("ambiguity guard", () => {
    it("returns zero updates when source still has an addon of same type", () => {
      const sections: Section[] = [
        // origem ainda tem outro attributeDefinitions
        { id: "A", addons: [attrDefs("defs-remaining")] },
        { id: "B", addons: [attrProfile("pr-1", "A")] },
      ];
      const { count, updatedSections } = collectReverseRefUpdates(
        sections,
        "attributeDefinitions",
        "A",
        "C"
      );
      expect(count).toBe(0);
      // sections retornadas são o mesmo ref (não mudou nada)
      expect(updatedSections).toBe(sections);
      const prof = updatedSections[1].addons![0];
      if (prof.type === "attributeProfile") {
        expect(prof.data.definitionsRef).toBe("A");
      }
    });

    it("updates when source has other addons but not of the moved type", () => {
      const sections: Section[] = [
        { id: "A", addons: [currency("curr-remaining")] },
        { id: "B", addons: [attrProfile("pr-1", "A")] },
      ];
      const { count } = collectReverseRefUpdates(
        sections,
        "attributeDefinitions",
        "A",
        "C"
      );
      expect(count).toBe(1);
    });
  });

  describe("no reverse-refs for some types", () => {
    it("returns zero for globalVariable moves", () => {
      const sections: Section[] = [
        { id: "A", addons: [] },
        { id: "B", addons: [attrProfile("pr-1", "A")] },
      ];
      const { count, updatedSections } = collectReverseRefUpdates(
        sections,
        "globalVariable",
        "A",
        "C"
      );
      expect(count).toBe(0);
      expect(updatedSections).toBe(sections);
    });
  });

  describe("untouched refs", () => {
    it("does not update refs pointing to other sections", () => {
      const sections: Section[] = [
        { id: "A", addons: [] },
        // Profile aponta pra outra section "Z", não pra A — não deve mudar
        { id: "B", addons: [attrProfile("pr-1", "Z")] },
      ];
      const { count, updatedSections } = collectReverseRefUpdates(
        sections,
        "attributeDefinitions",
        "A",
        "C"
      );
      expect(count).toBe(0);
      const prof = updatedSections[1].addons![0];
      if (prof.type === "attributeProfile") {
        expect(prof.data.definitionsRef).toBe("Z");
      }
    });
  });
});
