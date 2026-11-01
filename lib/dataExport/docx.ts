import type { Project } from "@/store/slices/types";
import { resolveProjectSpecialTokensForProject } from "@/lib/sections/specialTokens";
import { buildPageTree, sectionMarkdown, type MarkdownLabels, DEFAULT_MARKDOWN_LABELS, type PageNode } from "@/lib/dataExport/markdown";

/**
 * Word (.docx) de um projeto inteiro, para ler, imprimir ou mandar para quem
 * não usa o GDD. Não é restaurável — quem restaura é o JSON.
 *
 * A descrição de cada página é Markdown; aqui ela passa por um leitor curto
 * (título, lista, tabela, citação, código, parágrafo) que basta para o que o
 * editor de blocos produz. O que ele não entende vira parágrafo, nunca some.
 */

export type DocBlock =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "bullet"; text: string; depth: number; ordered: boolean }
  | { kind: "quote"; text: string }
  | { kind: "code"; text: string }
  | { kind: "table"; rows: string[][] };

/** Tira `$[Página]` → "Página" e as marcas de link/imagem, deixando o texto. */
export function plainInline(text: string): string {
  return text
    .replace(/\$\[#?([^\]]+)\]/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\(<?[^)>]*>?\)/g, "$1");
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

/** Markdown → blocos simples. `headingOffset` empurra os títulos da página para baixo do título dela. */
export function markdownToDocBlocks(markdown: string, headingOffset = 0): DocBlock[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const out: DocBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    const text = para.join(" ").trim();
    if (text) out.push({ kind: "paragraph", text: plainInline(text) });
    para = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      flush();
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        code.push(lines[i]);
        i += 1;
      }
      out.push({ kind: "code", text: code.join("\n") });
      continue;
    }
    if (!trimmed) {
      flush();
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flush();
      // "#" e "##" ficam logo abaixo do título da página; "###" um degrau a mais.
      out.push({ kind: "heading", level: Math.min(6, headingOffset + Math.max(1, heading[1].length - 1)), text: plainInline(heading[2]) });
      continue;
    }
    if (trimmed.startsWith("|") && i + 1 < lines.length && TABLE_DIVIDER.test(lines[i + 1])) {
      flush();
      const rows: string[][] = [splitRow(trimmed).map(plainInline)];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitRow(lines[i]).map(plainInline));
        i += 1;
      }
      i -= 1;
      out.push({ kind: "table", rows });
      continue;
    }
    const bullet = /^(\s*)([-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.*)$/.exec(line);
    if (bullet) {
      flush();
      out.push({
        kind: "bullet",
        depth: Math.min(4, Math.floor(bullet[1].replace(/\t/g, "  ").length / 2)),
        ordered: /\d/.test(bullet[2]),
        text: plainInline(bullet[3]),
      });
      continue;
    }
    if (trimmed.startsWith(">")) {
      flush();
      out.push({ kind: "quote", text: plainInline(trimmed.replace(/^>\s?/, "")) });
      continue;
    }
    para.push(trimmed);
  }
  flush();
  return out;
}

/** O projeto inteiro como blocos: capa, descrição, e cada página com título no nível da árvore. */
export function projectToDocBlocks(project: Project, labels: MarkdownLabels = DEFAULT_MARKDOWN_LABELS): DocBlock[] {
  const out: DocBlock[] = [];
  const v = project.vision;
  if (v?.logline?.trim()) out.push({ kind: "quote", text: v.logline.trim() });
  const pillars = (v?.pillars ?? []).map((p) => p.trim()).filter(Boolean);
  if (pillars.length > 0) {
    out.push({ kind: "heading", level: 1, text: labels.pillars });
    pillars.forEach((p) => out.push({ kind: "bullet", text: p, depth: 0, ordered: false }));
  }
  const description = (project.description ?? "").trim();
  if (description) out.push(...markdownToDocBlocks(resolveProjectSpecialTokensForProject(description, project), 1));

  const walk = (nodes: PageNode[], depth: number) => {
    for (const node of nodes) {
      const s = node.section;
      const level = Math.min(6, depth + 1);
      out.push({ kind: "heading", level, text: s.title || "—" });
      const body = sectionMarkdown(s);
      if (body) out.push(...markdownToDocBlocks(resolveProjectSpecialTokensForProject(body, project, s.id), level));
      walk(node.children, depth + 1);
    }
  };
  walk(buildPageTree(project.sections), 0);
  return out;
}

/** Monta o .docx. `docx` é carregado só aqui, na hora do clique — é pesado. */
export async function buildProjectDocx(project: Project, labels: MarkdownLabels = DEFAULT_MARKDOWN_LABELS): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } = await import(
    /* webpackChunkName: "docx" */ "docx"
  );
  const HEADINGS = [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
    HeadingLevel.HEADING_5,
    HeadingLevel.HEADING_6,
  ];

  /** `**negrito**` e `*itálico*` viram TextRun; o resto é texto corrido. */
  const runs = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g).filter(Boolean);
    return parts.map((part) => {
      if (/^\*\*[^*]+\*\*$/.test(part)) return new TextRun({ text: part.slice(2, -2), bold: true });
      if (/^(\*[^*]+\*|_[^_]+_)$/.test(part)) return new TextRun({ text: part.slice(1, -1), italics: true });
      return new TextRun({ text: part.replace(/`/g, "") });
    });
  };

  const children: InstanceType<typeof Paragraph | typeof Table>[] = [
    new Paragraph({ text: project.title || "GDD", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 400 } }),
  ];

  for (const block of projectToDocBlocks(project, labels)) {
    switch (block.kind) {
      case "heading":
        children.push(new Paragraph({ children: runs(block.text), heading: HEADINGS[block.level - 1], spacing: { before: 240, after: 120 } }));
        break;
      case "paragraph":
        children.push(new Paragraph({ children: runs(block.text), spacing: { after: 160 } }));
        break;
      case "bullet":
        // Lista numerada sai como marcador: o Word renumera sozinho e não
        // vale uma definição de numeração por documento para isso.
        children.push(new Paragraph({ children: runs(block.text), bullet: { level: block.depth } }));
        break;
      case "quote":
        children.push(new Paragraph({ children: [new TextRun({ text: block.text, italics: true })], indent: { left: 480 }, spacing: { after: 160 } }));
        break;
      case "code":
        block.text.split("\n").forEach((line) => children.push(new Paragraph({ children: [new TextRun({ text: line, font: "Consolas", size: 18 })] })));
        children.push(new Paragraph({ text: "" }));
        break;
      case "table": {
        const width = Math.max(...block.rows.map((r) => r.length));
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: block.rows.map(
              (row, r) =>
                new TableRow({
                  tableHeader: r === 0,
                  children: Array.from({ length: width }, (_, c) =>
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: row[c] ?? "", bold: r === 0 })] })] }),
                  ),
                }),
            ),
          }),
        );
        children.push(new Paragraph({ text: "" }));
        break;
      }
    }
  }

  const doc = new Document({ creator: "GDD Manager", title: project.title, sections: [{ properties: {}, children }] });
  return Packer.toBlob(doc);
}
