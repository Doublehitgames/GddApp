"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  ExportSchemaNode,
  ExportSchemaBinding,
  SectionAddon,
  DataSchemaAddonDraft,
  ProgressionTableAddonDraft,
} from "@/lib/addons/types";
import {
  CommitNumberInput,
  CommitOptionalNumberInput,
  CommitTextInput,
} from "@/components/common/CommitInput";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ── CSS constant strings ───────────────────────────────────────────

export const SHELL = "rounded-2xl border border-gray-700/80 bg-gray-900/70 p-4 md:p-5";
export const BLOCK = "rounded-xl border border-gray-700/80 bg-gray-800/70 p-3";
export const INPUT =
  "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-gray-500";
export const SELECT =
  "rounded-lg border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm text-white outline-none focus:border-gray-500";
export const BTN = "rounded-lg border border-gray-600 bg-gray-800 px-2.5 py-1 text-xs text-gray-100 hover:bg-gray-700";
export const BTN_DANGER =
  "rounded-lg border border-rose-700/60 bg-rose-900/30 px-2.5 py-1 text-xs text-rose-200 hover:bg-rose-900/50";
export const BTN_PRIMARY =
  "rounded-lg border border-indigo-600 bg-indigo-700 px-3 py-1.5 text-xs text-white hover:bg-indigo-600";

/** Consistent compact field style used inside the schema tree (inputs + selects). */
const FIELD =
  "rounded-md border border-gray-600 bg-gray-900 px-2 py-1 text-xs text-white outline-none focus:border-gray-500";

// ── uid helper ─────────────────────────────────────────────────────

export function uid(): string {
  return `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ── Collapse-all broadcaster context ───────────────────────────────

/**
 * When the version number changes, every SchemaNodeEditor watching this
 * context sets its collapsed state to match `target`. Used by the "Expand all"
 * / "Collapse all" buttons at the top of the tree editor.
 */
export type CollapseBroadcast = { version: number; target: "expand" | "collapse" };
export const CollapseBroadcastContext = createContext<CollapseBroadcast | null>(null);

// ── Inline value-preview context ───────────────────────────────────

/**
 * Provides a map of nodeId → resolved value so leaf nodes in the editor
 * can display a small inline preview of what the binding produces.
 * The map is computed once at the panel level via `resolveExportSchemaWithPreview`.
 */
export const NodeValuePreviewContext = createContext<Map<string, unknown> | null>(null);

function formatPreviewValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    if (!value) return '""';
    const trimmed = value.length > 24 ? `${value.slice(0, 24)}…` : value;
    return `"${trimmed}"`;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.length}]`;
  if (typeof value === "object") return "{…}";
  return String(value);
}

function NodeValuePreview({ nodeId }: { nodeId: string }) {
  const map = useContext(NodeValuePreviewContext);
  if (!map || !map.has(nodeId)) return null;
  const raw = map.get(nodeId);
  const formatted = formatPreviewValue(raw);
  if (formatted === null) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-gray-700/60 bg-gray-900/40 px-1.5 py-0.5 text-[10px] font-mono text-emerald-300/90"
      title="Valor resolvido (primeira iteração se for array)"
    >
      <span className="text-gray-500">→</span>
      <span className="max-w-[180px] truncate">{formatted}</span>
    </span>
  );
}

// ── Icons ──────────────────────────────────────────────────────────

/** Builds a fresh node with sensible defaults per type. Caller assigns the key. */
export function makeNewNode(type: "value" | "object" | "array" = "value"): ExportSchemaNode {
  const base: ExportSchemaNode = { id: uid(), key: "newProperty", nodeType: type };
  if (type === "value") base.binding = { source: "manual", value: "", valueType: "string" };
  if (type === "object") base.children = [];
  if (type === "array") base.itemTemplate = [];
  return base;
}

export function AddNodeButton({
  label,
  title,
  onAdd,
}: {
  /** Text shown on the button (e.g. `em "recipes"`, `na raiz`). */
  label: ReactNode;
  title: string;
  onAdd: (type: "value" | "object" | "array") => void;
}) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (popoverRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const pick = (type: "value" | "object" | "array") => {
    onAdd(type);
    setOpen(false);
  };

  return (
    <div ref={popoverRef} className="relative inline-block">
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-emerald-600/50 bg-emerald-900/10 px-2.5 py-1 text-[11px] text-gray-300 hover:border-emerald-500 hover:bg-emerald-900/20 hover:text-gray-100"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        title={title}
      >
        <AddIcon />
        {label}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-md border border-gray-700 bg-gray-950/95 text-xs text-gray-200 shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-gray-800"
            onClick={() => pick("value")}
          >
            <span className="font-mono text-gray-400 w-10">value</span>
            <span className="text-[10px] text-gray-500">campo simples</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-gray-800"
            onClick={() => pick("object")}
          >
            <span className="font-mono text-gray-400 w-10">object</span>
            <span className="text-[10px] text-gray-500">agrupa filhos</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-gray-800"
            onClick={() => pick("array")}
          >
            <span className="font-mono text-gray-400 w-10">array</span>
            <span className="text-[10px] text-gray-500">lista iterável</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function AddIcon() {
  return (
    <span
      className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"
      aria-hidden="true"
    >
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M6 1v10M1 6h10" />
      </svg>
    </span>
  );
}

// ── Numeric-binding predicate ──────────────────────────────────────

/**
 * True when the binding is expected to produce a numeric value.
 * Used to hide `abs` / `×multiplier` controls (XFORM pill) for string/boolean bindings.
 */
export function isNumericBinding(
  binding: ExportSchemaBinding | undefined,
  sectionAddons: SectionAddon[]
): boolean {
  if (!binding) return false;
  if (binding.source === "manual") return binding.valueType === "number";
  if (binding.source === "rowLevel" || binding.source === "rowColumn") return true;
  if (binding.source === "dataSchema") {
    for (const a of sectionAddons) {
      if ((a.type !== "dataSchema" && a.type !== "genericStats") || a.id !== binding.addonId) continue;
      const data = a.data as DataSchemaAddonDraft;
      const entry = binding.entryId
        ? data.entries.find((e) => e.id === binding.entryId)
        : data.entries.find((e) => e.key === binding.entryKey);
      if (!entry) return false;
      return entry.valueType === "int" || entry.valueType === "float" ||
             entry.valueType === "seconds" || entry.valueType === "percent";
    }
    return false;
  }
  if (binding.source === "entryField") {
    return binding.field === "order" || binding.field === "unlockLevel" ||
           binding.field === "unlockCurrencyAmount" || binding.field === "unlockItemQuantity";
  }
  if (binding.source === "productionField") {
    return binding.field === "craftTimeSeconds" || binding.field === "minOutput" ||
           binding.field === "maxOutput" || binding.field === "intervalSeconds" ||
           binding.field === "capacity";
  }
  if (binding.source === "itemField") return binding.field === "quantity";
  return false;
}

// ── Broken-ref detection ───────────────────────────────────────────

/**
 * Returns a warning message if the node has a binding or arraySource pointing
 * to an addon/entry that doesn't exist in scope, otherwise null.
 */
export function getBindingIssue(
  node: ExportSchemaNode,
  sectionAddons: SectionAddon[]
): string | null {
  // Array source: check addonId resolves (only for sources that carry an addonId)
  if (node.nodeType === "array" && node.arraySource) {
    const src = node.arraySource;
    if (src.type === "progressionTable") {
      const found = sectionAddons.some(
        (a) => a.type === "progressionTable" && (a.id === src.addonId || a.data?.id === src.addonId)
      );
      if (!found) return "Tabela de Balanceamento referenciada não foi encontrada";
    } else if (src.type === "craftTable") {
      const found = sectionAddons.some(
        (a) => a.type === "craftTable" && (a.id === src.addonId || a.data?.id === src.addonId)
      );
      if (!found) return "Craft Table referenciada não foi encontrada";
    }
    // productionIngredients/productionOutputs are context-dependent; no static ref to break
  }

  const binding = node.binding;
  if (!binding) return null;

  if (binding.source === "dataSchema") {
    if (!binding.addonId && !binding.addonName) return "Binding sem referência a um Data Schema";
    const found = sectionAddons.find(
      (a) =>
        (a.type === "dataSchema" || a.type === "genericStats") &&
        (a.id === binding.addonId || a.data?.id === binding.addonId || a.name === binding.addonName)
    );
    if (!found) return "Data Schema referenciado não foi encontrado";
    const entries = (found.data as DataSchemaAddonDraft).entries || [];
    const entry = binding.entryId
      ? entries.find((e) => e.id === binding.entryId)
      : entries.find((e) => e.key === binding.entryKey);
    if (!entry) return `Campo "${binding.entryKey}" não existe no Data Schema`;
  }

  // rowColumn/rowLevel/entryField/productionField/itemField are context-dependent —
  // they don't have a static ref to validate here.
  return null;
}

// ── Source color accents ───────────────────────────────────────────

/**
 * Tailwind class for the left-border color of a binding row, keyed by source.
 * Gives the user a visual hint of "where does this value come from".
 */
function bindingAccentClass(source?: ExportSchemaBinding["source"]): string {
  switch (source) {
    case "manual":
      return "border-gray-600";
    case "dataSchema":
      return "border-emerald-500/70";
    case "rowLevel":
    case "rowColumn":
      return "border-sky-500/70";
    case "entryField":
      return "border-indigo-500/70";
    case "productionField":
      return "border-violet-500/70";
    case "itemField":
      return "border-amber-500/70";
    default:
      return "border-gray-700";
  }
}

// ── Sortable primitives (dnd-kit) ──────────────────────────────────

function SortableNodeRow({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const stableTransform = transform ? { ...transform, scaleX: 1, scaleY: 1 } : null;
  const style = {
    transform: CSS.Transform.toString(stableTransform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <div
        onPointerDown={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest("[data-drag-handle]")) {
            listeners?.onPointerDown?.(event);
          }
        }}
        onKeyDown={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest("[data-drag-handle]")) {
            listeners?.onKeyDown?.(event);
          }
        }}
        {...attributes}
      >
        {children}
      </div>
    </div>
  );
}

export function NodeDragHandle({ label = "Arrastar" }: { label?: string }) {
  return (
    <span
      className="inline-flex cursor-grab items-center text-gray-500 hover:text-gray-300 active:cursor-grabbing flex-shrink-0"
      data-drag-handle
      onClick={(event) => event.stopPropagation()}
      aria-label={label}
      title={label}
    >
      <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <circle cx="6" cy="5" r="1.5" />
        <circle cx="6" cy="10" r="1.5" />
        <circle cx="6" cy="15" r="1.5" />
        <circle cx="12" cy="5" r="1.5" />
        <circle cx="12" cy="10" r="1.5" />
        <circle cx="12" cy="15" r="1.5" />
      </svg>
    </span>
  );
}

/**
 * Reusable wrapper that makes a list of schema nodes sortable by drag.
 * Each child must render a <SortableNodeRow id={node.id}> wrapping the node UI —
 * or use `renderItem` which does that automatically.
 */
export function SortableNodeList({
  nodes,
  onReorder,
  renderItem,
  readOnly,
}: {
  nodes: ExportSchemaNode[];
  onReorder: (next: ExportSchemaNode[]) => void;
  renderItem: (node: ExportSchemaNode, index: number) => ReactNode;
  readOnly?: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (readOnly) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = nodes.findIndex((n) => n.id === String(active.id));
    const newIndex = nodes.findIndex((n) => n.id === String(over.id));
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
    onReorder(arrayMove(nodes, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={nodes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
        {nodes.map((node, index) => (
          <SortableNodeRow key={node.id} id={node.id}>
            {renderItem(node, index)}
          </SortableNodeRow>
        ))}
      </SortableContext>
    </DndContext>
  );
}

// ── helpers to find sibling addons ─────────────────────────────────

export function getDataSchemaAddons(addons: SectionAddon[]): Array<{ id: string; name: string; data: DataSchemaAddonDraft }> {
  return addons
    .filter((a) => a.type === "dataSchema" || a.type === "genericStats")
    .map((a) => ({ id: a.id, name: a.name, data: a.data as DataSchemaAddonDraft }));
}

export function getProgressionTableAddons(addons: SectionAddon[]): Array<{ id: string; name: string; data: ProgressionTableAddonDraft }> {
  return addons
    .filter((a) => a.type === "progressionTable")
    .map((a) => ({ id: a.id, name: a.name, data: a.data as ProgressionTableAddonDraft }));
}

export function getCraftTableAddons(
  addons: SectionAddon[]
): Array<{ id: string; name: string }> {
  return addons
    .filter((a) => a.type === "craftTable")
    .map((a) => ({ id: a.id, name: a.name }));
}

// ── immutable tree helpers ─────────────────────────────────────────

export function updateNodeInList(nodes: ExportSchemaNode[], nodeId: string, updater: (n: ExportSchemaNode) => ExportSchemaNode): ExportSchemaNode[] {
  return nodes.map((n) => {
    if (n.id === nodeId) return updater(n);
    if (n.children) return { ...n, children: updateNodeInList(n.children, nodeId, updater) };
    if (n.itemTemplate) return { ...n, itemTemplate: updateNodeInList(n.itemTemplate, nodeId, updater) };
    return n;
  });
}

export function removeNodeFromList(nodes: ExportSchemaNode[], nodeId: string): ExportSchemaNode[] {
  return nodes
    .filter((n) => n.id !== nodeId)
    .map((n) => {
      if (n.children) return { ...n, children: removeNodeFromList(n.children, nodeId) };
      if (n.itemTemplate) return { ...n, itemTemplate: removeNodeFromList(n.itemTemplate, nodeId) };
      return n;
    });
}

export function addChildToNode(nodes: ExportSchemaNode[], parentId: string, child: ExportSchemaNode, isTemplate: boolean): ExportSchemaNode[] {
  return nodes.map((n) => {
    if (n.id === parentId) {
      if (isTemplate) return { ...n, itemTemplate: [...(n.itemTemplate ?? []), child] };
      return { ...n, children: [...(n.children ?? []), child] };
    }
    if (n.children) return { ...n, children: addChildToNode(n.children, parentId, child, isTemplate) };
    if (n.itemTemplate) return { ...n, itemTemplate: addChildToNode(n.itemTemplate, parentId, child, isTemplate) };
    return n;
  });
}

/** Deep-clone a node tree, regenerating every id so the clone can coexist with the original. */
export function cloneNodeWithNewIds(node: ExportSchemaNode): ExportSchemaNode {
  const clone: ExportSchemaNode = { ...node, id: uid() };
  if (node.children) clone.children = node.children.map(cloneNodeWithNewIds);
  if (node.itemTemplate) clone.itemTemplate = node.itemTemplate.map(cloneNodeWithNewIds);
  // binding/arraySource are plain objects with no ids — shallow copy is fine for safety
  if (node.binding) clone.binding = { ...node.binding };
  if (node.arraySource) clone.arraySource = { ...node.arraySource } as typeof node.arraySource;
  return clone;
}

/** Returns a new list with a deep-cloned copy of the given node inserted right after it. */
export function duplicateInList(nodes: ExportSchemaNode[], nodeId: string): ExportSchemaNode[] {
  const idx = nodes.findIndex((n) => n.id === nodeId);
  if (idx < 0) return nodes;
  const copy = cloneNodeWithNewIds(nodes[idx]);
  return [...nodes.slice(0, idx + 1), copy, ...nodes.slice(idx + 1)];
}

// ── Binding Editor ─────────────────────────────────────────────────

export type ArraySourceKind = "progressionTable" | "craftTable" | "productionIngredients" | "productionOutputs";

export function BindingEditor({
  binding,
  onChange,
  sectionAddons,
  insideArray,
  arraySourceAddonId,
  arraySourceType,
  inCraftEntry,
  readOnly,
}: {
  binding?: ExportSchemaBinding;
  onChange: (b: ExportSchemaBinding) => void;
  sectionAddons: SectionAddon[];
  insideArray: boolean;
  arraySourceAddonId?: string;
  arraySourceType?: ArraySourceKind;
  /** True when any ancestor iteration is a craftTable (entry + currentProduction are in scope). */
  inCraftEntry?: boolean;
  readOnly?: boolean;
}) {
  const source = binding?.source ?? "manual";
  const dataSchemas = useMemo(() => getDataSchemaAddons(sectionAddons), [sectionAddons]);
  const progressionTables = useMemo(() => getProgressionTableAddons(sectionAddons), [sectionAddons]);
  const insideCraftArray = insideArray && arraySourceType === "craftTable";
  const insideProgressionArray = insideArray && (arraySourceType ?? "progressionTable") === "progressionTable";
  const insideProductionItemsArray = insideArray && (arraySourceType === "productionIngredients" || arraySourceType === "productionOutputs");

  const currentPT = useMemo(
    () => (arraySourceAddonId ? progressionTables.find((pt) => pt.id === arraySourceAddonId) : undefined),
    [progressionTables, arraySourceAddonId]
  );

  const handleSourceChange = (newSource: string) => {
    if (readOnly) return;
    if (newSource === "manual") onChange({ source: "manual", value: "", valueType: "string" });
    else if (newSource === "dataSchema") {
      const first = dataSchemas[0];
      const firstEntry = first?.data.entries[0];
      onChange({ source: "dataSchema", addonId: first?.id ?? "", addonName: first?.name, entryKey: firstEntry?.key ?? "", entryId: firstEntry?.id });
    } else if (newSource === "rowLevel") onChange({ source: "rowLevel" });
    else if (newSource === "rowColumn") {
      const firstCol = currentPT?.data.columns[0];
      onChange({ source: "rowColumn", columnId: firstCol?.id ?? "" });
    } else if (newSource === "entryField") {
      onChange({ source: "entryField", field: "productionRef" });
    } else if (newSource === "productionField") {
      onChange({ source: "productionField", field: "name" });
    } else if (newSource === "itemField") {
      onChange({ source: "itemField", field: "itemRef" });
    }
  };

  const productionScalarFields: Array<{ value: "name" | "mode" | "craftTimeSeconds" | "minOutput" | "maxOutput" | "intervalSeconds" | "capacity" | "requiresCollection" | "outputRef"; label: string }> = [
    { value: "name", label: "name" },
    { value: "mode", label: "mode" },
    { value: "craftTimeSeconds", label: "craftTimeSeconds" },
    { value: "minOutput", label: "minOutput" },
    { value: "maxOutput", label: "maxOutput" },
    { value: "intervalSeconds", label: "intervalSeconds" },
    { value: "capacity", label: "capacity" },
    { value: "requiresCollection", label: "requiresCollection" },
    { value: "outputRef", label: "outputRef (dataId)" },
  ];

  const craftTableEntryFields: Array<{ value: "order" | "productionRef" | "category" | "hidden" | "unlockLevelEnabled" | "unlockLevel" | "unlockLevelXpRef" | "unlockCurrencyEnabled" | "unlockCurrencyAmount" | "unlockCurrencyRef" | "unlockItemEnabled" | "unlockItemQuantity" | "unlockItemRef"; label: string }> = [
    { value: "productionRef", label: "productionRef (dataId)" },
    { value: "category", label: "category" },
    { value: "order", label: "order" },
    { value: "hidden", label: "hidden" },
    { value: "unlockLevelEnabled", label: "unlock.level.enabled" },
    { value: "unlockLevel", label: "unlock.level.level" },
    { value: "unlockLevelXpRef", label: "unlock.level.xpAddonRef (dataId)" },
    { value: "unlockCurrencyEnabled", label: "unlock.currency.enabled" },
    { value: "unlockCurrencyAmount", label: "unlock.currency.amount" },
    { value: "unlockCurrencyRef", label: "unlock.currency.currencyAddonRef (dataId)" },
    { value: "unlockItemEnabled", label: "unlock.item.enabled" },
    { value: "unlockItemQuantity", label: "unlock.item.quantity" },
    { value: "unlockItemRef", label: "unlock.item.itemRef (dataId)" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className={FIELD} value={source} onChange={(e) => handleSourceChange(e.target.value)} disabled={readOnly}>
        <option value="manual">Manual</option>
        <option value="dataSchema">Data Schema</option>
        {insideProgressionArray && <option value="rowLevel">Row Level</option>}
        {insideProgressionArray && <option value="rowColumn">Row Column</option>}
        {insideCraftArray && <option value="entryField">Entry Field</option>}
        {(insideCraftArray || inCraftEntry) && <option value="productionField">Production Field</option>}
        {insideProductionItemsArray && <option value="itemField">Item Field</option>}
      </select>

      {source === "manual" && binding?.source === "manual" && (
        <>
          <select
            className={FIELD}
            value={binding.valueType}
            disabled={readOnly}
            onChange={(e) => {
              if (readOnly) return;
              const vt = e.target.value as "string" | "number" | "boolean";
              const v = vt === "number" ? 0 : vt === "boolean" ? false : "";
              onChange({ source: "manual", value: v, valueType: vt });
            }}
          >
            <option value="string">string</option>
            <option value="number">number</option>
            <option value="boolean">boolean</option>
          </select>
          {binding.valueType === "boolean" ? (
            <select
              className={FIELD}
              value={String(binding.value)}
              disabled={readOnly}
              onChange={(e) => {
                if (readOnly) return;
                onChange({ ...binding, value: e.target.value === "true" });
              }}
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : binding.valueType === "number" ? (
            <CommitNumberInput
              className={FIELD + " w-32"}
              value={typeof binding.value === "number" ? binding.value : Number(binding.value) || 0}
              disabled={readOnly}
              onCommit={(next) => {
                if (readOnly) return;
                onChange({ ...binding, value: next });
              }}
            />
          ) : (
            <CommitTextInput
              className={FIELD + " w-32"}
              value={String(binding.value ?? "")}
              disabled={readOnly}
              onCommit={(next) => {
                if (readOnly) return;
                onChange({ ...binding, value: next });
              }}
            />
          )}
        </>
      )}

      {source === "dataSchema" && binding?.source === "dataSchema" && (
        <>
          <select
            className={FIELD}
            value={binding.addonId}
            disabled={readOnly}
            onChange={(e) => {
              if (readOnly) return;
              const ds = dataSchemas.find((d) => d.id === e.target.value);
              const firstEntry = ds?.data.entries[0];
              onChange({ source: "dataSchema", addonId: e.target.value, addonName: ds?.name, entryKey: firstEntry?.key ?? "", entryId: firstEntry?.id });
            }}
          >
            {dataSchemas.map((ds) => (
              <option key={ds.id} value={ds.id}>
                {ds.name}
              </option>
            ))}
            {dataSchemas.length === 0 && <option value="">Nenhum Data Schema</option>}
          </select>
          <select
            className={FIELD}
            value={binding.entryId ?? binding.entryKey}
            disabled={readOnly}
            onChange={(e) => {
              if (readOnly) return;
              const selectedId = e.target.value;
              const ds = dataSchemas.find((d) => d.id === binding.addonId);
              const entry = ds?.data.entries.find((ent) => ent.id === selectedId);
              onChange({ ...binding, entryKey: entry?.key ?? selectedId, entryId: entry?.id });
            }}
          >
            {dataSchemas
              .find((d) => d.id === binding.addonId)
              ?.data.entries.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label || entry.key}
                </option>
              ))}
          </select>
        </>
      )}

      {source === "rowColumn" && binding?.source === "rowColumn" && currentPT && (
        <select
          className={FIELD}
          value={binding.columnId}
          disabled={readOnly}
          onChange={(e) => {
            if (readOnly) return;
            onChange({ source: "rowColumn", columnId: e.target.value });
          }}
        >
          {currentPT.data.columns.map((col) => (
            <option key={col.id} value={col.id}>
              {col.name}
            </option>
          ))}
        </select>
      )}

      {source === "entryField" && binding?.source === "entryField" && (
        <select
          className={FIELD}
          value={binding.field}
          disabled={readOnly}
          onChange={(e) => {
            if (readOnly) return;
            onChange({ source: "entryField", field: e.target.value as typeof binding.field });
          }}
        >
          {craftTableEntryFields.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      )}

      {source === "productionField" && binding?.source === "productionField" && (
        <select
          className={FIELD}
          value={binding.field}
          disabled={readOnly}
          onChange={(e) => {
            if (readOnly) return;
            onChange({ source: "productionField", field: e.target.value as typeof binding.field });
          }}
        >
          {productionScalarFields.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      )}

      {source === "itemField" && binding?.source === "itemField" && (
        <select
          className={FIELD}
          value={binding.field}
          disabled={readOnly}
          onChange={(e) => {
            if (readOnly) return;
            onChange({ source: "itemField", field: e.target.value as "itemRef" | "quantity" });
          }}
        >
          <option value="itemRef">itemRef (dataId)</option>
          <option value="quantity">quantity</option>
        </select>
      )}
    </div>
  );
}

// ── ResolvedKeyLabel ─────────────────────────────────────────────────

function ResolvedKeyLabel({ binding, sectionAddons }: { binding: ExportSchemaBinding; sectionAddons: SectionAddon[] }) {
  let label: string;
  if (binding.source === "dataSchema") {
    const ds = getDataSchemaAddons(sectionAddons).find((d) => d.id === binding.addonId || d.name === binding.addonName);
    const entry = binding.entryId
      ? ds?.data.entries.find((e) => e.id === binding.entryId)
      : ds?.data.entries.find((e) => e.key === binding.entryKey);
    label = entry?.key ?? binding.entryKey;
  } else if (binding.source === "rowColumn") {
    label = binding.columnId;
  } else if (binding.source === "entryField" || binding.source === "productionField" || binding.source === "itemField") {
    label = binding.field;
  } else {
    label = "level";
  }
  return (
    <span className="text-xs font-mono text-gray-400 px-2 py-1 bg-gray-800/50 rounded-lg border border-gray-700/50 min-w-[90px]" title="Chave definida pelo binding">
      {label}
    </span>
  );
}

// ── SchemaNodeEditor (recursive) ───────────────────────────────────

export function SchemaNodeEditor({
  node,
  onUpdate,
  onRemove,
  onDuplicate,
  onAddChild,
  sectionAddons,
  depth,
  insideArray,
  arraySourceAddonId,
  arraySourceType,
  inCraftEntry,
  readOnly,
}: {
  node: ExportSchemaNode;
  onUpdate: (updated: ExportSchemaNode) => void;
  onRemove: () => void;
  onDuplicate?: () => void;
  onAddChild: (parentId: string, isTemplate: boolean, type: "value" | "object" | "array") => void;
  sectionAddons: SectionAddon[];
  depth: number;
  arraySourceType?: ArraySourceKind;
  insideArray: boolean;
  arraySourceAddonId?: string;
  /** True when any ancestor iteration is craftTable (or productionIngredients/Outputs nested in a craftTable). */
  inCraftEntry?: boolean;
  readOnly?: boolean;
}) {
  const progressionTables = useMemo(() => getProgressionTableAddons(sectionAddons), [sectionAddons]);
  const craftTables = useMemo(() => getCraftTableAddons(sectionAddons), [sectionAddons]);
  const [collapsed, setCollapsed] = useState(true);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // React to "Expand all" / "Collapse all" broadcasts from the panel.
  const collapseBroadcast = useContext(CollapseBroadcastContext);
  const lastBroadcastVersionRef = useRef<number>(-1);
  useEffect(() => {
    if (!collapseBroadcast) return;
    if (collapseBroadcast.version === lastBroadcastVersionRef.current) return;
    lastBroadcastVersionRef.current = collapseBroadcast.version;
    setCollapsed(collapseBroadcast.target === "collapse");
  }, [collapseBroadcast]);

  // Auto-revert confirmation after ~3s so the user doesn't get stuck in a "armed" state.
  useEffect(() => {
    if (!confirmingDelete) return;
    const timer = window.setTimeout(() => setConfirmingDelete(false), 3000);
    return () => window.clearTimeout(timer);
  }, [confirmingDelete]);

  const handleTypeChange = (newType: "object" | "array" | "value") => {
    if (readOnly) return;
    const updated: ExportSchemaNode = { ...node, nodeType: newType };
    if (newType === "object") {
      updated.children = node.children ?? [];
      updated.arraySource = undefined;
      updated.itemTemplate = undefined;
      updated.binding = undefined;
    } else if (newType === "array") {
      updated.children = undefined;
      updated.arraySource = node.arraySource ?? undefined;
      updated.itemTemplate = node.itemTemplate ?? [];
      updated.binding = undefined;
    } else {
      updated.children = undefined;
      updated.arraySource = undefined;
      updated.itemTemplate = undefined;
      updated.binding = node.binding ?? { source: "manual", value: "", valueType: "string" };
    }
    onUpdate(updated);
  };

  const resolvedArraySourceId =
    node.nodeType === "array" && node.arraySource && (node.arraySource.type === "progressionTable" || node.arraySource.type === "craftTable")
      ? node.arraySource.addonId
      : arraySourceAddonId;

  const resolvedArraySourceType: ArraySourceKind | undefined =
    node.nodeType === "array" && node.arraySource
      ? node.arraySource.type
      : arraySourceType;

  // inCraftEntry stays true once we enter a craftTable iteration; productionIngredients/Outputs
  // inherit it since they only make sense inside a craftTable.
  const resolvedInCraftEntry =
    (node.nodeType === "array" && node.arraySource?.type === "craftTable") ||
    (node.nodeType === "array" && (node.arraySource?.type === "productionIngredients" || node.arraySource?.type === "productionOutputs"))
      ? true
      : inCraftEntry;

  const childInsideArray = node.nodeType === "array" ? true : insideArray;
  const childList = node.nodeType === "object" ? node.children ?? [] : node.nodeType === "array" ? node.itemTemplate ?? [] : [];

  const isContainer = node.nodeType === "object" || node.nodeType === "array";
  const bindingIssue = useMemo(() => getBindingIssue(node, sectionAddons), [node, sectionAddons]);
  const cardBorder = bindingIssue
    ? "border-amber-500/60"
    : isContainer ? "border-gray-600/60" : "border-gray-700/50";
  const cardBg = bindingIssue ? "bg-amber-900/10" : isContainer ? "bg-gray-800/40" : "bg-gray-800/20";
  const cardSpacing = isContainer ? "mb-1.5" : "mb-1";
  const cardClass = `rounded-md border ${cardBorder} ${cardBg} px-2 ${cardSpacing}`;

  return (
    <div className={`${depth > 0 ? "ml-2 border-l border-gray-700/50 pl-2" : ""}`}>
      <div className={cardClass}>
      <div className="flex items-center gap-2 py-1 flex-wrap">
        {!readOnly && <NodeDragHandle label="Arrastar propriedade" />}
        {(node.nodeType === "object" || node.nodeType === "array") && (
          <button
            type="button"
            className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border border-gray-600/70 bg-gray-800/70 text-gray-300 hover:border-gray-500 hover:bg-gray-700 hover:text-white"
            onClick={() => setCollapsed(!collapsed)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expandir filhos" : "Recolher filhos"}
            title={collapsed ? "Expandir filhos" : "Recolher filhos"}
          >
            <svg
              viewBox="0 0 12 12"
              className="h-3 w-3 transition-transform duration-200"
              style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 4.5 L6 8 L9 4.5" />
            </svg>
          </button>
        )}

        {bindingIssue && (
          <span
            className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[11px] text-amber-300"
            title={bindingIssue}
            aria-label={bindingIssue}
          >
            ⚠
          </span>
        )}

        {/* Key field: hidden for auto-bound nodes, editable for manual/object/array */}
        {node.nodeType === "value" && (
          node.binding?.source === "dataSchema" || node.binding?.source === "rowColumn" || node.binding?.source === "rowLevel"
        ) ? (
          <ResolvedKeyLabel binding={node.binding} sectionAddons={sectionAddons} />
        ) : (
          <CommitTextInput
            className={FIELD + " w-36 font-mono"}
            value={node.key}
            placeholder="key"
            disabled={readOnly}
            onCommit={(next) => {
              if (readOnly) return;
              onUpdate({ ...node, key: next });
            }}
          />
        )}

        <select
          className={FIELD}
          value={node.nodeType}
          disabled={readOnly}
          onChange={(e) => handleTypeChange(e.target.value as "object" | "array" | "value")}
        >
          <option value="value">value</option>
          <option value="object">object</option>
          <option value="array">array</option>
        </select>

        {node.nodeType === "array" && (
          <select
            className={FIELD}
            value={
              node.arraySource
                ? node.arraySource.type === "progressionTable" || node.arraySource.type === "craftTable"
                  ? `${node.arraySource.type}:${node.arraySource.addonId}`
                  : node.arraySource.type
                : ""
            }
            disabled={readOnly}
            onChange={(e) => {
              if (readOnly) return;
              const raw = e.target.value;
              if (!raw) {
                onUpdate({ ...node, arraySource: undefined });
                return;
              }
              const prevType = node.arraySource?.type;
              let nextSource: NonNullable<ExportSchemaNode["arraySource"]>;
              if (raw === "productionIngredients" || raw === "productionOutputs") {
                nextSource = { type: raw };
              } else {
                const [type, addonId] = raw.split(":");
                if (type !== "progressionTable" && type !== "craftTable") return;
                nextSource = { type, addonId };
              }
              const next: ExportSchemaNode = { ...node, arraySource: nextSource };
              // When switching between incompatible source types, clear item template
              // so stale bindings (rowColumn ↔ entryField ↔ itemField) don't leak.
              if (prevType && prevType !== nextSource.type) {
                next.itemTemplate = [];
              }
              onUpdate(next);
            }}
          >
            <option value="">Selecionar fonte...</option>
            {progressionTables.length > 0 && (
              <optgroup label="Progression Table">
                {progressionTables.map((pt) => (
                  <option key={pt.id} value={`progressionTable:${pt.id}`}>
                    {pt.name}
                  </option>
                ))}
              </optgroup>
            )}
            {craftTables.length > 0 && (
              <optgroup label="Craft Table">
                {craftTables.map((ct) => (
                  <option key={ct.id} value={`craftTable:${ct.id}`}>
                    {ct.name}
                  </option>
                ))}
              </optgroup>
            )}
            {inCraftEntry && (
              <optgroup label="Da receita atual">
                <option value="productionIngredients">Production Ingredients</option>
                <option value="productionOutputs">Production Outputs</option>
              </optgroup>
            )}
          </select>
        )}

        {!readOnly && onDuplicate && !confirmingDelete && (
          <button
            type="button"
            className="ml-auto flex-shrink-0 rounded-lg border border-gray-600 bg-gray-800 px-1.5 py-0.5 text-[11px] text-gray-300 hover:bg-gray-700 hover:text-white"
            onClick={onDuplicate}
            title="Duplicar propriedade (copia com mesmos valores)"
            aria-label="Duplicar propriedade"
          >
            ⧉
          </button>
        )}
        {!readOnly && (
          confirmingDelete ? (
            <button
              type="button"
              className={`flex-shrink-0 rounded-lg border border-rose-500 bg-rose-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-rose-500 ${onDuplicate ? "" : "ml-auto"}`}
              onClick={onRemove}
              onBlur={() => setConfirmingDelete(false)}
              autoFocus
              title="Clique para confirmar a remoção"
            >
              Confirmar?
            </button>
          ) : (
            <button
              type="button"
              className={BTN_DANGER + ` !px-1.5 !py-0.5 ${onDuplicate ? "" : "ml-auto"} flex-shrink-0`}
              onClick={() => setConfirmingDelete(true)}
              title="Remover propriedade (confirma no próximo clique)"
            >
              &times;
            </button>
          )
        )}
      </div>

      {node.nodeType === "value" && (
        <div className={`flex items-center gap-2 pb-1 pl-3 ml-4 flex-wrap border-l-4 ${bindingAccentClass(node.binding?.source)}`}>
          <BindingEditor
            binding={node.binding}
            onChange={(b) => {
              if (readOnly) return;
              const updated = { ...node, binding: b };
              const prevBinding = node.binding;
              const prevKey = prevBinding?.source === "dataSchema" ? prevBinding.entryKey
                : prevBinding?.source === "rowColumn" ? prevBinding.columnId
                : prevBinding?.source === "rowLevel" ? "level"
                : prevBinding?.source === "entryField" ? prevBinding.field
                : prevBinding?.source === "productionField" ? prevBinding.field
                : prevBinding?.source === "itemField" ? prevBinding.field : "";
              const shouldAutoFill = !node.key || node.key === "newProperty" || node.key === prevKey;
              if (shouldAutoFill) {
                if (b.source === "dataSchema") updated.key = b.entryKey;
                else if (b.source === "rowColumn") updated.key = b.columnId;
                else if (b.source === "rowLevel") updated.key = "level";
                else if (b.source === "entryField") updated.key = b.field;
                else if (b.source === "productionField") updated.key = b.field;
                else if (b.source === "itemField") updated.key = b.field;
              }
              onUpdate(updated);
            }}
            sectionAddons={sectionAddons}
            insideArray={insideArray}
            arraySourceAddonId={arraySourceAddonId}
            arraySourceType={arraySourceType}
            inCraftEntry={inCraftEntry}
            readOnly={readOnly}
          />
          <NodeValuePreview nodeId={node.id} />
          {/* Value modifiers — grouped pill on the right. Only shown for numeric bindings. */}
          {!readOnly && isNumericBinding(node.binding, sectionAddons) && (
            <div
              className="flex items-center gap-2 ml-auto rounded-full border border-gray-700/70 bg-gray-900/50 px-2 py-0.5 text-[10px] text-gray-400"
              title="Transformações aplicadas ao valor final"
            >
              <span className="text-[9px] uppercase tracking-wide text-gray-500">xform</span>
              <label className="flex items-center gap-1 cursor-pointer hover:text-gray-200" title="Valor absoluto (remove negativos)">
                <input
                  type="checkbox"
                  checked={node.abs ?? false}
                  onChange={(e) => onUpdate({ ...node, abs: e.target.checked || undefined })}
                  className="accent-indigo-500 w-3 h-3"
                />
                abs
              </label>
              <span className="text-gray-600" aria-hidden>·</span>
              <label className="flex items-center gap-1" title="Multiplicador aplicado ao valor">
                <span className="text-gray-500">×</span>
                <CommitOptionalNumberInput
                  value={node.multiplier}
                  onCommit={(next) => onUpdate({ ...node, multiplier: next })}
                  className="w-10 bg-transparent text-[10px] font-mono text-gray-200 outline-none px-0.5 py-0 text-center"
                  placeholder="1"
                  step="any"
                />
              </label>
            </div>
          )}
        </div>
      )}
      </div>

      {!collapsed && (node.nodeType === "object" || node.nodeType === "array") && (
        <div className="mt-1">
          <SortableNodeList
            nodes={childList}
            readOnly={readOnly}
            onReorder={(next) =>
              onUpdate(
                node.nodeType === "object"
                  ? { ...node, children: next }
                  : { ...node, itemTemplate: next }
              )
            }
            renderItem={(child) => (
              <SchemaNodeEditor
                node={child}
                onUpdate={(updated) => onUpdate(
                  node.nodeType === "object"
                    ? { ...node, children: (node.children ?? []).map((c) => (c.id === updated.id ? updated : c)) }
                    : { ...node, itemTemplate: (node.itemTemplate ?? []).map((c) => (c.id === updated.id ? updated : c)) }
                )}
                onRemove={() => onUpdate(
                  node.nodeType === "object"
                    ? { ...node, children: (node.children ?? []).filter((c) => c.id !== child.id) }
                    : { ...node, itemTemplate: (node.itemTemplate ?? []).filter((c) => c.id !== child.id) }
                )}
                onDuplicate={() => onUpdate(
                  node.nodeType === "object"
                    ? { ...node, children: duplicateInList(node.children ?? [], child.id) }
                    : { ...node, itemTemplate: duplicateInList(node.itemTemplate ?? [], child.id) }
                )}
                onAddChild={onAddChild}
                sectionAddons={sectionAddons}
                depth={depth + 1}
                insideArray={childInsideArray}
                arraySourceAddonId={resolvedArraySourceId}
                arraySourceType={resolvedArraySourceType}
                inCraftEntry={resolvedInCraftEntry}
                readOnly={readOnly}
              />
            )}
          />
          {!readOnly && (
            <div className="mt-1 ml-2">
              <AddNodeButton
                label={<>em <span className="font-mono text-gray-200">&quot;{node.key || "…"}&quot;</span></>}
                title={`Adicionar propriedade dentro de "${node.key || "…"}"`}
                onAdd={(type) => onAddChild(node.id, node.nodeType === "array", type)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
