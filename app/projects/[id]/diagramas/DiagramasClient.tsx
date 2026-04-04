"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactFlow, {
  addEdge,
  Background,
  BackgroundVariant,
  ConnectionMode,
  Connection,
  Controls,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  NodeTypes,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";
import { DiagramMarkerType, DiagramState, useProjectStore } from "@/store/projectStore";
import { useI18n } from "@/lib/i18n/provider";
import DiagramToolbar from "./components/DiagramToolbar";
import PropertiesSidebar from "./components/PropertiesSidebar";
import DiagramNodeComponent from "./components/DiagramNodeComponent";
import { DIAGRAM_THEMES, THEME_STORAGE_KEY, getThemeOptions, isDiagramThemeKey } from "./diagramTheme";
import { DiagramBlockType, DiagramNodeData, DiagramThemeKey } from "./diagramTypes";
import {
  DEFAULT_BORDER_WIDTH,
  DEFAULT_BORDER_RADIUS,
  DEFAULT_BLOCK_TYPE,
  DEFAULT_GRADIENT_ENABLED,
  DEFAULT_EDGE_TYPE,
  DEFAULT_EDGE_DASH_GAP,
  DEFAULT_EDGE_DASH_LENGTH,
  DEFAULT_EDGE_DASHED,
  DEFAULT_EDGE_STROKE_WIDTH,
  DEFAULT_FONT_SIZE,
  DEFAULT_TEXT_VERTICAL_ALIGN,
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  MAX_EDGES,
  MAX_NODES,
  MAX_BORDER_WIDTH,
  MAX_BORDER_RADIUS,
  MAX_FONT_SIZE,
  MIN_BORDER_WIDTH,
  MIN_BORDER_RADIUS,
  MIN_FONT_SIZE,
  clampNumber,
  buildEdgeStyle,
  createEmptyDiagramState,
  fromEdgeMarker,
  getNodeSizeStyle,
  normalizeHexColor,
  normalizeBlockType,
  normalizeEdgeType,
  normalizeEdgeDashGap,
  normalizeEdgeDashLength,
  normalizeEdgeStrokeWidth,
  parseEdgeDashStyle,
  normalizeTextAlign,
  normalizeTextVerticalAlign,
  readNodeStyleDimension,
  serializeEdges,
  serializeNodes,
  toFlowEdges,
  toFlowNodes,
  toMarkerConfig,
} from "./flowUtils";

interface DiagramasClientProps {
  projectId: string;
  sectionId: string;
  readOnlyPublic?: boolean;
  publicToken?: string;
  publicProjectTitle?: string;
  publicSectionTitle?: string;
  initialDiagramState?: DiagramState;
}

const SNAP_GRID_SIZE_OPTIONS = [10, 20, 30] as const;
const DEFAULT_SNAP_GRID_SIZE = 20;
const BLOCK_DND_MIME = "application/x-gdd-block-type";
const DIAGRAM_CLIPBOARD_KEY = "gdd_diagram_clipboard_v1";
const DIAGRAM_SELECTION_CLIPBOARD_KEY = "gdd_diagram_selection_clipboard_v1";
const DIAGRAM_HISTORY_LIMIT = 120;

type CopiedSelectionSnapshot = {
  nodes: Node<DiagramNodeData>[];
  edges: Edge[];
  anchor: { x: number; y: number };
};

type DiagramHistorySnapshot = {
  nodes: DiagramState["nodes"];
  edges: DiagramState["edges"];
  signature: string;
};

const OPPOSITE_HANDLE: Record<"top" | "right" | "bottom" | "left", "top" | "right" | "bottom" | "left"> = {
  top: "bottom",
  right: "left",
  bottom: "top",
  left: "right",
};

function normalizeSnapGridSize(value: unknown): number {
  const size = Number(value);
  if (SNAP_GRID_SIZE_OPTIONS.includes(size as (typeof SNAP_GRID_SIZE_OPTIONS)[number])) {
    return size;
  }
  return DEFAULT_SNAP_GRID_SIZE;
}

function inferHandleByDirection(
  sourcePos: { x: number; y: number },
  targetPos: { x: number; y: number }
): "top" | "right" | "bottom" | "left" {
  const dx = targetPos.x - sourcePos.x;
  const dy = targetPos.y - sourcePos.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "bottom" : "top";
}

function DiagramasFlow({
  projectId,
  sectionId,
  readOnlyPublic = false,
  publicToken,
  publicProjectTitle,
  publicSectionTitle,
  initialDiagramState,
}: DiagramasClientProps) {
  const { t } = useI18n();
  const router = useRouter();
  const isReadOnly = Boolean(readOnlyPublic);
  const getSectionDiagram = useProjectStore((state) => state.getSectionDiagram);
  const saveSectionDiagram = useProjectStore((state) => state.saveSectionDiagram);
  const resetSectionDiagram = useProjectStore((state) => state.resetSectionDiagram);
  const [nodes, setNodes, onNodesChange] = useNodesState<DiagramNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [theme, setTheme] = useState<DiagramThemeKey>("neon");
  const [defaultBlockType, setDefaultBlockType] = useState<DiagramBlockType>(DEFAULT_BLOCK_TYPE);
  const [defaultEdgeType, setDefaultEdgeType] = useState<"straight" | "step" | "smoothstep" | "bezier">(DEFAULT_EDGE_TYPE);
  const [defaultEdgeStrokeWidth, setDefaultEdgeStrokeWidth] = useState<number>(DEFAULT_EDGE_STROKE_WIDTH);
  const [defaultEdgeDashed, setDefaultEdgeDashed] = useState<boolean>(DEFAULT_EDGE_DASHED);
  const [defaultEdgeDashLength, setDefaultEdgeDashLength] = useState<number>(DEFAULT_EDGE_DASH_LENGTH);
  const [defaultEdgeDashGap, setDefaultEdgeDashGap] = useState<number>(DEFAULT_EDGE_DASH_GAP);
  const [defaultEdgeAnimated, setDefaultEdgeAnimated] = useState<boolean>(false);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(false);
  const [snapGridSize, setSnapGridSize] = useState<number>(DEFAULT_SNAP_GRID_SIZE);
  const [canPasteDiagram, setCanPasteDiagram] = useState<boolean>(false);
  const [historyAvailability, setHistoryAvailability] = useState({ canUndo: false, canRedo: false });
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedRef = useRef(false);
  const nodesRef = useRef<Node<DiagramNodeData>[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const copiedSelectionRef = useRef<CopiedSelectionSnapshot | null>(null);
  const isPointerOverPaneRef = useRef(false);
  const lastPointerClientRef = useRef<{ x: number; y: number } | null>(null);
  const historyPastRef = useRef<DiagramHistorySnapshot[]>([]);
  const historyFutureRef = useRef<DiagramHistorySnapshot[]>([]);
  const historyPresentRef = useRef<DiagramHistorySnapshot | null>(null);
  const historyCapturePendingRef = useRef(false);
  const isApplyingHistoryRef = useRef(false);
  const isNodeDragInProgressRef = useRef(false);
  const dragDuplicateRef = useRef<{
    sourceId: string;
    cloneId: string;
    sourceStartPosition: { x: number; y: number };
  } | null>(null);
  const { fitView, setViewport: setFlowViewport, screenToFlowPosition } = useReactFlow();
  const activeTheme = DIAGRAM_THEMES[theme];
  const nodesLimitMessage = (count: number) =>
    t("sectionDetail.flowchart.editor.nodesLimit", "Limite de {{count}} blocos atingido neste MVP.").replace("{{count}}", String(count));
  const edgesLimitMessage = (count: number) =>
    t("sectionDetail.flowchart.editor.edgesLimit", "Limite de {{count}} conexões atingido neste MVP.").replace("{{count}}", String(count));

  useEffect(() => {
    if (typeof document === "undefined") return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;
    const previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved && isDiagramThemeKey(saved)) {
      setTheme(saved);
    }
  }, []);

  const nodeTypes = useMemo<NodeTypes>(
    () => ({
      diagramNode: (props) => <DiagramNodeComponent {...props} readOnly={isReadOnly} />,
    }),
    [isReadOnly]
  );

  const backfillMissingEdgeHandles = useCallback(
    (inputEdges: Edge[], inputNodes: Node<DiagramNodeData>[]): Edge[] => {
      const nodesById = new Map(inputNodes.map((node) => [node.id, node]));
      return inputEdges.map((edge) => {
        if (edge.sourceHandle && edge.targetHandle) return edge;
        const sourceNode = nodesById.get(edge.source);
        const targetNode = nodesById.get(edge.target);
        if (!sourceNode || !targetNode) return edge;

        const sourcePos = {
          x: sourceNode.position.x + readNodeStyleDimension(sourceNode.style?.width, DEFAULT_NODE_WIDTH) / 2,
          y: sourceNode.position.y + readNodeStyleDimension(sourceNode.style?.height, DEFAULT_NODE_HEIGHT) / 2,
        };
        const targetPos = {
          x: targetNode.position.x + readNodeStyleDimension(targetNode.style?.width, DEFAULT_NODE_WIDTH) / 2,
          y: targetNode.position.y + readNodeStyleDimension(targetNode.style?.height, DEFAULT_NODE_HEIGHT) / 2,
        };

        const inferredSource = inferHandleByDirection(sourcePos, targetPos);
        const inferredTarget = OPPOSITE_HANDLE[inferredSource];

        return {
          ...edge,
          sourceHandle: edge.sourceHandle ?? inferredSource,
          targetHandle: edge.targetHandle ?? inferredTarget,
        };
      });
    },
    []
  );

  const writeSelectionClipboard = useCallback((snapshot: CopiedSelectionSnapshot) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(DIAGRAM_SELECTION_CLIPBOARD_KEY, JSON.stringify(snapshot));
    } catch {
      // Ignore clipboard persistence failures.
    }
  }, []);

  const readSelectionClipboard = useCallback((): CopiedSelectionSnapshot | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(DIAGRAM_SELECTION_CLIPBOARD_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CopiedSelectionSnapshot;
      if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null;
      if (!parsed.anchor || !Number.isFinite(parsed.anchor.x) || !Number.isFinite(parsed.anchor.y)) return null;
      return parsed;
    } catch {
      return null;
    }
  }, []);

  const refreshClipboardAvailability = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(DIAGRAM_CLIPBOARD_KEY);
      setCanPasteDiagram(Boolean(raw));
    } catch {
      setCanPasteDiagram(false);
    }
  }, []);

  const readClipboardDiagram = useCallback((): DiagramState | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(DIAGRAM_CLIPBOARD_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as DiagramState;
      if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null;
      return parsed;
    } catch {
      return null;
    }
  }, []);

  const createHistorySnapshot = useCallback(
    (inputNodes: Node<DiagramNodeData>[], inputEdges: Edge[]): DiagramHistorySnapshot => {
      const serializedNodes = serializeNodes(inputNodes);
      const serializedEdges = serializeEdges(inputEdges);
      return {
        nodes: serializedNodes,
        edges: serializedEdges,
        signature: JSON.stringify({ nodes: serializedNodes, edges: serializedEdges }),
      };
    },
    []
  );

  const syncHistoryAvailability = useCallback(() => {
    setHistoryAvailability({
      canUndo: historyPastRef.current.length > 0,
      canRedo: historyFutureRef.current.length > 0,
    });
  }, []);

  const markHistoryCheckpoint = useCallback(() => {
    if (isReadOnly) return;
    historyCapturePendingRef.current = true;
  }, [isReadOnly]);

  const applyHistorySnapshot = useCallback(
    (snapshot: DiagramHistorySnapshot) => {
      isApplyingHistoryRef.current = true;
      const flowNodes = toFlowNodes(snapshot.nodes || [], theme);
      const flowEdges = toFlowEdges(snapshot.edges || [], activeTheme);
      setNodes(flowNodes);
      setEdges(backfillMissingEdgeHandles(flowEdges, flowNodes));
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    },
    [theme, activeTheme, setNodes, setEdges, backfillMissingEdgeHandles]
  );

  const undoDiagram = useCallback(() => {
    if (isReadOnly) return;
    const current = historyPresentRef.current;
    const previous = historyPastRef.current[historyPastRef.current.length - 1];
    if (!current || !previous) return;

    historyPastRef.current = historyPastRef.current.slice(0, -1);
    historyFutureRef.current = [current, ...historyFutureRef.current].slice(0, DIAGRAM_HISTORY_LIMIT);
    historyPresentRef.current = previous;
    historyCapturePendingRef.current = false;
    syncHistoryAvailability();
    applyHistorySnapshot(previous);
  }, [isReadOnly, applyHistorySnapshot, syncHistoryAvailability]);

  const redoDiagram = useCallback(() => {
    if (isReadOnly) return;
    const current = historyPresentRef.current;
    const [next, ...restFuture] = historyFutureRef.current;
    if (!current || !next) return;

    historyFutureRef.current = restFuture;
    historyPastRef.current = [...historyPastRef.current, current].slice(-DIAGRAM_HISTORY_LIMIT);
    historyPresentRef.current = next;
    historyCapturePendingRef.current = false;
    syncHistoryAvailability();
    applyHistorySnapshot(next);
  }, [isReadOnly, applyHistorySnapshot, syncHistoryAvailability]);

  const onNodesChangeWithHistory = useCallback(
    (changes: NodeChange[]) => {
      if (!isReadOnly) {
        const hasMeaningfulChange = changes.some((change) => {
          if (change.type === "add" || change.type === "remove" || change.type === "dimensions") return true;
          if (change.type === "position") {
            return "dragging" in change ? change.dragging === false : true;
          }
          return false;
        });
        if (hasMeaningfulChange && !isNodeDragInProgressRef.current) {
          markHistoryCheckpoint();
        }
      }
      onNodesChange(changes);
    },
    [isReadOnly, markHistoryCheckpoint, onNodesChange]
  );

  const onEdgesChangeWithHistory = useCallback(
    (changes: EdgeChange[]) => {
      if (!isReadOnly) {
        const hasMeaningfulChange = changes.some(
          (change) => change.type === "add" || change.type === "remove" || change.type === "reset"
        );
        if (hasMeaningfulChange) {
          markHistoryCheckpoint();
        }
      }
      onEdgesChange(changes);
    },
    [isReadOnly, markHistoryCheckpoint, onEdgesChange]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    refreshClipboardAvailability();
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === DIAGRAM_CLIPBOARD_KEY) {
        refreshClipboardAvailability();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refreshClipboardAvailability]);

  useEffect(() => {
    const initial = (isReadOnly ? (initialDiagramState || createEmptyDiagramState()) : getSectionDiagram(projectId, sectionId))
      || createEmptyDiagramState();
    const flowNodes = toFlowNodes(initial.nodes || [], theme);
    const flowEdges = toFlowEdges(initial.edges || [], activeTheme);
    const hydratedEdges = backfillMissingEdgeHandles(flowEdges, flowNodes);
    setNodes(flowNodes);
    setEdges(hydratedEdges);
    setViewport(initial.viewport || { x: 0, y: 0, zoom: 1 });
    setSnapToGrid(Boolean(initial.settings?.snapToGrid));
    setSnapGridSize(normalizeSnapGridSize(initial.settings?.snapGridSize));
    historyPastRef.current = [];
    historyFutureRef.current = [];
    historyCapturePendingRef.current = false;
    isApplyingHistoryRef.current = false;
    isNodeDragInProgressRef.current = false;
    historyPresentRef.current = createHistorySnapshot(flowNodes, hydratedEdges);
    syncHistoryAvailability();
    setTimeout(() => {
      setFlowViewport(initial.viewport || { x: 0, y: 0, zoom: 1 }, { duration: 250 });
    }, 0);
    hydratedRef.current = true;
  }, [projectId, sectionId, getSectionDiagram, setNodes, setEdges, setFlowViewport, backfillMissingEdgeHandles, isReadOnly, initialDiagramState, createHistorySnapshot, syncHistoryAvailability]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    if (isReadOnly) return;
    if (!hydratedRef.current) return;

    const snapshot = createHistorySnapshot(nodes, edges);
    const current = historyPresentRef.current;

    if (!current) {
      historyPresentRef.current = snapshot;
      historyCapturePendingRef.current = false;
      syncHistoryAvailability();
      return;
    }

    if (snapshot.signature === current.signature) {
      if (isApplyingHistoryRef.current) {
        isApplyingHistoryRef.current = false;
      }
      return;
    }

    if (isApplyingHistoryRef.current) {
      historyPresentRef.current = snapshot;
      historyCapturePendingRef.current = false;
      isApplyingHistoryRef.current = false;
      return;
    }

    if (historyCapturePendingRef.current) {
      historyPastRef.current.push(current);
      if (historyPastRef.current.length > DIAGRAM_HISTORY_LIMIT) {
        historyPastRef.current = historyPastRef.current.slice(-DIAGRAM_HISTORY_LIMIT);
      }
      historyFutureRef.current = [];
      historyCapturePendingRef.current = false;
      syncHistoryAvailability();
    }

    historyPresentRef.current = snapshot;
  }, [nodes, edges, isReadOnly, createHistorySnapshot, syncHistoryAvailability]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
    setNodes((prev) => prev.map((node) => ({ ...node, data: { ...node.data, theme } })));
    setEdges((prev) =>
      backfillMissingEdgeHandles(prev.map((edge) => ({
        ...edge,
        markerStart: toMarkerConfig(fromEdgeMarker(edge.markerStart), activeTheme.edgeStroke),
        markerEnd: toMarkerConfig(fromEdgeMarker(edge.markerEnd), activeTheme.edgeStroke),
        style: (() => {
          const dash = parseEdgeDashStyle(edge.style?.strokeDasharray);
          return buildEdgeStyle(
            activeTheme.edgeStroke,
            normalizeEdgeStrokeWidth(Number(edge.style?.strokeWidth ?? DEFAULT_EDGE_STROKE_WIDTH)),
            dash.dashed,
            dash.dashLength,
            dash.dashGap
          );
        })(),
        labelStyle: { ...(edge.labelStyle || {}), fill: activeTheme.edgeLabelFill, fontSize: 10, fontWeight: 400 },
        labelBgStyle: {
          ...(edge.labelBgStyle || {}),
          fill: activeTheme.edgeLabelBg,
          stroke: activeTheme.edgeLabelBorder,
          strokeWidth: 1,
          fillOpacity: 0.92,
        },
      })), nodesRef.current)
    );
  }, [theme, activeTheme, setNodes, setEdges, backfillMissingEdgeHandles]);

  useEffect(() => {
    if (isReadOnly) return;
    if (!hydratedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveSectionDiagram(projectId, sectionId, {
        version: 1,
        updatedAt: new Date().toISOString(),
        nodes: serializeNodes(nodes),
        edges: serializeEdges(edges),
        viewport,
        settings: {
          snapToGrid,
          snapGridSize,
        },
      });
    }, 700);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [nodes, edges, viewport, snapToGrid, snapGridSize, saveSectionDiagram, projectId, sectionId, isReadOnly]);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) || null;
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) || null;

  useEffect(() => {
    setNodes((prev) => {
      let changed = false;
      const next = prev.map((node) => {
        const shouldBeSelected = node.id === selectedNodeId;
        if (Boolean(node.selected) === shouldBeSelected) return node;
        changed = true;
        return { ...node, selected: shouldBeSelected };
      });
      return changed ? next : prev;
    });

    setEdges((prev) => {
      let changed = false;
      const next = prev.map((edge) => {
        const shouldBeSelected = edge.id === selectedEdgeId;
        if (Boolean(edge.selected) === shouldBeSelected) return edge;
        changed = true;
        return { ...edge, selected: shouldBeSelected };
      });
      return changed ? next : prev;
    });
  }, [selectedNodeId, selectedEdgeId, setNodes, setEdges]);

  useEffect(() => {
    if (!selectedEdge) return;
    setDefaultEdgeType(normalizeEdgeType(selectedEdge.type));
    const dash = parseEdgeDashStyle(selectedEdge.style?.strokeDasharray);
    setDefaultEdgeStrokeWidth(normalizeEdgeStrokeWidth(Number(selectedEdge.style?.strokeWidth ?? DEFAULT_EDGE_STROKE_WIDTH)));
    setDefaultEdgeDashed(dash.dashed);
    setDefaultEdgeDashLength(dash.dashLength);
    setDefaultEdgeDashGap(dash.dashGap);
    setDefaultEdgeAnimated(Boolean(selectedEdge.animated));
  }, [selectedEdge]);

  useEffect(() => {
    if (!selectedNode) return;
    setDefaultBlockType(normalizeBlockType(selectedNode.data.blockType));
  }, [selectedNode]);

  const createNode = useCallback(
    (blockType: DiagramBlockType, position: { x: number; y: number }) => {
      if (nodes.length >= MAX_NODES) {
        window.alert(nodesLimitMessage(MAX_NODES));
        return;
      }
      const index = nodes.length + 1;
      const id = crypto.randomUUID();
      const normalizedBlockType = normalizeBlockType(blockType);
      const circleSide = Math.max(DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT);
      const nextWidth = normalizedBlockType === "circulo" ? circleSide : DEFAULT_NODE_WIDTH;
      const nextHeight = normalizedBlockType === "circulo" ? circleSide : DEFAULT_NODE_HEIGHT;
      const nextNode: Node<DiagramNodeData> = {
        id,
        type: "diagramNode",
        position,
        style: { width: nextWidth, height: nextHeight },
        data: {
          label: t("sectionDetail.flowchart.editor.defaultBlockLabel", "Bloco {{count}}").replace("{{count}}", String(index)),
          blockType: normalizedBlockType,
          textAlign: "center",
          textVerticalAlign: DEFAULT_TEXT_VERTICAL_ALIGN,
          fontSize: DEFAULT_FONT_SIZE,
          borderWidth: DEFAULT_BORDER_WIDTH,
          borderRadius: DEFAULT_BORDER_RADIUS,
          gradientEnabled: DEFAULT_GRADIENT_ENABLED,
          theme,
        },
      };
      markHistoryCheckpoint();
      setNodes((prev) => [...prev, nextNode]);
      setSelectedNodeId(id);
      setSelectedEdgeId(null);
      setDefaultBlockType(normalizedBlockType);
    },
    [nodes.length, setNodes, theme, t, nodesLimitMessage, markHistoryCheckpoint]
  );

  const buildClonedNode = useCallback(
    (source: Node<DiagramNodeData>, targetPosition?: { x: number; y: number }): Node<DiagramNodeData> => {
      const defaultOffset = 24;
      const nextPosition = targetPosition || {
        x: source.position.x + defaultOffset,
        y: source.position.y + defaultOffset,
      };
      return {
        ...source,
        id: crypto.randomUUID(),
        position: nextPosition,
        data: {
          ...source.data,
        },
        style: {
          ...(source.style || {}),
        },
      };
    },
    []
  );

  const duplicateNode = useCallback(
    (source: Node<DiagramNodeData>, targetPosition?: { x: number; y: number }) => {
      if (nodes.length >= MAX_NODES) {
        window.alert(nodesLimitMessage(MAX_NODES));
        return null;
      }
      const clone = buildClonedNode(source, targetPosition);
      markHistoryCheckpoint();
      setNodes((prev) => [...prev, clone]);
      setSelectedNodeId(clone.id);
      setSelectedEdgeId(null);
      return clone;
    },
    [nodes.length, buildClonedNode, setNodes, t, nodesLimitMessage, markHistoryCheckpoint]
  );

  const handleCreateNode = useCallback(() => {
    const index = nodes.length + 1;
    const offset = index * 24;
    createNode(defaultBlockType, { x: offset, y: offset });
  }, [nodes.length, createNode, defaultBlockType]);

  const handleConnect = useCallback((connection: Connection) => {
    if (edges.length >= MAX_EDGES) {
      window.alert(edgesLimitMessage(MAX_EDGES));
      return;
    }
    if (!connection.source || !connection.target) {
      return;
    }
    const edge: Edge = {
      id: crypto.randomUUID(),
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      type: defaultEdgeType,
      animated: defaultEdgeDashed && defaultEdgeAnimated,
      label: "",
      markerEnd: toMarkerConfig("arrow", activeTheme.edgeStroke),
      markerStart: toMarkerConfig("none", activeTheme.edgeStroke),
      style: buildEdgeStyle(
        activeTheme.edgeStroke,
        defaultEdgeStrokeWidth,
        defaultEdgeDashed,
        defaultEdgeDashLength,
        defaultEdgeDashGap
      ),
      labelStyle: { fill: activeTheme.edgeLabelFill, fontSize: 10, fontWeight: 400 },
      labelBgStyle: { fill: activeTheme.edgeLabelBg, fillOpacity: 0.92, stroke: activeTheme.edgeLabelBorder, strokeWidth: 1 },
      labelBgPadding: [8, 4],
      labelBgBorderRadius: 999,
    };
    markHistoryCheckpoint();
    setEdges((prev) => addEdge(edge, prev));
    setSelectedNodeId(null);
  }, [
    edges.length,
    setEdges,
    activeTheme,
    defaultEdgeType,
    defaultEdgeAnimated,
    defaultEdgeStrokeWidth,
    defaultEdgeDashed,
    defaultEdgeDashLength,
    defaultEdgeDashGap,
    t,
    edgesLimitMessage,
    markHistoryCheckpoint,
  ]);

  const updateSelectedNode = (patch: Partial<DiagramNodeData>) => {
    if (!selectedNodeId) return;
    markHistoryCheckpoint();
    setNodes((prev) =>
      prev.map((node) => (node.id === selectedNodeId ? { ...node, data: { ...node.data, ...patch } } : node))
    );
  };

  const updateSelectedNodeSize = (partial: { width?: number; height?: number }) => {
    if (!selectedNodeId) return;
    markHistoryCheckpoint();
    setNodes((prev) =>
      prev.map((node) => {
        if (node.id !== selectedNodeId) return node;
        let normalizedPartial = partial;
        if (normalizeBlockType(node.data.blockType) === "circulo") {
          if (typeof partial.width === "number" && typeof partial.height !== "number") {
            normalizedPartial = { width: partial.width, height: partial.width };
          } else if (typeof partial.height === "number" && typeof partial.width !== "number") {
            normalizedPartial = { width: partial.height, height: partial.height };
          } else if (typeof partial.width === "number" && typeof partial.height === "number") {
            const side = Math.max(partial.width, partial.height);
            normalizedPartial = { width: side, height: side };
          }
        }
        const { width, height } = getNodeSizeStyle(node.style, normalizedPartial);
        return {
          ...node,
          style: {
            ...(node.style || {}),
            width,
            height,
          },
        };
      })
    );
  };

  const updateSelectedEdge = (patch: Partial<Edge>) => {
    if (!selectedEdgeId) return;
    markHistoryCheckpoint();
    setEdges((prev) =>
      prev.map((edge) => (edge.id === selectedEdgeId ? { ...edge, ...patch } : edge))
    );
  };

  const deleteSelection = () => {
    if (selectedNodeId) {
      markHistoryCheckpoint();
      setNodes((prev) => prev.filter((node) => node.id !== selectedNodeId));
      setEdges((prev) => prev.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId));
      setSelectedNodeId(null);
      return;
    }
    if (selectedEdgeId) {
      markHistoryCheckpoint();
      setEdges((prev) => prev.filter((edge) => edge.id !== selectedEdgeId));
      setSelectedEdgeId(null);
    }
  };

  const clearBoard = () => {
    if (isReadOnly) return;
    if (!window.confirm(t("sectionDetail.flowchart.editor.clearConfirm", "Deseja limpar todo o quadro de diagramas?"))) return;
    markHistoryCheckpoint();
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setViewport({ x: 0, y: 0, zoom: 1 });
    resetSectionDiagram(projectId, sectionId);
    setTimeout(() => fitView({ duration: 200, padding: 0.4 }), 0);
  };

  const copyDiagram = useCallback(() => {
    if (isReadOnly || typeof window === "undefined") return;
    const snapshot: DiagramState = {
      version: 1,
      updatedAt: new Date().toISOString(),
      nodes: serializeNodes(nodes),
      edges: serializeEdges(edges),
      viewport,
      settings: {
        snapToGrid,
        snapGridSize,
      },
    };
    try {
      window.localStorage.setItem(DIAGRAM_CLIPBOARD_KEY, JSON.stringify(snapshot));
      refreshClipboardAvailability();
    } catch {
      // Ignore storage write errors to avoid blocking editor interaction.
    }
  }, [isReadOnly, nodes, edges, viewport, snapToGrid, snapGridSize, refreshClipboardAvailability]);

  const pasteDiagram = useCallback(() => {
    if (isReadOnly) return;
    const snapshot = readClipboardDiagram();
    if (!snapshot) return;

    const nextViewport = snapshot.viewport || { x: 0, y: 0, zoom: 1 };
    const nextSnapToGrid = Boolean(snapshot.settings?.snapToGrid);
    const nextSnapGridSize = normalizeSnapGridSize(snapshot.settings?.snapGridSize);
    const flowNodes = toFlowNodes(snapshot.nodes || [], theme);
    const flowEdges = toFlowEdges(snapshot.edges || [], activeTheme);

    markHistoryCheckpoint();
    setNodes(flowNodes);
    setEdges(backfillMissingEdgeHandles(flowEdges, flowNodes));
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setViewport(nextViewport);
    setSnapToGrid(nextSnapToGrid);
    setSnapGridSize(nextSnapGridSize);

    setTimeout(() => {
      setFlowViewport(nextViewport, { duration: 220 });
    }, 0);
  }, [
    isReadOnly,
    readClipboardDiagram,
    theme,
    activeTheme,
    setNodes,
    setEdges,
    backfillMissingEdgeHandles,
    setFlowViewport,
    markHistoryCheckpoint,
  ]);

  const isTypingTarget = (target: EventTarget | null) => {
    const element = target as HTMLElement | null;
    if (!element) return false;
    const tag = element.tagName.toLowerCase();
    return (
      tag === "input" ||
      tag === "textarea" ||
      tag === "select" ||
      element.isContentEditable ||
      Boolean(element.closest("[contenteditable='true']"))
    );
  };

  useEffect(() => {
    if (isReadOnly) return;

    const copySelectedBlocks = () => {
      const selectedNodes = nodesRef.current.filter((node) => Boolean(node.selected));
      const fallbackSingle = selectedNode ? [selectedNode] : [];
      const sourceNodes = selectedNodes.length > 0 ? selectedNodes : fallbackSingle;
      if (sourceNodes.length === 0) return false;

      const selectedIds = new Set(sourceNodes.map((node) => node.id));
      const selectedEdges = edgesRef.current.filter(
        (edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target)
      );
      const minX = Math.min(...sourceNodes.map((node) => node.position.x));
      const minY = Math.min(...sourceNodes.map((node) => node.position.y));

      const snapshot: CopiedSelectionSnapshot = {
        nodes: sourceNodes.map((node) => ({
          ...node,
          data: { ...node.data },
          style: { ...(node.style || {}) },
        })),
        edges: selectedEdges.map((edge) => ({
          ...edge,
          style: edge.style ? { ...edge.style } : edge.style,
          labelStyle: edge.labelStyle ? { ...edge.labelStyle } : edge.labelStyle,
          labelBgStyle: edge.labelBgStyle ? { ...edge.labelBgStyle } : edge.labelBgStyle,
        })),
        anchor: { x: minX, y: minY },
      };

      copiedSelectionRef.current = snapshot;
      writeSelectionClipboard(snapshot);

      return true;
    };

    const pasteSelectedBlocks = () => {
      const copied = copiedSelectionRef.current || readSelectionClipboard();
      if (!copied) return false;
      copiedSelectionRef.current = copied;
      if (nodesRef.current.length + copied.nodes.length > MAX_NODES) {
        window.alert(nodesLimitMessage(MAX_NODES));
        return true;
      }
      if (edgesRef.current.length + copied.edges.length > MAX_EDGES) {
        window.alert(edgesLimitMessage(MAX_EDGES));
        return true;
      }

      const pasteOrigin =
        isPointerOverPaneRef.current && lastPointerClientRef.current
          ? screenToFlowPosition(lastPointerClientRef.current)
          : { x: copied.anchor.x + 24, y: copied.anchor.y + 24 };

      const idMap = new Map<string, string>();
      const nextNodes = copied.nodes.map((node) => {
        const nextId = crypto.randomUUID();
        idMap.set(node.id, nextId);
        return {
          ...node,
          id: nextId,
          selected: true,
          position: {
            x: node.position.x - copied.anchor.x + pasteOrigin.x,
            y: node.position.y - copied.anchor.y + pasteOrigin.y,
          },
          data: { ...node.data },
          style: { ...(node.style || {}) },
        };
      });

      const nextEdges = copied.edges
        .map((edge) => {
          const source = idMap.get(edge.source);
          const target = idMap.get(edge.target);
          if (!source || !target) return null;
          return {
            ...edge,
            id: crypto.randomUUID(),
            source,
            target,
            selected: false,
            style: edge.style ? { ...edge.style } : edge.style,
            labelStyle: edge.labelStyle ? { ...edge.labelStyle } : edge.labelStyle,
            labelBgStyle: edge.labelBgStyle ? { ...edge.labelBgStyle } : edge.labelBgStyle,
          } as Edge;
        })
        .filter((edge): edge is Edge => Boolean(edge));

      markHistoryCheckpoint();
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setNodes((prev) => [...prev.map((node) => ({ ...node, selected: false })), ...nextNodes]);
      setEdges((prev) => backfillMissingEdgeHandles([...prev, ...nextEdges], [...nodesRef.current, ...nextNodes]));

      return true;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isTypingTarget(event.target)) return;
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        return;
      }

      if (!(event.ctrlKey || event.metaKey)) return;
      if (isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();

      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undoDiagram();
        return;
      }

      if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        redoDiagram();
        return;
      }

      if (key === "d" && selectedNode) {
        event.preventDefault();
        duplicateNode(selectedNode);
        return;
      }

      if (key === "c") {
        if (copySelectedBlocks()) {
          event.preventDefault();
          return;
        }
      }

      if (key === "v") {
        if (pasteSelectedBlocks()) {
          event.preventDefault();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedNode,
    duplicateNode,
    screenToFlowPosition,
    isReadOnly,
    backfillMissingEdgeHandles,
    nodesLimitMessage,
    edgesLimitMessage,
    readSelectionClipboard,
    writeSelectionClipboard,
    markHistoryCheckpoint,
    undoDiagram,
    redoDiagram,
  ]);

  const themeOptions = getThemeOptions();
  const selectedStartMarker: DiagramMarkerType = selectedEdge ? fromEdgeMarker(selectedEdge.markerStart) : "none";
  const selectedEndMarker: DiagramMarkerType = selectedEdge ? fromEdgeMarker(selectedEdge.markerEnd) : "none";
  const selectedEdgeType = normalizeEdgeType(selectedEdge?.type);
  const selectedEdgeDash = parseEdgeDashStyle(selectedEdge?.style?.strokeDasharray);
  const selectedEdgeStrokeWidth = normalizeEdgeStrokeWidth(Number(selectedEdge?.style?.strokeWidth ?? DEFAULT_EDGE_STROKE_WIDTH));
  const selectedEdgeDashed = selectedEdgeDash.dashed;
  const selectedEdgeDashLength = selectedEdgeDash.dashLength;
  const selectedEdgeDashGap = selectedEdgeDash.dashGap;
  const selectedEdgeAnimated = Boolean(selectedEdge?.animated);
  const selectedNodeWidth = selectedNode
    ? readNodeStyleDimension(selectedNode.style?.width, DEFAULT_NODE_WIDTH)
    : DEFAULT_NODE_WIDTH;
  const selectedNodeHeight = selectedNode
    ? readNodeStyleDimension(selectedNode.style?.height, DEFAULT_NODE_HEIGHT)
    : DEFAULT_NODE_HEIGHT;
  const selectedNodeColor = normalizeHexColor(selectedNode?.data.color) || "";
  const selectedNodeTextColor = normalizeHexColor(selectedNode?.data.textColor) || "";
  const selectedNodeTextAlign = normalizeTextAlign(selectedNode?.data.textAlign);
  const selectedNodeTextVerticalAlign = normalizeTextVerticalAlign(selectedNode?.data.textVerticalAlign);
  const selectedNodeFontSize = clampNumber(
    Number(selectedNode?.data.fontSize ?? DEFAULT_FONT_SIZE),
    MIN_FONT_SIZE,
    MAX_FONT_SIZE,
    DEFAULT_FONT_SIZE
  );
  const selectedNodeBorderColor = normalizeHexColor(selectedNode?.data.borderColor) || "";
  const selectedNodeBorderWidth = clampNumber(
    Number(selectedNode?.data.borderWidth ?? DEFAULT_BORDER_WIDTH),
    MIN_BORDER_WIDTH,
    MAX_BORDER_WIDTH,
    DEFAULT_BORDER_WIDTH
  );
  const selectedNodeBorderRadius = clampNumber(
    Number(selectedNode?.data.borderRadius ?? DEFAULT_BORDER_RADIUS),
    MIN_BORDER_RADIUS,
    MAX_BORDER_RADIUS,
    DEFAULT_BORDER_RADIUS
  );
  const selectedNodeGradientEnabled =
    typeof selectedNode?.data.gradientEnabled === "boolean"
      ? selectedNode.data.gradientEnabled
      : DEFAULT_GRADIENT_ENABLED;
  const selectedNodeBlockType = normalizeBlockType(selectedNode?.data.blockType);
  const selectedNodeNote = selectedNode?.data.note || "";

  return (
    <div className={`fixed inset-x-0 bottom-0 ${isReadOnly ? "top-0" : "top-16 md:top-20"} text-white flex overflow-hidden overscroll-none ${activeTheme.appBgClass}`}>
      {isReadOnly && publicToken && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => router.push(`/s/${encodeURIComponent(publicToken)}?mode=view&focus=${encodeURIComponent(sectionId)}#section-${sectionId}`)}
              className="text-gray-400 hover:text-white transition-colors shrink-0"
            >
              ← {t("sectionDetail.actions.goToDocument")}
            </button>
            <span className="text-gray-500 shrink-0">/</span>
            <span
              className="min-w-0 truncate text-emerald-200 font-medium"
              title={publicSectionTitle || t("sectionDetail.flowchart.breadcrumb")}
            >
              {publicSectionTitle || t("sectionDetail.flowchart.breadcrumb")}
            </span>
            {publicProjectTitle ? (
              <>
                <span className="text-gray-500 shrink-0">|</span>
                <span className="min-w-0 truncate text-gray-300" title={publicProjectTitle}>
                  {publicProjectTitle}
                </span>
              </>
            ) : null}
          </div>
          <span className="text-green-300 text-sm shrink-0">🔓 {t("projectDetail.visibility.public", "Public")}</span>
        </div>
      )}
      <div
        className="flex-1 relative min-h-0 overflow-hidden"
        onDragOver={isReadOnly ? undefined : (event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={isReadOnly ? undefined : (event) => {
          const blockTypeRaw = event.dataTransfer.getData(BLOCK_DND_MIME) || event.dataTransfer.getData("text/plain");
          if (!blockTypeRaw) return;
          event.preventDefault();
          const blockType = normalizeBlockType(blockTypeRaw);
          const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
          createNode(blockType, position);
        }}
      >
        <DiagramToolbar
          shellClass={activeTheme.toolbarShellClass}
          toolbarButtonClass={activeTheme.toolbarButtonClass}
          dangerButtonClass={activeTheme.dangerButtonClass}
          isReadOnly={isReadOnly}
          topClassName={isReadOnly ? "top-16" : "top-3"}
          currentTheme={theme}
          themeOptions={themeOptions}
          onCenter={() => fitView({ duration: 300, padding: 0.3 })}
          onUndo={undoDiagram}
          onRedo={redoDiagram}
          canUndo={historyAvailability.canUndo}
          canRedo={historyAvailability.canRedo}
          onClear={clearBoard}
          onCopyDiagram={copyDiagram}
          onPasteDiagram={pasteDiagram}
          canPasteDiagram={canPasteDiagram}
          snapToGrid={snapToGrid}
          snapGridSize={snapGridSize}
          onThemeChange={(nextTheme) => {
            if (isDiagramThemeKey(nextTheme)) {
              setTheme(nextTheme);
            }
          }}
          onToggleSnapToGrid={() => setSnapToGrid((prev) => !prev)}
          onSnapGridSizeChange={(size) => setSnapGridSize(normalizeSnapGridSize(size))}
        />

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={isReadOnly ? undefined : onNodesChangeWithHistory}
          onEdgesChange={isReadOnly ? undefined : onEdgesChangeWithHistory}
          onConnect={isReadOnly ? undefined : handleConnect}
          onNodeClick={(_, node) => { setSelectedNodeId(node.id); setSelectedEdgeId(null); }}
          onNodeDragStart={isReadOnly ? undefined : (event, node) => {
            isNodeDragInProgressRef.current = true;
            markHistoryCheckpoint();
            setSelectedNodeId(node.id);
            setSelectedEdgeId(null);
            if (!(event.ctrlKey || event.altKey)) return;
            if (dragDuplicateRef.current) return;
            if (nodes.length >= MAX_NODES) {
              window.alert(nodesLimitMessage(MAX_NODES));
              return;
            }
            const clone = buildClonedNode(node, node.position);
            setNodes((prev) => [...prev, clone]);
            dragDuplicateRef.current = {
              sourceId: node.id,
              cloneId: clone.id,
              sourceStartPosition: { ...node.position },
            };
            setSelectedNodeId(clone.id);
            setSelectedEdgeId(null);
          }}
          onNodeDrag={isReadOnly ? undefined : (_, node) => {
            const dragDuplicate = dragDuplicateRef.current;
            if (!dragDuplicate || dragDuplicate.sourceId !== node.id) return;
            setNodes((prev) =>
              prev.map((candidate) => {
                if (candidate.id === dragDuplicate.sourceId) {
                  return { ...candidate, position: dragDuplicate.sourceStartPosition };
                }
                if (candidate.id === dragDuplicate.cloneId) {
                  return { ...candidate, position: node.position };
                }
                return candidate;
              })
            );
          }}
          onNodeDragStop={isReadOnly ? undefined : (_, node) => {
            isNodeDragInProgressRef.current = false;
            const dragDuplicate = dragDuplicateRef.current;
            if (!dragDuplicate || dragDuplicate.sourceId !== node.id) {
              setSelectedNodeId(node.id);
              setSelectedEdgeId(null);
              return;
            }
            setNodes((prev) =>
              prev.map((candidate) => {
                if (candidate.id === dragDuplicate.sourceId) {
                  return { ...candidate, position: dragDuplicate.sourceStartPosition };
                }
                return candidate;
              })
            );
            dragDuplicateRef.current = null;
            setSelectedNodeId(dragDuplicate.cloneId);
            setSelectedEdgeId(null);
          }}
          onEdgeClick={isReadOnly ? undefined : (_, edge) => { setSelectedEdgeId(edge.id); setSelectedNodeId(null); }}
          onPaneClick={() => { setSelectedEdgeId(null); setSelectedNodeId(null); }}
          onPaneMouseEnter={() => {
            isPointerOverPaneRef.current = true;
          }}
          onPaneMouseLeave={() => {
            isPointerOverPaneRef.current = false;
          }}
          onPaneMouseMove={(event) => {
            isPointerOverPaneRef.current = true;
            lastPointerClientRef.current = { x: event.clientX, y: event.clientY };
          }}
          onMoveEnd={isReadOnly ? undefined : (_, flowViewport) => setViewport(flowViewport)}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          className="bg-transparent"
          connectionMode={ConnectionMode.Loose}
          snapToGrid={snapToGrid}
          snapGrid={[snapGridSize, snapGridSize]}
          nodesConnectable={!isReadOnly}
          nodesDraggable={!isReadOnly}
          elementsSelectable
          deleteKeyCode={isReadOnly ? null : ["Delete", "Backspace"]}
          onNodesDelete={isReadOnly ? undefined : (deleted) => { if (deleted.some((node) => node.id === selectedNodeId)) setSelectedNodeId(null); }}
          onEdgesDelete={isReadOnly ? undefined : (deleted) => { if (deleted.some((edge) => edge.id === selectedEdgeId)) setSelectedEdgeId(null); }}
          proOptions={{ hideAttribution: true }}
        >
          <style>{`
            .react-flow__node .diagram-node-card { backdrop-filter: blur(2px); }
            .react-flow__node:hover { z-index: 1400 !important; }
            .react-flow__edge.selected path {
              stroke: ${activeTheme.edgeSelectedStroke} !important;
              filter: drop-shadow(0 0 6px ${activeTheme.edgeGlow});
            }
            .react-flow__controls { border-radius: 14px !important; overflow: hidden; }
            .react-flow__controls-button {
              background: rgba(10, 15, 25, 0.92);
              border-bottom: 1px solid rgba(70, 75, 90, 0.5);
              color: rgb(226, 232, 240);
            }
            .react-flow__controls-button:hover { background: rgba(35, 42, 56, 0.95); }
          `}</style>
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color={activeTheme.dotColor} />
          <Controls className={activeTheme.controlsClass} />
        </ReactFlow>

      </div>

      {!isReadOnly && (
      <PropertiesSidebar
        panelClass={activeTheme.panelClass}
        idleHintClass={activeTheme.idleHintClass}
        nodeSectionClass={activeTheme.nodeSectionClass}
        edgeSectionClass={activeTheme.edgeSectionClass}
        inputClass={activeTheme.inputClass}
        showNode={Boolean(selectedNode)}
        showEdge={Boolean(selectedEdge)}
        nodeLabel={selectedNode?.data.label || ""}
        nodeNote={selectedNodeNote}
        nodeColor={selectedNodeColor}
        nodeTextColor={selectedNodeTextColor}
        nodeTextAlign={selectedNodeTextAlign}
        nodeTextVerticalAlign={selectedNodeTextVerticalAlign}
        nodeFontSize={selectedNodeFontSize}
        nodeBorderColor={selectedNodeBorderColor}
        nodeBorderWidth={selectedNodeBorderWidth}
        nodeBorderRadius={selectedNodeBorderRadius}
        nodeGradientEnabled={selectedNodeGradientEnabled}
        nodeWidth={selectedNodeWidth}
        nodeHeight={selectedNodeHeight}
        nodeBlockType={selectedNodeBlockType}
        edgeLabel={typeof selectedEdge?.label === "string" ? selectedEdge.label : ""}
        edgeType={selectedEdgeType}
        edgeStrokeWidth={selectedEdgeStrokeWidth}
        edgeDashed={selectedEdgeDashed}
        edgeDashLength={selectedEdgeDashLength}
        edgeDashGap={selectedEdgeDashGap}
        edgeAnimated={selectedEdgeAnimated}
        startMarker={selectedStartMarker}
        endMarker={selectedEndMarker}
        onNodeLabelChange={(label) => updateSelectedNode({ label })}
        onNodeNoteChange={(note) => updateSelectedNode({ note })}
        onNodeColorChange={(color) => updateSelectedNode({ color: normalizeHexColor(color) })}
        onNodeTextColorChange={(color) => updateSelectedNode({ textColor: normalizeHexColor(color) })}
        onNodeTextAlignChange={(textAlign) => updateSelectedNode({ textAlign })}
        onNodeTextVerticalAlignChange={(textVerticalAlign) => updateSelectedNode({ textVerticalAlign })}
        onNodeFontSizeChange={(fontSize) =>
          updateSelectedNode({
            fontSize: clampNumber(fontSize, MIN_FONT_SIZE, MAX_FONT_SIZE, DEFAULT_FONT_SIZE),
          })
        }
        onNodeBorderColorChange={(borderColor) => updateSelectedNode({ borderColor: normalizeHexColor(borderColor) })}
        onNodeBorderWidthChange={(borderWidth) =>
          updateSelectedNode({
            borderWidth: clampNumber(borderWidth, MIN_BORDER_WIDTH, MAX_BORDER_WIDTH, DEFAULT_BORDER_WIDTH),
          })
        }
        onNodeBorderRadiusChange={(borderRadius) =>
          updateSelectedNode({
            borderRadius: clampNumber(borderRadius, MIN_BORDER_RADIUS, MAX_BORDER_RADIUS, DEFAULT_BORDER_RADIUS),
          })
        }
        onNodeGradientEnabledChange={(gradientEnabled) => updateSelectedNode({ gradientEnabled })}
        onNodeWidthChange={(width) => updateSelectedNodeSize({ width })}
        onNodeHeightChange={(height) => updateSelectedNodeSize({ height })}
        onNodeBlockTypeChange={(blockType) => {
          if (blockType === "circulo" && selectedNode) {
            const currentWidth = readNodeStyleDimension(selectedNode.style?.width, DEFAULT_NODE_WIDTH);
            const currentHeight = readNodeStyleDimension(selectedNode.style?.height, DEFAULT_NODE_HEIGHT);
            const side = Math.max(currentWidth, currentHeight);
            updateSelectedNodeSize({ width: side, height: side });
          }
          updateSelectedNode({ blockType });
          setDefaultBlockType(blockType);
        }}
        onEdgeLabelChange={(label) => updateSelectedEdge({ label })}
        onEdgeTypeChange={(edgeType) => {
          updateSelectedEdge({ type: edgeType });
          setDefaultEdgeType(edgeType);
        }}
        onEdgeStrokeWidthChange={(strokeWidth) => {
          const nextStrokeWidth = normalizeEdgeStrokeWidth(strokeWidth);
          updateSelectedEdge({
            style: buildEdgeStyle(
              activeTheme.edgeStroke,
              nextStrokeWidth,
              selectedEdgeDashed,
              selectedEdgeDashLength,
              selectedEdgeDashGap
            ),
          });
          setDefaultEdgeStrokeWidth(nextStrokeWidth);
        }}
        onEdgeDashedChange={(dashed) => {
          updateSelectedEdge({
            ...(dashed ? {} : { animated: false }),
            style: buildEdgeStyle(
              activeTheme.edgeStroke,
              selectedEdgeStrokeWidth,
              dashed,
              selectedEdgeDashLength,
              selectedEdgeDashGap
            ),
          });
          setDefaultEdgeDashed(dashed);
          if (!dashed) setDefaultEdgeAnimated(false);
        }}
        onEdgeDashLengthChange={(dashLength) => {
          const nextDashLength = normalizeEdgeDashLength(dashLength);
          updateSelectedEdge({
            style: buildEdgeStyle(
              activeTheme.edgeStroke,
              selectedEdgeStrokeWidth,
              selectedEdgeDashed,
              nextDashLength,
              selectedEdgeDashGap
            ),
          });
          setDefaultEdgeDashLength(nextDashLength);
        }}
        onEdgeDashGapChange={(dashGap) => {
          const nextDashGap = normalizeEdgeDashGap(dashGap);
          updateSelectedEdge({
            style: buildEdgeStyle(
              activeTheme.edgeStroke,
              selectedEdgeStrokeWidth,
              selectedEdgeDashed,
              selectedEdgeDashLength,
              nextDashGap
            ),
          });
          setDefaultEdgeDashGap(nextDashGap);
        }}
        onEdgeAnimatedChange={(animated) => {
          updateSelectedEdge({ animated });
          setDefaultEdgeAnimated(animated);
        }}
        onEdgeStartMarkerChange={(marker) => updateSelectedEdge({ markerStart: toMarkerConfig(marker, activeTheme.edgeStroke) })}
        onEdgeEndMarkerChange={(marker) => updateSelectedEdge({ markerEnd: toMarkerConfig(marker, activeTheme.edgeStroke) })}
      />
      )}
    </div>
  );
}

export default function DiagramasClient({
  projectId,
  sectionId,
  readOnlyPublic = false,
  publicToken,
  publicProjectTitle,
  publicSectionTitle,
  initialDiagramState,
}: DiagramasClientProps) {
  return (
    <ReactFlowProvider>
      <DiagramasFlow
        projectId={projectId}
        sectionId={sectionId}
        readOnlyPublic={readOnlyPublic}
        publicToken={publicToken}
        publicProjectTitle={publicProjectTitle}
        publicSectionTitle={publicSectionTitle}
        initialDiagramState={initialDiagramState}
      />
    </ReactFlowProvider>
  );
}
