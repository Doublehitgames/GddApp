import { DiagramEdge, DiagramMarkerType, DiagramNode, DiagramState } from "@/store/projectStore";
import { Edge, MarkerType, Node } from "reactflow";
import { DiagramBlockType, DiagramNodeData, DiagramTheme, DiagramThemeKey } from "./diagramTypes";

export const DEFAULT_NODE_WIDTH = 120;
export const DEFAULT_NODE_HEIGHT = 40;
export const MAX_NODES = 250;
export const MAX_EDGES = 500;
export const DEFAULT_FONT_SIZE = 10;
export const MIN_FONT_SIZE = 10;
export const MAX_FONT_SIZE = 42;
export const DEFAULT_BORDER_WIDTH = 1;
export const MIN_BORDER_WIDTH = 0;
export const MAX_BORDER_WIDTH = 8;
export const DEFAULT_BORDER_RADIUS = 5;
export const MIN_BORDER_RADIUS = 0;
export const MAX_BORDER_RADIUS = 40;
export const DEFAULT_TEXT_VERTICAL_ALIGN: NonNullable<DiagramNodeData["textVerticalAlign"]> = "middle";
export const DEFAULT_GRADIENT_ENABLED = true;
export const DEFAULT_EDGE_TYPE = "bezier" as const;
export const DEFAULT_BLOCK_TYPE: DiagramBlockType = "retangulo";
export const DEFAULT_EDGE_STROKE_WIDTH = 1;
export const MIN_EDGE_STROKE_WIDTH = 1;
export const MAX_EDGE_STROKE_WIDTH = 10;
export const DEFAULT_EDGE_DASHED = false;
export const DEFAULT_EDGE_DASH_LENGTH = 10;
export const DEFAULT_EDGE_DASH_GAP = 6;
export const MIN_EDGE_DASH_LENGTH = 1;
export const MAX_EDGE_DASH_LENGTH = 40;
export const MIN_EDGE_DASH_GAP = 1;
export const MAX_EDGE_DASH_GAP = 40;
export const DIAGRAM_NODE_COLOR_PRESETS = [
  "#0ea5e9",
  "#6366f1",
  "#8b5cf6",
  "#22c55e",
  "#f59e0b",
  "#f97316",
  "#ef4444",
  "#ec4899",
] as const;

export function normalizeHexColor(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const value = raw.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const short = value.slice(1).toLowerCase();
    return `#${short[0]}${short[0]}${short[1]}${short[1]}${short[2]}${short[2]}`;
  }
  return undefined;
}

export function normalizeTextAlign(value: string | undefined): "left" | "center" | "right" {
  if (value === "left" || value === "right") return value;
  return "center";
}

export function normalizeTextVerticalAlign(
  value: string | undefined
): NonNullable<DiagramNodeData["textVerticalAlign"]> {
  if (value === "top" || value === "bottom") return value;
  return "middle";
}

export function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

export function normalizeEdgeType(value: string | undefined): "straight" | "step" | "smoothstep" | "bezier" {
  if (value === "straight" || value === "step" || value === "bezier") return value;
  return "smoothstep";
}

export function normalizeBlockType(value: string | undefined): DiagramBlockType {
  if (value === "losango" || value === "pill" || value === "circulo") return value;
  return "retangulo";
}

export function normalizeEdgeStrokeWidth(value: number): number {
  return clampNumber(value, MIN_EDGE_STROKE_WIDTH, MAX_EDGE_STROKE_WIDTH, DEFAULT_EDGE_STROKE_WIDTH);
}

export function normalizeEdgeDashLength(value: number): number {
  return clampNumber(value, MIN_EDGE_DASH_LENGTH, MAX_EDGE_DASH_LENGTH, DEFAULT_EDGE_DASH_LENGTH);
}

export function normalizeEdgeDashGap(value: number): number {
  return clampNumber(value, MIN_EDGE_DASH_GAP, MAX_EDGE_DASH_GAP, DEFAULT_EDGE_DASH_GAP);
}

export function parseEdgeDashStyle(strokeDasharray: unknown): { dashed: boolean; dashLength: number; dashGap: number } {
  if (typeof strokeDasharray !== "string" || !strokeDasharray.trim()) {
    return {
      dashed: DEFAULT_EDGE_DASHED,
      dashLength: DEFAULT_EDGE_DASH_LENGTH,
      dashGap: DEFAULT_EDGE_DASH_GAP,
    };
  }
  const parts = strokeDasharray
    .split(/[,\s]+/)
    .map((part) => Number.parseFloat(part))
    .filter((part) => Number.isFinite(part) && part > 0);
  if (parts.length === 0) {
    return {
      dashed: DEFAULT_EDGE_DASHED,
      dashLength: DEFAULT_EDGE_DASH_LENGTH,
      dashGap: DEFAULT_EDGE_DASH_GAP,
    };
  }
  const dashLength = normalizeEdgeDashLength(parts[0]);
  const dashGap = normalizeEdgeDashGap(parts[1] ?? parts[0]);
  return { dashed: true, dashLength, dashGap };
}

export function buildEdgeStyle(
  stroke: string,
  strokeWidth: number,
  dashed: boolean,
  dashLength: number,
  dashGap: number
): Edge["style"] {
  return {
    stroke,
    strokeWidth: normalizeEdgeStrokeWidth(strokeWidth),
    strokeDasharray: dashed ? `${normalizeEdgeDashLength(dashLength)} ${normalizeEdgeDashGap(dashGap)}` : undefined,
  };
}

export function createEmptyDiagramState(): DiagramState {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    settings: {
      snapToGrid: false,
      snapGridSize: 20,
    },
  };
}

export function toMarkerConfig(marker: DiagramMarkerType | undefined, color?: string) {
  if (!marker || marker === "none") return undefined;
  if (marker === "circle") {
    return { type: "circle" as MarkerType, width: 18, height: 18, color };
  }
  return { type: MarkerType.ArrowClosed, width: 20, height: 20, color };
}

export function fromEdgeMarker(rawMarker: Edge["markerStart"] | Edge["markerEnd"]): DiagramMarkerType {
  if (!rawMarker || typeof rawMarker === "string") return "none";
  const markerType = String(rawMarker.type || "").toLowerCase();
  if (markerType.includes("circle")) return "circle";
  if (markerType) return "arrow";
  return "none";
}

export function toFlowNodes(nodes: DiagramNode[], theme: DiagramThemeKey = "neon"): Node<DiagramNodeData>[] {
  return nodes.map((node) => ({
    id: node.id,
    type: node.type || "diagramNode",
    position: node.position,
    style: {
      width: node.data.width || DEFAULT_NODE_WIDTH,
      height: node.data.height || DEFAULT_NODE_HEIGHT,
    },
    data: {
      label: node.data.label || "",
      note: node.data.note || "",
      blockType: normalizeBlockType(node.data.blockType),
      color: normalizeHexColor(node.data.color),
      textColor: normalizeHexColor(node.data.textColor),
      textAlign: normalizeTextAlign(node.data.textAlign),
      textVerticalAlign: normalizeTextVerticalAlign(node.data.textVerticalAlign),
      fontSize: clampNumber(Number(node.data.fontSize ?? DEFAULT_FONT_SIZE), MIN_FONT_SIZE, MAX_FONT_SIZE, DEFAULT_FONT_SIZE),
      borderColor: normalizeHexColor(node.data.borderColor),
      borderWidth: clampNumber(Number(node.data.borderWidth ?? DEFAULT_BORDER_WIDTH), MIN_BORDER_WIDTH, MAX_BORDER_WIDTH, DEFAULT_BORDER_WIDTH),
      borderRadius: clampNumber(Number(node.data.borderRadius ?? DEFAULT_BORDER_RADIUS), MIN_BORDER_RADIUS, MAX_BORDER_RADIUS, DEFAULT_BORDER_RADIUS),
      gradientEnabled: typeof node.data.gradientEnabled === "boolean" ? node.data.gradientEnabled : DEFAULT_GRADIENT_ENABLED,
      theme,
    },
  }));
}

export function toFlowEdges(edges: DiagramEdge[], palette: DiagramTheme): Edge[] {
  return edges.map((edge) => ({
    ...(() => {
      const dashed = typeof edge.dashed === "boolean" ? edge.dashed : DEFAULT_EDGE_DASHED;
      return {
        animated: dashed && typeof edge.animated === "boolean" ? edge.animated : false,
        style: buildEdgeStyle(
          palette.edgeStroke,
          Number(edge.strokeWidth ?? DEFAULT_EDGE_STROKE_WIDTH),
          dashed,
          Number(edge.dashLength ?? DEFAULT_EDGE_DASH_LENGTH),
          Number(edge.dashGap ?? DEFAULT_EDGE_DASH_GAP)
        ),
      };
    })(),
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    label: edge.label || "",
    type: normalizeEdgeType(edge.edgeType),
    markerStart: toMarkerConfig(edge.startMarker, palette.edgeStroke),
    markerEnd: toMarkerConfig(edge.endMarker, palette.edgeStroke),
    labelStyle: { fill: palette.edgeLabelFill, fontSize: 10, fontWeight: 400 },
    labelBgStyle: { fill: palette.edgeLabelBg, fillOpacity: 0.92, stroke: palette.edgeLabelBorder, strokeWidth: 1 },
    labelBgPadding: [8, 4],
    labelBgBorderRadius: 999,
  }));
}

export function serializeNodes(nodes: Node<DiagramNodeData>[]): DiagramNode[] {
  const readSize = (value: unknown, fallback: number) => {
    if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) return Math.round(parsed);
    }
    return fallback;
  };

  return nodes.map((node) => ({
    id: node.id,
    type: "diagramNode",
    position: node.position,
    data: {
      label: node.data?.label || "",
      note: node.data?.note || "",
      blockType: normalizeBlockType(node.data?.blockType),
      color: normalizeHexColor(node.data?.color),
      textColor: normalizeHexColor(node.data?.textColor),
      textAlign: normalizeTextAlign(node.data?.textAlign),
      textVerticalAlign: normalizeTextVerticalAlign(node.data?.textVerticalAlign),
      fontSize: clampNumber(Number(node.data?.fontSize ?? DEFAULT_FONT_SIZE), MIN_FONT_SIZE, MAX_FONT_SIZE, DEFAULT_FONT_SIZE),
      borderColor: normalizeHexColor(node.data?.borderColor),
      borderWidth: clampNumber(Number(node.data?.borderWidth ?? DEFAULT_BORDER_WIDTH), MIN_BORDER_WIDTH, MAX_BORDER_WIDTH, DEFAULT_BORDER_WIDTH),
      borderRadius: clampNumber(Number(node.data?.borderRadius ?? DEFAULT_BORDER_RADIUS), MIN_BORDER_RADIUS, MAX_BORDER_RADIUS, DEFAULT_BORDER_RADIUS),
      gradientEnabled: typeof node.data?.gradientEnabled === "boolean" ? node.data.gradientEnabled : DEFAULT_GRADIENT_ENABLED,
      width: readSize(node.style?.width, DEFAULT_NODE_WIDTH),
      height: readSize(node.style?.height, DEFAULT_NODE_HEIGHT),
    },
  }));
}

export function serializeEdges(edges: Edge[]): DiagramEdge[] {
  return edges.map((edge) => ({
    ...(() => {
      const dash = parseEdgeDashStyle(edge.style?.strokeDasharray);
      return {
        strokeWidth: normalizeEdgeStrokeWidth(Number(edge.style?.strokeWidth ?? DEFAULT_EDGE_STROKE_WIDTH)),
        dashed: dash.dashed,
        dashLength: dash.dashLength,
        dashGap: dash.dashGap,
      };
    })(),
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    label: typeof edge.label === "string" ? edge.label : "",
    edgeType: normalizeEdgeType(edge.type),
    animated: Boolean(edge.animated),
    startMarker: fromEdgeMarker(edge.markerStart),
    endMarker: fromEdgeMarker(edge.markerEnd),
  }));
}

export function readNodeStyleDimension(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function getNodeSizeStyle(
  style: Node<DiagramNodeData>["style"] | undefined,
  partial: { width?: number; height?: number }
) {
  const currentWidth = readNodeStyleDimension(style?.width, DEFAULT_NODE_WIDTH);
  const currentHeight = readNodeStyleDimension(style?.height, DEFAULT_NODE_HEIGHT);
  const width = Math.max(120, partial.width ?? currentWidth);
  const height = Math.max(40, partial.height ?? currentHeight);

  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}
