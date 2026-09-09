/**
 * O fluxograma da página, escrito de fora.
 *
 * O editor visual (app/projects/[id]/diagramas) guarda um `DiagramState`
 * completo: posição de cada nó em pixels, largura, cor, espessura de borda,
 * handle de saída de cada aresta. É a estrutura certa para um humano
 * arrastando caixas e a estrutura errada para pedir a um agente — ninguém
 * acerta um layout de 20 nós escrevendo coordenadas na mão.
 *
 * Então a API aceita a forma que um agente sabe descrever — os nós e quem
 * aponta para quem — e o resto é derivado aqui: camadas por ordenação
 * topológica, posições a partir das camadas, e o handle de cada aresta pela
 * geometria que sobrou. Quem quiser controle total ainda manda `position` no
 * nó, e essa posição é respeitada.
 *
 * Duas regras que o resto do arquivo existe para cumprir:
 *
 * 1. Uma reescrita não apaga o trabalho manual. Nó que já existia com o mesmo
 *    id mantém cor, tamanho, fonte, borda — e a posição, quando o chamador não
 *    mandou uma. O agente reescreve a lógica do fluxo; a estética continua de
 *    quem a ajustou no editor.
 * 2. O app não precisa saber que isto existe. A saída é um `DiagramState`
 *    normal, indistinguível de um salvo pelo editor.
 */

import type { DiagramEdge, DiagramNode, DiagramState } from "@/store/slices/types";

/** As quatro formas do editor. `losango` é o nó de decisão. */
export const FLOWCHART_SHAPES = ["retangulo", "losango", "pill", "circulo"] as const;
export type FlowchartShape = (typeof FLOWCHART_SHAPES)[number];

/** Para onde o fluxo corre quando o layout é automático. */
export const FLOWCHART_DIRECTIONS = ["down", "right"] as const;
export type FlowchartDirection = (typeof FLOWCHART_DIRECTIONS)[number];

/**
 * Nomes que um agente tenta antes de acertar o nome interno. Vale aceitar:
 * errar "diamond" por "losango" não é ambiguidade, é vocabulário.
 */
const SHAPE_ALIASES: Record<string, FlowchartShape> = {
  rect: "retangulo",
  rectangle: "retangulo",
  retangulo: "retangulo",
  retângulo: "retangulo",
  box: "retangulo",
  step: "retangulo",
  process: "retangulo",
  diamond: "losango",
  losango: "losango",
  decision: "losango",
  decisao: "losango",
  decisão: "losango",
  condition: "losango",
  pill: "pill",
  stadium: "pill",
  terminal: "pill",
  start: "pill",
  end: "pill",
  circle: "circulo",
  circulo: "circulo",
  círculo: "circulo",
  round: "circulo",
};

/** Espelham as constantes do editor (flowUtils.ts) — o teto é o dele. */
export const MAX_FLOWCHART_NODES = 250;
export const MAX_FLOWCHART_EDGES = 500;

const NODE_WIDTH = 120;
const NODE_HEIGHT = 40;
/** Nó largo o suficiente para o rótulo caber sem quebrar em quatro linhas. */
const MIN_AUTO_WIDTH = 120;
const MAX_AUTO_WIDTH = 260;
/** Largura média de um caractere na fonte 10px que o nó usa por padrão. */
const CHAR_WIDTH = 5.6;
const LABEL_PADDING = 28;
/** Folga entre nós da mesma camada e entre camadas. */
const GAP_ALONG = 48;
const GAP_ACROSS = 90;

// ── Entrada ───────────────────────────────────────────────────────

export type FlowchartNodeInput = {
  /** Estável entre reescritas: é por ele que cor e posição são preservadas. */
  id?: string;
  label: string;
  shape?: string;
  note?: string;
  color?: string;
  position?: { x: number; y: number };
  width?: number;
  height?: number;
};

export type FlowchartEdgeInput = {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
};

export type FlowchartInput = {
  direction?: FlowchartDirection;
  nodes: FlowchartNodeInput[];
  edges?: FlowchartEdgeInput[];
};

/** Entrada que o chamador precisa corrigir — vira 400, não 500. */
export class FlowchartInputError extends Error {}

// ── Normalização ──────────────────────────────────────────────────

export function normalizeShape(raw: string | undefined): FlowchartShape {
  if (!raw) return "retangulo";
  return SHAPE_ALIASES[raw.trim().toLowerCase()] ?? "retangulo";
}

function normalizeHex(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const value = raw.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(value)) return value;
  if (/^#[0-9a-f]{3}$/.test(value)) {
    const s = value.slice(1);
    return `#${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`;
  }
  return undefined;
}

/**
 * Id legível a partir do rótulo, para o chamador que não quis inventar um.
 * Legível importa: é o que ele vai ter que repetir nas arestas.
 */
/** Acentos fora, sem regex de faixa combinante no meio do fonte. */
function stripDiacritics(text: string): string {
  const COMBINING_FIRST = 0x300;
  const COMBINING_LAST = 0x36f;
  return Array.from(text.normalize("NFD"))
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code < COMBINING_FIRST || code > COMBINING_LAST;
    })
    .join("");
}

function slugify(label: string): string {
  const slug = stripDiacritics(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "no";
}

/**
 * Largura que o rótulo pede, quando o chamador não disse nada.
 *
 * A régua é caber em duas linhas: a caixa padrão tem altura para isso, e o
 * alvo é o rótulo longo, que numa caixa de 120px viraria quatro linhas
 * cortadas. A maior palavra também tem que caber inteira numa linha.
 */
function autoWidth(label: string): number {
  const longestWord = label.split(/\s+/).reduce((max, w) => Math.max(max, w.length), 0);
  const twoLines = (label.length * CHAR_WIDTH) / 2;
  const wanted = Math.max(twoLines, longestWord * CHAR_WIDTH) + LABEL_PADDING;
  return Math.round(Math.min(MAX_AUTO_WIDTH, Math.max(MIN_AUTO_WIDTH, wanted)));
}

// ── Camadas ───────────────────────────────────────────────────────

/**
 * Profundidade de cada nó: a maior distância desde uma entrada do fluxo.
 * Kahn, com uma saída de emergência para ciclos — um fluxo de puzzle volta
 * atrás com frequência ("falhou → tenta de novo") e um ciclo não pode
 * derrubar o layout inteiro.
 */
function computeLayers(ids: string[], edges: { from: string; to: string }[]): Map<string, number> {
  const incoming = new Map<string, number>(ids.map((id) => [id, 0]));
  const outgoing = new Map<string, string[]>(ids.map((id) => [id, []]));

  for (const e of edges) {
    if (e.from === e.to) continue; // laço em si mesmo não empurra camada
    outgoing.get(e.from)!.push(e.to);
    incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1);
  }

  const layer = new Map<string, number>();
  const pending = new Map(incoming);
  let frontier = ids.filter((id) => (pending.get(id) ?? 0) === 0);

  // Fluxo todo em ciclo: sem entrada natural, o primeiro nó declarado serve.
  if (frontier.length === 0 && ids.length > 0) frontier = [ids[0]];

  let depth = 0;
  const seen = new Set<string>();
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const id of frontier) {
      if (seen.has(id)) continue;
      seen.add(id);
      layer.set(id, depth);
      for (const to of outgoing.get(id) ?? []) {
        pending.set(to, (pending.get(to) ?? 1) - 1);
        if ((pending.get(to) ?? 0) <= 0 && !seen.has(to)) next.push(to);
      }
    }
    frontier = [...new Set(next)];
    depth += 1;
  }

  // Sobrou quem só é alcançado por dentro de um ciclo: entra logo abaixo do
  // predecessor já posicionado, que é onde um leitor espera encontrá-lo.
  for (const id of ids) {
    if (layer.has(id)) continue;
    const parents = edges.filter((e) => e.to === id && layer.has(e.from));
    const deepest = parents.reduce((max, e) => Math.max(max, layer.get(e.from) ?? 0), -1);
    layer.set(id, deepest + 1);
  }

  return layer;
}

// ── Handles ───────────────────────────────────────────────────────

type Box = { x: number; y: number; w: number; h: number };

/**
 * De que lado a aresta sai e entra, decidido pela posição final dos dois nós.
 * O editor faz o mesmo cálculo quando abre um diagrama com handles em branco
 * (backfillMissingEdgeHandles) — fazer aqui só evita o diagrama nascer torto
 * na primeira renderização.
 */
function pickHandles(source: Box, target: Box): { sourceHandle: string; targetHandle: string } {
  const sx = source.x + source.w / 2;
  const sy = source.y + source.h / 2;
  const tx = target.x + target.w / 2;
  const ty = target.y + target.h / 2;
  const dx = tx - sx;
  const dy = ty - sy;

  // Volta atrás na mesma coluna: contorna pela direita em vez de atravessar
  // os nós que estão no meio do caminho.
  if (dy < 0 && Math.abs(dx) < source.w) return { sourceHandle: "right", targetHandle: "right" };

  if (Math.abs(dy) >= Math.abs(dx)) {
    return dy >= 0
      ? { sourceHandle: "bottom", targetHandle: "top" }
      : { sourceHandle: "top", targetHandle: "bottom" };
  }
  return dx >= 0
    ? { sourceHandle: "right", targetHandle: "left" }
    : { sourceHandle: "left", targetHandle: "right" };
}

// ── Estado anterior ───────────────────────────────────────────────

type PreviousNode = { position?: { x: number; y: number }; data?: Record<string, unknown> };

/** Índice do que já estava salvo, por id de nó. */
function indexPrevious(previous: unknown): Map<string, PreviousNode> {
  const out = new Map<string, PreviousNode>();
  const nodes = (previous as DiagramState | null | undefined)?.nodes;
  if (!Array.isArray(nodes)) return out;
  for (const node of nodes) {
    if (node && typeof node.id === "string") out.set(node.id, node as PreviousNode);
  }
  return out;
}

/**
 * Estilo que o editor ajustou à mão e uma reescrita não deve levar embora.
 * Cor entra na lista mas cede para a cor que o chamador mandou de propósito.
 */
const PRESERVED_STYLE = [
  "color",
  "textColor",
  "textAlign",
  "textVerticalAlign",
  "fontSize",
  "borderColor",
  "borderWidth",
  "borderRadius",
  "gradientEnabled",
] as const;

// ── Construção ────────────────────────────────────────────────────

/**
 * Monta o `DiagramState` que vai para a coluna `flowchart_state`.
 *
 * `previous` é o estado salvo hoje: dele vêm o viewport, as posições que o
 * chamador não mandou e o estilo de cada nó que sobreviveu à reescrita.
 */
export function buildFlowchartState(
  input: FlowchartInput,
  opts: { now: string; previous?: unknown },
): DiagramState {
  const rawNodes = Array.isArray(input.nodes) ? input.nodes : [];
  if (rawNodes.length === 0) {
    throw new FlowchartInputError("A flowchart needs at least one node");
  }
  if (rawNodes.length > MAX_FLOWCHART_NODES) {
    throw new FlowchartInputError(
      `Too many nodes (${rawNodes.length}); the editor holds ${MAX_FLOWCHART_NODES}`,
    );
  }
  const rawEdges = Array.isArray(input.edges) ? input.edges : [];
  if (rawEdges.length > MAX_FLOWCHART_EDGES) {
    throw new FlowchartInputError(
      `Too many edges (${rawEdges.length}); the editor holds ${MAX_FLOWCHART_EDGES}`,
    );
  }

  const direction: FlowchartDirection = input.direction === "right" ? "right" : "down";
  const previousNodes = indexPrevious(opts.previous);

  // ids primeiro: as arestas referenciam nós por id ou por rótulo, e os dois
  // índices têm que existir antes de resolver a primeira aresta.
  const usedIds = new Set<string>();
  const byLabel = new Map<string, string>();
  const prepared = rawNodes.map((node) => {
    const label = typeof node.label === "string" ? node.label.trim() : "";
    if (!label && !node.id) {
      throw new FlowchartInputError("Every node needs a label (or an explicit id)");
    }
    let id = (typeof node.id === "string" && node.id.trim()) || slugify(label);
    if (usedIds.has(id)) {
      let n = 2;
      while (usedIds.has(`${id}-${n}`)) n += 1;
      id = `${id}-${n}`;
    }
    usedIds.add(id);
    const key = label.toLowerCase();
    if (label && !byLabel.has(key)) byLabel.set(key, id);
    return { input: node, id, label };
  });

  const resolve = (ref: unknown, edgeIndex: number): string => {
    if (typeof ref !== "string" || !ref.trim()) {
      throw new FlowchartInputError(`Edge ${edgeIndex + 1} is missing "from" or "to"`);
    }
    const value = ref.trim();
    if (usedIds.has(value)) return value;
    const byName = byLabel.get(value.toLowerCase());
    if (byName) return byName;
    throw new FlowchartInputError(
      `Edge ${edgeIndex + 1} points at "${value}", which is not one of the nodes`,
    );
  };

  const edgePairs = rawEdges.map((edge, i) => ({
    from: resolve(edge.from, i),
    to: resolve(edge.to, i),
    label: typeof edge.label === "string" ? edge.label.trim() : "",
    dashed: edge.dashed === true,
  }));

  // ── Posições ────────────────────────────────────────────────────
  const layers = computeLayers(prepared.map((p) => p.id), edgePairs);

  const sized = prepared.map((p) => {
    const prev = previousNodes.get(p.id);
    const prevData = (prev?.data ?? {}) as Record<string, unknown>;
    const width = Number(p.input.width) > 0
      ? Math.round(Number(p.input.width))
      : Number(prevData.width) > 0
        ? Number(prevData.width)
        : autoWidth(p.label);
    const height = Number(p.input.height) > 0
      ? Math.round(Number(p.input.height))
      : Number(prevData.height) > 0
        ? Number(prevData.height)
        : NODE_HEIGHT;
    // Posição explícita ganha; depois a que já estava salva; auto-layout por último.
    const fixed = p.input.position && Number.isFinite(p.input.position.x) && Number.isFinite(p.input.position.y)
      ? { x: Math.round(p.input.position.x), y: Math.round(p.input.position.y) }
      : prev?.position && Number.isFinite(prev.position.x) && Number.isFinite(prev.position.y)
        ? { x: Math.round(prev.position.x), y: Math.round(prev.position.y) }
        : null;
    return { ...p, width, height, fixed, prevData };
  });

  // Auto-layout só para quem ficou sem posição, camada por camada. Os nós já
  // fixados contam na largura da faixa para não nascer um em cima do outro.
  const autoByLayer = new Map<number, typeof sized>();
  for (const node of sized) {
    if (node.fixed) continue;
    const layer = layers.get(node.id) ?? 0;
    const bucket = autoByLayer.get(layer) ?? [];
    bucket.push(node);
    autoByLayer.set(layer, bucket);
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const node of sized) if (node.fixed) positions.set(node.id, node.fixed);

  const layerCount = Math.max(0, ...[...layers.values()].map((l) => l + 1));
  const across = direction === "down" ? NODE_HEIGHT + GAP_ACROSS : MAX_AUTO_WIDTH + GAP_ACROSS;

  for (let layer = 0; layer < layerCount; layer += 1) {
    const bucket = autoByLayer.get(layer);
    if (!bucket || bucket.length === 0) continue;

    if (direction === "down") {
      const total = bucket.reduce((sum, n) => sum + n.width, 0) + GAP_ALONG * (bucket.length - 1);
      let x = Math.round(-total / 2);
      const y = layer * across;
      for (const node of bucket) {
        positions.set(node.id, { x, y });
        x += node.width + GAP_ALONG;
      }
    } else {
      const total = bucket.reduce((sum, n) => sum + n.height, 0) + GAP_ALONG * (bucket.length - 1);
      let y = Math.round(-total / 2);
      const x = layer * across;
      for (const node of bucket) {
        positions.set(node.id, { x, y });
        y += node.height + GAP_ALONG;
      }
    }
  }

  // Tudo para o quadrante positivo: o editor abre no canto superior esquerdo,
  // e um fluxo em coordenadas negativas nasceria fora da tela.
  const minX = Math.min(...sized.map((n) => positions.get(n.id)!.x));
  const minY = Math.min(...sized.map((n) => positions.get(n.id)!.y));
  const shiftX = minX < 0 ? -minX : 0;
  const shiftY = minY < 0 ? -minY : 0;

  const nodes: DiagramNode[] = sized.map((node) => {
    const base = positions.get(node.id)!;
    const position = { x: base.x + shiftX, y: base.y + shiftY };
    const preserved: Record<string, unknown> = {};
    for (const key of PRESERVED_STYLE) {
      if (node.prevData[key] !== undefined) preserved[key] = node.prevData[key];
    }
    const color = normalizeHex(node.input.color);
    return {
      id: node.id,
      type: "diagramNode",
      position,
      data: {
        ...preserved,
        label: node.label,
        ...(typeof node.input.note === "string" && node.input.note.trim()
          ? { note: node.input.note.trim() }
          : {}),
        blockType: normalizeShape(node.input.shape),
        ...(color ? { color } : {}),
        width: node.width,
        height: node.height,
      } as DiagramNode["data"],
    };
  });

  const boxes = new Map<string, Box>(
    nodes.map((n) => [
      n.id,
      { x: n.position.x, y: n.position.y, w: Number(n.data.width) || NODE_WIDTH, h: Number(n.data.height) || NODE_HEIGHT },
    ]),
  );

  const edgeIds = new Set<string>();
  const edges: DiagramEdge[] = edgePairs.map((pair) => {
    let id = `e-${pair.from}-${pair.to}`;
    if (edgeIds.has(id)) {
      let n = 2;
      while (edgeIds.has(`${id}-${n}`)) n += 1;
      id = `${id}-${n}`;
    }
    edgeIds.add(id);
    const handles = pickHandles(boxes.get(pair.from)!, boxes.get(pair.to)!);
    return {
      id,
      source: pair.from,
      target: pair.to,
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
      ...(pair.label ? { label: pair.label } : {}),
      edgeType: "bezier",
      ...(pair.dashed ? { dashed: true } : {}),
      // Um fluxo tem sentido: a seta é o que o torna legível.
      startMarker: "none",
      endMarker: "arrow",
    };
  });

  const prevState = opts.previous as DiagramState | null | undefined;
  return {
    version: 1,
    updatedAt: opts.now,
    nodes,
    edges,
    // Viewport é preferência de quem estava olhando — não é do agente mexer.
    viewport: prevState?.viewport ?? { x: 0, y: 0, zoom: 1 },
    ...(prevState?.settings ? { settings: prevState.settings } : {}),
  };
}

// ── Leitura ───────────────────────────────────────────────────────

/**
 * O fluxograma na mesma forma que a escrita aceita, de volta.
 *
 * Devolver o `DiagramState` cru custaria umas dez vezes mais tokens em
 * espessura de borda e handles — e o que um agente precisa para editar um
 * fluxo existente é a lógica dele: os nós, as setas, os rótulos. Mandar isto
 * de volta em `flowchart` é uma reescrita que preserva tudo o mais.
 */
export function flowchartDigest(state: unknown): {
  nodes: { id: string; label: string; shape?: FlowchartShape; note?: string }[];
  edges: { from: string; to: string; label?: string }[];
} | null {
  const s = state as DiagramState | null | undefined;
  if (!s || !Array.isArray(s.nodes) || s.nodes.length === 0) return null;

  return {
    nodes: s.nodes.map((node) => {
      const shape = normalizeShape(node.data?.blockType);
      return {
        id: node.id,
        label: node.data?.label ?? "",
        // retangulo é o default da escrita: dizê-lo não informa nada.
        ...(shape !== "retangulo" ? { shape } : {}),
        ...(node.data?.note ? { note: node.data.note } : {}),
      };
    }),
    edges: (Array.isArray(s.edges) ? s.edges : []).map((edge) => ({
      from: edge.source,
      to: edge.target,
      ...(edge.label ? { label: edge.label } : {}),
      ...(edge.dashed ? { dashed: true } : {}),
    })),
  };
}
