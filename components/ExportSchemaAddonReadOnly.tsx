"use client";

import { useMemo, useState } from "react";
import type {
  ExportSchemaAddonDraft,
  ExportSchemaArrayFormat,
  ExportSchemaNode,
  SectionAddon,
} from "@/lib/addons/types";
import { buildSectionLookup, resolveExportSchema, stringifyExportJson } from "@/lib/addons/exportSchemaResolver";
import { useProjectStore } from "@/store/projectStore";

interface ExportSchemaAddonReadOnlyProps {
  addon: ExportSchemaAddonDraft;
  sectionAddons?: SectionAddon[];
  theme?: "dark" | "light";
  bare?: boolean;
}

export function ExportSchemaAddonReadOnly({
  addon,
  sectionAddons: externalAddons,
  theme = "dark",
  bare = false,
}: ExportSchemaAddonReadOnlyProps) {
  const [copied, setCopied] = useState(false);
  // Local (transient) override so the user can preview/copy/download in any
  // format without entering edit mode. Tracks the persisted addon format and
  // resyncs if the stored value changes (e.g. after editing). Follows the
  // React "adjusting state on prop change" pattern.
  const [format, setFormat] = useState<ExportSchemaArrayFormat>(
    addon.arrayFormat ?? "rowMajor"
  );
  const [prevStoredFormat, setPrevStoredFormat] = useState(addon.arrayFormat);
  if (prevStoredFormat !== addon.arrayFormat) {
    setPrevStoredFormat(addon.arrayFormat);
    setFormat(addon.arrayFormat ?? "rowMajor");
  }

  const projects = useProjectStore((s) => s.projects);

  // Resolve section addons and dataId from the store if not provided externally
  const sectionContext = useMemo(() => {
    if (externalAddons) return { addons: externalAddons, dataId: undefined as string | undefined };

    const matchesSelf = (a: SectionAddon) => a.id === addon.id || a.data?.id === addon.id;
    for (const proj of projects) {
      for (const sec of proj.sections ?? []) {
        const wrapper = (sec.addons ?? []).find(matchesSelf);
        if (wrapper) {
          const myGroup = (wrapper as any)?.group || "A";
          return {
            addons: (sec.addons ?? []).filter(
              (a: SectionAddon) => !matchesSelf(a) && ((a as any).group || "A") === myGroup
            ),
            dataId: sec.dataId,
          };
        }
      }
    }
    return { addons: [] as SectionAddon[], dataId: undefined as string | undefined };
  }, [externalAddons, projects, addon.id]);

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
    () => [...sectionContext.addons, ...globalFieldLibraries.filter((a) => !sectionContext.addons.some((s) => s.id === a.id))],
    [sectionContext, globalFieldLibraries]
  );

  const sectionLookup = useMemo(() => buildSectionLookup(projects), [projects]);

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
    () => resolveExportSchema(addon.nodes, resolverAddons, sectionContext.dataId, format, sectionLookup),
    [addon.nodes, resolverAddons, sectionContext, format, sectionLookup],
  );

  const jsonString = useMemo(
    () => stringifyExportJson(resolved),
    [resolved],
  );

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${addon.name || "export"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isDark = theme === "dark";

  if (addon.nodes.length === 0) {
    return (
      <p className={`text-xs italic ${isDark ? "text-gray-500" : "text-gray-400"}`}>
        Nenhuma propriedade definida no schema de exportacao.
      </p>
    );
  }

  const btnClass = `rounded-lg border px-2.5 py-1 text-xs ${
    isDark
      ? "border-gray-600 bg-gray-800 text-gray-100 hover:bg-gray-700"
      : "border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200"
  }`;
  const selectClass = `rounded-lg border px-2 py-1 text-xs outline-none ${
    isDark
      ? "border-gray-600 bg-gray-800 text-gray-100"
      : "border-gray-300 bg-gray-100 text-gray-700"
  }`;

  const outerClass = bare
    ? ""
    : `rounded-xl p-3 ${isDark ? "border border-gray-700 bg-gray-900/40" : "border border-gray-300 bg-white"}`;

  return (
    <div className={outerClass}>
      <div className={`flex items-center ${bare ? "justify-end" : "justify-between mb-2"} gap-2 flex-wrap`}>
        {!bare && (
          <h5 className={`text-sm font-semibold ${isDark ? "text-gray-200" : "text-gray-900"}`}>
            {addon.name || "Remote Config"}
          </h5>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <label
            className={`flex items-center gap-1.5 text-xs ${
              hasProgressionArraySource
                ? (isDark ? "text-gray-400" : "text-gray-600")
                : (isDark ? "text-gray-500" : "text-gray-500") + " opacity-60"
            }`}
            title={
              hasProgressionArraySource
                ? "Formato do JSON para nós array (tabelas de balanceamento)"
                : "Este schema não itera tabelas de balanceamento — formato fixo em rowMajor."
            }
          >
            Formato:
            <select
              className={selectClass}
              value={hasProgressionArraySource ? format : "rowMajor"}
              disabled={!hasProgressionArraySource}
              onChange={(e) => setFormat(e.target.value as ExportSchemaArrayFormat)}
            >
              <option value="rowMajor">Row-major (array de objetos)</option>
              <option value="columnMajor">Column-major (objeto de arrays)</option>
              <option value="keyedByLevel">Keyed by level (índice por nível)</option>
              <option value="matrix">Matrix (headers + rows)</option>
            </select>
          </label>
          <button type="button" className={btnClass} onClick={handleCopy}>
            {copied ? "Copiado!" : "Copiar JSON"}
          </button>
          <button type="button" className={btnClass} onClick={handleDownload}>
            Download JSON
          </button>
        </div>
      </div>
      <pre
        className={`text-xs font-mono whitespace-pre overflow-x-auto max-h-64 overflow-y-auto rounded-lg p-3 ${
          isDark ? "bg-gray-950/60 text-green-300" : "bg-gray-50 text-green-700"
        }`}
      >
        {jsonString}
      </pre>
    </div>
  );
}
