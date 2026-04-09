"use client";

import { useCallback, useMemo, useState } from "react";
import type {
  ExportSchemaAddonDraft,
  ExportSchemaNode,
  SectionAddon,
} from "@/lib/addons/types";
import { resolveExportSchema } from "@/lib/addons/exportSchemaResolver";
import { importJsonToAddons } from "@/lib/addons/exportSchemaImporter";
import { useProjectStore } from "@/store/projectStore";
import {
  SHELL,
  BLOCK,
  INPUT,
  BTN,
  BTN_DANGER,
  BTN_PRIMARY,
  uid,
  addChildToNode,
  SchemaNodeEditor,
} from "./exportSchema/SchemaTreeEditor";

interface ExportSchemaAddonPanelProps {
  addon: ExportSchemaAddonDraft;
  onChange: (next: ExportSchemaAddonDraft) => void;
  onRemove: () => void;
  sectionAddons?: SectionAddon[];
}

// ── Main Panel ──────────────────────────────────────────────────────

export function ExportSchemaAddonPanel({ addon, onChange, onRemove, sectionAddons: externalAddons }: ExportSchemaAddonPanelProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [showTree, setShowTree] = useState(false);
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
        if (found) return { projectId: proj.id, sectionId: sec.id, addons: sec.addons ?? [], dataId: sec.dataId };
      }
    }
    return null;
  }, [projects, addon.id]);

  // group is on the SectionAddon wrapper, not the draft
  const myAddonWrapper = sectionContext?.addons.find((a: SectionAddon) => a.id === addon.id);
  const myGroup = (myAddonWrapper as any)?.group || "A";
  const sectionAddons = externalAddons ?? (sectionContext?.addons.filter((a: SectionAddon) => a.id !== addon.id && ((a as any).group || "A") === myGroup) ?? []);

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
    () => (showPreview ? resolveExportSchema(addon.nodes, sectionAddons, sectionContext?.dataId) : null),
    [showPreview, addon.nodes, sectionAddons]
  );

  const jsonString = useMemo(
    () => (resolved ? JSON.stringify(resolved, null, 4) : ""),
    [resolved]
  );

  const handleCopy = async () => {
    const json = JSON.stringify(resolveExportSchema(addon.nodes, sectionAddons, sectionContext?.dataId), null, 4);
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const json = JSON.stringify(resolveExportSchema(addon.nodes, sectionAddons, sectionContext?.dataId), null, 4);
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
      // Assign the same group as this Remote Config addon to imported addons
      const groupedNewAddons: SectionAddon[] = myGroup !== "A"
        ? newAddons.map((a) => ({ ...a, group: myGroup } as SectionAddon))
        : newAddons;
      const allSectionAddons = sectionContext.addons;
      // Find the full addons list (all groups) from the section
      const fullAddons = (() => {
        for (const proj of projects) {
          for (const sec of proj.sections ?? []) {
            if (sec.id === sectionContext.sectionId) return sec.addons ?? [];
          }
        }
        return allSectionAddons;
      })();
      const updatedExportSchemaAddon: SectionAddon = {
        id: addon.id,
        type: "exportSchema",
        name: addon.name,
        group: myGroup !== "A" ? myGroup : undefined,
        data: { ...addon, nodes: exportSchemaNodes },
      };
      const mergedAddons: SectionAddon[] = [
        ...groupedNewAddons,
        ...fullAddons.map((a) => (a.id === addon.id ? updatedExportSchemaAddon : a)),
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
      {/* Schema Tree Editor (collapsible) */}
      <div className={BLOCK + " mb-3"}>
        <button
          type="button"
          className="w-full flex items-center justify-between text-xs text-gray-400 font-medium"
          onClick={() => setShowTree(!showTree)}
        >
          <span>Estrutura JSON ({addon.nodes.length} propriedade{addon.nodes.length !== 1 ? "s" : ""})</span>
          <span className="transition-transform duration-200" style={{ transform: showTree ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
        </button>
        {showTree && (
          <div className="mt-2">
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
                readOnly={false}
              />
            ))}
            <button type="button" className={BTN + " mt-2"} onClick={addRootNode}>
              + Propriedade
            </button>
          </div>
        )}
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
