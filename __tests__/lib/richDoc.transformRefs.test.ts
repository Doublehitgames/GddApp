import { transformRichDocRefs, SECTION_REF_HREF_PREFIX } from "@/lib/richDoc/transformRefs";

const sections = [
  { id: "sec-combat", title: "Combat" },
  { id: "sec-economy", title: "Economy" },
];

describe("transformRichDocRefs", () => {
  it("returns empty array for non-array input", () => {
    expect(transformRichDocRefs(null, sections)).toEqual([]);
    expect(transformRichDocRefs(undefined, sections)).toEqual([]);
    expect(transformRichDocRefs({}, sections)).toEqual([]);
  });

  it("converts $[Section Name] into a link inline node", () => {
    const blocks = [
      {
        type: "paragraph",
        content: [{ type: "text", text: "See $[Combat] for details" }],
      },
    ];
    const out = transformRichDocRefs(blocks, sections);
    const content = (out[0] as { content: unknown[] }).content;
    expect(content).toHaveLength(3);
    expect(content[0]).toMatchObject({ type: "text", text: "See " });
    expect(content[1]).toMatchObject({
      type: "link",
      href: `${SECTION_REF_HREF_PREFIX}sec-combat`,
    });
    expect((content[1] as { content: unknown[] }).content[0]).toMatchObject({
      type: "text",
      text: "Combat",
    });
    expect(content[2]).toMatchObject({ type: "text", text: " for details" });
  });

  it("supports $[#id] reference syntax", () => {
    const blocks = [
      { type: "paragraph", content: [{ type: "text", text: "Go to $[#sec-economy]." }] },
    ];
    const out = transformRichDocRefs(blocks, sections);
    const linkNode = (out[0] as { content: unknown[] }).content[1] as { href: string; content: unknown[] };
    expect(linkNode.href).toBe(`${SECTION_REF_HREF_PREFIX}sec-economy`);
    expect((linkNode.content[0] as { text: string }).text).toBe("Economy");
  });

  it("preserves the literal text when the reference doesn't resolve", () => {
    const blocks = [
      { type: "paragraph", content: [{ type: "text", text: "Open $[Missing] now" }] },
    ];
    const out = transformRichDocRefs(blocks, sections);
    const content = (out[0] as { content: unknown[] }).content;
    expect(content).toHaveLength(3);
    expect((content[1] as { text: string }).text).toBe("$[Missing]");
  });

  it("handles multiple refs in one paragraph", () => {
    const blocks = [
      {
        type: "paragraph",
        content: [{ type: "text", text: "$[Combat] and $[Economy] together" }],
      },
    ];
    const content = (transformRichDocRefs(blocks, sections)[0] as { content: unknown[] }).content;
    expect(content).toHaveLength(4);
    expect((content[0] as { href: string }).href).toBe(`${SECTION_REF_HREF_PREFIX}sec-combat`);
    expect((content[2] as { href: string }).href).toBe(`${SECTION_REF_HREF_PREFIX}sec-economy`);
  });

  it("recurses into children (lists, toggles)", () => {
    const blocks = [
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "outer" }],
        children: [
          { type: "bulletListItem", content: [{ type: "text", text: "see $[Combat]" }] },
        ],
      },
    ];
    const out = transformRichDocRefs(blocks, sections);
    const childContent = ((out[0] as { children: unknown[] }).children[0] as { content: unknown[] }).content;
    expect((childContent[1] as { href: string }).href).toBe(`${SECTION_REF_HREF_PREFIX}sec-combat`);
  });

  it("recurses into table cells", () => {
    const blocks = [
      {
        type: "table",
        content: {
          type: "tableContent",
          rows: [
            { cells: [[{ type: "text", text: "ref $[Combat]" }]] },
          ],
        },
      },
    ];
    const out = transformRichDocRefs(blocks, sections);
    const cell = ((out[0] as { content: { rows: { cells: unknown[][] }[] } }).content.rows[0].cells[0]) as unknown[];
    expect((cell[1] as { href: string }).href).toBe(`${SECTION_REF_HREF_PREFIX}sec-combat`);
  });

  it("preserves text styles on the surrounding fragments", () => {
    const blocks = [
      {
        type: "paragraph",
        content: [{ type: "text", text: "see $[Combat] now", styles: { bold: true } }],
      },
    ];
    const content = (transformRichDocRefs(blocks, sections)[0] as { content: unknown[] }).content;
    expect((content[0] as { styles: unknown }).styles).toEqual({ bold: true });
    expect((content[2] as { styles: unknown }).styles).toEqual({ bold: true });
  });

  it("does not touch user-set link inline content", () => {
    const blocks = [
      {
        type: "paragraph",
        content: [
          { type: "link", href: "https://x.com", content: [{ type: "text", text: "external" }] },
        ],
      },
    ];
    const out = transformRichDocRefs(blocks, sections);
    expect((out[0] as { content: unknown[] }).content[0]).toMatchObject({
      type: "link",
      href: "https://x.com",
    });
  });

  it("leaves text without $[ marker untouched", () => {
    const blocks = [
      { type: "paragraph", content: [{ type: "text", text: "no refs here" }] },
    ];
    expect(transformRichDocRefs(blocks, sections)).toEqual(blocks);
  });
});
