/**
 * Modo Deck — as regras de leitura da árvore, sem React nem DOM.
 *
 * O Deck é um navegador de níveis: a grade mostra as filhas de um andar, e
 * qualquer página pode virar o andar. Tudo aqui é derivado do que a seção já
 * tem (cor, thumb, título, status) — o Deck não guarda campo próprio.
 */

import type { PageStatus } from "@/lib/pageStatus/types";

/**
 * O subconjunto de Section que o Deck lê. Estrutural de propósito: serve tanto
 * a seção do store quanto a que volta do payload público.
 */
/**
 * Como uma página mostra as filhas dela no Deck: numa lista dentro da gaveta,
 * ou numa parede de cartas com andar próprio.
 *
 * Ausente é o normal, e quer dizer "decide por mim" — um GDD antigo tem
 * centenas de páginas que ninguém vai classificar uma a uma.
 */
export type DeckLayout = "list" | "grid";

export const DECK_LAYOUTS: readonly DeckLayout[] = ["list", "grid"] as const;

export function parseDeckLayout(value: unknown): DeckLayout | undefined {
  return value === "list" || value === "grid" ? value : undefined;
}

export type DeckSection = {
  id: string;
  title: string;
  /** Escolha manual de exibição das filhas. Ausente = automático. */
  deckLayout?: DeckLayout;
  parentId?: string;
  order?: number;
  created_at?: string;
  color?: string;
  thumbImageUrl?: string;
  status?: PageStatus;
  content?: string;
  contentBlocks?: unknown;
};

export type DeckNode<S extends DeckSection = DeckSection> = {
  section: S;
  children: DeckNode<S>[];
  /** Quantas páginas existem no ramo inteiro abaixo desta. */
  branchTotal: number;
};

export type DeckTree<S extends DeckSection = DeckSection> = {
  roots: DeckNode<S>[];
  byId: Map<string, DeckNode<S>>;
  /** Pai de cada nó; `null` para as raízes. */
  parentOf: Map<string, DeckNode<S> | null>;
};

/**
 * A partir de quantas filhas um nível vira parede de cartas em vez de lista.
 *
 * É heurística de propósito: enquanto ela acertar, o Deck não precisa de campo
 * novo na seção (e portanto nem de migration, sync, /api/v1 ou MCP).
 *
 * O número saiu de um GDD real, não do chute. Em 250 páginas, os 38 pais com
 * filhas se dividem assim: 29 têm até 7, e o resto se separa em dois grupos
 * bem distintos — capítulos com 8 a 11 filhas (Insumos, Economia, Progressão)
 * e inventários de verdade com 34 (Sementes, Frutos). Um corte em 8 chamava
 * capítulo de inventário; o vão entre 11 e 34 é onde a linha realmente está.
 */
export const DECK_GRID_THRESHOLD = 20;

/** Neutro para páginas que nunca receberam cor no mapa mental. */
export const DECK_FALLBACK_COLOR = "#64748B";

/**
 * O estado vira glifo, e não cor: a carta já é pintada com a cor da página, e
 * um âmbar de "em revisão" brigaria com o fundo — pior, mudaria de significado
 * de uma carta para a outra. O glifo é desenhado na tinta da própria carta.
 */
export const DECK_STATUS_GLYPH: Record<PageStatus, string> = {
  draft: "✎",
  review: "⟳",
  approved: "✓",
  implemented: "★",
  obsolete: "⊘",
};

/** Selo de "pode estar desatualizada", que é outra pergunta e mora no outro canto. */
export const DECK_STALE_GLYPH = "⚠";

/** A mesma ordem do gerenciador: `order`, e a data de criação desempata. */
export function sortByManagerOrder<S extends DeckSection>(sections: S[]): S[] {
  return [...sections].sort((a, b) => {
    const orderA = typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
    const orderB = typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return (a.created_at || "").localeCompare(b.created_at || "");
  });
}

export function buildDeckTree<S extends DeckSection>(sections: S[]): DeckTree<S> {
  const byParent = new Map<string, S[]>();
  for (const section of sections) {
    const key = section.parentId || "";
    const bucket = byParent.get(key);
    if (bucket) bucket.push(section);
    else byParent.set(key, [section]);
  }

  const byId = new Map<string, DeckNode<S>>();
  const parentOf = new Map<string, DeckNode<S> | null>();

  const seen = new Set<string>();
  const build = (section: S, parent: DeckNode<S> | null): DeckNode<S> => {
    // Ciclo em parentId travaria a recursão. Corta na segunda visita.
    seen.add(section.id);
    const node: DeckNode<S> = { section, children: [], branchTotal: 0 };
    byId.set(section.id, node);
    parentOf.set(section.id, parent);

    const kids = sortByManagerOrder(byParent.get(section.id) || []).filter((k) => !seen.has(k.id));
    node.children = kids.map((kid) => build(kid, node));
    node.branchTotal = node.children.reduce((acc, kid) => acc + 1 + kid.branchTotal, 0);
    return node;
  };

  const roots = sortByManagerOrder(byParent.get("") || []).map((section) => build(section, null));

  // Nem toda página chega pela raiz: quem aponta para um pai que não existe, e
  // quem está preso num ciclo de parentId, não seria alcançado por ninguém e
  // sumiria do Deck inteiro sem aviso. Essas sobem para o térreo.
  for (const section of sortByManagerOrder(sections)) {
    if (byId.has(section.id)) continue;
    roots.push(build(section, null));
  }

  return { roots, byId, parentOf };
}

/** As filhas de um andar; sem andar, as raízes. */
export function levelOf<S extends DeckSection>(tree: DeckTree<S>, floor: DeckNode<S> | null): DeckNode<S>[] {
  return floor ? floor.children : tree.roots;
}

/**
 * As filhas desta página abrem como parede de cartas (andar próprio) em vez de
 * lista dentro da gaveta?
 *
 * A escolha da pessoa manda. Sem escolha, decide a contagem — e o térreo nunca
 * é inventário: as raízes são os capítulos do GDD, e capítulo se lê pelo nome.
 */
export function isInventory<S extends DeckSection>(node: DeckNode<S> | null, tree: DeckTree<S>): boolean {
  if (!node) return false;
  const escolha = parseDeckLayout(node.section.deckLayout);
  if (escolha) return escolha === "grid";
  return levelOf(tree, node).length >= DECK_GRID_THRESHOLD;
}

/** Da raiz até o nó, incluindo os dois. */
export function pathOf<S extends DeckSection>(tree: DeckTree<S>, node: DeckNode<S>): DeckNode<S>[] {
  const trail: DeckNode<S>[] = [];
  let current: DeckNode<S> | null | undefined = node;
  while (current) {
    trail.unshift(current);
    current = tree.parentOf.get(current.section.id) ?? null;
  }
  return trail;
}

/**
 * Onde o Deck precisa estar para mostrar uma página — andar, carta aberta,
 * menu e conteúdo da gaveta.
 *
 * Uma página não escolhe sozinha como aparece: quem manda é o andar em que ela
 * mora. Só um inventário vira andar; um capítulo continua sendo carta com
 * gaveta, mesmo quando se chega nele pela trilha. É esta função que garante
 * que a mesma página se apresente igual, venha o clique de onde vier.
 */
export type DeckPlacement = {
  floorId: string | null;
  openId: string;
  menuId: string | null;
  contentId: string;
};

export function placeInDeck<S extends DeckSection>(
  tree: DeckTree<S>,
  sectionId: string
): DeckPlacement | null {
  const node = tree.byId.get(sectionId);
  if (!node) return null;
  const parent = tree.parentOf.get(sectionId) ?? null;

  // Filha de inventário (ou raiz): a página é uma carta do próprio andar.
  if (!parent || isInventory(parent, tree)) {
    return {
      floorId: parent ? parent.section.id : null,
      openId: sectionId,
      menuId: node.children.length && !isInventory(node, tree) ? sectionId : null,
      contentId: sectionId,
    };
  }

  // Senão, a página mora na lista de uma gaveta: sobe até a carta que o andar
  // de fato mostra, e o menu continua sendo o pai, onde ela aparece marcada.
  let card = parent;
  let floor = tree.parentOf.get(card.section.id) ?? null;
  while (floor && !isInventory(floor, tree)) {
    card = floor;
    floor = tree.parentOf.get(card.section.id) ?? null;
  }

  return {
    floorId: floor ? floor.section.id : null,
    openId: card.section.id,
    menuId: parent.section.id,
    contentId: sectionId,
  };
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function normalizeHex(value: string | undefined): string | null {
  const raw = (value || "").trim();
  if (!HEX.test(raw)) return null;
  if (raw.length === 4) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase();
  }
  return raw.toLowerCase();
}

/**
 * Cor própria, senão a do ancestral mais próximo, senão o neutro.
 *
 * A herança é o que faz um ramo se ler como conjunto: quase nenhuma página do
 * GDD tem cor, e sem isso o inventário viraria arco-íris de cinza e acaso.
 */
export function colorOf<S extends DeckSection>(tree: DeckTree<S>, node: DeckNode<S>): string {
  let current: DeckNode<S> | null | undefined = node;
  while (current) {
    const own = normalizeHex(current.section.color);
    if (own) return own;
    current = tree.parentOf.get(current.section.id) ?? null;
  }
  return DECK_FALLBACK_COLOR;
}

/** Luminância relativa (WCAG), para decidir a tinta por cima da cor. */
export function luminanceOf(hex: string): number {
  const normalized = normalizeHex(hex) || DECK_FALLBACK_COLOR;
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(normalized.slice(i, i + 2), 16) / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * A cor é escolhida por gente no mapa mental, então o texto tem que se
 * defender sozinho: um amarelo-claro não pode quebrar a carta.
 */
export function inkOn(hex: string): "#ffffff" | "#1f2937" {
  return luminanceOf(hex) > 0.5 ? "#1f2937" : "#ffffff";
}

/** Plaquinha das marcas: clareia fundo escuro, escurece fundo claro. */
export function plateOn(hex: string): string {
  return inkOn(hex) === "#ffffff" ? "rgba(255,255,255,0.24)" : "rgba(0,0,0,0.13)";
}

// Um ou mais emojis colados no começo do título, cada um podendo trazer
// seletor de variação (FE0F), tom de pele (1F3FB-1F3FF) e junções ZWJ (200D).
const LEADING_EMOJI = new RegExp(
  "^\\s*((?:\\p{Extended_Pictographic}\\uFE0F?[\\u{1F3FB}-\\u{1F3FF}]?" +
    "(?:\\u200D\\p{Extended_Pictographic}\\uFE0F?)*)+)\\s*",
  "u"
);

/**
 * Separa o emoji da frente do título. A convenção do GDD é escrever o ícone no
 * próprio título (`🦴Osso`), então na maioria das páginas o ícone já existe —
 * ninguém precisa cadastrar nada.
 */
export function splitTitleIcon(title: string): { emoji: string; text: string } {
  const raw = title || "";
  const match = raw.match(LEADING_EMOJI);
  if (!match) return { emoji: "", text: raw.trim() };
  const text = raw.slice(match[0].length).trim();
  // Título que é SÓ emoji continua sendo o texto: melhor repetir que ficar vazio.
  return text ? { emoji: match[1], text } : { emoji: match[1], text: raw.trim() };
}

/** Iniciais de até duas palavras de peso, para o último degrau da cascata. */
export function initialsOf(title: string): string {
  const cleaned = (title || "").replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "?";
  const words = cleaned.split(" ");
  const meaningful = words.filter((word) => word.length > 2);
  return (meaningful.length ? meaningful : words)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export type DeckIcon =
  | { kind: "image"; url: string }
  | { kind: "emoji"; char: string }
  | { kind: "initials"; text: string };

/**
 * A cascata do ícone, nesta ordem: imagem da página → emoji do título →
 * iniciais. Nenhum degrau precisa de campo novo.
 */
export function iconOf(section: DeckSection): DeckIcon {
  const thumb = (section.thumbImageUrl || "").trim();
  if (thumb) return { kind: "image", url: thumb };
  const { emoji } = splitTitleIcon(section.title || "");
  if (emoji) return { kind: "emoji", char: emoji };
  return { kind: "initials", text: initialsOf(section.title || "") };
}

/** O título sem o emoji que virou ícone — para não mostrar duas vezes. */
export function labelOf(section: DeckSection): string {
  const { emoji, text } = splitTitleIcon(section.title || "");
  // Quando a imagem é o ícone, o emoji continua fazendo parte do nome.
  if ((section.thumbImageUrl || "").trim()) return (section.title || "").trim();
  return emoji ? text : (section.title || "").trim();
}

/**
 * Quantas colunas a grade tem numa largura — o mesmo cálculo que o CSS faz com
 * `repeat(auto-fill, minmax(min, 1fr))`.
 *
 * Precisa ser em JS porque a gaveta entra DEPOIS da última carta da linha, e
 * sem saber o número de colunas ela abre no meio da fileira.
 */
export function columnsForWidth(width: number, minColumn: number, gap: number): number {
  if (!Number.isFinite(width) || width <= 0) return 1;
  return Math.max(1, Math.floor((width + gap) / (minColumn + gap)));
}

/** A gaveta entra logo depois da última carta da linha do selecionado. */
export function drawerInsertionIndex(openIndex: number, columns: number, total: number): number {
  if (openIndex < 0) return total;
  const row = Math.floor(openIndex / Math.max(1, columns));
  return Math.min((row + 1) * Math.max(1, columns), total);
}

/** Centro horizontal da carta aberta, relativo à grade — onde a setinha aponta. */
export function caretOffset(openIndex: number, columns: number, gridWidth: number, gap: number): number {
  const cols = Math.max(1, columns);
  const column = openIndex % cols;
  const cell = (gridWidth - gap * (cols - 1)) / cols;
  return column * (cell + gap) + cell / 2;
}
