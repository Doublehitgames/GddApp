import { richDocToPlainText, richDocToMarkdown } from "@/lib/richDoc/serialize";

describe("richDocToPlainText", () => {
  it("returns empty string for non-array input", () => {
    expect(richDocToPlainText(null)).toBe("");
    expect(richDocToPlainText(undefined)).toBe("");
    expect(richDocToPlainText({})).toBe("");
  });

  it("flattens paragraph + heading text", () => {
    const blocks = [
      { type: "heading", props: { level: 1 }, content: [{ type: "text", text: "Title" }] },
      { type: "paragraph", content: [{ type: "text", text: "Hello " }, { type: "text", text: "world" }] },
    ];
    expect(richDocToPlainText(blocks)).toBe("Title\nHello world");
  });

  it("walks nested children (lists, toggles)", () => {
    const blocks = [
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "outer" }],
        children: [
          { type: "bulletListItem", content: [{ type: "text", text: "inner" }] },
        ],
      },
    ];
    expect(richDocToPlainText(blocks)).toBe("outer\ninner");
  });

  it("flattens link inline content", () => {
    const blocks = [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "see " },
          { type: "link", href: "https://x.com", content: [{ type: "text", text: "this" }] },
        ],
      },
    ];
    expect(richDocToPlainText(blocks)).toBe("see this");
  });

  it("extracts text from table rows", () => {
    const blocks = [
      {
        type: "table",
        content: {
          type: "tableContent",
          rows: [
            { cells: [[{ type: "text", text: "h1" }], [{ type: "text", text: "h2" }]] },
            { cells: [[{ type: "text", text: "a" }], [{ type: "text", text: "b" }]] },
          ],
        },
      },
    ];
    expect(richDocToPlainText(blocks)).toBe("h1 | h2\na | b");
  });

  it("ignores unknown block types but keeps their text", () => {
    const blocks = [
      { type: "future-block", content: [{ type: "text", text: "still here" }] },
    ];
    expect(richDocToPlainText(blocks)).toBe("still here");
  });
});

describe("richDocToMarkdown", () => {
  it("returns empty string for non-array input", () => {
    expect(richDocToMarkdown(null)).toBe("");
    expect(richDocToMarkdown([])).toBe("");
  });

  it("renders headings with the right hash count", () => {
    const blocks = [
      { type: "heading", props: { level: 1 }, content: [{ type: "text", text: "H1" }] },
      { type: "heading", props: { level: 3 }, content: [{ type: "text", text: "H3" }] },
    ];
    expect(richDocToMarkdown(blocks)).toBe("# H1\n\n### H3");
  });

  it("renders bullet, numbered, and check lists with indentation", () => {
    const blocks = [
      { type: "bulletListItem", content: [{ type: "text", text: "a" }] },
      {
        type: "numberedListItem",
        content: [{ type: "text", text: "first" }],
        children: [{ type: "numberedListItem", content: [{ type: "text", text: "nested" }] }],
      },
      { type: "checkListItem", props: { checked: true }, content: [{ type: "text", text: "done" }] },
      { type: "checkListItem", props: { checked: false }, content: [{ type: "text", text: "todo" }] },
    ];
    const md = richDocToMarkdown(blocks);
    expect(md).toContain("- a");
    expect(md).toContain("1. first");
    expect(md).toContain("  1. nested");
    expect(md).toContain("- [x] done");
    expect(md).toContain("- [ ] todo");
  });

  it("renders quote, code, divider, image, embed", () => {
    const blocks = [
      { type: "quote", content: [{ type: "text", text: "wisdom" }] },
      { type: "codeBlock", props: { language: "ts" }, content: [{ type: "text", text: "const x = 1;" }] },
      { type: "divider" },
      { type: "image", props: { url: "https://x/y.png", caption: "alt" } },
      { type: "embed", props: { url: "https://youtu.be/abc" } },
    ];
    const md = richDocToMarkdown(blocks);
    expect(md).toContain("> wisdom");
    expect(md).toContain("```ts\nconst x = 1;\n```");
    expect(md).toContain("---");
    expect(md).toContain("![alt](https://x/y.png)");
    expect(md).toContain("[Embed: https://youtu.be/abc](https://youtu.be/abc)");
  });

  it("renders tables in GFM pipe syntax with header separator", () => {
    const blocks = [
      {
        type: "table",
        content: {
          type: "tableContent",
          rows: [
            { cells: [[{ type: "text", text: "Name" }], [{ type: "text", text: "Damage" }]] },
            { cells: [[{ type: "text", text: "Sword" }], [{ type: "text", text: "10" }]] },
          ],
        },
      },
    ];
    const md = richDocToMarkdown(blocks);
    expect(md).toContain("| Name | Damage |");
    expect(md).toContain("| --- | --- |");
    expect(md).toContain("| Sword | 10 |");
  });

  it("escapes pipes in table cells", () => {
    const blocks = [
      {
        type: "table",
        content: {
          type: "tableContent",
          rows: [
            { cells: [[{ type: "text", text: "a|b" }], [{ type: "text", text: "c" }]] },
          ],
        },
      },
    ];
    expect(richDocToMarkdown(blocks)).toContain("| a\\|b | c |");
  });

  it("falls back to plain text for unknown block types", () => {
    const blocks = [
      { type: "future-block", content: [{ type: "text", text: "preserved" }] },
    ];
    expect(richDocToMarkdown(blocks)).toBe("preserved");
  });
});
