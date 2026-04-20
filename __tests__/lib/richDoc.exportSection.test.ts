import {
  extractSectionRichDocMarkdown,
  sectionHasExportableContent,
} from "@/lib/richDoc/exportSection";

describe("extractSectionRichDocMarkdown", () => {
  it("returns empty string when section has no addons", () => {
    expect(extractSectionRichDocMarkdown(null)).toBe("");
    expect(extractSectionRichDocMarkdown({})).toBe("");
    expect(extractSectionRichDocMarkdown({ addons: [] })).toBe("");
  });

  it("ignores non-richDoc addons", () => {
    const section = {
      addons: [{ type: "currency", name: "Gold", data: { code: "GOLD" } }],
    };
    expect(extractSectionRichDocMarkdown(section)).toBe("");
  });

  it("emits each richDoc as a level-3 heading + its markdown", () => {
    const section = {
      addons: [
        {
          type: "richDoc",
          name: "Lore",
          data: {
            id: "rd1",
            blocks: [
              { type: "heading", props: { level: 1 }, content: [{ type: "text", text: "Origin" }] },
              { type: "paragraph", content: [{ type: "text", text: "Long ago..." }] },
            ],
          },
        },
        {
          type: "richDoc",
          name: "Mechanics",
          data: {
            id: "rd2",
            blocks: [{ type: "paragraph", content: [{ type: "text", text: "Tap to play." }] }],
          },
        },
      ],
    };
    const md = extractSectionRichDocMarkdown(section);
    expect(md).toContain("### Lore");
    expect(md).toContain("# Origin");
    expect(md).toContain("Long ago...");
    expect(md).toContain("### Mechanics");
    expect(md).toContain("Tap to play.");
  });

  it("falls back to a default heading when the addon has no name", () => {
    const section = {
      addons: [
        {
          type: "richDoc",
          name: "",
          data: { id: "x", blocks: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }] },
        },
      ],
    };
    expect(extractSectionRichDocMarkdown(section)).toContain("### Documento");
  });

  it("skips richDocs with empty blocks arrays", () => {
    const section = {
      addons: [{ type: "richDoc", name: "Empty", data: { id: "x", blocks: [] } }],
    };
    expect(extractSectionRichDocMarkdown(section)).toBe("");
  });
});

describe("sectionHasExportableContent", () => {
  it("returns false for empty input", () => {
    expect(sectionHasExportableContent(null)).toBe(false);
    expect(sectionHasExportableContent({})).toBe(false);
    expect(sectionHasExportableContent({ content: "" })).toBe(false);
    expect(sectionHasExportableContent({ content: "   " })).toBe(false);
  });

  it("returns true when content has non-whitespace text", () => {
    expect(sectionHasExportableContent({ content: "hello" })).toBe(true);
  });

  it("returns true when a richDoc has blocks even if content is empty", () => {
    const section = {
      content: "",
      addons: [
        {
          type: "richDoc",
          name: "n",
          data: { id: "x", blocks: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }] },
        },
      ],
    };
    expect(sectionHasExportableContent(section)).toBe(true);
  });

  it("returns false when both content is empty and richDocs are empty", () => {
    const section = {
      content: "",
      addons: [{ type: "richDoc", name: "n", data: { id: "x", blocks: [] } }],
    };
    expect(sectionHasExportableContent(section)).toBe(false);
  });
});
