import { getSectionSearchText } from "@/utils/sectionSearchText";

describe("getSectionSearchText", () => {
  it("returns title + content", () => {
    const text = getSectionSearchText({ title: "Economia", content: "Preços e moedas." });
    expect(text).toContain("Economia");
    expect(text).toContain("Preços e moedas.");
  });

  it("tolerates partial section shapes", () => {
    expect(getSectionSearchText({ title: "Só título" })).toBe("Só título");
    expect(getSectionSearchText({ content: "Só corpo" })).toBe("Só corpo");
    expect(getSectionSearchText({})).toBe("");
  });

  it("returns an empty string for non-objects", () => {
    expect(getSectionSearchText(null)).toBe("");
    expect(getSectionSearchText("texto")).toBe("");
  });
});
