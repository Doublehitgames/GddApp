"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ProductionAddonDraft } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";

interface ProductionAddonReadOnlyProps {
  addon: ProductionAddonDraft;
  theme?: "dark" | "light";
}

type SectionMeta = {
  id: string;
  title: string;
  content: string;
};

type ProgressionColumnOption = {
  key: string;
  progressionAddonId: string;
  columnId: string;
  isPercentage: boolean;
  startLevel: number;
  endLevel: number;
  rowsByLevel: Map<number, number | string>;
};

type PendingAnchorNavigation = {
  sectionId: string;
  title: string;
  shortDescription: string;
};

function toShortDescription(markdownContent: string): string {
  const plain = markdownContent
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[[^\]]+\]\([^)]+\)/g, "")
    .replace(/[#>*`~_-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return "";
  return plain.length > 160 ? `${plain.slice(0, 157)}...` : plain;
}

function toSecondsLabel(value: unknown): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "n/a";
  return `${Math.max(0, Math.floor(parsed))}s`;
}

function toQuantityLabel(value: unknown): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "n/a";
  return String(Math.max(0, Math.floor(parsed)));
}

function computeLinkedTimeSeconds(
  baseSeconds: number | undefined,
  columnValue: unknown,
  isPercentage: boolean
): number | undefined {
  if (baseSeconds == null || !Number.isFinite(baseSeconds)) return undefined;
  const modifier = Number(columnValue);
  if (!Number.isFinite(modifier)) return undefined;
  const next = isPercentage ? baseSeconds + (baseSeconds * modifier) / 100 : baseSeconds + modifier;
  return Math.max(0, Math.floor(next));
}

export function ProductionAddonReadOnly({ addon, theme = "dark" }: ProductionAddonReadOnlyProps) {
  const { t } = useI18n();
  const projects = useProjectStore((state) => state.projects);
  const isLight = theme === "light";
  const [pendingAnchorNavigation, setPendingAnchorNavigation] = useState<PendingAnchorNavigation | null>(null);
  const anchorPreviewCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pendingAnchorNavigation) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (anchorPreviewCardRef.current?.contains(event.target as Node)) return;
      setPendingAnchorNavigation(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPendingAnchorNavigation(null);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [pendingAnchorNavigation]);

  const sectionsById = useMemo(() => {
    const map = new Map<string, SectionMeta>();
    for (const project of projects) {
      for (const section of project.sections || []) {
        map.set(section.id, {
          id: section.id,
          title: section.title || section.id,
          content: section.content || "",
        });
      }
    }
    return map;
  }, [projects]);

  const currentSection = useMemo(() => {
    for (const project of projects) {
      for (const section of project.sections || []) {
        const found = (section.addons || []).some(
          (item) => item.type === "production" && item.id === addon.id
        );
        if (found) return section;
      }
    }
    return undefined;
  }, [addon.id, projects]);

  const progressionColumnOptions = useMemo(() => {
    const out: ProgressionColumnOption[] = [];
    if (!currentSection) return out;
    for (const sectionAddon of currentSection.addons || []) {
      if (sectionAddon.type !== "progressionTable") continue;
      const startLevel = Math.max(1, Math.floor(sectionAddon.data.startLevel || 1));
      const endLevel = Math.max(startLevel, Math.floor(sectionAddon.data.endLevel || startLevel));
      for (const column of sectionAddon.data.columns || []) {
        out.push({
          key: `${sectionAddon.id}::${column.id}`,
          progressionAddonId: sectionAddon.id,
          columnId: column.id,
          isPercentage: Boolean(column.isPercentage),
          startLevel,
          endLevel,
          rowsByLevel: new Map((sectionAddon.data.rows || []).map((row) => [row.level, row.values?.[column.id] ?? 0])),
        });
      }
    }
    return out;
  }, [currentSection]);

  const progressionColumnOptionByKey = useMemo(() => {
    const map = new Map<string, ProgressionColumnOption>();
    for (const option of progressionColumnOptions) map.set(option.key, option);
    return map;
  }, [progressionColumnOptions]);

  const resolveProgressionOption = useCallback((link?: { progressionAddonId: string; columnId: string }) => {
    if (!link) return undefined;
    return progressionColumnOptionByKey.get(`${link.progressionAddonId}::${link.columnId}`);
  }, [progressionColumnOptionByKey]);

  const buildSimulationBadges = (
    option: ProgressionColumnOption | undefined,
    baseSeconds: number | undefined,
    formatter: (value: unknown) => string
  ) => {
    if (!option) return null;
    const minLevel = option.startLevel;
    const maxLevel = option.endLevel;
    const midLevel = Math.floor((minLevel + maxLevel) / 2);
    return [
      { level: minLevel, value: formatter(computeLinkedTimeSeconds(baseSeconds, option.rowsByLevel.get(minLevel), option.isPercentage)) },
      { level: midLevel, value: formatter(computeLinkedTimeSeconds(baseSeconds, option.rowsByLevel.get(midLevel), option.isPercentage)) },
      { level: maxLevel, value: formatter(computeLinkedTimeSeconds(baseSeconds, option.rowsByLevel.get(maxLevel), option.isPercentage)) },
    ];
  };

  const minOutputSimulationBadges = useMemo(
    () =>
      addon.mode === "passive"
        ? buildSimulationBadges(
            resolveProgressionOption(addon.minOutputProgressionLink),
            addon.minOutput,
            toQuantityLabel
          )
        : null,
    [addon.mode, addon.minOutputProgressionLink, addon.minOutput, resolveProgressionOption]
  );
  const maxOutputSimulationBadges = useMemo(
    () =>
      addon.mode === "passive"
        ? buildSimulationBadges(
            resolveProgressionOption(addon.maxOutputProgressionLink),
            addon.maxOutput,
            toQuantityLabel
          )
        : null,
    [addon.mode, addon.maxOutputProgressionLink, addon.maxOutput, resolveProgressionOption]
  );
  const timeSimulationBadges = useMemo(
    () =>
      buildSimulationBadges(
        resolveProgressionOption(
          addon.mode === "passive" ? addon.intervalSecondsProgressionLink : addon.craftTimeSecondsProgressionLink
        ),
        addon.mode === "passive" ? addon.intervalSeconds : addon.craftTimeSeconds,
        toSecondsLabel
      ),
    [
      addon.mode,
      addon.intervalSecondsProgressionLink,
      addon.craftTimeSecondsProgressionLink,
      addon.intervalSeconds,
      addon.craftTimeSeconds,
      resolveProgressionOption,
    ]
  );

  const navigateToDocumentAnchor = (sectionId: string) => {
    const targetId = `section-${sectionId}`;
    const targetElement =
      (document.getElementById(targetId) as HTMLElement | null) ||
      (document.querySelector(`[data-section-anchor="${sectionId}"]`) as HTMLElement | null);
    if (!targetElement) return;
    const targetTop = targetElement.getBoundingClientRect().top + window.scrollY - 180;
    window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
    window.history.replaceState(null, "", `#${targetId}`);
    targetElement.classList.add("gdd-anchor-highlight");
    window.setTimeout(() => targetElement.classList.remove("gdd-anchor-highlight"), 1800);
  };

  const renderSectionLink = (refId: string, meta: SectionMeta): ReactNode => (
    <a
      href={`#section-${refId}`}
      onClick={(event) => {
        event.preventDefault();
        setPendingAnchorNavigation({
          sectionId: refId,
          title: meta.title,
          shortDescription: toShortDescription(meta.content),
        });
      }}
      className="gdd-inline-anchor text-blue-600 hover:text-blue-800 underline cursor-pointer"
      title={t("view.anchorPreview.goToSection")}
    >
      {meta.title}
    </a>
  );

  const renderRef = (sectionId?: string): ReactNode => {
    if (!sectionId) return t("productionAddon.emptyValue", "nao informado");
    const meta = sectionsById.get(sectionId);
    if (!meta) return `${sectionId} (${t("productionAddon.refNotFound", "referencia nao encontrada")})`;
    return renderSectionLink(sectionId, meta);
  };

  const renderRecipeList = (items: Array<{ itemRef: string; quantity: number }>): ReactNode => {
    if (items.length === 0) return t("productionAddon.none", "nenhum");
    return items.map((item, index) => (
      <span key={`${item.itemRef || "empty"}-${index}`}>
        {index > 0 ? ", " : ""}
        {item.quantity} {renderRef(item.itemRef)}
      </span>
    ));
  };

  const passiveSummary = (
    <>
      {t("productionAddon.passiveSummaryStart", "Produz")}{" "}
      {t("productionAddon.passiveSummaryAdverb", "passivamente")}{" "}
      {addon.minOutput ?? 0}
      {addon.maxOutput != null ? ` ${t("productionAddon.toConnector", "a")} ${addon.maxOutput}` : ""}{" "}
      {renderRef(addon.outputRef)} {t("productionAddon.inConnector", "em")} {addon.intervalSeconds ?? 0}s.
    </>
  );

  const recipeSummary = (
    <>
      {t("productionAddon.recipeSummaryStart", "Receita")}:{" "}
      {renderRecipeList(addon.ingredients)}{" "}
      {t("productionAddon.recipeToConnector", "->")}{" "}
      {renderRecipeList(addon.outputs)}{" "}
      {t("productionAddon.inConnector", "em")} {addon.craftTimeSeconds ?? 0}s.
    </>
  );

  return (
    <div
      className={`mt-3 rounded-xl p-3 ${
        isLight ? "border border-gray-300 bg-white" : "border border-gray-700 bg-gray-900/40"
      }`}
    >
      <h5 className={`text-sm font-semibold ${isLight ? "text-gray-900" : "text-gray-200"}`}>
        {addon.name || t("productionAddon.defaultName", "Production")}
      </h5>
      <div className="mt-2 grid gap-2 text-xs">
        <p className={isLight ? "text-gray-700" : "text-gray-300"}>
          {addon.mode === "passive" ? passiveSummary : recipeSummary}
        </p>
        {(minOutputSimulationBadges || maxOutputSimulationBadges || timeSimulationBadges) && (
          <div className="space-y-1">
            {minOutputSimulationBadges ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={isLight ? "text-gray-700" : "text-gray-300"}>
                  {t("productionAddon.minOutputLabel", "Qtd minima")}:
                </span>
                {minOutputSimulationBadges.map((badge) => (
                  <span
                    key={`readonly-min-lv-${badge.level}`}
                    className={`rounded-full border px-2 py-0.5 text-[10px] ${
                      isLight ? "border-gray-400 bg-white text-gray-800" : "border-gray-500 bg-gray-800 text-gray-100"
                    }`}
                  >
                    Lv{badge.level}: {badge.value}
                  </span>
                ))}
              </div>
            ) : null}
            {maxOutputSimulationBadges ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={isLight ? "text-gray-700" : "text-gray-300"}>
                  {t("productionAddon.maxOutputLabel", "Qtd maxima")}:
                </span>
                {maxOutputSimulationBadges.map((badge) => (
                  <span
                    key={`readonly-max-lv-${badge.level}`}
                    className={`rounded-full border px-2 py-0.5 text-[10px] ${
                      isLight ? "border-gray-400 bg-white text-gray-800" : "border-gray-500 bg-gray-800 text-gray-100"
                    }`}
                  >
                    Lv{badge.level}: {badge.value}
                  </span>
                ))}
              </div>
            ) : null}
            {timeSimulationBadges ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={isLight ? "text-gray-700" : "text-gray-300"}>
                  {addon.mode === "passive"
                    ? t("productionAddon.intervalSecondsLabel", "Tempo (segundos)")
                    : t("productionAddon.craftTimeSecondsLabel", "Tempo de receita (segundos)")}
                  :
                </span>
                {timeSimulationBadges.map((badge) => (
                  <span
                    key={`readonly-time-lv-${badge.level}`}
                    className={`rounded-full border px-2 py-0.5 text-[10px] ${
                      isLight ? "border-gray-400 bg-white text-gray-800" : "border-gray-500 bg-gray-800 text-gray-100"
                    }`}
                  >
                    Lv{badge.level}: {badge.value}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {pendingAnchorNavigation && (
        <div className="fixed inset-0 z-50 bg-black/30 p-4 flex items-center justify-center">
          <div
            ref={anchorPreviewCardRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("view.anchorPreview.title")}
            className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-2xl"
          >
            <div className="px-5 py-4 border-b border-gray-200">
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
            <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
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
