import { getSectionAiContent } from "@/utils/sectionAiContent";

describe("getSectionAiContent", () => {
  it("returns the section markdown", () => {
    expect(getSectionAiContent({ content: "Markdown body." })).toBe("Markdown body.");
  });

  it("trims surrounding whitespace", () => {
    expect(getSectionAiContent({ content: "  spaced  " })).toBe("spaced");
  });

  it("returns an empty string for sections without content", () => {
    expect(getSectionAiContent({})).toBe("");
    expect(getSectionAiContent(null)).toBe("");
    expect(getSectionAiContent("not a section")).toBe("");
  });
});
