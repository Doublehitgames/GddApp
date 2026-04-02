"use client";

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

export default function DiagramNodeComponent({ data, selected }: NodeProps<DiagramNodeData>) {
  const label = data?.label || "";
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

  return (
    <div className={outerNodeClass} style={outerSelectedGlowStyle}>
      <NodeResizer
        isVisible={selected}
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
        className={`!z-20 !h-2.5 !w-2.5 !border !opacity-0 group-hover:!opacity-100 group-hover:!h-3.5 group-hover:!w-3.5 transition-all duration-150 ${theme.handleClass} !bg-orange-300`}
        style={{ top: 0, left: "50%", transform: "translate(-50%, -50%)" }}
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className={`!z-20 !h-2.5 !w-2.5 !border !opacity-0 group-hover:!opacity-100 group-hover:!h-3.5 group-hover:!w-3.5 transition-all duration-150 ${theme.handleClass} !bg-orange-300`}
        style={{ top: "50%", right: 0, transform: "translate(50%, -50%)" }}
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className={`!z-20 !h-2.5 !w-2.5 !border !opacity-0 group-hover:!opacity-100 group-hover:!h-3.5 group-hover:!w-3.5 transition-all duration-150 ${theme.handleClass} !bg-orange-300`}
        style={{ bottom: 0, left: "50%", transform: "translate(-50%, 50%)" }}
      />
      <Handle
        id="left"
        type="source"
        position={Position.Left}
        className={`!z-20 !h-2.5 !w-2.5 !border !opacity-0 group-hover:!opacity-100 group-hover:!h-3.5 group-hover:!w-3.5 transition-all duration-150 ${theme.handleClass} !bg-orange-300`}
        style={{ top: "50%", left: 0, transform: "translate(-50%, -50%)" }}
      />
      <div className={`${shapeNodeClass} relative`} style={{ ...mergedNodeStyle, ...(selectedShapeStyle || {}) }} data-shape={blockType}>
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
