import { getSectionAiContent } from "@/utils/sectionAiContent";

describe("getSectionAiContent", () => {
  it("returns empty string for null/undefined/non-object", () => {
    expect(getSectionAiContent(null)).toBe("");
    expect(getSectionAiContent(undefined)).toBe("");
    expect(getSectionAiContent("string")).toBe("");
  });

  it("returns just the markdown content when there are no richDocs", () => {
    expect(getSectionAiContent({ content: "Hello world" })).toBe("Hello world");
  });

  it("returns just the richDoc markdown when content is empty", () => {
    const section = {
      content: "",
      addons: [
        {
          type: "richDoc",
          name: "Notes",
          data: { id: "x", blocks: [{ type: "paragraph", content: [{ type: "text", text: "doc body" }] }] },
        },
      ],
    };
    const text = getSectionAiContent(section);
    expect(text).toContain("### Notes");
    expect(text).toContain("doc body");
  });

  it("concatenates content + richDoc markdown when both exist", () => {
    const section = {
      content: "Markdown body.",
      addons: [
        {
          type: "richDoc",
          name: "Lore",
          data: { id: "x", blocks: [{ type: "paragraph", content: [{ type: "text", text: "rich text" }] }] },
        },
      ],
    };
    const text = getSectionAiContent(section);
    expect(text).toMatch(/Markdown body\.[\s\S]*### Lore[\s\S]*rich text/);
  });

  it("ignores non-richDoc addons", () => {
    const section = {
      content: "x",
      addons: [{ type: "currency", name: "Gold", data: { code: "GOLD" } }],
    };
    expect(getSectionAiContent(section)).toBe("x");
  });

  it("trims leading/trailing whitespace on the base content", () => {
    expect(getSectionAiContent({ content: "  hello  " })).toBe("hello");
  });
});
