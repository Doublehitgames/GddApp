"use client";

import { useMemo } from "react";
import type { CropAddonDraft, CropSeason } from "@/lib/addons/types";
import { CROP_SEED_SELF } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";

interface CropAddonReadOnlyProps {
  addon: CropAddonDraft;
  theme?: "dark" | "light";
  bare?: boolean;
}

const SEASON_LABELS: Record<CropSeason, string> = {
  spring: "🌸 Primavera",
  summer: "☀️ Verão",
  fall: "🍂 Outono",
  winter: "❄️ Inverno",
  greenhouse: "🏠 Estufa",
};

function formatSeconds(s: number | undefined): string {
  if (s == null) return "—";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function CropAddonReadOnly({ addon, theme = "dark", bare }: CropAddonReadOnlyProps) {
  const { t } = useI18n();
  const allProjects = useProjectStore((state) => state.projects);

  const isDark = theme === "dark";

  const sectionTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of allProjects) {
      for (const section of project.sections || []) {
        map.set(section.id, section.title || section.id);
      }
    }
    return map;
  }, [allProjects]);

  const harvestInterval =
    addon.harvestMode === "progressive" &&
    addon.growthSeconds &&
    addon.totalHarvest &&
    addon.totalHarvest > 0
      ? Math.round(addon.growthSeconds / addon.totalHarvest)
      : null;

  const shell = bare
    ? ""
    : isDark
    ? "rounded-2xl border border-gray-700/60 bg-gray-900/60 p-4"
    : "rounded-2xl border border-gray-200 bg-white p-4";

  const labelClass = isDark ? "text-[10px] text-gray-500 uppercase tracking-wide" : "text-[10px] text-gray-400 uppercase tracking-wide";
  const valueClass = isDark ? "text-sm text-gray-100" : "text-sm text-gray-800";
  const chipClass = isDark
    ? "rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-300"
    : "rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600";
  const blockClass = isDark
    ? "rounded-xl border border-gray-700/60 bg-gray-800/50 p-3"
    : "rounded-xl border border-gray-200 bg-gray-50 p-3";

  const renderRow = (label: string, value: React.ReactNode) => (
    <div className="flex items-baseline justify-between gap-3">
      <span className={labelClass}>{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );

  const modeBadge = (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        addon.harvestMode === "instant"
          ? "bg-emerald-900/60 text-emerald-300"
          : "bg-blue-900/60 text-blue-300"
      }`}
    >
      {addon.harvestMode === "instant"
        ? t("cropAddon.modeInstant", "Instantânea")
        : t("cropAddon.modeProgressive", "Progressiva")}
    </span>
  );

  return (
    <div className={shell}>
      {!bare && (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-base">🌱</span>
          <span className={isDark ? "text-sm font-semibold text-gray-100" : "text-sm font-semibold text-gray-800"}>
            {addon.name}
          </span>
          {modeBadge}
        </div>
      )}

      {/* Growth cycle */}
      <div className={`${blockClass} mb-3 space-y-2`}>
        <p className={`${labelClass} mb-1`}>{t("cropAddon.growthCycle", "Ciclo de crescimento")}</p>
        {renderRow(
          t("cropAddon.growthSeconds", "Tempo"),
          <span className="font-mono">{formatSeconds(addon.growthSeconds)}</span>
        )}
        {addon.growthSecondsMin != null || addon.growthSecondsMax != null ? (
          renderRow(
            t("cropAddon.growthLimits", "Limites"),
            <span className="font-mono text-gray-400">
              {addon.growthSecondsMin != null ? formatSeconds(addon.growthSecondsMin) : "—"}
              {" → "}
              {addon.growthSecondsMax != null ? formatSeconds(addon.growthSecondsMax) : "—"}
            </span>
          )
        ) : null}
        {addon.harvestMode === "progressive" && addon.totalHarvest != null && (
          <>
            {renderRow(
              t("cropAddon.totalHarvest", "Total de colheitas"),
              <span className="font-mono">{addon.totalHarvest}×</span>
            )}
            {harvestInterval !== null &&
              renderRow(
                t("cropAddon.harvestInterval", "Intervalo"),
                <span className="font-mono text-green-400">~{harvestInterval}s</span>
              )}
          </>
        )}

        {/* Stages */}
        {(addon.stages || []).length > 0 && (
          <div className="mt-2">
            <p className={`${labelClass} mb-1`}>{t("cropAddon.stages", "Estágios visuais")}</p>
            <div className="flex flex-wrap gap-1.5">
              {addon.stages.map((stage, idx) => (
                <div key={stage.id} className="flex items-center gap-1">
                  <span className={chipClass}>
                    {idx + 1}. {stage.label}
                  </span>
                  <span className="text-[10px] text-gray-600">@{formatSeconds(stage.secondsFromPlanting)}</span>
                  {idx < addon.stages.length - 1 && (
                    <span className="text-gray-600">→</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Outputs */}
      {(addon.outputs || []).length > 0 && (
        <div className={`${blockClass} mb-3`}>
          <p className={`${labelClass} mb-2`}>{t("cropAddon.outputs", "Saídas da colheita")}</p>
          <div className="space-y-1">
            {addon.outputs.map((output) => {
              const itemLabel = output.itemRef ? (sectionTitleById.get(output.itemRef) ?? output.itemRef) : "—";
              const base = output.quantity != null ? String(output.quantity) : "—";
              const hasBounds = output.quantityMin != null || output.quantityMax != null;
              const qtyStr = hasBounds
                ? `${base} (${output.quantityMin ?? "—"}–${output.quantityMax ?? "—"})`
                : base;
              return (
                <div key={output.id} className="flex items-center justify-between gap-2">
                  <span className={valueClass}>{itemLabel}</span>
                  <span className={`font-mono ${isDark ? "text-green-400" : "text-green-700"}`}>×{qtyStr}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* XP */}
      {(addon.plantXp.xp != null || addon.harvestXp.xp != null) && (
        <div className={`${blockClass} mb-3 space-y-1`}>
          <p className={`${labelClass} mb-1`}>{t("cropAddon.xp", "XP")}</p>
          {addon.plantXp.xp != null && (
            <div className="flex items-center justify-between gap-2">
              <span className={labelClass}>{t("cropAddon.plantXp", "Ao plantar")}</span>
              <span className={`font-mono ${isDark ? "text-yellow-400" : "text-yellow-700"}`}>
                +{addon.plantXp.xp} XP
                {addon.plantXp.xpAddonRef && (
                  <span className="ml-1 text-[10px] text-gray-500">
                    ({sectionTitleById.get(addon.plantXp.xpAddonRef) ?? addon.plantXp.xpAddonRef})
                  </span>
                )}
              </span>
            </div>
          )}
          {addon.harvestXp.xp != null && (
            <div className="flex items-center justify-between gap-2">
              <span className={labelClass}>
                {t("cropAddon.harvestXp", "Ao colher")}
                {addon.harvestMode === "progressive" && (
                  <span className="ml-1 text-gray-600">{t("cropAddon.harvestXpProgressiveHint", "/un.")}</span>
                )}
              </span>
              <span className={`font-mono ${isDark ? "text-yellow-400" : "text-yellow-700"}`}>
                +{addon.harvestXp.xp} XP
                {addon.harvestXp.xpAddonRef && (
                  <span className="ml-1 text-[10px] text-gray-500">
                    ({sectionTitleById.get(addon.harvestXp.xpAddonRef) ?? addon.harvestXp.xpAddonRef})
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Post-harvest */}
      {addon.spawnWitheredPlant && (
        <div className={`${blockClass} mb-3`}>
          <p className={`${labelClass} mb-1`}>{t("cropAddon.postHarvest", "Pós-colheita")}</p>
          <div className="flex items-center gap-2">
            <span className="text-base">🥀</span>
            <span className={valueClass}>
              {t("cropAddon.spawnWithered", "Spawna planta murcha")}
              {addon.witheredPlantRef && (
                <span className={`ml-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  → {sectionTitleById.get(addon.witheredPlantRef) ?? addon.witheredPlantRef}
                </span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Planting */}
      {(addon.seedRef || addon.plantEnergy != null) && (
        <div className={`${blockClass} mb-3 space-y-1`}>
          <p className={`${labelClass} mb-1`}>{t("cropAddon.planting", "Plantio")}</p>
          {addon.seedRef && renderRow(
            t("cropAddon.seed", "Semente"),
            <>
              {addon.seedRef === CROP_SEED_SELF
                ? t("cropAddon.seedSelf", "Esta página (semente própria)")
                : (sectionTitleById.get(addon.seedRef) ?? addon.seedRef)}
              {addon.seedQuantity != null && (
                <span className="ml-1 text-gray-500">×{addon.seedQuantity}</span>
              )}
            </>
          )}
          {addon.plantEnergy != null && renderRow(
            t("cropAddon.plantEnergy", "Energia"),
            <span className="font-mono">{addon.plantEnergy}</span>
          )}
        </div>
      )}

      {/* Accepted inputs */}
      {((addon.fertilizers || []).length > 0 || (addon.amendments || []).length > 0) && (
        <div className={`${blockClass} mb-3 space-y-2`}>
          <p className={`${labelClass} mb-1`}>{t("cropAddon.inputs", "Insumos aceitos")}</p>
          {(addon.fertilizers || []).length > 0 && (
            <div>
              <span className={labelClass}>{t("cropAddon.fertilizers", "Fertilizantes")} </span>
              <div className="mt-1 flex flex-wrap gap-1">
                {addon.fertilizers.map((f) => (
                  <span key={f.id} className={chipClass}>
                    {f.itemRef ? (sectionTitleById.get(f.itemRef) ?? f.itemRef) : "—"}
                  </span>
                ))}
              </div>
            </div>
          )}
          {(addon.amendments || []).length > 0 && (
            <div>
              <span className={labelClass}>{t("cropAddon.amendments", "Adubos")} </span>
              <div className="mt-1 flex flex-wrap gap-1">
                {addon.amendments.map((a) => (
                  <span key={a.id} className={chipClass}>
                    {a.itemRef ? (sectionTitleById.get(a.itemRef) ?? a.itemRef) : "—"}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Seasons */}
      {(addon.seasons || []).length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {addon.seasons!.map((s) => (
            <span key={s} className={`${chipClass} text-xs`}>
              {SEASON_LABELS[s]}
            </span>
          ))}
        </div>
      )}

      {/* Notes */}
      {addon.notes && (
        <p className={`mt-2 text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
          {addon.notes}
        </p>
      )}
    </div>
  );
}
