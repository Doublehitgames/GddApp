import { getSectionSearchText } from "@/utils/sectionSearchText";

describe("getSectionSearchText", () => {
  it("returns title + content + addon names + richDoc text", () => {
    const section = {
      title: "Combat System",
      content: "Players use weapons.",
      addons: [
        { type: "currency", name: "Gold", data: { id: "c1", name: "Gold", code: "GOLD" } },
        {
          type: "richDoc",
          name: "Lore",
          data: {
            id: "rd1",
            name: "Lore",
            blocks: [
              { type: "heading", props: { level: 1 }, content: [{ type: "text", text: "Backstory" }] },
              { type: "paragraph", content: [{ type: "text", text: "An ancient kingdom fell." }] },
            ],
            schemaVersion: 1,
          },
        },
      ],
    };
    const text = getSectionSearchText(section);
    expect(text).toContain("Combat System");
    expect(text).toContain("Players use weapons.");
    expect(text).toContain("Gold");
    expect(text).toContain("Lore");
    expect(text).toContain("Backstory");
    expect(text).toContain("An ancient kingdom fell.");
  });

  it("falls back to balanceAddons when addons is missing", () => {
    const section = {
      title: "X",
      balanceAddons: [
        { type: "richDoc", name: "n", data: { blocks: [{ content: [{ type: "text", text: "legacy" }] }] } },
      ],
    };
    expect(getSectionSearchText(section)).toContain("legacy");
  });

  it("ignores non-richDoc addon data (just uses the name)", () => {
    const section = {
      title: "T",
      addons: [
        { type: "inventory", name: "Sword", data: { stackable: true, weight: 5 } },
      ],
    };
    const text = getSectionSearchText(section);
    expect(text).toContain("Sword");
    expect(text).not.toContain("stackable");
    expect(text).not.toContain("weight");
  });

  it("returns empty string for malformed input", () => {
    expect(getSectionSearchText(null)).toBe("");
    expect(getSectionSearchText(undefined)).toBe("");
    expect(getSectionSearchText({})).toBe("");
  });

  it("tolerates richDoc with missing blocks", () => {
    const section = {
      title: "T",
      addons: [{ type: "richDoc", name: "Empty", data: { id: "x", name: "Empty" } }],
    };
    expect(getSectionSearchText(section)).toContain("Empty");
  });
});
