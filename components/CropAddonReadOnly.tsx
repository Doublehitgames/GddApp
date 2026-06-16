"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CropAddonDraft, CropSeason } from "@/lib/addons/types";
import { CROP_SEED_SELF } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";
import { useCurrentProjectId } from "@/hooks/useCurrentProjectId";
import { toSlug } from "@/lib/utils/slug";

interface CropAddonReadOnlyProps {
  addon: CropAddonDraft;
  theme?: "dark" | "light";
  bare?: boolean;
}

type SectionMeta = { id: string; title: string; content: string };
type PendingAnchorNavigation = { sectionId: string; title: string; shortDescription: string };

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

function toShortDescription(markdown: string): string {
  const plain = markdown
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[[^\]]+\]\([^)]+\)/g, "")
    .replace(/[#>*`~_-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return "";
  return plain.length > 160 ? `${plain.slice(0, 157)}...` : plain;
}

export function CropAddonReadOnly({ addon, theme = "dark", bare }: CropAddonReadOnlyProps) {
  const { t } = useI18n();
  const allProjects = useProjectStore((state) => state.projects);
  const currentProjectId = useCurrentProjectId();
  const isDark = theme === "dark";

  const projects = useMemo(
    () => (currentProjectId ? allProjects.filter((p) => p.id === currentProjectId) : allProjects),
    [allProjects, currentProjectId]
  );

  /* ── anchor navigation state ── */
  const [pendingAnchorNavigation, setPendingAnchorNavigation] = useState<PendingAnchorNavigation | null>(null);
  const anchorPreviewCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pendingAnchorNavigation) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (anchorPreviewCardRef.current?.contains(e.target as Node)) return;
      setPendingAnchorNavigation(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setPendingAnchorNavigation(null); };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [pendingAnchorNavigation]);

  /* ── section map ── */
  const sectionsById = useMemo(() => {
    const map = new Map<string, SectionMeta>();
    for (const project of projects) {
      for (const section of project.sections || []) {
        map.set(section.id, { id: section.id, title: section.title || section.id, content: section.content || "" });
      }
    }
    return map;
  }, [projects]);

  /* ── navigation ── */
  const navigateToDocumentAnchor = useCallback((sectionId: string) => {
    const targetId = `section-${sectionId}`;
    const targetEl =
      (document.getElementById(targetId) as HTMLElement | null) ||
      (document.querySelector(`[data-section-anchor="${sectionId}"]`) as HTMLElement | null);
    if (!targetEl) {
      const match = window.location.pathname.match(/\/projects\/([^/]+)/);
      if (match) window.location.href = `/projects/${match[1]}/sections/${toSlug(sectionsById.get(sectionId)?.title ?? "") || sectionId}`;
      return;
    }
    const top = targetEl.getBoundingClientRect().top + window.scrollY - 180;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    window.history.replaceState(null, "", `#${targetId}`);
    targetEl.classList.add("gdd-anchor-highlight");
    window.setTimeout(() => targetEl.classList.remove("gdd-anchor-highlight"), 1800);
  }, [sectionsById]);

  /* ── render helpers ── */

  const renderSectionLink = (refId: string, meta: SectionMeta): ReactNode => (
    <a
      href={`#section-${refId}`}
      onClick={(e) => {
        e.preventDefault();
        setPendingAnchorNavigation({ sectionId: refId, title: meta.title, shortDescription: toShortDescription(meta.content) });
      }}
      className={`gdd-inline-anchor cursor-pointer underline ${isDark ? "text-sky-300 hover:text-sky-200" : "text-blue-600 hover:text-blue-800"}`}
      title={t("view.anchorPreview.goToSection")}
    >
      {meta.title}
    </a>
  );

  const renderRef = (id: string | undefined): ReactNode => {
    if (!id) return <span className={isDark ? "text-gray-500" : "text-gray-400"}>não definido</span>;
    const meta = sectionsById.get(id);
    if (!meta) return <span className={isDark ? "text-gray-500" : "text-gray-400"}>{id}</span>;
    return renderSectionLink(id, meta);
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

  /* ── paragraphs ── */

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
            {!hasPlantXp && <>{t("cropAddon.summaryGains", "Ganha")}{" "}</>}
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

  const xpParagraph = renderXpParagraph();
  const plantingParagraph = renderPlantingParagraph();
  const postHarvestParagraph = renderPostHarvestParagraph();
  const inputsParagraph = renderInputsParagraph();

  /* ── render ── */

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

        {seasons.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {seasons.map((s) => (
              <span key={s} className={chipClass}>{SEASON_LABELS[s]}</span>
            ))}
          </div>
        )}

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

        {addon.notes && <p className={mutedClass}>{addon.notes}</p>}
      </div>

      {/* Anchor navigation popup */}
      {pendingAnchorNavigation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div
            ref={anchorPreviewCardRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("view.anchorPreview.title")}
            className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-2xl"
          >
            <div className="border-b border-gray-200 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t("view.anchorPreview.title")}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-gray-900">
                {pendingAnchorNavigation.title}
              </h3>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm leading-6 text-gray-700">
                {pendingAnchorNavigation.shortDescription || t("view.anchorPreview.noDescription")}
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setPendingAnchorNavigation(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  navigateToDocumentAnchor(pendingAnchorNavigation.sectionId);
                  setPendingAnchorNavigation(null);
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {t("view.anchorPreview.goButton")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
