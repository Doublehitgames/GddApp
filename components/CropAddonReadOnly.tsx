"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
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
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
  }
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

  /* ── helpers ── */

  const sectionName = (id: string | undefined): string =>
    id ? (sectionTitleById.get(id) ?? id) : "—";

  const renderRef = (id: string | undefined): ReactNode => {
    if (!id) return <span className={isDark ? "text-gray-500" : "text-gray-400"}>não definido</span>;
    return (
      <span className={isDark ? "text-sky-300" : "text-blue-600"}>
        {sectionTitleById.get(id) ?? id}
      </span>
    );
  };

  const bold = (value: ReactNode): ReactNode => (
    <span className={isDark ? "font-medium text-white" : "font-medium text-gray-900"}>{value}</span>
  );

  const greenNum = (n: number | undefined): ReactNode =>
    n != null ? (
      <span className={isDark ? "font-medium text-green-300" : "font-medium text-green-700"}>{n}</span>
    ) : null;

  const yellowNum = (n: number): ReactNode => (
    <span className={isDark ? "font-medium text-yellow-300" : "font-medium text-yellow-600"}>+{n} XP</span>
  );

  /* ── derived values ── */

  const outputs = addon.outputs || [];
  const fertilizers = addon.fertilizers || [];
  const amendments = addon.amendments || [];
  const seasons = addon.seasons || [];
  const stages = addon.stages || [];

  const harvestInterval =
    addon.harvestMode === "progressive" &&
    addon.growthSeconds &&
    addon.totalHarvest &&
    addon.totalHarvest > 0
      ? Math.round(addon.growthSeconds / addon.totalHarvest)
      : null;

  const hasPlantXp = addon.plantXp?.xp != null;
  const hasHarvestXp = addon.harvestXp?.xp != null;

  /* ── paragraph renderers ── */

  const renderOutputItem = (o: (typeof outputs)[number], i: number): ReactNode => {
    const hasBounds = o.quantityMin != null || o.quantityMax != null;
    return (
      <span key={o.id}>
        {i > 0 && ", "}
        {greenNum(o.quantity ?? 1)}{" "}
        {o.itemRef ? renderRef(o.itemRef) : <span className={isDark ? "text-gray-500" : "text-gray-400"}>item</span>}
        {hasBounds && (
          <span className={isDark ? "text-gray-500" : "text-gray-400"}>
            {" "}(mín {o.quantityMin ?? "—"}{o.quantityMax != null ? `, máx ${o.quantityMax}` : ""})
          </span>
        )}
      </span>
    );
  };

  // "Cresce em 3m 1s e produz 15 Nabo por colheita."
  // "Cresce em 60min em modo progressivo — 1 Nabo a cada ~36s, até 100 por ciclo."
  const renderMainParagraph = (): ReactNode => {
    const time = bold(formatSeconds(addon.growthSeconds));
    if (addon.harvestMode === "instant") {
      return (
        <>
          {t("cropAddon.summaryGrows", "Cresce em")} {time}
          {outputs.length > 0 ? (
            <>
              {" "}{t("cropAddon.summaryProduces", "e produz")}{" "}
              {outputs.map(renderOutputItem)}
              {" "}{t("cropAddon.summaryPerHarvest", "por colheita")}.
            </>
          ) : (
            <> {t("cropAddon.summaryNoOutputs", "(sem saídas definidas)")}.</>
          )}
        </>
      );
    }
    // progressive
    const singleItem =
      outputs.length === 1 && outputs[0].itemRef
        ? renderRef(outputs[0].itemRef)
        : <span>{t("cropAddon.summaryUnit", "unidade")}</span>;
    return (
      <>
        {t("cropAddon.summaryGrows", "Cresce em")} {time}{" "}
        {t("cropAddon.summaryProgressiveMode", "em modo progressivo")}
        {harvestInterval !== null && (
          <> — 1 {singleItem}{" "}
            {t("cropAddon.summaryEvery", "a cada")} ~{bold(formatSeconds(harvestInterval))}</>
        )}
        {addon.totalHarvest != null && (
          <>, {t("cropAddon.summaryUpTo", "até")} {greenNum(addon.totalHarvest)}{" "}
            {t("cropAddon.summaryPerCycle", "por ciclo")}</>
        )}.
      </>
    );
  };

  // "Ganha +25 XP ao plantar e +50 XP ao colher (via [XP Page])."
  const renderXpParagraph = (): ReactNode => {
    if (!hasPlantXp && !hasHarvestXp) return null;
    return (
      <>
        {t("cropAddon.summaryGains", "Ganha")}{" "}
        {hasPlantXp && (
          <>
            {yellowNum(addon.plantXp.xp!)}{" "}
            {t("cropAddon.summaryOnPlant", "ao plantar")}
            {addon.plantXp.xpAddonRef && (
              <> ({t("cropAddon.summaryVia", "via")} {renderRef(addon.plantXp.xpAddonRef)})</>
            )}
          </>
        )}
        {hasPlantXp && hasHarvestXp && <> {t("cropAddon.summaryAnd", "e")} </>}
        {hasHarvestXp && (
          <>
            {yellowNum(addon.harvestXp.xp!)}{" "}
            {t("cropAddon.summaryOnHarvest", "ao colher")}
            {addon.harvestMode === "progressive" && (
              <span className={isDark ? "text-gray-500" : "text-gray-400"}>
                {" "}({t("cropAddon.summaryPerUnit", "por unidade")})
              </span>
            )}
            {addon.harvestXp.xpAddonRef && (
              <> ({t("cropAddon.summaryVia", "via")} {renderRef(addon.harvestXp.xpAddonRef)})</>
            )}
          </>
        )}.
      </>
    );
  };

  // "Requer 1 [Semente] e 10 de energia para plantar."
  const renderPlantingParagraph = (): ReactNode => {
    const hasSeed = !!addon.seedRef;
    const hasEnergy = addon.plantEnergy != null && addon.plantEnergy > 0;
    if (!hasSeed && !hasEnergy) return null;
    return (
      <>
        {t("cropAddon.summaryRequires", "Requer")}{" "}
        {hasSeed && (
          <>
            {addon.seedQuantity != null && <>{bold(addon.seedQuantity)} </>}
            {addon.seedRef === CROP_SEED_SELF
              ? <span className={isDark ? "text-sky-300" : "text-blue-600"}>
                  {t("cropAddon.seedSelf", "desta página (semente própria)")}
                </span>
              : renderRef(addon.seedRef)}
          </>
        )}
        {hasSeed && hasEnergy && <> {t("cropAddon.summaryAnd", "e")} </>}
        {hasEnergy && (
          <>{bold(addon.plantEnergy!)} {t("cropAddon.summaryEnergy", "de energia")}</>
        )}
        {" "}{t("cropAddon.summaryToPlant", "para plantar")}.
      </>
    );
  };

  // "Ao expirar, spawna [Planta Murcha] no talhão."
  const renderPostHarvestParagraph = (): ReactNode => {
    if (!addon.spawnWitheredPlant) return null;
    return (
      <>
        {t("cropAddon.summaryOnExpire", "Ao expirar, spawna")}{" "}
        {addon.witheredPlantRef
          ? renderRef(addon.witheredPlantRef)
          : <span className={isDark ? "text-gray-500" : "text-gray-400"}>
              {t("cropAddon.summaryPageNotSet", "(página não definida)")}
            </span>}
        {" "}{t("cropAddon.summaryOnPlot", "no talhão")}.
      </>
    );
  };

  // "Fertilizantes: [A], [B]. Adubos: [C]."
  const renderInputsParagraph = (): ReactNode => {
    if (fertilizers.length === 0 && amendments.length === 0) return null;
    return (
      <>
        {fertilizers.length > 0 && (
          <>
            {t("cropAddon.fertilizers", "Fertilizantes")}:{" "}
            {fertilizers.map((f, i) => (
              <span key={f.id}>{i > 0 && ", "}{f.itemRef ? renderRef(f.itemRef) : "—"}</span>
            ))}.{amendments.length > 0 && " "}
          </>
        )}
        {amendments.length > 0 && (
          <>
            {t("cropAddon.amendments", "Adubos")}:{" "}
            {amendments.map((a, i) => (
              <span key={a.id}>{i > 0 && ", "}{a.itemRef ? renderRef(a.itemRef) : "—"}</span>
            ))}.
          </>
        )}
      </>
    );
  };

  /* ── styling ── */

  const textClass = isDark ? "text-xs text-gray-300" : "text-xs text-gray-700";
  const mutedClass = isDark ? "text-xs text-gray-500" : "text-xs text-gray-400";
  const chipClass = isDark
    ? "rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-300"
    : "rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600";

  const outerClass = bare
    ? ""
    : isDark
    ? "rounded-xl border border-gray-700 bg-gray-900/40 p-3"
    : "rounded-xl border border-gray-300 bg-white p-3";

  /* ── render ── */

  const xpParagraph = renderXpParagraph();
  const plantingParagraph = renderPlantingParagraph();
  const postHarvestParagraph = renderPostHarvestParagraph();
  const inputsParagraph = renderInputsParagraph();

  return (
    <div className={outerClass}>
      {!bare && (
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm">🌱</span>
          <span className={isDark ? "text-sm font-semibold text-gray-100" : "text-sm font-semibold text-gray-800"}>
            {addon.name}
          </span>
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
        </div>
      )}

      <div className="grid gap-1.5">
        <p className={textClass}>{renderMainParagraph()}</p>
        {xpParagraph && <p className={textClass}>{xpParagraph}</p>}
        {plantingParagraph && <p className={textClass}>{plantingParagraph}</p>}
        {postHarvestParagraph && <p className={textClass}>{postHarvestParagraph}</p>}
        {inputsParagraph && <p className={textClass}>{inputsParagraph}</p>}

        {/* Seasons chips */}
        {seasons.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {seasons.map((s) => (
              <span key={s} className={chipClass}>{SEASON_LABELS[s]}</span>
            ))}
          </div>
        )}

        {/* Stages — compact single line */}
        {stages.length > 0 && (
          <p className={mutedClass}>
            {stages.length} {t("cropAddon.stages", "estágio")}
            {stages.length > 1 ? "s" : ""} visual
            {stages.length > 1 ? "is" : ""}:{" "}
            {stages.map((s, i) => (
              <span key={s.id}>
                {i > 0 && " → "}
                {s.label}
                <span className="text-gray-600"> @{formatSeconds(s.secondsFromPlanting)}</span>
              </span>
            ))}
          </p>
        )}

        {/* Notes */}
        {addon.notes && (
          <p className={mutedClass}>{addon.notes}</p>
        )}
      </div>
    </div>
  );
}
