"use client";

import { useEffect, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { DiagramMarkerType } from "@/store/projectStore";
import { DIAGRAM_NODE_COLOR_PRESETS, normalizeHexColor } from "../flowUtils";
import { DiagramBlockType, DiagramNodeData } from "../diagramTypes";

const BLOCK_DND_MIME = "application/x-gdd-block-type";

type PropertiesSidebarProps = {
  panelClass: string;
  idleHintClass: string;
  nodeSectionClass: string;
  edgeSectionClass: string;
  inputClass: string;
  showNode: boolean;
  showEdge: boolean;
  nodeLabel: string;
  nodeNote: string;
  nodeColor: string;
  nodeTextColor: string;
  nodeTextAlign: DiagramNodeData["textAlign"];
  nodeTextVerticalAlign: DiagramNodeData["textVerticalAlign"];
  nodeFontSize: number;
  nodeBorderColor: string;
  nodeBorderWidth: number;
  nodeBorderRadius: number;
  nodeGradientEnabled: boolean;
  nodeWidth: number;
  nodeHeight: number;
  nodeBlockType: DiagramBlockType;
  edgeLabel: string;
  edgeType: "straight" | "step" | "smoothstep" | "bezier";
  edgeStrokeWidth: number;
  edgeDashed: boolean;
  edgeDashLength: number;
  edgeDashGap: number;
  edgeAnimated: boolean;
  startMarker: DiagramMarkerType;
  endMarker: DiagramMarkerType;
  onNodeLabelChange: (label: string) => void;
  onNodeNoteChange: (note: string) => void;
  onNodeColorChange: (color: string) => void;
  onNodeTextColorChange: (color: string) => void;
  onNodeTextAlignChange: (align: NonNullable<DiagramNodeData["textAlign"]>) => void;
  onNodeTextVerticalAlignChange: (align: NonNullable<DiagramNodeData["textVerticalAlign"]>) => void;
  onNodeFontSizeChange: (size: number) => void;
  onNodeBorderColorChange: (color: string) => void;
  onNodeBorderWidthChange: (width: number) => void;
  onNodeBorderRadiusChange: (radius: number) => void;
  onNodeGradientEnabledChange: (enabled: boolean) => void;
  onNodeWidthChange: (width: number) => void;
  onNodeHeightChange: (height: number) => void;
  onNodeBlockTypeChange: (blockType: DiagramBlockType) => void;
  onEdgeLabelChange: (label: string) => void;
  onEdgeTypeChange: (edgeType: "straight" | "step" | "smoothstep" | "bezier") => void;
  onEdgeStrokeWidthChange: (strokeWidth: number) => void;
  onEdgeDashedChange: (dashed: boolean) => void;
  onEdgeDashLengthChange: (dashLength: number) => void;
  onEdgeDashGapChange: (dashGap: number) => void;
  onEdgeAnimatedChange: (animated: boolean) => void;
  onEdgeStartMarkerChange: (marker: DiagramMarkerType) => void;
  onEdgeEndMarkerChange: (marker: DiagramMarkerType) => void;
};

type ColorPaletteControlProps = {
  activeColor: string;
  onChange: (value: string) => void;
  inputClass: string;
  allowThemeReset?: boolean;
};

type NumberInputFieldProps = {
  value: number;
  min?: number;
  max?: number;
  className: string;
  onCommit: (value: number) => void;
  disabled?: boolean;
};

function NumberInputField({ value, min, max, className, onCommit, disabled = false }: NumberInputFieldProps) {
  const [draft, setDraft] = useState(String(value));
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) setDraft(String(value));
  }, [value, isEditing]);

  const commit = () => {
    let next = Number(draft);
    if (!Number.isFinite(next)) next = value;
    if (typeof min === "number") next = Math.max(min, next);
    if (typeof max === "number") next = Math.min(max, next);
    onCommit(next);
    setDraft(String(next));
  };

  return (
    <input
      type="number"
      min={min}
      max={max}
      className={className}
      value={draft}
      disabled={disabled}
      onFocus={(e) => {
        setIsEditing(true);
        e.currentTarget.select();
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setIsEditing(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
    />
  );
}

function ColorPaletteControl({
  activeColor,
  onChange,
  inputClass,
  allowThemeReset = false,
}: ColorPaletteControlProps) {
  const normalizedActiveColor = normalizeHexColor(activeColor) || "#0ea5e9";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {DIAGRAM_NODE_COLOR_PRESETS.map((presetColor) => {
          const isActive = activeColor === presetColor;
          return (
            <button
              key={presetColor}
              type="button"
              aria-label={`Selecionar cor ${presetColor}`}
              onClick={() => onChange(presetColor)}
              className={`h-6 w-6 rounded-full border transition ${isActive ? "scale-110 border-white shadow-md shadow-black/35" : "border-white/35 hover:scale-105"}`}
              style={{ backgroundColor: presetColor }}
            />
          );
        })}
        {allowThemeReset && (
          <button
            type="button"
            onClick={() => onChange("")}
            className={`h-6 px-2 rounded-md border text-xs transition ${!activeColor ? "border-white/70 text-white bg-white/10" : "border-white/25 text-white/80 hover:border-white/45"}`}
          >
            Tema
          </button>
        )}
      </div>
      <div className="rounded-lg border border-white/15 bg-black/20 p-2">
        <div className="overflow-hidden rounded-md">
          <HexColorPicker
            color={normalizedActiveColor}
            onChange={(nextColor) => onChange(nextColor)}
            style={{ width: "100%", height: 160 }}
          />
        </div>
        <input
          type="text"
          className={`${inputClass} mt-2`}
          value={activeColor}
          placeholder="#0ea5e9"
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

export default function PropertiesSidebar({
  panelClass,
  idleHintClass,
  nodeSectionClass,
  edgeSectionClass,
  inputClass,
  showNode,
  showEdge,
  nodeLabel,
  nodeNote,
  nodeColor,
  nodeTextColor,
  nodeTextAlign,
  nodeTextVerticalAlign,
  nodeFontSize,
  nodeBorderColor,
  nodeBorderWidth,
  nodeBorderRadius,
  nodeGradientEnabled,
  nodeWidth,
  nodeHeight,
  nodeBlockType,
  edgeLabel,
  edgeType,
  edgeStrokeWidth,
  edgeDashed,
  edgeDashLength,
  edgeDashGap,
  edgeAnimated,
  startMarker,
  endMarker,
  onNodeLabelChange,
  onNodeNoteChange,
  onNodeColorChange,
  onNodeTextColorChange,
  onNodeTextAlignChange,
  onNodeTextVerticalAlignChange,
  onNodeFontSizeChange,
  onNodeBorderColorChange,
  onNodeBorderWidthChange,
  onNodeBorderRadiusChange,
  onNodeGradientEnabledChange,
  onNodeWidthChange,
  onNodeHeightChange,
  onNodeBlockTypeChange,
  onEdgeLabelChange,
  onEdgeTypeChange,
  onEdgeStrokeWidthChange,
  onEdgeDashedChange,
  onEdgeDashLengthChange,
  onEdgeDashGapChange,
  onEdgeAnimatedChange,
  onEdgeStartMarkerChange,
  onEdgeEndMarkerChange,
}: PropertiesSidebarProps) {
  const alignOptions: Array<{ value: NonNullable<DiagramNodeData["textAlign"]>; label: string }> = [
    { value: "left", label: "Esquerda" },
    { value: "center", label: "Centro" },
    { value: "right", label: "Direita" },
  ];
  const verticalAlignOptions: Array<{ value: NonNullable<DiagramNodeData["textVerticalAlign"]>; label: string }> = [
    { value: "top", label: "Cima" },
    { value: "middle", label: "Meio" },
    { value: "bottom", label: "Baixo" },
  ];
  const [openSection, setOpenSection] = useState<null | "text" | "note" | "border" | "layout">(null);
  const blockLibrary: Array<{ type: DiagramBlockType; label: string }> = [
    { type: "retangulo", label: "Retangulo" },
    { type: "losango", label: "Losango" },
    { type: "pill", label: "Pill" },
    { type: "circulo", label: "Circulo" },
  ];

  const renderBlockTypeIcon = (type: DiagramBlockType) => {
    const baseShapeClass = "border border-white/70 bg-white/15";
    if (type === "losango") {
      return <span className={`h-12 w-12 rotate-45 rounded-[4px] ${baseShapeClass}`} aria-hidden="true" />;
    }
    if (type === "pill") {
      return <span className={`h-10 w-16 rounded-full ${baseShapeClass}`} aria-hidden="true" />;
    }
    if (type === "circulo") {
      return <span className={`h-12 w-12 rounded-full ${baseShapeClass}`} aria-hidden="true" />;
    }
    return <span className={`h-12 w-16 rounded-lg ${baseShapeClass}`} aria-hidden="true" />;
  };

  return (
    <aside className={panelClass}>
      <h2 className="text-lg font-semibold mb-3 text-slate-100">Propriedades</h2>
      {!showNode && !showEdge && (
        <div className={`${idleHintClass} space-y-3`}>
          <p className="text-sm font-semibold text-slate-100 text-center">Biblioteca de blocos</p>
          <div className="grid grid-cols-2 gap-2">
            {blockLibrary.map((item) => (
              <div
                key={item.type}
                draggable
                aria-label={`Arrastar bloco ${item.label}`}
                onDragStart={(event) => {
                  event.dataTransfer.setData(BLOCK_DND_MIME, item.type);
                  event.dataTransfer.setData("text/plain", item.type);
                  event.dataTransfer.effectAllowed = "copy";
                }}
                className="cursor-grab active:cursor-grabbing rounded-lg border border-transparent bg-transparent px-3 py-2 flex items-center justify-center"
              >
                {renderBlockTypeIcon(item.type)}
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 text-center">Arraste um tipo e solte no palco.</p>
        </div>
      )}

      {showNode && (
        <div className={nodeSectionClass}>
          <p className="text-xs uppercase tracking-wide text-cyan-200">Bloco</p>
          <label className="block text-sm text-slate-300">
            Tipo do bloco
            <select
              className={inputClass}
              value={nodeBlockType}
              onChange={(e) => onNodeBlockTypeChange(e.target.value as DiagramBlockType)}
            >
              <option value="retangulo">Retangulo</option>
              <option value="losango">Losango</option>
              <option value="pill">Pill</option>
              <option value="circulo">Circulo</option>
            </select>
          </label>
          <div className="rounded-lg border border-white/10 bg-black/10 p-2">
            <button
              type="button"
              onClick={() => setOpenSection((prev) => (prev === "text" ? null : "text"))}
              className="w-full text-left text-sm font-semibold text-slate-100"
            >
              Texto
            </button>
            {openSection === "text" && (
              <div className="mt-3 space-y-3">
                <label className="block text-sm text-slate-300">
                  Texto do bloco
                  <textarea
                    className={`${inputClass} min-h-[110px]`}
                    value={nodeLabel}
                    onChange={(e) => onNodeLabelChange(e.target.value)}
                  />
                </label>
                <label className="text-sm text-slate-300">
                  Tamanho da fonte
                  <NumberInputField
                    min={10}
                    max={42}
                    value={nodeFontSize}
                    className={inputClass}
                    onCommit={onNodeFontSizeChange}
                  />
                </label>
                <label className="text-sm text-slate-300">
                  Alinhamento horizontal
                  <div className="mt-1 flex items-center gap-1 rounded-lg border border-white/10 bg-black/15 p-1">
                    {alignOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => onNodeTextAlignChange(option.value)}
                        className={`flex-1 rounded-md px-2 py-1 text-xs transition ${
                          nodeTextAlign === option.value ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </label>
                <label className="text-sm text-slate-300">
                  Alinhamento vertical
                  <div className="mt-1 flex items-center gap-1 rounded-lg border border-white/10 bg-black/15 p-1">
                    {verticalAlignOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => onNodeTextVerticalAlignChange(option.value)}
                        className={`flex-1 rounded-md px-2 py-1 text-xs transition ${
                          nodeTextVerticalAlign === option.value ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </label>
                <div className="block text-sm text-slate-300">
                  <p className="mb-1">Cor da fonte</p>
                  <ColorPaletteControl activeColor={nodeTextColor} onChange={onNodeTextColorChange} inputClass={inputClass} />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-white/10 bg-black/10 p-2">
            <button
              type="button"
              onClick={() => setOpenSection((prev) => (prev === "note" ? null : "note"))}
              className="w-full text-left text-sm font-semibold text-slate-100"
            >
              Note
            </button>
            {openSection === "note" && (
              <div className="mt-3 space-y-3">
                <label className="block text-sm text-slate-300">
                  Nota do bloco (opcional)
                  <textarea
                    className={`${inputClass} min-h-[120px]`}
                    value={nodeNote}
                    onChange={(e) => onNodeNoteChange(e.target.value)}
                  />
                  <span className="mt-1 block text-xs text-slate-400">Nao aparece dentro do bloco.</span>
                </label>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-white/10 bg-black/10 p-2">
            <button
              type="button"
              onClick={() => setOpenSection((prev) => (prev === "border" ? null : "border"))}
              className="w-full text-left text-sm font-semibold text-slate-100"
            >
              Borda
            </button>
            {openSection === "border" && (
              <div className="mt-3 space-y-3">
                <div className="block text-sm text-slate-300">
                  <p className="mb-1">Cor da borda</p>
                  <ColorPaletteControl activeColor={nodeBorderColor} onChange={onNodeBorderColorChange} inputClass={inputClass} />
                </div>
                <label className="text-sm text-slate-300 block">
                  Espessura da borda
                  <NumberInputField
                    min={0}
                    max={8}
                    value={nodeBorderWidth}
                    className={inputClass}
                    onCommit={onNodeBorderWidthChange}
                  />
                </label>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-white/10 bg-black/10 p-2">
            <button
              type="button"
              onClick={() => setOpenSection((prev) => (prev === "layout" ? null : "layout"))}
              className="w-full text-left text-sm font-semibold text-slate-100"
            >
              Layout
            </button>
            {openSection === "layout" && (
              <div className="mt-3 space-y-3">
                <div className="text-sm text-slate-300">
                  <p className="mb-1">Cor de fundo</p>
                  <ColorPaletteControl
                    activeColor={nodeColor}
                    onChange={onNodeColorChange}
                    inputClass={inputClass}
                    allowThemeReset
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-sm text-slate-300">
                    Gradiente
                    <div className="mt-1 flex items-center gap-1 rounded-lg border border-white/10 bg-black/15 p-1">
                      <button
                        type="button"
                        onClick={() => onNodeGradientEnabledChange(true)}
                        className={`flex-1 rounded-md px-2 py-1 text-xs transition ${
                          nodeGradientEnabled ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10"
                        }`}
                      >
                        Ligado
                      </button>
                      <button
                        type="button"
                        onClick={() => onNodeGradientEnabledChange(false)}
                        className={`flex-1 rounded-md px-2 py-1 text-xs transition ${
                          !nodeGradientEnabled ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10"
                        }`}
                      >
                        Desligado
                      </button>
                    </div>
                  </label>
                  <div />
                  <label className="text-sm text-slate-300">
                    Chanfro da borda
                    <NumberInputField
                      min={0}
                      max={40}
                      value={nodeBorderRadius}
                      className={inputClass}
                      onCommit={onNodeBorderRadiusChange}
                    />
                  </label>
                  <div />
                  <label className="text-sm text-slate-300">
                    Largura
                    <NumberInputField
                      min={120}
                      value={nodeWidth}
                      className={inputClass}
                      onCommit={onNodeWidthChange}
                    />
                  </label>
                  <label className="text-sm text-slate-300">
                    Altura
                    <NumberInputField
                      min={40}
                      value={nodeHeight}
                      className={inputClass}
                      onCommit={onNodeHeightChange}
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showEdge && (
        <div className={edgeSectionClass}>
          <p className="text-xs uppercase tracking-wide text-violet-200">Conexao</p>
          <label className="block text-sm text-slate-300">
            Tipo da conexao
            <select
              className={inputClass}
              value={edgeType}
              onChange={(e) => onEdgeTypeChange(e.target.value as "straight" | "step" | "smoothstep" | "bezier")}
            >
              <option value="straight">Straight</option>
              <option value="step">Step</option>
              <option value="smoothstep">Smoothstep</option>
              <option value="bezier">Bezier</option>
            </select>
          </label>
          <label className="block text-sm text-slate-300">
            Espessura da linha
            <NumberInputField
              min={1}
              max={10}
              value={edgeStrokeWidth}
              className={inputClass}
              onCommit={onEdgeStrokeWidthChange}
            />
          </label>
          <label className="block text-sm text-slate-300">
            Tracejado
            <div className="mt-1 flex items-center gap-1 rounded-lg border border-white/10 bg-black/15 p-1">
              <button
                type="button"
                onClick={() => onEdgeDashedChange(true)}
                className={`flex-1 rounded-md px-2 py-1 text-xs transition ${
                  edgeDashed ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10"
                }`}
              >
                Ligado
              </button>
              <button
                type="button"
                onClick={() => onEdgeDashedChange(false)}
                className={`flex-1 rounded-md px-2 py-1 text-xs transition ${
                  !edgeDashed ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10"
                }`}
              >
                Desligado
              </button>
            </div>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm text-slate-300">
              Tamanho do traço
              <NumberInputField
                min={1}
                max={40}
                value={edgeDashLength}
                className={`${inputClass} ${!edgeDashed ? "opacity-45 cursor-not-allowed" : ""}`}
                onCommit={onEdgeDashLengthChange}
                disabled={!edgeDashed}
              />
            </label>
            <label className="text-sm text-slate-300">
              Distância do traço
              <NumberInputField
                min={1}
                max={40}
                value={edgeDashGap}
                className={`${inputClass} ${!edgeDashed ? "opacity-45 cursor-not-allowed" : ""}`}
                onCommit={onEdgeDashGapChange}
                disabled={!edgeDashed}
              />
            </label>
          </div>
          <label className="block text-sm text-slate-300">
            Tracejado animado
            <div className="mt-1 flex items-center gap-1 rounded-lg border border-white/10 bg-black/15 p-1">
              <button
                type="button"
                onClick={() => onEdgeAnimatedChange(true)}
                className={`flex-1 rounded-md px-2 py-1 text-xs transition ${
                  edgeAnimated ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10"
                }`}
                disabled={!edgeDashed}
              >
                Ligado
              </button>
              <button
                type="button"
                onClick={() => onEdgeAnimatedChange(false)}
                className={`flex-1 rounded-md px-2 py-1 text-xs transition ${
                  !edgeAnimated ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10"
                }`}
              >
                Desligado
              </button>
            </div>
          </label>
          <label className="block text-sm text-slate-300">
            Label da conexao
            <input className={inputClass} value={edgeLabel} onChange={(e) => onEdgeLabelChange(e.target.value)} />
          </label>
          <label className="block text-sm text-slate-300">
            Marcador de entrada
            <select
              className={inputClass}
              value={startMarker}
              onChange={(e) => onEdgeStartMarkerChange(e.target.value as DiagramMarkerType)}
            >
              <option value="none">Sem marcador</option>
              <option value="arrow">Seta</option>
              <option value="circle">Bolinha</option>
            </select>
          </label>
          <label className="block text-sm text-slate-300">
            Marcador de saida
            <select
              className={inputClass}
              value={endMarker}
              onChange={(e) => onEdgeEndMarkerChange(e.target.value as DiagramMarkerType)}
            >
              <option value="none">Sem marcador</option>
              <option value="arrow">Seta</option>
              <option value="circle">Bolinha</option>
            </select>
          </label>
        </div>
      )}
    </aside>
  );
}
