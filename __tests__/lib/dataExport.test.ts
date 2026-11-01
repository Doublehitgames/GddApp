import type { Project, Section } from "@/store/slices/types";
import { safeFileName, uniqueNamer, exportDateStamp } from "@/lib/dataExport/fileNames";
import {
  buildMarkdownArchiveFiles,
  buildPageTree,
  buildProjectMarkdownFiles,
  flowchartToMermaid,
  linkReferences,
  relativePath,
  sectionMarkdown,
} from "@/lib/dataExport/markdown";
import { buildAccountExport, buildFullBackup, projectRole } from "@/lib/dataExport/json";
import { markdownToDocBlocks, plainInline, projectToDocBlocks } from "@/lib/dataExport/docx";
import { buildZipArchive } from "@/lib/dataExport/zip";

const ID = {
  p: "7f1d6c4e-1b2a-4c3d-8e9f-0a1b2c3d4e5f",
  farm: "a3b8d1b6-0b3b-4b1a-9c1a-1a2b3c4d5e6f",
  hen: "b4c9e2c7-1c4c-4c2b-8d2b-2b3c4d5e6f70",
  market: "c5d0f3d8-2d5d-4d3c-9e3c-3c4d5e6f7081",
  orphan: "d6e1a4e9-3e6e-4e4d-8f4d-4d5e6f708192",
};

function section(partial: Partial<Section> & Pick<Section, "id" | "title" | "order">): Section {
  return { created_at: "2026-10-01T00:00:00.000Z", ...partial };
}

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: ID.p,
    title: "Colheita: Feliz",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-02T00:00:00.000Z",
    description: "Um jogo de $[🐔Galinha] e fazenda.",
    vision: { logline: "Plante e venda", pillars: ["Calma", "Ritmo"] },
    sections: [
      section({ id: ID.market, title: "Mercado", order: 1, content: "Vende ovos da $[🐔Galinha]." }),
      section({ id: ID.farm, title: "Fazenda", order: 0, content: "A base." }),
      section({
        id: ID.hen,
        title: "🐔Galinha",
        order: 0,
        parentId: ID.farm,
        status: "approved",
        domainTags: ["economy"],
        content: "Põe ovo. Vai ao $[Mercado] e volta à $[#" + ID.farm + "].\n\n## Produção\n\n| Item | Tempo (s) |\n| --- | --- |\n| Ovo | 30 |",
        flowchartState: {
          version: 1,
          updatedAt: "2026-10-01T00:00:00.000Z",
          viewport: { x: 0, y: 0, zoom: 1 },
          nodes: [
            { id: "x", type: "block", position: { x: 0, y: 0 }, data: { label: "Fome?", blockType: "losango" } },
            { id: "y", type: "block", position: { x: 0, y: 0 }, data: { label: "Come" } },
          ],
          edges: [{ id: "e", source: "x", target: "y", label: "sim" }],
        } as unknown as Section["flowchartState"],
      }),
    ],
    ...overrides,
  };
}

describe("fileNames", () => {
  it("keeps accents and emoji, strips forbidden characters", () => {
    expect(safeFileName("🐔 Galinha: ovos/dia?")).toBe("🐔 Galinha ovos dia");
    expect(safeFileName("  ...  ")).toBe("sem-titulo");
    expect(safeFileName("CON")).toBe("sem-titulo");
    expect(safeFileName("fim.")).toBe("fim");
  });

  it("dedupes names case-insensitively", () => {
    const n = uniqueNamer();
    expect([n("A"), n("a"), n("A")]).toEqual(["A", "a (2)", "A (3)"]);
  });

  it("stamps the local date", () => {
    expect(exportDateStamp(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("buildPageTree", () => {
  it("orders by `order`, nests children and lifts orphans to the root", () => {
    const p = project();
    p.sections!.push(section({ id: ID.orphan, title: "Solta", order: 9, parentId: "gone" }));
    const tree = buildPageTree(p.sections);
    expect(tree.map((n) => n.section.title)).toEqual(["Fazenda", "Mercado", "Solta"]);
    expect(tree[0].children.map((n) => n.section.title)).toEqual(["🐔Galinha"]);
  });

  it("survives a parent cycle", () => {
    const tree = buildPageTree([
      section({ id: "a", title: "A", order: 0, parentId: "b" }),
      section({ id: "b", title: "B", order: 0, parentId: "a" }),
    ]);
    expect(tree.map((n) => n.section.id).sort()).toEqual(["a", "b"]);
  });
});

describe("relativePath / linkReferences", () => {
  it("walks up and down folders", () => {
    expect(relativePath([], ["01 A", "01 B.md"])).toBe("01 A/01 B.md");
    expect(relativePath(["01 A"], ["01 A", "01 B.md"])).toBe("01 B.md");
    expect(relativePath(["01 A"], ["02 C.md"])).toBe("../02 C.md");
  });

  it("leaves unknown references alone", () => {
    expect(linkReferences("ver $[Nada]", [], new Map(), [])).toBe("ver $[Nada]");
  });
});

describe("sectionMarkdown", () => {
  it("falls back to blocks when the markdown mirror is empty", () => {
    expect(sectionMarkdown({ content: "", contentBlocks: [{ type: "paragraph", content: [{ type: "text", text: "oi" }] }] as never })).toBe("oi");
  });
});

describe("buildProjectMarkdownFiles", () => {
  const files = buildProjectMarkdownFiles(project());
  const byPath = Object.fromEntries(files.map((f) => [f.path, f.content]));

  it("mirrors the page tree as folders, in GDD order", () => {
    expect(files.map((f) => f.path)).toEqual(["README.md", "01 Fazenda.md", "01 Fazenda/01 🐔Galinha.md", "02 Mercado.md"]);
  });

  it("writes a cover with vision, description and a linked index", () => {
    const readme = byPath["README.md"];
    expect(readme).toMatch(/^# Colheita: Feliz/);
    expect(readme).toContain("Plante e venda");
    expect(readme).toContain("- Calma");
    expect(readme).toContain("[🐔Galinha](<01 Fazenda/01 🐔Galinha.md>)");
    expect(readme).toContain("  - [🐔Galinha](<01 Fazenda/01 🐔Galinha.md>)");
  });

  it("turns $[...] and legacy $[#id] into relative links", () => {
    const hen = byPath["01 Fazenda/01 🐔Galinha.md"];
    expect(hen).toContain("[Mercado](<../02 Mercado.md>)");
    expect(hen).toContain("[Fazenda](<../01 Fazenda.md>)");
    expect(byPath["02 Mercado.md"]).toContain("[🐔Galinha](<01 Fazenda/01 🐔Galinha.md>)");
  });

  it("keeps metadata in front matter, the table and the flowchart", () => {
    const hen = byPath["01 Fazenda/01 🐔Galinha.md"];
    expect(hen.startsWith(`---\nid: "${ID.hen}"`)).toBe(true);
    expect(hen).toContain("status: approved");
    expect(hen).toContain('tags: ["economy"]');
    expect(hen).toContain("| Ovo | 30 |");
    expect(hen).toContain("```mermaid");
    expect(hen).toContain('n1{"Fome?"}');
    expect(hen).toContain('n1 -->|"sim"| n2');
  });
});

describe("buildMarkdownArchiveFiles", () => {
  it("puts each project in its own folder, deduping equal titles", () => {
    const a = project();
    const b = project({ id: "other", title: "Colheita: Feliz", sections: [] });
    const paths = buildMarkdownArchiveFiles([a, b]).map((f) => f.path);
    expect(paths).toContain("Colheita Feliz/README.md");
    expect(paths).toContain("Colheita Feliz (2)/README.md");
    expect(paths.filter((p) => p.startsWith("Colheita Feliz (2)/"))).toHaveLength(1);
  });
});

describe("flowchartToMermaid", () => {
  it("is empty without nodes", () => {
    expect(flowchartToMermaid(undefined)).toBe("");
  });
});

describe("json exports", () => {
  it("keeps the /backup format that the restore reads", () => {
    const backup = buildFullBackup([project()], new Date("2026-11-01T10:00:00.000Z"));
    expect(Object.keys(backup).sort()).toEqual(["exportDate", "projects", "version"]);
    expect(backup.version).toBe("1.0");
    expect(backup.exportDate).toBe("2026-11-01T10:00:00.000Z");
    expect(backup.projects[0].sections).toHaveLength(3);
  });

  it("classifies ownership like the home page", () => {
    expect(projectRole({ ownerId: null }, "u1")).toBe("owner");
    expect(projectRole({ ownerId: "u1" }, "u1")).toBe("owner");
    expect(projectRole({ ownerId: "u2" }, "u1")).toBe("member");
    expect(projectRole({ ownerId: "u2" }, null)).toBe("local");
  });

  it("exports account basics and never tokens", () => {
    const user = {
      id: "u1",
      email: "a@b.c",
      created_at: "2026-01-01T00:00:00Z",
      last_sign_in_at: "2026-10-31T00:00:00Z",
      app_metadata: { provider: "google", providers: ["google"] },
      user_metadata: { full_name: "Ana", access_token: "secret" },
      access_token: "secret",
      refresh_token: "secret",
    };
    const data = buildAccountExport({
      user,
      profile: { display_name: null, avatar_url: "https://x/y.png" },
      locale: "pt-BR",
      theme: "dark",
      projects: [{ ...project(), ownerId: "u2" }],
    });
    expect(data.account).toEqual({
      id: "u1",
      email: "a@b.c",
      name: "Ana",
      avatarUrl: "https://x/y.png",
      createdAt: "2026-01-01T00:00:00Z",
      lastSignInAt: "2026-10-31T00:00:00Z",
      signInMethods: ["google"],
    });
    expect(data.projects[0]).toMatchObject({ role: "member", pages: 3 });
    expect(JSON.stringify(data)).not.toContain("secret");
  });
});

describe("docx blocks", () => {
  it("strips reference and link markup", () => {
    expect(plainInline("ver $[Mercado], $[#abc] e [site](<a b.md>)")).toBe("ver Mercado, abc e site");
  });

  it("parses headings, lists, tables, quotes and code", () => {
    const blocks = markdownToDocBlocks("## Sub\n\n- um\n  - dois\n1. três\n\n> nota\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```\nx\n```\n\nfim\nde linha", 1);
    expect(blocks).toEqual([
      { kind: "heading", level: 2, text: "Sub" },
      { kind: "bullet", depth: 0, ordered: false, text: "um" },
      { kind: "bullet", depth: 1, ordered: false, text: "dois" },
      { kind: "bullet", depth: 0, ordered: true, text: "três" },
      { kind: "quote", text: "nota" },
      { kind: "table", rows: [["A", "B"], ["1", "2"]] },
      { kind: "code", text: "x" },
      { kind: "paragraph", text: "fim de linha" },
    ]);
  });

  it("nests page titles by tree depth", () => {
    const headings = projectToDocBlocks(project()).filter((b) => b.kind === "heading");
    expect(headings.map((h) => (h.kind === "heading" ? `${h.level}:${h.text}` : ""))).toEqual([
      "1:Pilares",
      "1:Fazenda",
      "2:🐔Galinha",
      "3:Produção",
      "1:Mercado",
    ]);
  });
});

describe("buildProjectDocx", () => {
  it("builds a non-empty Word file", async () => {
    const { buildProjectDocx } = await import("@/lib/dataExport/docx");
    const blob = await buildProjectDocx(project());
    expect(blob.size).toBeGreaterThan(1000);
  });
});

describe("buildZip", () => {
  it("zips the markdown tree with the same paths", async () => {
    const JSZip = (await import("jszip")).default;
    const files = buildMarkdownArchiveFiles([project()]);
    const bytes = await (await buildZipArchive(files)).generateAsync({ type: "uint8array" });
    const zip = await JSZip.loadAsync(bytes);
    const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
    expect(names.sort()).toEqual(files.map((f) => f.path).sort());
    expect(await zip.file("Colheita Feliz/02 Mercado.md")!.async("string")).toContain("# Mercado");
  });
});
