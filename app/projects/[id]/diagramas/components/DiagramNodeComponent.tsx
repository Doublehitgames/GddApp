"use client";

import { useEffect, useRef, useState } from "react";
import { Handle, NodeProps, NodeResizer, Position } from "reactflow";
import { DIAGRAM_THEMES } from "../diagramTheme";
import { DiagramNodeData } from "../diagramTypes";

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((char) => `${char}${char}`).join("") : value;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return { r, g, b };
}

function rgbaFromHex(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getReadableTextColor(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.58 ? "#0f172a" : "#f8fafc";
}

type DiagramNodeComponentProps = NodeProps<DiagramNodeData> & {
  readOnly?: boolean;
};

export default function DiagramNodeComponent({ data, selected, readOnly = false }: DiagramNodeComponentProps) {
  const label = data?.label || "";
  const rawNote = data?.note || "";
  const note = rawNote.trim();
  const hasNote = note.length > 0;
  const notePreview = note.length > 260 ? `${note.slice(0, 260)}...` : note;
  const [isNoteCardOpen, setIsNoteCardOpen] = useState(false);
  const noteCardRef = useRef<HTMLDivElement | null>(null);
  const noteButtonRef = useRef<HTMLButtonElement | null>(null);
  const theme = DIAGRAM_THEMES[data?.theme || "neon"];
  const blockType = data?.blockType || "retangulo";
  const customColor = data?.color;
  const customTextColor = data?.textColor;
  const customBorderColor = data?.borderColor;
  const customBorderWidth = typeof data?.borderWidth === "number" ? data.borderWidth : undefined;
  const customBorderRadius = typeof data?.borderRadius === "number" ? data.borderRadius : undefined;
  const gradientEnabled = data?.gradientEnabled !== false;
  const textAlign = data?.textAlign || "center";
  const textVerticalAlign = data?.textVerticalAlign || "middle";
  const fontSize = typeof data?.fontSize === "number" ? data.fontSize : 10;
  const justifyContentByVerticalAlign = {
    top: "flex-start",
    middle: "center",
    bottom: "flex-end",
  } as const;

  const customNodeStyle = customColor
    ? {
        borderColor: rgbaFromHex(customColor, 0.7),
        background: gradientEnabled
          ? `linear-gradient(135deg, ${rgbaFromHex(customColor, 0.45)} 0%, ${rgbaFromHex(customColor, 0.2)} 100%)`
          : rgbaFromHex(customColor, 0.35),
      }
    : undefined;
  const fallbackBorderColor = "rgba(148, 163, 184, 0.45)";
  const resolvedBorderColor = customBorderColor || customNodeStyle?.borderColor || fallbackBorderColor;
  const resolvedBorderWidth = typeof customBorderWidth === "number" ? customBorderWidth : 1;
  const baseNodeStyle = {
    ...(customNodeStyle || {}),
    ...(customBorderColor ? { borderColor: customBorderColor } : {}),
    ...(typeof customBorderWidth === "number" ? { borderWidth: customBorderWidth } : {}),
  };
  const shapeNodeStyle = {
    ...(blockType === "retangulo" && typeof customBorderRadius === "number" ? { borderRadius: customBorderRadius } : {}),
    ...(blockType === "pill" ? { borderRadius: 9999 } : {}),
    ...(blockType === "circulo" ? { borderRadius: "50%", clipPath: "circle(50% at 50% 50%)" } : {}),
    ...(blockType === "losango"
      ? {
          clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
          borderRadius: 0,
          borderWidth: 0,
          borderColor: "transparent",
          boxShadow:
            resolvedBorderWidth > 0
              ? `inset 0 0 0 ${resolvedBorderWidth}px ${resolvedBorderColor}`
              : "none",
        }
      : {}),
  };
  const mergedNodeStyle = {
    ...baseNodeStyle,
    ...shapeNodeStyle,
  };
  const selectedShapeStyle = selected
    ? {
        ...(blockType !== "losango" ? { borderColor: theme.selectedNodeBorder } : {}),
        boxShadow:
          blockType === "losango"
            ? "none"
            : `0 0 0 2px ${theme.selectedNodeRing}, 0 0 26px ${theme.selectedNodeGlow}, 0 12px 26px rgb(2 6 23 / 0.48)`,
        filter: blockType === "losango" || blockType === "circulo" ? undefined : `drop-shadow(0 0 10px ${theme.selectedNodeGlow})`,
      }
    : undefined;
  const outerSelectedGlowStyle =
    selected && (blockType === "losango" || blockType === "circulo")
      ? {
          filter: `drop-shadow(0 0 10px ${theme.selectedNodeGlow}) drop-shadow(0 0 4px ${theme.selectedNodeRing})`,
        }
      : undefined;
  const textPadding = blockType === "losango" ? "14% 18%" : blockType === "circulo" ? "12%" : "0.5rem 0.75rem";
  const customTextStyle = {
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: justifyContentByVerticalAlign[textVerticalAlign],
    textAlign,
    fontSize,
    padding: textPadding,
    color: customTextColor || (customColor ? getReadableTextColor(customColor) : undefined),
  };
  const isMinimalResizer = theme.resizerVisualMode === "minimal";
  const resizerHandleVisualStyle = {
    width: 10,
    height: 10,
    borderRadius: 4,
    border: isMinimalResizer ? `1px solid ${theme.resizerLineColor}` : `1px solid ${theme.resizerColor}`,
    background: isMinimalResizer
      ? `radial-gradient(circle at center, ${theme.resizerHandleBg} 0 1px, transparent 1.1px)`
      : `radial-gradient(circle at center, ${theme.resizerHandleBg} 0 1.5px, transparent 1.6px)`,
    boxShadow: isMinimalResizer
      ? "0 0 0 1px rgb(2 6 23 / 0.14)"
      : "0 0 0 1px rgb(2 6 23 / 0.22)",
  };
  const resizerLineVisualStyle = {
    borderColor: theme.resizerLineColor,
    borderWidth: isMinimalResizer ? 1 : 1.5,
    opacity: isMinimalResizer ? 0.75 : 1,
  };
  const outerNodeClass = "group h-full w-full box-border relative";
  const shapeNodeClass = `${theme.nodeCardClass} !p-0 ${
    blockType === "losango" ? "!border-0 hover:!border-0 !shadow-none hover:!shadow-none" : ""
  }`;

  useEffect(() => {
    if (!hasNote) {
      setIsNoteCardOpen(false);
    }
  }, [hasNote]);

  useEffect(() => {
    if (!isNoteCardOpen) return;

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (noteCardRef.current?.contains(target)) return;
      if (noteButtonRef.current?.contains(target)) return;
      setIsNoteCardOpen(false);
    };

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsNoteCardOpen(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentMouseDown, true);
    document.addEventListener("keydown", handleDocumentKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown, true);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [isNoteCardOpen]);

  return (
    <div
      className={outerNodeClass}
      style={{
        ...(outerSelectedGlowStyle || {}),
        ...(isNoteCardOpen ? { zIndex: 1700 } : {}),
      }}
    >
      <NodeResizer
        isVisible={selected && !readOnly}
        minWidth={120}
        minHeight={40}
        keepAspectRatio={blockType === "circulo"}
        color={theme.resizerColor}
        handleStyle={resizerHandleVisualStyle}
        lineStyle={resizerLineVisualStyle}
      />
      <Handle
        id="top"
        type="source"
        position={Position.Top}
        className={`!z-20 !h-2.5 !w-2.5 !border transition-all duration-150 ${theme.handleClass} !bg-orange-300 ${
          readOnly
            ? "!opacity-0 !pointer-events-none"
            : "!opacity-0 group-hover:!opacity-100 group-hover:!h-3.5 group-hover:!w-3.5"
        }`}
        style={{ top: 0, left: "50%", transform: "translate(-50%, -50%)" }}
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className={`!z-20 !h-2.5 !w-2.5 !border transition-all duration-150 ${theme.handleClass} !bg-orange-300 ${
          readOnly
            ? "!opacity-0 !pointer-events-none"
            : "!opacity-0 group-hover:!opacity-100 group-hover:!h-3.5 group-hover:!w-3.5"
        }`}
        style={{ top: "50%", right: 0, transform: "translate(50%, -50%)" }}
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className={`!z-20 !h-2.5 !w-2.5 !border transition-all duration-150 ${theme.handleClass} !bg-orange-300 ${
          readOnly
            ? "!opacity-0 !pointer-events-none"
            : "!opacity-0 group-hover:!opacity-100 group-hover:!h-3.5 group-hover:!w-3.5"
        }`}
        style={{ bottom: 0, left: "50%", transform: "translate(-50%, 50%)" }}
      />
      <Handle
        id="left"
        type="source"
        position={Position.Left}
        className={`!z-20 !h-2.5 !w-2.5 !border transition-all duration-150 ${theme.handleClass} !bg-orange-300 ${
          readOnly
            ? "!opacity-0 !pointer-events-none"
            : "!opacity-0 group-hover:!opacity-100 group-hover:!h-3.5 group-hover:!w-3.5"
        }`}
        style={{ top: "50%", left: 0, transform: "translate(-50%, -50%)" }}
      />
      {hasNote && (
        <>
          <button
            ref={noteButtonRef}
            type="button"
            className={`absolute right-1 top-1 z-[90] inline-flex items-center justify-center rounded-full border text-slate-900 shadow-sm pointer-events-auto transition-transform duration-150 hover:scale-110 ${
              readOnly
                ? "h-5 w-5 border-amber-700/70 bg-amber-200 text-amber-950"
                : "h-4 w-4 border-amber-200/70 bg-amber-300/85"
            }`}
            aria-label="Abrir nota do bloco"
            title="Abrir nota"
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setIsNoteCardOpen((prev) => !prev);
            }}
          >
            <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <path d="M14 3v6h6" />
              <path d="M8 13h8" />
              <path d="M8 17h5" />
            </svg>
          </button>

          {!isNoteCardOpen && (
            <div className="pointer-events-none absolute right-0 top-6 z-[60] w-60 max-w-[82vw] rounded-sm border border-amber-700/45 bg-amber-200 px-3 py-2 text-[11px] leading-snug text-amber-950 whitespace-pre-wrap break-words opacity-0 shadow-[0_8px_20px_rgba(15,23,42,0.35)] translate-y-1 transition-all duration-150 group-hover:opacity-100 group-hover:translate-y-0">
              <span
                aria-hidden="true"
                className="absolute right-0 top-0 h-3.5 w-3.5 border-b border-l border-amber-700/45 bg-amber-100"
                style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%)" }}
              />
              {notePreview}
            </div>
          )}

          {isNoteCardOpen && (
            <div
              ref={noteCardRef}
              className="absolute right-0 top-6 z-[80] w-72 max-w-[86vw] max-h-72 overflow-y-auto rounded-sm border border-amber-700/45 bg-amber-200 px-3 py-2 text-xs leading-snug text-amber-950 whitespace-pre-wrap break-words shadow-[0_10px_26px_rgba(15,23,42,0.4)]"
            >
              <span
                aria-hidden="true"
                className="absolute right-0 top-0 h-3.5 w-3.5 border-b border-l border-amber-700/45 bg-amber-100"
                style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%)" }}
              />
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  className="inline-flex items-center rounded border border-amber-800/45 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900 hover:bg-amber-50"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsNoteCardOpen(false);
                  }}
                >
                  Fechar
                </button>
              </div>
              {note}
            </div>
          )}
        </>
      )}
      <div
        className={`${shapeNodeClass} relative`}
        style={{ ...mergedNodeStyle, ...(selectedShapeStyle || {}) }}
        data-shape={blockType}
        onClick={readOnly && hasNote ? () => setIsNoteCardOpen(true) : undefined}
      >
        {blockType === "losango" && resolvedBorderWidth > 0 && (
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polygon
              points="50,1 99,50 50,99 1,50"
              fill="none"
              stroke={resolvedBorderColor}
              strokeWidth={resolvedBorderWidth}
              vectorEffect="non-scaling-stroke"
            />
            {selected && (
              <polygon
                points="50,2 98,50 50,98 2,50"
                fill="none"
                stroke={theme.selectedNodeBorder}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
        )}
        <div className={`h-full w-full overflow-hidden leading-relaxed whitespace-pre-wrap break-words ${theme.nodeTextClass}`} style={customTextStyle}>
          {label}
        </div>
      </div>
    </div>
  );
}
