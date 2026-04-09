"use client";

import { useMemo, useState } from "react";
import type { ExportSchemaAddonDraft, SectionAddon } from "@/lib/addons/types";
import { resolveExportSchema } from "@/lib/addons/exportSchemaResolver";
import { useProjectStore } from "@/store/projectStore";

interface ExportSchemaAddonReadOnlyProps {
  addon: ExportSchemaAddonDraft;
  sectionAddons?: SectionAddon[];
  theme?: "dark" | "light";
}

export function ExportSchemaAddonReadOnly({
  addon,
  sectionAddons: externalAddons,
  theme = "dark",
}: ExportSchemaAddonReadOnlyProps) {
  const [copied, setCopied] = useState(false);

  const projects = useProjectStore((s) => s.projects);

  // Resolve section addons and dataId from the store if not provided externally
  const sectionContext = useMemo(() => {
    if (externalAddons) return { addons: externalAddons, dataId: undefined as string | undefined };

    for (const proj of projects) {
      for (const sec of proj.sections ?? []) {
        const found = (sec.addons ?? []).find((a: SectionAddon) => a.id === addon.id);
        if (found) {
          return { addons: (sec.addons ?? []).filter((a: SectionAddon) => a.id !== addon.id), dataId: sec.dataId };
        }
      }
    }
    return { addons: [] as SectionAddon[], dataId: undefined as string | undefined };
  }, [externalAddons, projects, addon.id]);

  const resolved = useMemo(
    () => resolveExportSchema(addon.nodes, sectionContext.addons, sectionContext.dataId),
    [addon.nodes, sectionContext],
  );

  const jsonString = useMemo(
    () => JSON.stringify(resolved, null, 4),
    [resolved],
  );

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isDark = theme === "dark";

  if (addon.nodes.length === 0) {
    return (
      <p className={`text-xs italic ${isDark ? "text-gray-500" : "text-gray-400"}`}>
        Nenhuma propriedade definida no schema de exportacao.
      </p>
    );
  }

  return (
    <div
      className={`mt-3 rounded-xl p-3 ${
        isDark ? "border border-gray-700 bg-gray-900/40" : "border border-gray-300 bg-white"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <h5 className={`text-sm font-semibold ${isDark ? "text-gray-200" : "text-gray-900"}`}>
          {addon.name || "Remote Config"}
        </h5>
        <button
          type="button"
          className={`rounded-lg border px-2.5 py-1 text-xs ${
            isDark
              ? "border-gray-600 bg-gray-800 text-gray-100 hover:bg-gray-700"
              : "border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
          onClick={handleCopy}
        >
          {copied ? "Copiado!" : "Copiar JSON"}
        </button>
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
