"use client";

import { useMemo, useState } from "react";
import type {
  ExportSchemaNode,
  ExportSchemaBinding,
  SectionAddon,
  DataSchemaAddonDraft,
  ProgressionTableAddonDraft,
} from "@/lib/addons/types";

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

// ── uid helper ─────────────────────────────────────────────────────

export function uid(): string {
  return `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
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

// ── Binding Editor ─────────────────────────────────────────────────

export function BindingEditor({
  binding,
  onChange,
  sectionAddons,
  insideArray,
  arraySourceAddonId,
  readOnly,
}: {
  binding?: ExportSchemaBinding;
  onChange: (b: ExportSchemaBinding) => void;
  sectionAddons: SectionAddon[];
  insideArray: boolean;
  arraySourceAddonId?: string;
  readOnly?: boolean;
}) {
  const source = binding?.source ?? "manual";
  const dataSchemas = useMemo(() => getDataSchemaAddons(sectionAddons), [sectionAddons]);
  const progressionTables = useMemo(() => getProgressionTableAddons(sectionAddons), [sectionAddons]);

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
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className={SELECT} value={source} onChange={(e) => handleSourceChange(e.target.value)} disabled={readOnly}>
        <option value="manual">Manual</option>
        <option value="dataSchema">Data Schema</option>
        {insideArray && <option value="rowLevel">Row Level</option>}
        {insideArray && <option value="rowColumn">Row Column</option>}
      </select>

      {source === "manual" && binding?.source === "manual" && (
        <>
          <select
            className={SELECT}
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
              className={SELECT}
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
          ) : (
            <input
              className={INPUT + " !w-32"}
              type={binding.valueType === "number" ? "number" : "text"}
              value={String(binding.value)}
              readOnly={readOnly}
              onChange={(e) => {
                if (readOnly) return;
                const v = binding.valueType === "number" ? Number(e.target.value.replace(",", ".")) || 0 : e.target.value;
                onChange({ ...binding, value: v });
              }}
            />
          )}
        </>
      )}

      {source === "dataSchema" && binding?.source === "dataSchema" && (
        <>
          <select
            className={SELECT}
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
            className={SELECT}
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
          className={SELECT}
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
  onAddChild,
  sectionAddons,
  depth,
  insideArray,
  arraySourceAddonId,
  readOnly,
}: {
  node: ExportSchemaNode;
  onUpdate: (updated: ExportSchemaNode) => void;
  onRemove: () => void;
  onAddChild: (parentId: string, isTemplate: boolean) => void;
  sectionAddons: SectionAddon[];
  depth: number;
  insideArray: boolean;
  arraySourceAddonId?: string;
  readOnly?: boolean;
}) {
  const progressionTables = useMemo(() => getProgressionTableAddons(sectionAddons), [sectionAddons]);
  const [collapsed, setCollapsed] = useState(true);

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
    node.nodeType === "array" && node.arraySource
      ? node.arraySource.addonId
      : arraySourceAddonId;

  const childInsideArray = node.nodeType === "array" ? true : insideArray;
  const childList = node.nodeType === "object" ? node.children ?? [] : node.nodeType === "array" ? node.itemTemplate ?? [] : [];

  return (
    <div className={`${depth > 0 ? "ml-4 border-l border-gray-700/50 pl-3" : ""}`}>
      <div className="flex items-center gap-2 py-1.5">
        {(node.nodeType === "object" || node.nodeType === "array") && (
          <button
            type="button"
            className="text-gray-400 hover:text-gray-200 text-xs w-4 flex-shrink-0"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? "+" : "-"}
          </button>
        )}
        {node.nodeType === "value" && <span className="w-4 flex-shrink-0" />}

        {/* Key field: hidden for auto-bound nodes, editable for manual/object/array */}
        {node.nodeType === "value" && (
          node.binding?.source === "dataSchema" || node.binding?.source === "rowColumn" || node.binding?.source === "rowLevel"
        ) ? (
          <ResolvedKeyLabel binding={node.binding} sectionAddons={sectionAddons} />
        ) : (
          <input
            className={INPUT + " !w-36 !py-1 !text-xs font-mono"}
            value={node.key}
            placeholder="key"
            readOnly={readOnly}
            onChange={(e) => {
              if (readOnly) return;
              onUpdate({ ...node, key: e.target.value });
            }}
          />
        )}

        <select
          className={SELECT + " !text-xs"}
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
            className={SELECT + " !text-xs"}
            value={node.arraySource?.addonId ?? ""}
            disabled={readOnly}
            onChange={(e) => {
              if (readOnly) return;
              onUpdate({
                ...node,
                arraySource: e.target.value ? { type: "progressionTable", addonId: e.target.value } : undefined,
              });
            }}
          >
            <option value="">Selecionar tabela...</option>
            {progressionTables.map((pt) => (
              <option key={pt.id} value={pt.id}>
                {pt.name}
              </option>
            ))}
          </select>
        )}

        {node.nodeType === "value" && (
          <>
            <BindingEditor
              binding={node.binding}
              onChange={(b) => {
                if (readOnly) return;
                const updated = { ...node, binding: b };
                const prevBinding = node.binding;
                const prevKey = prevBinding?.source === "dataSchema" ? prevBinding.entryKey
                  : prevBinding?.source === "rowColumn" ? prevBinding.columnId
                  : prevBinding?.source === "rowLevel" ? "level" : "";
                const shouldAutoFill = !node.key || node.key === "newProperty" || node.key === prevKey;
                if (shouldAutoFill) {
                  if (b.source === "dataSchema") updated.key = b.entryKey;
                  else if (b.source === "rowColumn") updated.key = b.columnId;
                  else if (b.source === "rowLevel") updated.key = "level";
                }
                onUpdate(updated);
              }}
              sectionAddons={sectionAddons}
              insideArray={insideArray}
              arraySourceAddonId={arraySourceAddonId}
              readOnly={readOnly}
            />
            {/* Value modifiers */}
            {!readOnly && (
              <div className="flex items-center gap-1.5">
                <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer" title="Valor absoluto (remove negativos)">
                  <input
                    type="checkbox"
                    checked={node.abs ?? false}
                    onChange={(e) => onUpdate({ ...node, abs: e.target.checked || undefined })}
                    className="accent-indigo-500 w-3 h-3"
                  />
                  abs
                </label>
                <label className="flex items-center gap-1 text-[10px] text-gray-500" title="Multiplicador aplicado ao valor">
                  <span>*</span>
                  <input
                    type="number"
                    value={node.multiplier ?? ""}
                    onChange={(e) => {
                      const v = e.target.value ? Number(e.target.value.replace(",", ".")) : undefined;
                      onUpdate({ ...node, multiplier: v != null && Number.isFinite(v) ? v : undefined });
                    }}
                    className="w-14 bg-transparent border-b border-gray-700 text-[10px] font-mono text-gray-400 outline-none focus:border-indigo-500 px-0.5 py-0 text-center"
                    placeholder="1"
                    step="any"
                  />
                </label>
              </div>
            )}
          </>
        )}

        {!readOnly && (
          <button type="button" className={BTN_DANGER + " !px-1.5 !py-0.5 ml-auto flex-shrink-0"} onClick={onRemove}>
            &times;
          </button>
        )}
      </div>

      {!collapsed && (node.nodeType === "object" || node.nodeType === "array") && (
        <div className="mt-1">
          {childList.map((child) => (
            <SchemaNodeEditor
              key={child.id}
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
              onAddChild={onAddChild}
              sectionAddons={sectionAddons}
              depth={depth + 1}
              insideArray={childInsideArray}
              arraySourceAddonId={resolvedArraySourceId}
              readOnly={readOnly}
            />
          ))}
          {!readOnly && (
            <button
              type="button"
              className={BTN + " ml-4 mt-1"}
              onClick={() => onAddChild(node.id, node.nodeType === "array")}
            >
              + Propriedade
            </button>
          )}
        </div>
      )}
    </div>
  );
}
