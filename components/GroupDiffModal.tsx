"use client";

import { useMemo, useState } from "react";
import type { SectionAddon, ExportSchemaAddonDraft } from "@/lib/addons/types";
import { resolveExportSchema } from "@/lib/addons/exportSchemaResolver";
import { diffJson, type DiffEntry } from "@/lib/addons/groupDiff";

interface GroupDiffModalProps {
  addons: SectionAddon[];
  groups: string[];
  sectionDataId?: string;
  onClose: () => void;
}

function formatValue(v: unknown): string {
  if (v === undefined || v === null) return "—";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "string") return v.length > 40 ? v.slice(0, 37) + "..." : v;
  return JSON.stringify(v);
}

function formatPercent(p: number | undefined): string {
  if (p === undefined) return "";
  const sign = p >= 0 ? "+" : "";
  return `${sign}${p.toFixed(1)}%`;
}

export function GroupDiffModal({ addons, groups, sectionDataId, onClose }: GroupDiffModalProps) {
  const [groupA, setGroupA] = useState(groups[0] ?? "A");
  const [groupB, setGroupB] = useState(groups[1] ?? groups[0] ?? "A");

  const resolveGroupJson = (group: string): Record<string, unknown> | null => {
    const gAddons = addons.filter((a) => ((a as any).group || "A") === group);
    const exportAddon = gAddons.find((a) => a.type === "exportSchema");
    if (!exportAddon) return null;
    const draft = exportAddon.data as ExportSchemaAddonDraft;
    const siblings = gAddons.filter((a) => a.id !== exportAddon.id);
    return resolveExportSchema(draft.nodes, siblings, sectionDataId, draft.arrayFormat);
  };

  const jsonA = useMemo(() => resolveGroupJson(groupA), [addons, groupA, sectionDataId]);
  const jsonB = useMemo(() => resolveGroupJson(groupB), [addons, groupB, sectionDataId]);

  const diffs = useMemo<DiffEntry[]>(() => {
    if (!jsonA || !jsonB) return [];
    return diffJson(jsonA, jsonB);
  }, [jsonA, jsonB]);

  const noRemoteConfig = !jsonA && !jsonB;
  const onlyOneHasRC = (!jsonA && jsonB) || (jsonA && !jsonB);

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} />
      <div className="fixed inset-4 md:inset-12 z-[70] flex items-start justify-center overflow-y-auto pt-8">
        <div className="w-full max-w-3xl rounded-xl border border-gray-700 bg-gray-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
            <h3 className="text-sm font-semibold text-gray-200">Comparar Grupos</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 text-lg leading-none"
            >
              ✕
            </button>
          </div>

          {/* Group selectors */}
          <div className="px-5 py-3 flex items-center gap-3 border-b border-gray-800">
            <select
              value={groupA}
              onChange={(e) => setGroupA(e.target.value)}
              className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs text-white outline-none"
            >
              {groups.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <span className="text-xs text-gray-500">vs</span>
            <select
              value={groupB}
              onChange={(e) => setGroupB(e.target.value)}
              className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs text-white outline-none"
            >
              {groups.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            {groupA === groupB && (
              <span className="text-[10px] text-amber-400">Selecione grupos diferentes</span>
            )}
          </div>

          {/* Content */}
          <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
            {noRemoteConfig && (
              <p className="text-xs text-gray-500 italic">
                Nenhum grupo possui addon Remote Config. Adicione um Remote Config para comparar.
              </p>
            )}
            {onlyOneHasRC && (
              <p className="text-xs text-amber-400 italic">
                Apenas um dos grupos possui Remote Config. Ambos precisam ter para comparar.
              </p>
            )}
            {jsonA && jsonB && groupA === groupB && (
              <p className="text-xs text-gray-500 italic">Selecione dois grupos diferentes para ver as diferencas.</p>
            )}
            {jsonA && jsonB && groupA !== groupB && diffs.length === 0 && (
              <p className="text-xs text-emerald-400">Nenhuma diferenca encontrada. Os grupos geram JSONs identicos.</p>
            )}
            {jsonA && jsonB && groupA !== groupB && diffs.length > 0 && (
              <>
                <p className="text-xs text-gray-400 mb-3">{diffs.length} diferenca{diffs.length !== 1 ? "s" : ""} encontrada{diffs.length !== 1 ? "s" : ""}</p>
                <div className="space-y-1">
                  {diffs.map((d, i) => {
                    const pct = d.percentChange;
                    const isIncrease = pct !== undefined && pct > 0;
                    const isDecrease = pct !== undefined && pct < 0;
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-2 py-1.5 px-2 rounded-lg text-xs border border-gray-800 bg-gray-800/30"
                      >
                        <span className="font-mono text-gray-400 truncate min-w-0 flex-1" title={d.path}>
                          {d.path}
                        </span>
                        <span className="font-mono text-gray-500 shrink-0">{formatValue(d.valueA)}</span>
                        <span className="text-gray-600 shrink-0">→</span>
                        <span className="font-mono text-white shrink-0">{formatValue(d.valueB)}</span>
                        {pct !== undefined && (
                          <span className={`font-mono text-[10px] shrink-0 px-1.5 py-0.5 rounded ${
                            isIncrease ? "text-emerald-300 bg-emerald-900/30" : isDecrease ? "text-rose-300 bg-rose-900/30" : "text-gray-400"
                          }`}>
                            {formatPercent(pct)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-gray-700 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
