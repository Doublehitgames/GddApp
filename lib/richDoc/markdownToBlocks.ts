/**
 * Markdown → blocos do BlockNote. Sem DOM e sem React: é o conversor que as
 * rotas da API e os servidores MCP usam para derivar `contentBlocks` do
 * markdown, e também o que as telas de leitura usam para renderizar a
 * descrição de uma página que só tem o espelho markdown (legado).
 *
 * Ele cobre o markdown que aparece em descrição de verdade:
 * - blocos: parágrafo, título (h1-h3, e h4-h6 achatados em h3), lista com
 *   marcador, numerada e de tarefa (aninhando por indentação), citação,
 *   código cercado, tabela, imagem, callout e spoiler (`> [!tag]`)
 * - inline: negrito, itálico, código, riscado e link
 * - `$[Página]` e `@[token]` ficam como texto normal de propósito —
 *   transformRefs e resolveTokens cuidam deles na hora de renderizar.
 *
 * O que ele NÃO faz: HTML embutido, nota de rodapé, lista de definição. Nada
 * disso aparece em descrição escrita no editor.
 */

/** Espelha CALLOUT_VARIANTS de lib/richDoc/calloutBlock.tsx — repetido aqui
 *  porque aquele módulo é de cliente (BlockNote/React) e este precisa
 *  continuar importável de rota de API. Variante nova lá, variante nova aqui. */
const CALLOUT_VARIANT_IDS = new Set([
  "note",
  "warning",
  "design-decision",
  "balance-note",
]);

interface TextNode {
  type: "text";
  text: string;
  styles?: { bold?: boolean; italic?: boolean; code?: boolean; strikethrough?: boolean };
}

interface LinkNode {
  type: "link";
  href: string;
  content: TextNode[];
}

type InlineNode = TextNode | LinkNode;

interface TableContent {
  type: "tableContent";
  rows: Array<{ cells: InlineNode[][] }>;
}

export interface BNBlock {
  type: string;
  props?: Record<string, unknown>;
  content: InlineNode[] | TableContent;
  children: BNBlock[];
}

// ─── Inline ──────────────────────────────────────────────────────────────────

/**
 * Uma alternativa por marcação, e um catch-all de UM caractere no fim: assim
 * um asterisco solto ou um colchete que não fecha link viram texto em vez de
 * sumir. Os pedaços de texto puro são costurados de volta depois.
 */
const INLINE_RE = new RegExp(
  [
    "\\*\\*([^*]+)\\*\\*", // 1 negrito com asterisco
    "__([^_]+)__", // 2 negrito com underscore
    "\\*([^*]+)\\*", // 3 itálico
    "~~([^~]+)~~", // 4 riscado
    "`([^`]+)`", // 5 código
    "!\\[([^\\]]*)\\]\\(([^)]*)\\)", // 6 alt, 7 url — imagem no meio do texto
    "\\[([^\\]]+)\\]\\(([^)]*)\\)", // 8 texto, 9 href — link
    "([\\s\\S])", // 10 qualquer outro caractere
  ].join("|"),
  "g",
);

/** Só a URL: `(url "título")` guarda um título opcional que não usamos. */
function hrefOf(target: string): string {
  return (target || "").trim().split(/\s+/)[0] || "";
}

function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  const push = (node: InlineNode) => {
    const last = nodes[nodes.length - 1];
    // Costura caractere solto em cima do texto puro anterior.
    if (
      node.type === "text" &&
      !node.styles &&
      last &&
      last.type === "text" &&
      !last.styles
    ) {
      last.text += node.text;
      return;
    }
    nodes.push(node);
  };

  INLINE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m[1] !== undefined) push({ type: "text", text: m[1], styles: { bold: true } });
    else if (m[2] !== undefined) push({ type: "text", text: m[2], styles: { bold: true } });
    else if (m[3] !== undefined) push({ type: "text", text: m[3], styles: { italic: true } });
    else if (m[4] !== undefined) push({ type: "text", text: m[4], styles: { strikethrough: true } });
    else if (m[5] !== undefined) push({ type: "text", text: m[5], styles: { code: true } });
    else if (m[6] !== undefined) {
      // Imagem no meio de um parágrafo: o inline do BlockNote não tem nó de
      // imagem, então fica o texto alternativo. Imagem sozinha na linha vira
      // bloco de imagem, no laço principal.
      if (m[6]) push({ type: "text", text: m[6] });
    } else if (m[8] !== undefined) {
      const href = hrefOf(m[9]);
      if (href) nodes.push({ type: "link", href, content: [{ type: "text", text: m[8] }] });
      else push({ type: "text", text: m[8] });
    } else if (m[10]) push({ type: "text", text: m[10] });
  }

  return nodes.filter((n) => n.type !== "text" || n.text !== "");
}

// ─── Tabela ──────────────────────────────────────────────────────────────────

function isTableRow(line: string): boolean {
  return /^[ \t]*\|.*\|[ \t]*$/.test(line);
}

/** A linha de baixo do cabeçalho: só barra, hífen, dois-pontos e espaço. */
function isTableSeparator(line: string): boolean {
  const t = line.trim();
  return t.includes("|") && t.includes("-") && /^[|\s:-]+$/.test(t);
}

/**
 * Tabela de verdade começa aqui: linha de células E separadora embaixo. Sem
 * as duas, a linha é um parágrafo que por acaso tem barra vertical — e é esta
 * função que decide isso nos dois lugares, senão a linha não é consumida por
 * ramo nenhum e o texto do usuário evapora.
 */
function startsTable(lines: string[], index: number): boolean {
  return (
    isTableRow(lines[index]) &&
    index + 1 < lines.length &&
    isTableSeparator(lines[index + 1])
  );
}

function splitTableCells(line: string): string[] {
  const body = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let current = "";
  for (let k = 0; k < body.length; k += 1) {
    if (body[k] === "\\" && body[k + 1] === "|") {
      current += "|";
      k += 1;
      continue;
    }
    if (body[k] === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += body[k];
  }
  cells.push(current.trim());
  return cells;
}

// ─── Listas ──────────────────────────────────────────────────────────────────

const LIST_RE = /^([ \t]*)(?:[-*+]|(\d+)[.)])[ \t]+(.*)$/;
const TASK_RE = /^\[([ xX])\][ \t]+(.*)$/;

/**
 * Consome a sequência inteira de itens de lista e devolve os de primeiro
 * nível, com os indentados como filhos. Feito de uma vez porque o
 * aninhamento só existe em relação aos vizinhos.
 */
function parseListRun(lines: string[], start: number): { blocks: BNBlock[]; next: number } {
  const flat: Array<{ level: number; block: BNBlock }> = [];
  let i = start;

  while (i < lines.length) {
    const m = lines[i].match(LIST_RE);
    if (!m) break;
    const level = Math.floor(m[1].replace(/\t/g, "  ").length / 2);
    const ordered = m[2] !== undefined;
    let text = m[3];
    let type = ordered ? "numberedListItem" : "bulletListItem";
    let props: Record<string, unknown> | undefined;

    const task = ordered ? null : text.match(TASK_RE);
    if (task) {
      type = "checkListItem";
      props = { checked: task[1].toLowerCase() === "x" };
      text = task[2];
    }

    flat.push({
      level,
      block: { type, ...(props ? { props } : {}), content: parseInline(text), children: [] },
    });
    i += 1;
  }

  const roots: BNBlock[] = [];
  const stack: Array<{ level: number; block: BNBlock }> = [];
  for (const item of flat) {
    while (stack.length > 0 && stack[stack.length - 1].level >= item.level) stack.pop();
    if (stack.length === 0) roots.push(item.block);
    else stack[stack.length - 1].block.children.push(item.block);
    stack.push(item);
  }

  return { blocks: roots, next: i };
}

// ─── Laço principal ──────────────────────────────────────────────────────────

const HEADING_RE = /^[ \t]*(#{1,6})[ \t]+(.+)$/;
const IMAGE_LINE_RE = /^[ \t]*!\[([^\]]*)\]\(([^)]+)\)[ \t]*$/;
const MARKER_RE = /^[ \t]*>[ \t]*\[!([a-z-]+)\][ \t]*(.*)$/i;
const HR_RE = /^[ \t]*([-*_])(?:[ \t]*\1){2,}[ \t]*$/;

export function markdownToBlocks(markdown: string): BNBlock[] {
  if (!markdown?.trim()) return [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: BNBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    // Guarda-corpo: se nenhum ramo abaixo consumir a linha, o laço avança
    // igual. Já custou um travamento — `#### Título` não casava com nenhum
    // ramo e também era excluído do parágrafo, então `i` ficava parado e a
    // requisição da API girava para sempre.
    const lineAtStart = i;

    if (!line.trim()) {
      i++;
      continue;
    }

    // Código cercado
    if (line.trimStart().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) code.push(lines[i++]);
      i++;
      blocks.push({
        type: "codeBlock",
        props: { language: lang || "plain" },
        content: [{ type: "text", text: code.join("\n") }],
        children: [],
      });
      continue;
    }

    // Título. O BlockNote só tem três níveis, então h4-h6 descem para h3 —
    // melhor um título raso que um parágrafo com o cerquilha na cara do leitor.
    const heading = line.match(HEADING_RE);
    if (heading) {
      blocks.push({
        type: "heading",
        props: { level: Math.min(3, heading[1].length) },
        content: parseInline(heading[2].trim()),
        children: [],
      });
      i++;
      continue;
    }

    // Tabela: linha de células com a linha separadora logo abaixo.
    if (startsTable(lines, i)) {
      const rows: Array<{ cells: InlineNode[][] }> = [
        { cells: splitTableCells(line).map((cell) => parseInline(cell)) },
      ];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push({ cells: splitTableCells(lines[i]).map((cell) => parseInline(cell)) });
        i++;
      }
      blocks.push({ type: "table", content: { type: "tableContent", rows }, children: [] });
      continue;
    }

    // Imagem sozinha na linha
    const image = line.match(IMAGE_LINE_RE);
    if (image) {
      const url = hrefOf(image[2]);
      if (url) {
        blocks.push({
          type: "image",
          props: { url, caption: image[1] || "" },
          content: [],
          children: [],
        });
      }
      // Consome de qualquer jeito: imagem sem URL é lixo, não parágrafo.
      i++;
      continue;
    }

    // Callout / spoiler — citação aberta por um marcador, com o texto do bloco
    // nas linhas de citação seguintes:
    //
    //   > [!warning]
    //   > Não deixe o jogador entrar aqui sem a chave.
    //
    //   > [!spoiler] Senha do cofre
    //   > 4-7-1-9
    //
    // É a sintaxe que os prompts da IA ensinam (utils/ai/gddVocabulary.ts) e a
    // que os próprios blocos escrevem no espelho markdown da página.
    const markerMatch = line.match(MARKER_RE);
    const markerTag = markerMatch ? markerMatch[1].toLowerCase() : null;
    if (markerTag && (markerTag === "spoiler" || CALLOUT_VARIANT_IDS.has(markerTag))) {
      const trailing = (markerMatch as RegExpMatchArray)[2].trim();
      i++;
      const bodyLines: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith(">")) {
        bodyLines.push(lines[i].trimStart().replace(/^>[ \t]?/, ""));
        i++;
      }
      const body = bodyLines.join(" ").replace(/\s+/g, " ").trim();
      if (markerTag === "spoiler") {
        // No spoiler a linha do marcador carrega o rótulo, não o texto.
        blocks.push({
          type: "spoiler",
          props: { label: trailing },
          content: parseInline(body),
          children: [],
        });
      } else {
        // No callout ela é só as primeiras palavras do texto.
        blocks.push({
          type: "callout",
          props: { variant: markerTag },
          content: parseInline([trailing, body].filter(Boolean).join(" ")),
          children: [],
        });
      }
      continue;
    }

    // Citação
    if (/^[ \t]*>[ \t]?/.test(line)) {
      blocks.push({
        type: "quote",
        content: parseInline(line.replace(/^[ \t]*>[ \t]?/, "")),
        children: [],
      });
      i++;
      continue;
    }

    // Linha horizontal — o esquema não tem bloco para ela, então some.
    if (HR_RE.test(line)) {
      i++;
      continue;
    }

    // Listas (com marcador, numeradas, de tarefa), aninhadas por indentação
    if (LIST_RE.test(line)) {
      const run = parseListRun(lines, i);
      blocks.push(...run.blocks);
      i = run.next;
      continue;
    }

    // Parágrafo — junta as linhas seguidas que não abrem outro bloco
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !HEADING_RE.test(lines[i]) &&
      !LIST_RE.test(lines[i]) &&
      !/^[ \t]*>/.test(lines[i]) &&
      !lines[i].trimStart().startsWith("```") &&
      !HR_RE.test(lines[i]) &&
      !startsTable(lines, i) &&
      !IMAGE_LINE_RE.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({
        type: "paragraph",
        content: parseInline(paraLines.join(" ")),
        children: [],
      });
      continue;
    }

    if (i === lineAtStart) i++;
  }

  return blocks;
}
