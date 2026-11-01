import type { DiagramState, Project, Section } from "@/store/slices/types";
import { richDocToMarkdown } from "@/lib/richDoc/serialize";
import { resolveProjectSpecialTokensForProject } from "@/lib/sections/specialTokens";
import { safeFileName, uniqueNamer } from "@/lib/dataExport/fileNames";

/**
 * Markdown do "Exportar os dados": uma pasta por projeto, um arquivo .md por
 * página, e a árvore de páginas vira a árvore de pastas.
 *
 *   Meu Jogo/
 *     README.md               ← capa: título, visão, descrição do projeto
 *     01 Fazenda.md
 *     01 Fazenda/             ← filhas de "Fazenda"
 *       01 Galinha.md
 *     02 Mercado.md
 *
 * O número na frente guarda a ordem do GDD (o explorador de arquivos ordena
 * por nome). As referências `$[Página]` viram links relativos entre os
 * arquivos, então o zip abre navegável em qualquer leitor de Markdown.
 */

export type ExportFile = { path: string; content: string };

export type MarkdownLabels = {
  vision: string;
  logline: string;
  playerVerb: string;
  feeling: string;
  pillars: string;
  genre: string;
  pages: string;
  flowchart: string;
  emptyPage: string;
};

export const DEFAULT_MARKDOWN_LABELS: MarkdownLabels = {
  vision: "Visão do jogo",
  logline: "Em uma frase",
  playerVerb: "O que o jogador faz",
  feeling: "O que o jogador sente",
  pillars: "Pilares",
  genre: "Gênero",
  pages: "Páginas",
  flowchart: "Fluxograma",
  emptyPage: "(página sem descrição)",
};

export type PageNode = { section: Section; children: PageNode[] };

/** Árvore de páginas na ordem do GDD. Página com mãe que sumiu sobe para a raiz. */
export function buildPageTree(sections: Section[] | undefined): PageNode[] {
  const list = Array.isArray(sections) ? sections : [];
  const ids = new Set(list.map((s) => s.id));
  const byParent = new Map<string, Section[]>();
  for (const s of list) {
    const key = s.parentId && ids.has(s.parentId) && s.parentId !== s.id ? s.parentId : "";
    const bucket = byParent.get(key) ?? [];
    bucket.push(s);
    byParent.set(key, bucket);
  }
  const seen = new Set<string>();
  const build = (parentKey: string): PageNode[] =>
    (byParent.get(parentKey) ?? [])
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .filter((s) => {
        // Ciclo de parentId não pode virar recursão infinita.
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      })
      .map((section) => ({ section, children: build(section.id) }));
  const roots = build("");
  // Páginas presas num ciclo (A mãe de B, B mãe de A) não alcançam a raiz.
  for (const s of list) {
    if (!seen.has(s.id)) {
      seen.add(s.id);
      roots.push({ section: s, children: [] });
    }
  }
  return roots;
}

/** O texto da página em Markdown: o espelho `content`, ou os blocos quando ele falta. */
export function sectionMarkdown(section: Pick<Section, "content" | "contentBlocks">): string {
  const content = typeof section.content === "string" ? section.content.trim() : "";
  if (content) return content;
  return richDocToMarkdown(section.contentBlocks ?? []);
}

function projectDescriptionMarkdown(project: Project): string {
  const text = typeof project.description === "string" ? project.description.trim() : "";
  if (text) return text;
  return richDocToMarkdown(project.contentBlocks ?? []);
}

/** Caminho relativo de `fromDir` (pastas) até `toPath` (arquivo), com "/". */
export function relativePath(fromDir: string[], toPath: string[]): string {
  let i = 0;
  while (i < fromDir.length && i < toPath.length - 1 && fromDir[i] === toPath[i]) i += 1;
  const up = fromDir.slice(i).map(() => "..");
  return [...up, ...toPath.slice(i)].join("/");
}

/** Link Markdown que aceita espaço e parêntese no caminho. */
function mdLink(label: string, target: string): string {
  return `[${label.replace(/[[\]]/g, "")}](<${target}>)`;
}

/**
 * Troca `$[Título]` e `$[#id]` por link relativo para o arquivo da página.
 * Referência que não acha página fica como estava — é texto do autor.
 */
export function linkReferences(
  text: string,
  fromDir: string[],
  pathById: Map<string, string[]>,
  sections: Pick<Section, "id" | "title">[],
): string {
  if (!text.includes("$[")) return text;
  const byTitle = new Map<string, Pick<Section, "id" | "title">>();
  for (const s of sections) {
    const key = (s.title || "").trim().toLowerCase();
    if (key && !byTitle.has(key)) byTitle.set(key, s);
  }
  return text.replace(/\$\[([^\]]+)\]/g, (whole, raw: string) => {
    const value = raw.trim();
    const target = value.startsWith("#")
      ? sections.find((s) => s.id === value.slice(1))
      : byTitle.get(value.toLowerCase());
    if (!target) return whole;
    const path = pathById.get(target.id);
    if (!path) return whole;
    return mdLink(target.title, relativePath(fromDir, path));
  });
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function frontMatter(section: Section): string {
  const lines: string[] = [`id: ${yamlString(section.id)}`];
  if (section.dataId) lines.push(`dataId: ${yamlString(section.dataId)}`);
  if (section.status) lines.push(`status: ${section.status}`);
  if (section.domainTags && section.domainTags.length > 0) {
    lines.push(`tags: [${section.domainTags.map(yamlString).join(", ")}]`);
  }
  if (section.created_at) lines.push(`created: ${yamlString(section.created_at)}`);
  const updated = section.content_updated_at || section.updated_at;
  if (updated) lines.push(`updated: ${yamlString(updated)}`);
  return `---\n${lines.join("\n")}\n---\n\n`;
}

function mermaidLabel(text: string): string {
  return `"${String(text || " ").replace(/"/g, "'").replace(/\s+/g, " ").trim() || " "}"`;
}

/**
 * Fluxograma como bloco Mermaid: o GitHub, o Obsidian e o Notion desenham
 * isso; quem não desenha ainda lê "A --> B".
 */
export function flowchartToMermaid(state: DiagramState | undefined): string {
  const nodes = state?.nodes ?? [];
  if (nodes.length === 0) return "";
  const alias = new Map<string, string>();
  nodes.forEach((n, i) => alias.set(n.id, `n${i + 1}`));
  const lines = ["flowchart TD"];
  for (const n of nodes) {
    const label = mermaidLabel(n.data?.label ?? "");
    const shape = n.data?.blockType;
    const id = alias.get(n.id)!;
    if (shape === "losango") lines.push(`  ${id}{${label}}`);
    else if (shape === "circulo") lines.push(`  ${id}((${label}))`);
    else if (shape === "pill") lines.push(`  ${id}([${label}])`);
    else lines.push(`  ${id}[${label}]`);
  }
  for (const e of state?.edges ?? []) {
    const from = alias.get(e.source);
    const to = alias.get(e.target);
    if (!from || !to) continue;
    lines.push(e.label ? `  ${from} -->|${mermaidLabel(e.label)}| ${to}` : `  ${from} --> ${to}`);
  }
  return "```mermaid\n" + lines.join("\n") + "\n```";
}

function visionMarkdown(project: Project, labels: MarkdownLabels): string {
  const v = project.vision;
  if (!v) return "";
  const rows: string[] = [];
  if (v.logline?.trim()) rows.push(`**${labels.logline}:** ${v.logline.trim()}`);
  if (v.playerVerb?.trim()) rows.push(`**${labels.playerVerb}:** ${v.playerVerb.trim()}`);
  if (v.feeling?.trim()) rows.push(`**${labels.feeling}:** ${v.feeling.trim()}`);
  if (v.genre?.trim()) rows.push(`**${labels.genre}:** ${v.genre.trim()}`);
  const pillars = (v.pillars ?? []).map((p) => p.trim()).filter(Boolean);
  if (rows.length === 0 && pillars.length === 0) return "";
  let out = `## ${labels.vision}\n\n${rows.join("\n\n")}`;
  if (pillars.length > 0) out += `${rows.length ? "\n\n" : ""}**${labels.pillars}:**\n\n${pillars.map((p) => `- ${p}`).join("\n")}`;
  return out;
}

/** Os arquivos de UM projeto, com caminhos relativos à pasta dele. */
export function buildProjectMarkdownFiles(project: Project, labels: MarkdownLabels = DEFAULT_MARKDOWN_LABELS): ExportFile[] {
  const sections = project.sections ?? [];
  const tree = buildPageTree(sections);
  const pathById = new Map<string, string[]>();

  // 1ª passada: decide o caminho de cada página, para os links da 2ª.
  const assign = (nodes: PageNode[], dir: string[]) => {
    const namer = uniqueNamer();
    const pad = Math.max(2, String(nodes.length).length);
    nodes.forEach((node, i) => {
      const base = namer(`${String(i + 1).padStart(pad, "0")} ${safeFileName(node.section.title)}`);
      pathById.set(node.section.id, [...dir, `${base}.md`]);
      if (node.children.length > 0) assign(node.children, [...dir, base]);
    });
  };
  assign(tree, []);

  const resolve = (text: string, fromDir: string[], sectionId?: string) =>
    linkReferences(resolveProjectSpecialTokensForProject(text, project, sectionId), fromDir, pathById, sections);

  const files: ExportFile[] = [];

  // Capa do projeto.
  const cover: string[] = [`# ${project.title || "GDD"}`];
  const vision = visionMarkdown(project, labels);
  if (vision) cover.push(vision);
  const description = projectDescriptionMarkdown(project);
  if (description) cover.push(resolve(description, []));
  if (tree.length > 0) {
    const toc: string[] = [];
    const walk = (nodes: PageNode[], depth: number) => {
      for (const node of nodes) {
        toc.push(`${"  ".repeat(depth)}- ${mdLink(node.section.title || "—", relativePath([], pathById.get(node.section.id)!))}`);
        walk(node.children, depth + 1);
      }
    };
    walk(tree, 0);
    cover.push(`## ${labels.pages}\n\n${toc.join("\n")}`);
  }
  files.push({ path: "README.md", content: cover.join("\n\n") + "\n" });

  // Uma página por arquivo.
  const emit = (nodes: PageNode[]) => {
    for (const node of nodes) {
      const s = node.section;
      const path = pathById.get(s.id)!;
      const dir = path.slice(0, -1);
      const parts: string[] = [`${frontMatter(s)}# ${s.title || "—"}`];
      const body = sectionMarkdown(s);
      parts.push(body ? resolve(body, dir, s.id) : `_${labels.emptyPage}_`);
      const chart = flowchartToMermaid(s.flowchartState);
      if (chart) parts.push(`## ${labels.flowchart}\n\n${chart}`);
      files.push({ path: path.join("/"), content: parts.join("\n\n") + "\n" });
      emit(node.children);
    }
  };
  emit(tree);
  return files;
}

/**
 * Todos os projetos escolhidos num zip só: uma pasta por projeto, nomes que
 * não se repetem (dois projetos com o mesmo título viram "X" e "X (2)").
 */
export function buildMarkdownArchiveFiles(projects: Project[], labels: MarkdownLabels = DEFAULT_MARKDOWN_LABELS): ExportFile[] {
  const namer = uniqueNamer();
  const out: ExportFile[] = [];
  for (const project of projects) {
    const folder = namer(safeFileName(project.title, "projeto"));
    for (const file of buildProjectMarkdownFiles(project, labels)) {
      out.push({ path: `${folder}/${file.path}`, content: file.content });
    }
  }
  return out;
}
