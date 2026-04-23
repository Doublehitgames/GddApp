"use client";

import { useCallback, useMemo, useState } from "react";
import type {
  ExportSchemaAddonDraft,
  ExportSchemaArrayFormat,
  ExportSchemaNode,
  SectionAddon,
} from "@/lib/addons/types";
import { buildSectionLookup, resolveExportSchema, resolveExportSchemaWithPreview, stringifyExportJson } from "@/lib/addons/exportSchemaResolver";
import { importJsonToAddons } from "@/lib/addons/exportSchemaImporter";
import { useProjectStore } from "@/store/projectStore";
import {
  SHELL,
  BLOCK,
  INPUT,
  SELECT,
  BTN,
  BTN_DANGER,
  BTN_PRIMARY,
  uid,
  addChildToNode,
  duplicateInList,
  makeNewNode,
  AddIcon,
  AddNodeButton,
  CollapseBroadcastContext,
  type CollapseBroadcast,
  NodeValuePreviewContext,
  SchemaNodeEditor,
  SortableNodeList,
} from "./exportSchema/SchemaTreeEditor";

/** Recursively patch addonId references in export schema nodes to use reused IDs */
function patchNodeAddonIds(
  node: ExportSchemaNode,
  idMap: Map<string, string> // newId → existingId
): ExportSchemaNode {
  let patched = node;

  // Patch binding addonId (only dataSchema bindings have addonId)
  if (node.binding && "addonId" in node.binding && idMap.has(node.binding.addonId)) {
    patched = {
      ...patched,
      binding: { ...node.binding, addonId: idMap.get(node.binding.addonId)! },
    };
  }

  // Patch arraySource addonId (only sources that carry one)
  if (
    node.arraySource &&
    (node.arraySource.type === "progressionTable" || node.arraySource.type === "craftTable") &&
    node.arraySource.addonId &&
    idMap.has(node.arraySource.addonId)
  ) {
    patched = {
      ...patched,
      arraySource: { ...node.arraySource, addonId: idMap.get(node.arraySource.addonId)! },
    };
  }

  // Recurse into children and itemTemplate
  if (node.children) {
    patched = { ...patched, children: node.children.map((c) => patchNodeAddonIds(c, idMap)) };
  }
  if (node.itemTemplate) {
    patched = { ...patched, itemTemplate: node.itemTemplate.map((c) => patchNodeAddonIds(c, idMap)) };
  }

  return patched;
}

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
  const [collapseBroadcast, setCollapseBroadcast] = useState<CollapseBroadcast | null>(null);

  const triggerExpandAll = () => setCollapseBroadcast((prev) => ({ version: (prev?.version ?? 0) + 1, target: "expand" }));
  const triggerCollapseAll = () => setCollapseBroadcast((prev) => ({ version: (prev?.version ?? 0) + 1, target: "collapse" }));

  // Find sibling addons from the store if not provided externally
  const projects = useProjectStore((s) => s.projects);
  const setSectionAddons = useProjectStore((s) => s.setSectionAddons);

  const sectionContext = useMemo(() => {
    const matchesSelf = (a: SectionAddon) => a.id === addon.id || a.data?.id === addon.id;
    for (const proj of projects) {
      for (const sec of proj.sections ?? []) {
        const found = (sec.addons ?? []).find(matchesSelf);
        if (found) return { projectId: proj.id, sectionId: sec.id, addons: sec.addons ?? [], dataId: sec.dataId, sectionTitle: sec.title || "section" };
      }
    }
    return null;
  }, [projects, addon.id]);

  // group is on the SectionAddon wrapper, not the draft
  const matchesSelf = (a: SectionAddon) => a.id === addon.id || a.data?.id === addon.id;
  const myAddonWrapper = sectionContext?.addons.find(matchesSelf);
  const myGroup = (myAddonWrapper as any)?.group || "A";
  const sectionAddons = externalAddons ?? (sectionContext?.addons.filter((a: SectionAddon) => !matchesSelf(a) && ((a as any).group || "A") === myGroup) ?? []);

  // Column libraries are cross-section — collect from the whole project so libraryRef keys resolve.
  const globalFieldLibraries = useMemo<SectionAddon[]>(() => {
    const out: SectionAddon[] = [];
    const seen = new Set<string>();
    for (const proj of projects) {
      for (const sec of proj.sections ?? []) {
        for (const sa of sec.addons ?? []) {
          if (sa.type !== "fieldLibrary") continue;
          if (seen.has(sa.id)) continue;
          seen.add(sa.id);
          out.push(sa);
        }
      }
    }
    return out;
  }, [projects]);

  const resolverAddons = useMemo<SectionAddon[]>(
    () => [...sectionAddons, ...globalFieldLibraries.filter((a) => !sectionAddons.some((s) => s.id === a.id))],
    [sectionAddons, globalFieldLibraries]
  );

  const commit = useCallback(
    (nodes: ExportSchemaNode[]) => onChange({ ...addon, nodes }),
    [addon, onChange]
  );

  const addRootNode = (type: "value" | "object" | "array" = "value") => {
    commit([...addon.nodes, makeNewNode(type)]);
  };

  const handleAddChild = (
    parentId: string,
    isTemplate: boolean,
    type: "value" | "object" | "array" = "value"
  ) => {
    commit(addChildToNode(addon.nodes, parentId, makeNewNode(type), isTemplate));
  };

  const sectionLookup = useMemo(() => buildSectionLookup(projects), [projects]);

  // Resolved value per node (first iteration of any array wins). Used to render
  // inline preview chips next to each leaf in the tree editor.
  const nodeValueMap = useMemo(
    () => resolveExportSchemaWithPreview(addon.nodes, resolverAddons, sectionContext?.dataId, addon.arrayFormat, sectionLookup).nodeValueMap,
    [addon.nodes, resolverAddons, sectionContext?.dataId, addon.arrayFormat, sectionLookup]
  );

  // The arrayFormat selector only affects ProgressionTable iteration. If the schema
  // doesn't use any ProgressionTable array source, the format is irrelevant — we
  // disable the selector to avoid confusing the user.
  const hasProgressionArraySource = useMemo(() => {
    const walk = (nodes: ExportSchemaNode[]): boolean => {
      for (const n of nodes) {
        if (n.nodeType === "array" && n.arraySource?.type === "progressionTable") return true;
        if (n.children && walk(n.children)) return true;
        if (n.itemTemplate && walk(n.itemTemplate)) return true;
      }
      return false;
    };
    return walk(addon.nodes);
  }, [addon.nodes]);

  const resolved = useMemo(
    () => (showPreview ? resolveExportSchema(addon.nodes, resolverAddons, sectionContext?.dataId, addon.arrayFormat, sectionLookup) : null),
    [showPreview, addon.nodes, resolverAddons, sectionContext?.dataId, addon.arrayFormat, sectionLookup]
  );

  const jsonString = useMemo(
    () => (resolved ? stringifyExportJson(resolved) : ""),
    [resolved]
  );

  const handleCopy = async () => {
    const json = stringifyExportJson(resolveExportSchema(addon.nodes, resolverAddons, sectionContext?.dataId, addon.arrayFormat, sectionLookup));
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const json = stringifyExportJson(resolveExportSchema(addon.nodes, resolverAddons, sectionContext?.dataId, addon.arrayFormat, sectionLookup));
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${addon.name || "export"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Collect all groups in this section that have a Remote Config addon
  const sectionGroups = useMemo(() => {
    if (!sectionContext) return [] as string[];
    const groups = new Set<string>();
    for (const a of sectionContext.addons) {
      if (a.type === "exportSchema") groups.add((a as any).group || "A");
    }
    return Array.from(groups).sort();
  }, [sectionContext]);

  const [downloadingAll, setDownloadingAll] = useState(false);

  const sanitizeFilename = (name: string) => name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/\s+/g, "_").trim().slice(0, 80);

  const handleDownloadAll = async () => {
    if (!sectionContext) return;
    setDownloadingAll(true);
    try {
      const JSZip = (await import(/* webpackChunkName: "jszip" */ "jszip")).default;
      const zip = new JSZip();
      const sectionName = sanitizeFilename(sectionContext.sectionTitle);

      for (const group of sectionGroups) {
        // Find the Remote Config addon in this group
        const rcAddon = sectionContext.addons.find((a) => a.type === "exportSchema" && ((a as any).group || "A") === group);
        if (!rcAddon) continue;
        // Get sibling addons from the same group (excluding the RC itself) + cross-section libraries
        const siblings = sectionContext.addons.filter((a) => a.id !== rcAddon.id && ((a as any).group || "A") === group);
        const pool = [...siblings, ...globalFieldLibraries.filter((lib) => !siblings.some((s) => s.id === lib.id))];
        const rcDraft = rcAddon.data as ExportSchemaAddonDraft;
        const json = resolveExportSchema(rcDraft.nodes, pool, sectionContext.dataId, rcDraft.arrayFormat, sectionLookup);
        const filename = `${sectionName}_${sanitizeFilename(group)}.json`;
        zip.file(filename, stringifyExportJson(json));
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sectionName}_grupos.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingAll(false);
    }
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

    const { newAddons, exportSchemaNodes, arrayFormat } = importJsonToAddons(parsed);

    // Add new addons to the section via the store, then update the export schema
    if (sectionContext && newAddons.length > 0) {
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

      // Existing addons in the same group (excluding the RC itself)
      const groupAddons = fullAddons.filter(
        (a) => a.id !== addon.id && ((a as any).group || "A") === myGroup
      );

      // Reuse existing addons by type+name instead of always creating new ones
      const reusedIds = new Map<string, string>(); // newId → existingId
      const trulyNewAddons: SectionAddon[] = [];
      for (const imported of newAddons) {
        const existing = groupAddons.find(
          (a) => a.type === imported.type && a.name === imported.name
        );
        if (existing) {
          // Reuse existing addon id, replace data
          reusedIds.set(imported.id, existing.id);
        } else {
          trulyNewAddons.push(imported);
        }
      }

      // Assign the same group as this Remote Config addon
      const groupedNewAddons: SectionAddon[] = myGroup !== "A"
        ? trulyNewAddons.map((a) => ({ ...a, group: myGroup } as SectionAddon))
        : trulyNewAddons;

      // Patch exportSchemaNodes bindings to reference reused addon ids
      const patchedNodes = reusedIds.size > 0
        ? exportSchemaNodes.map((node) => patchNodeAddonIds(node, reusedIds))
        : exportSchemaNodes;

      const updatedExportSchemaAddon: SectionAddon = {
        id: addon.id,
        type: "exportSchema",
        name: addon.name,
        group: myGroup !== "A" ? myGroup : undefined,
        data: { ...addon, nodes: patchedNodes, arrayFormat },
      };

      // Build merged list: update reused addons in-place, append truly new ones
      const mergedAddons: SectionAddon[] = [
        ...groupedNewAddons,
        ...fullAddons.map((a) => {
          if (a.id === addon.id) return updatedExportSchemaAddon;
          // Check if this existing addon should be replaced with imported data
          const importedMatch = newAddons.find(
            (imp) => reusedIds.get(imp.id) === a.id
          );
          if (importedMatch) {
            return {
              ...a,
              data: { ...importedMatch.data, id: a.id },
            } as SectionAddon;
          }
          return a;
        }),
      ];
      setSectionAddons(sectionContext.projectId, sectionContext.sectionId, mergedAddons);
    } else {
      // No store context, just update the schema nodes
      onChange({ ...addon, nodes: exportSchemaNodes, arrayFormat });
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
            {addon.nodes.length > 0 && (
              <div className="mb-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={triggerExpandAll}
                  className="rounded-md border border-gray-700 bg-gray-800 px-2 py-0.5 text-[10px] text-gray-300 hover:bg-gray-700 hover:text-white"
                  title="Expandir todos os nós da árvore"
                >
                  ▼ Expandir tudo
                </button>
                <button
                  type="button"
                  onClick={triggerCollapseAll}
                  className="rounded-md border border-gray-700 bg-gray-800 px-2 py-0.5 text-[10px] text-gray-300 hover:bg-gray-700 hover:text-white"
                  title="Recolher todos os nós da árvore"
                >
                  ▶ Recolher tudo
                </button>
              </div>
            )}
            <CollapseBroadcastContext.Provider value={collapseBroadcast}>
            <NodeValuePreviewContext.Provider value={nodeValueMap}>
            <SortableNodeList
              nodes={addon.nodes}
              onReorder={(next) => commit(next)}
              renderItem={(node) => (
                <SchemaNodeEditor
                  node={node}
                  onUpdate={(updated) =>
                    commit(addon.nodes.map((n) => (n.id === updated.id ? updated : n)))
                  }
                  onRemove={() => commit(addon.nodes.filter((n) => n.id !== node.id))}
                  onDuplicate={() => commit(duplicateInList(addon.nodes, node.id))}
                  onAddChild={handleAddChild}
                  sectionAddons={sectionAddons}
                  depth={0}
                  insideArray={false}
                  readOnly={false}
                />
              )}
            />
            </NodeValuePreviewContext.Provider>
            </CollapseBroadcastContext.Provider>
            <div className="mt-2">
              <AddNodeButton
                label={<>na <span className="font-mono text-gray-200">raiz</span></>}
                title="Adicionar propriedade na raiz do JSON"
                onAdd={addRootNode}
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <label
          className={`flex items-center gap-1.5 text-xs ${hasProgressionArraySource ? "text-gray-400" : "text-gray-500 opacity-60"}`}
          title={
            hasProgressionArraySource
              ? "Formato do JSON para nós array (tabelas de balanceamento)"
              : "Este schema não itera tabelas de balanceamento — formato fixo em rowMajor."
          }
        >
          Formato:
          <select
            className={SELECT + " !text-xs"}
            value={hasProgressionArraySource ? (addon.arrayFormat ?? "rowMajor") : "rowMajor"}
            disabled={!hasProgressionArraySource}
            onChange={(e) =>
              onChange({ ...addon, arrayFormat: e.target.value as ExportSchemaArrayFormat })
            }
          >
            <option value="rowMajor">Row-major (array de objetos)</option>
            <option value="columnMajor">Column-major (objeto de arrays)</option>
            <option value="keyedByLevel">Keyed by level (índice por nível)</option>
            <option value="matrix">Matrix (headers + rows)</option>
          </select>
        </label>
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
        {sectionGroups.length >= 2 && (
          <button
            type="button"
            className={BTN}
            onClick={handleDownloadAll}
            disabled={downloadingAll}
            title="Baixa um .zip com um JSON por grupo"
          >
            {downloadingAll ? "Gerando..." : `Download Todos os Grupos (${sectionGroups.length})`}
          </button>
        )}
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
