"use client";

import { useCallback, useMemo, useState } from "react";
import type {
  ExportSchemaAddonDraft,
  ExportSchemaNode,
  ExportSchemaBinding,
  SectionAddon,
  DataSchemaAddonDraft,
  ProgressionTableAddonDraft,
} from "@/lib/addons/types";
import { resolveExportSchema } from "@/lib/addons/exportSchemaResolver";
import { importJsonToAddons } from "@/lib/addons/exportSchemaImporter";
import { useProjectStore } from "@/store/projectStore";

interface ExportSchemaAddonPanelProps {
  addon: ExportSchemaAddonDraft;
  onChange: (next: ExportSchemaAddonDraft) => void;
  onRemove: () => void;
  sectionAddons?: SectionAddon[];
}

const SHELL = "rounded-2xl border border-gray-700/80 bg-gray-900/70 p-4 md:p-5";
const BLOCK = "rounded-xl border border-gray-700/80 bg-gray-800/70 p-3";
const INPUT =
  "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-gray-500";
const SELECT =
  "rounded-lg border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm text-white outline-none focus:border-gray-500";
const BTN = "rounded-lg border border-gray-600 bg-gray-800 px-2.5 py-1 text-xs text-gray-100 hover:bg-gray-700";
const BTN_DANGER =
  "rounded-lg border border-rose-700/60 bg-rose-900/30 px-2.5 py-1 text-xs text-rose-200 hover:bg-rose-900/50";
const BTN_PRIMARY =
  "rounded-lg border border-indigo-600 bg-indigo-700 px-3 py-1.5 text-xs text-white hover:bg-indigo-600";

function uid(): string {
  return `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ── helpers to find sibling addons ──────────────────────────────────

function getDataSchemaAddons(addons: SectionAddon[]): Array<{ id: string; name: string; data: DataSchemaAddonDraft }> {
  return addons
    .filter((a) => a.type === "dataSchema" || a.type === "genericStats")
    .map((a) => ({ id: a.id, name: a.name, data: a.data as DataSchemaAddonDraft }));
}

function getProgressionTableAddons(addons: SectionAddon[]): Array<{ id: string; name: string; data: ProgressionTableAddonDraft }> {
  return addons
    .filter((a) => a.type === "progressionTable")
    .map((a) => ({ id: a.id, name: a.name, data: a.data as ProgressionTableAddonDraft }));
}

// ── immutable tree helpers ──────────────────────────────────────────

function updateNodeInList(nodes: ExportSchemaNode[], nodeId: string, updater: (n: ExportSchemaNode) => ExportSchemaNode): ExportSchemaNode[] {
  return nodes.map((n) => {
    if (n.id === nodeId) return updater(n);
    if (n.children) return { ...n, children: updateNodeInList(n.children, nodeId, updater) };
    if (n.itemTemplate) return { ...n, itemTemplate: updateNodeInList(n.itemTemplate, nodeId, updater) };
    return n;
  });
}

function removeNodeFromList(nodes: ExportSchemaNode[], nodeId: string): ExportSchemaNode[] {
  return nodes
    .filter((n) => n.id !== nodeId)
    .map((n) => {
      if (n.children) return { ...n, children: removeNodeFromList(n.children, nodeId) };
      if (n.itemTemplate) return { ...n, itemTemplate: removeNodeFromList(n.itemTemplate, nodeId) };
      return n;
    });
}

function addChildToNode(nodes: ExportSchemaNode[], parentId: string, child: ExportSchemaNode, isTemplate: boolean): ExportSchemaNode[] {
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

// ── Binding Editor ──────────────────────────────────────────────────

function BindingEditor({
  binding,
  onChange,
  sectionAddons,
  insideArray,
  arraySourceAddonId,
}: {
  binding?: ExportSchemaBinding;
  onChange: (b: ExportSchemaBinding) => void;
  sectionAddons: SectionAddon[];
  insideArray: boolean;
  arraySourceAddonId?: string;
}) {
  const source = binding?.source ?? "manual";
  const dataSchemas = useMemo(() => getDataSchemaAddons(sectionAddons), [sectionAddons]);
  const progressionTables = useMemo(() => getProgressionTableAddons(sectionAddons), [sectionAddons]);

  const currentPT = useMemo(
    () => (arraySourceAddonId ? progressionTables.find((pt) => pt.id === arraySourceAddonId) : undefined),
    [progressionTables, arraySourceAddonId]
  );

  const handleSourceChange = (newSource: string) => {
    if (newSource === "manual") onChange({ source: "manual", value: "", valueType: "string" });
    else if (newSource === "dataSchema") {
      const first = dataSchemas[0];
      const firstEntry = first?.data.entries[0];
      onChange({ source: "dataSchema", addonId: first?.id ?? "", entryKey: firstEntry?.key ?? "" });
    } else if (newSource === "rowLevel") onChange({ source: "rowLevel" });
    else if (newSource === "rowColumn") {
      const firstCol = currentPT?.data.columns[0];
      onChange({ source: "rowColumn", columnId: firstCol?.id ?? "" });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className={SELECT} value={source} onChange={(e) => handleSourceChange(e.target.value)}>
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
            onChange={(e) => {
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
              onChange={(e) => onChange({ ...binding, value: e.target.value === "true" })}
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : (
            <input
              className={INPUT + " !w-32"}
              type={binding.valueType === "number" ? "number" : "text"}
              value={String(binding.value)}
              onChange={(e) => {
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
            onChange={(e) => {
              const ds = dataSchemas.find((d) => d.id === e.target.value);
              const firstKey = ds?.data.entries[0]?.key ?? "";
              onChange({ source: "dataSchema", addonId: e.target.value, entryKey: firstKey });
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
            value={binding.entryKey}
            onChange={(e) => onChange({ ...binding, entryKey: e.target.value })}
          >
            {dataSchemas
              .find((d) => d.id === binding.addonId)
              ?.data.entries.map((entry) => (
                <option key={entry.key} value={entry.key}>
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
          onChange={(e) => onChange({ source: "rowColumn", columnId: e.target.value })}
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

// ── SchemaNodeEditor (recursive) ────────────────────────────────────

function SchemaNodeEditor({
  node,
  onUpdate,
  onRemove,
  onAddChild,
  sectionAddons,
  depth,
  insideArray,
  arraySourceAddonId,
}: {
  node: ExportSchemaNode;
  onUpdate: (updated: ExportSchemaNode) => void;
  onRemove: () => void;
  onAddChild: (parentId: string, isTemplate: boolean) => void;
  sectionAddons: SectionAddon[];
  depth: number;
  insideArray: boolean;
  arraySourceAddonId?: string;
}) {
  const progressionTables = useMemo(() => getProgressionTableAddons(sectionAddons), [sectionAddons]);
  const [collapsed, setCollapsed] = useState(false);

  const handleTypeChange = (newType: "object" | "array" | "value") => {
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
  const hasChildren = childList.length > 0;

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

        <input
          className={INPUT + " !w-36 !py-1 !text-xs font-mono"}
          value={node.key}
          placeholder="key"
          onChange={(e) => onUpdate({ ...node, key: e.target.value })}
        />

        <select
          className={SELECT + " !text-xs"}
          value={node.nodeType}
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
            onChange={(e) =>
              onUpdate({
                ...node,
                arraySource: e.target.value ? { type: "progressionTable", addonId: e.target.value } : undefined,
              })
            }
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
          <BindingEditor
            binding={node.binding}
            onChange={(b) => onUpdate({ ...node, binding: b })}
            sectionAddons={sectionAddons}
            insideArray={insideArray}
            arraySourceAddonId={arraySourceAddonId}
          />
        )}

        <button type="button" className={BTN_DANGER + " !px-1.5 !py-0.5 ml-auto flex-shrink-0"} onClick={onRemove}>
          &times;
        </button>
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
            />
          ))}
          <button
            type="button"
            className={BTN + " ml-4 mt-1"}
            onClick={() => onAddChild(node.id, node.nodeType === "array")}
          >
            + Propriedade
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Panel ──────────────────────────────────────────────────────

export function ExportSchemaAddonPanel({ addon, onChange, onRemove, sectionAddons: externalAddons }: ExportSchemaAddonPanelProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");

  // Find sibling addons from the store if not provided externally
  const projects = useProjectStore((s) => s.projects);
  const setSectionAddons = useProjectStore((s) => s.setSectionAddons);
  const sectionContext = useMemo(() => {
    for (const proj of projects) {
      for (const sec of proj.sections ?? []) {
        const found = (sec.addons ?? []).find((a: SectionAddon) => a.id === addon.id);
        if (found) return { projectId: proj.id, sectionId: sec.id, addons: sec.addons ?? [] };
      }
    }
    return null;
  }, [projects, addon.id]);
  const sectionAddons = externalAddons ?? (sectionContext?.addons.filter((a: SectionAddon) => a.id !== addon.id) ?? []);

  const commit = useCallback(
    (nodes: ExportSchemaNode[]) => onChange({ ...addon, nodes }),
    [addon, onChange]
  );

  const addRootNode = () => {
    const newNode: ExportSchemaNode = {
      id: uid(),
      key: "newProperty",
      nodeType: "value",
      binding: { source: "manual", value: "", valueType: "string" },
    };
    commit([...addon.nodes, newNode]);
  };

  const handleAddChild = (parentId: string, isTemplate: boolean) => {
    const child: ExportSchemaNode = {
      id: uid(),
      key: "newProperty",
      nodeType: "value",
      binding: { source: "manual", value: "", valueType: "string" },
    };
    commit(addChildToNode(addon.nodes, parentId, child, isTemplate));
  };

  const resolved = useMemo(
    () => (showPreview ? resolveExportSchema(addon.nodes, sectionAddons) : null),
    [showPreview, addon.nodes, sectionAddons]
  );

  const jsonString = useMemo(
    () => (resolved ? JSON.stringify(resolved, null, 4) : ""),
    [resolved]
  );

  const handleCopy = async () => {
    const json = JSON.stringify(resolveExportSchema(addon.nodes, sectionAddons), null, 4);
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const json = JSON.stringify(resolveExportSchema(addon.nodes, sectionAddons), null, 4);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${addon.name || "export"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    setImportError("");
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(importText);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        setImportError("O JSON deve ser um objeto (nao array ou primitivo).");
        return;
      }
    } catch {
      setImportError("JSON invalido. Verifique a sintaxe.");
      return;
    }

    const { newAddons, exportSchemaNodes } = importJsonToAddons(parsed);

    // Add new addons to the section via the store, then update the export schema
    if (sectionContext && newAddons.length > 0) {
      const currentAddons = sectionContext.addons;
      const updatedExportSchemaAddon: SectionAddon = {
        id: addon.id,
        type: "exportSchema",
        name: addon.name,
        data: { ...addon, nodes: exportSchemaNodes },
      };
      const mergedAddons: SectionAddon[] = [
        ...newAddons,
        ...currentAddons.map((a) => (a.id === addon.id ? updatedExportSchemaAddon : a)),
      ];
      setSectionAddons(sectionContext.projectId, sectionContext.sectionId, mergedAddons);
    } else {
      // No store context, just update the schema nodes
      onChange({ ...addon, nodes: exportSchemaNodes });
    }

    setShowImport(false);
    setImportText("");
  };

  return (
    <div className={SHELL}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-200">Export Schema</span>
          <input
            className={INPUT + " !w-48 !py-1 !text-xs"}
            value={addon.name}
            onChange={(e) => onChange({ ...addon, name: e.target.value })}
            placeholder="Nome do schema"
          />
        </div>
        <button type="button" className={BTN_DANGER} onClick={onRemove}>
          Remover
        </button>
      </div>

      {/* Schema Tree Editor */}
      <div className={BLOCK + " mb-3"}>
        <div className="text-xs text-gray-400 mb-2 font-medium">Estrutura JSON</div>
        {addon.nodes.length === 0 && (
          <p className="text-xs text-gray-500 italic mb-2">
            Nenhuma propriedade definida. Clique em &quot;+ Propriedade&quot; para comecar.
          </p>
        )}
        {addon.nodes.map((node) => (
          <SchemaNodeEditor
            key={node.id}
            node={node}
            onUpdate={(updated) =>
              commit(addon.nodes.map((n) => (n.id === updated.id ? updated : n)))
            }
            onRemove={() => commit(addon.nodes.filter((n) => n.id !== node.id))}
            onAddChild={handleAddChild}
            sectionAddons={sectionAddons}
            depth={0}
            insideArray={false}
          />
        ))}
        <button type="button" className={BTN + " mt-2"} onClick={addRootNode}>
          + Propriedade
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button type="button" className={BTN_PRIMARY} onClick={() => setShowImport(!showImport)}>
          Importar JSON
        </button>
        <button type="button" className={BTN} onClick={() => setShowPreview(!showPreview)}>
          {showPreview ? "Ocultar Preview" : "Preview JSON"}
        </button>
        <button type="button" className={BTN_PRIMARY} onClick={handleCopy}>
          {copied ? "Copiado!" : "Copiar JSON"}
        </button>
        <button type="button" className={BTN} onClick={handleDownload}>
          Download JSON
        </button>
      </div>

      {/* Import Modal */}
      {showImport && (
        <div className={BLOCK + " mb-3"}>
          <div className="text-xs text-gray-400 mb-2 font-medium">
            Importar JSON
          </div>
          <p className="text-xs text-gray-500 mb-2">
            Cole um JSON aqui. O sistema vai analisar a estrutura e criar automaticamente os addons
            (Data Schema para objetos, Progression Table para arrays de niveis) e montar o Export Schema.
          </p>
          <textarea
            className={INPUT + " !h-48 font-mono !text-xs"}
            value={importText}
            onChange={(e) => {
              setImportText(e.target.value);
              setImportError("");
            }}
            placeholder='{"baseSettings": {"id": "ITEM_01", ...}, "levelSettings": [{"level": 1, ...}]}'
          />
          {importError && (
            <p className="text-xs text-rose-400 mt-1">{importError}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <button type="button" className={BTN_PRIMARY} onClick={handleImport}>
              Importar e Criar Addons
            </button>
            <button type="button" className={BTN} onClick={() => { setShowImport(false); setImportText(""); setImportError(""); }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Preview */}
      {showPreview && (
        <div className={BLOCK}>
          <div className="text-xs text-gray-400 mb-2 font-medium">Preview</div>
          <pre className="text-xs text-green-300 font-mono whitespace-pre overflow-x-auto max-h-96 overflow-y-auto">
            {jsonString || "{}"}
          </pre>
        </div>
      )}
    </div>
  );
}
