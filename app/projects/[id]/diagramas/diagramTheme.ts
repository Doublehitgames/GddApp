import { DiagramTheme, DiagramThemeKey } from "./diagramTypes";

export const THEME_STORAGE_KEY = "gdd_diagram_theme_v1";
export const DIAGRAM_THEME_KEYS: DiagramThemeKey[] = ["neon", "minimal", "pastel"];

export const DIAGRAM_THEMES: Record<DiagramThemeKey, DiagramTheme> = {
  neon: {
    label: "Neon",
    appBgClass: "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950",
    toolbarShellClass: "rounded-2xl border border-slate-700/70 bg-slate-900/80 p-2 backdrop-blur-md shadow-xl shadow-black/30",
    toolbarButtonClass:
      "inline-flex items-center justify-center rounded-xl border border-slate-600/70 bg-slate-900/85 px-3.5 py-2 text-sm font-medium text-slate-100 shadow-sm shadow-black/20 transition-all hover:-translate-y-0.5 hover:border-cyan-300/60 hover:bg-slate-800/90",
    primaryButtonClass:
      "inline-flex items-center justify-center rounded-xl border border-cyan-300/45 bg-cyan-500/20 px-3.5 py-2 text-sm font-semibold text-cyan-100 shadow-sm shadow-cyan-950/30 transition-all hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-cyan-400/25",
    dangerButtonClass:
      "inline-flex items-center justify-center rounded-xl border border-rose-400/40 bg-rose-500/20 px-3.5 py-2 text-sm font-semibold text-rose-100 shadow-sm shadow-rose-950/30 transition-all hover:-translate-y-0.5 hover:border-rose-300 hover:bg-rose-500/25",
    panelClass: "w-[340px] border-l border-slate-700/80 bg-slate-900/75 backdrop-blur-sm p-4 overflow-y-auto",
    emptyCardClass: "rounded-2xl border border-slate-700/80 bg-slate-900/90 p-7 text-center max-w-sm shadow-2xl shadow-black/35 backdrop-blur-md",
    idleHintClass: "rounded-xl border border-slate-700/80 bg-slate-900/75 px-3 py-3 text-sm text-slate-400",
    nodeSectionClass: "space-y-3 rounded-xl border border-cyan-400/30 bg-cyan-950/20 p-3",
    edgeSectionClass: "space-y-3 rounded-xl border border-violet-400/35 bg-violet-950/20 p-3",
    inputClass:
      "mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400/70 focus:outline-none",
    nodeCardClass:
      "diagram-node-card group h-full w-full box-border rounded-2xl border border-cyan-300/35 bg-gradient-to-br from-slate-900/95 via-slate-900/92 to-slate-800/90 text-slate-100 px-3 py-2 shadow-lg shadow-black/30 transition-all duration-150 hover:border-cyan-300/55",
    nodeTextClass: "text-slate-100",
    handleClass: "!border-slate-900 !bg-cyan-300",
    resizerColor: "#67e8f9",
    resizerHandleBg: "#a5f3fc",
    resizerLineColor: "rgba(103, 232, 249, 0.75)",
    resizerVisualMode: "normal",
    edgeStroke: "#64748b",
    edgeSelectedStroke: "rgb(125 211 252)",
    edgeGlow: "rgba(56, 189, 248, 0.6)",
    edgeLabelFill: "#e2e8f0",
    edgeLabelBg: "#0f172a",
    edgeLabelBorder: "#334155",
    dotColor: "#334155",
    controlsClass: "!bg-slate-900/90 !border !border-slate-700 !rounded-xl",
    selectedNodeBorder: "rgb(125 211 252 / 0.95)",
    selectedNodeRing: "rgb(125 211 252 / 0.5)",
    selectedNodeGlow: "rgb(56 189 248 / 0.25)",
  },
  minimal: {
    label: "Minimal",
    appBgClass: "bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950",
    toolbarShellClass: "rounded-2xl border border-zinc-700/70 bg-zinc-900/85 p-2 backdrop-blur-md shadow-lg shadow-black/25",
    toolbarButtonClass:
      "inline-flex items-center justify-center rounded-xl border border-zinc-600/70 bg-zinc-900 px-3.5 py-2 text-sm font-medium text-zinc-100 transition-all hover:border-zinc-400 hover:bg-zinc-800",
    primaryButtonClass:
      "inline-flex items-center justify-center rounded-xl border border-zinc-400/60 bg-zinc-700/35 px-3.5 py-2 text-sm font-semibold text-zinc-100 transition-all hover:bg-zinc-700/50",
    dangerButtonClass:
      "inline-flex items-center justify-center rounded-xl border border-red-400/45 bg-red-900/30 px-3.5 py-2 text-sm font-semibold text-red-100 transition-all hover:bg-red-800/35",
    panelClass: "w-[340px] border-l border-zinc-700/80 bg-zinc-900/85 backdrop-blur-sm p-4 overflow-y-auto",
    emptyCardClass: "rounded-2xl border border-zinc-700/80 bg-zinc-900/90 p-7 text-center max-w-sm shadow-xl shadow-black/30 backdrop-blur-md",
    idleHintClass: "rounded-xl border border-zinc-700/80 bg-zinc-900/70 px-3 py-3 text-sm text-zinc-400",
    nodeSectionClass: "space-y-3 rounded-xl border border-zinc-500/35 bg-zinc-800/35 p-3",
    edgeSectionClass: "space-y-3 rounded-xl border border-zinc-500/35 bg-zinc-800/35 p-3",
    inputClass:
      "mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950/85 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-400/70 focus:outline-none",
    nodeCardClass:
      "diagram-node-card group h-full w-full box-border rounded-2xl border border-zinc-400/30 bg-zinc-900/95 text-zinc-100 px-3 py-2 shadow-md shadow-black/25 transition-all duration-150 hover:border-zinc-300/50",
    nodeTextClass: "text-zinc-100",
    handleClass: "!border-zinc-900 !bg-zinc-300",
    resizerColor: "#d4d4d8",
    resizerHandleBg: "#f4f4f5",
    resizerLineColor: "rgba(212, 212, 216, 0.85)",
    resizerVisualMode: "minimal",
    edgeStroke: "#71717a",
    edgeSelectedStroke: "rgb(244 244 245)",
    edgeGlow: "rgba(228, 228, 231, 0.55)",
    edgeLabelFill: "#fafafa",
    edgeLabelBg: "#18181b",
    edgeLabelBorder: "#3f3f46",
    dotColor: "#3f3f46",
    controlsClass: "!bg-zinc-900/90 !border !border-zinc-700 !rounded-xl",
    selectedNodeBorder: "rgb(244 244 245 / 0.9)",
    selectedNodeRing: "rgb(244 244 245 / 0.42)",
    selectedNodeGlow: "rgb(212 212 216 / 0.2)",
  },
  pastel: {
    label: "Pastel",
    appBgClass: "bg-gradient-to-br from-indigo-950 via-slate-900 to-fuchsia-950",
    toolbarShellClass: "rounded-2xl border border-violet-300/35 bg-slate-900/70 p-2 backdrop-blur-md shadow-xl shadow-indigo-950/35",
    toolbarButtonClass:
      "inline-flex items-center justify-center rounded-xl border border-violet-200/40 bg-violet-500/20 px-3.5 py-2 text-sm font-medium text-violet-50 transition-all hover:-translate-y-0.5 hover:bg-violet-400/30",
    primaryButtonClass:
      "inline-flex items-center justify-center rounded-xl border border-sky-200/50 bg-sky-400/25 px-3.5 py-2 text-sm font-semibold text-sky-50 transition-all hover:-translate-y-0.5 hover:bg-sky-300/35",
    dangerButtonClass:
      "inline-flex items-center justify-center rounded-xl border border-pink-200/45 bg-pink-500/25 px-3.5 py-2 text-sm font-semibold text-pink-50 transition-all hover:-translate-y-0.5 hover:bg-pink-400/35",
    panelClass: "w-[340px] border-l border-violet-300/30 bg-slate-900/65 backdrop-blur-sm p-4 overflow-y-auto",
    emptyCardClass: "rounded-2xl border border-violet-300/35 bg-slate-900/70 p-7 text-center max-w-sm shadow-2xl shadow-indigo-950/35 backdrop-blur-md",
    idleHintClass: "rounded-xl border border-violet-300/30 bg-slate-900/65 px-3 py-3 text-sm text-violet-100/75",
    nodeSectionClass: "space-y-3 rounded-xl border border-sky-200/35 bg-sky-400/12 p-3",
    edgeSectionClass: "space-y-3 rounded-xl border border-fuchsia-200/35 bg-fuchsia-400/10 p-3",
    inputClass:
      "mt-1 w-full rounded-xl border border-violet-200/35 bg-slate-950/65 px-3 py-2 text-sm text-violet-50 focus:border-sky-200/70 focus:outline-none",
    nodeCardClass:
      "diagram-node-card group h-full w-full box-border rounded-2xl border border-sky-200/45 bg-gradient-to-br from-indigo-900/70 via-slate-900/80 to-fuchsia-900/65 text-violet-50 px-3 py-2 shadow-lg shadow-indigo-950/35 transition-all duration-150 hover:border-sky-100/65",
    nodeTextClass: "text-violet-50",
    handleClass: "!border-indigo-950 !bg-sky-200",
    resizerColor: "#bae6fd",
    resizerHandleBg: "#e0f2fe",
    resizerLineColor: "rgba(186, 230, 253, 0.8)",
    resizerVisualMode: "normal",
    edgeStroke: "#c4b5fd",
    edgeSelectedStroke: "rgb(186 230 253)",
    edgeGlow: "rgba(186, 230, 253, 0.6)",
    edgeLabelFill: "#f8fafc",
    edgeLabelBg: "#312e81",
    edgeLabelBorder: "#a78bfa",
    dotColor: "#6d28d9",
    controlsClass: "!bg-indigo-950/85 !border !border-violet-300/35 !rounded-xl",
    selectedNodeBorder: "rgb(186 230 253 / 0.95)",
    selectedNodeRing: "rgb(186 230 253 / 0.45)",
    selectedNodeGlow: "rgb(167 139 250 / 0.28)",
  },
};

export function isDiagramThemeKey(value: string): value is DiagramThemeKey {
  return DIAGRAM_THEME_KEYS.includes(value as DiagramThemeKey);
}

export function getThemeOptions() {
  return DIAGRAM_THEME_KEYS.map((key) => ({ key, label: DIAGRAM_THEMES[key].label }));
}
