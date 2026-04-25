"use client";

import { useMemo } from "react";
import type {
  SkillsAddonDraft,
  SkillEntry,
  SkillCost,
  AttributeModifierEntry,
} from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";
import { SectionAnchorLink } from "@/components/common/SectionAnchorLink";

interface SkillsAddonReadOnlyProps {
  addon: SkillsAddonDraft;
  theme?: "dark" | "light";
  bare?: boolean;
}

type CurrencyMeta = { displayName: string; code: string };
type EffectMeta = {
  sectionTitle: string;
  addonName: string;
  attrLabel: string;
  entry: AttributeModifierEntry;
};

function formatAmount(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function formatModifier(entry: AttributeModifierEntry, attrLabel: string): string {
  const numericValue = typeof entry.value === "number" ? entry.value : null;
  const sign =
    entry.mode === "set"
      ? "="
      : entry.mode === "mult"
      ? "×"
      : numericValue != null && numericValue >= 0
      ? "+"
      : "";
  const valueStr = typeof entry.value === "boolean" ? (entry.value ? "true" : "false") : String(entry.value);
  let suffix = "";
  if (entry.temporary && entry.durationSeconds && entry.durationSeconds > 0) {
    suffix = ` ${entry.tickIntervalSeconds && entry.tickIntervalSeconds > 0 ? `(cada ${entry.tickIntervalSeconds}s por ${entry.durationSeconds}s)` : `(${entry.durationSeconds}s)`}`;
  } else if (entry.temporary) {
    suffix = ` (temp.)`;
  }
  return `${sign}${valueStr} ${attrLabel}${suffix}`;
}

export function SkillsAddonReadOnly({ addon, theme = "dark", bare = false }: SkillsAddonReadOnlyProps) {
  const { t } = useI18n();
  const projects = useProjectStore((state) => state.projects);
  const isLight = theme === "light";

  /**
   * Per-section map of attribute key → label. Used to resolve attribute
   * cost labels by the cost's own `definitionsRef` (each cost can target
   * a different definitions page).
   */
  const attributeLabelByDefinitionAndKey = useMemo(() => {
    const outer = new Map<string, Map<string, string>>();
    for (const project of projects) {
      for (const section of project.sections || []) {
        let inner: Map<string, string> | null = null;
        for (const sa of section.addons || []) {
          if (sa.type !== "attributeDefinitions") continue;
          if (!inner) inner = new Map<string, string>();
          for (const a of sa.data.attributes || []) {
            inner.set(a.key, a.label || a.key);
          }
        }
        if (inner) outer.set(section.id, inner);
      }
    }
    return outer;
  }, [projects]);

  const currencyByRef = useMemo(() => {
    const map = new Map<string, CurrencyMeta>();
    for (const project of projects) {
      for (const section of project.sections || []) {
        for (const sa of section.addons || []) {
          if (sa.type !== "currency") continue;
          const c = sa.data.code?.trim() || sa.data.name || section.title || section.id;
          const d = sa.data.displayName?.trim() || sa.data.name || section.title || section.id;
          map.set(section.id, { code: c, displayName: d });
        }
      }
    }
    return map;
  }, [projects]);

  const effectsByKey = useMemo(() => {
    const map = new Map<string, EffectMeta>();
    for (const project of projects) {
      for (const section of project.sections || []) {
        for (const sa of section.addons || []) {
          if (sa.type !== "attributeModifiers") continue;
          const defsRef = sa.data.definitionsRef;
          const lblByKey = new Map<string, string>();
          if (defsRef) {
            for (const sp of projects) {
              for (const sec of sp.sections || []) {
                if (sec.id !== defsRef) continue;
                for (const da of sec.addons || []) {
                  if (da.type !== "attributeDefinitions") continue;
                  for (const a of da.data.attributes || []) {
                    lblByKey.set(a.key, a.label || a.key);
                  }
                }
              }
            }
          }
          for (const entry of sa.data.modifiers || []) {
            const key = `${section.id}::${sa.id}::${entry.id}`;
            map.set(key, {
              sectionTitle: section.title || section.id,
              addonName: sa.name || sa.data.name || "Modifiers",
              attrLabel: lblByKey.get(entry.attributeKey) || entry.attributeKey,
              entry,
            });
          }
        }
      }
    }
    return map;
  }, [projects]);

  const itemTitleBySectionId = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects) {
      for (const section of project.sections || []) {
        const hasInventory = (section.addons || []).some((a) => a.type === "inventory");
        if (hasInventory) map.set(section.id, section.title || section.id);
      }
    }
    return map;
  }, [projects]);

  const xpTitleBySectionId = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects) {
      for (const section of project.sections || []) {
        const hasXp = (section.addons || []).some((a) => a.type === "xpBalance");
        if (hasXp) map.set(section.id, section.title || section.id);
      }
    }
    return map;
  }, [projects]);

  const entries = addon.entries || [];
  const outerClass = bare
    ? ""
    : `rounded-xl p-3 ${isLight ? "border border-gray-300 bg-white" : "border border-gray-700 bg-gray-900/40"}`;

  const renderCost = (cost: SkillCost) => {
    if (cost.type === "currency") {
      if (!cost.currencyRef) return `${formatAmount(cost.amount)} 🪙 ?`;
      const meta = currencyByRef.get(cost.currencyRef);
      if (!meta) return `${formatAmount(cost.amount)} 🪙 ↯`;
      return (
        <span className="inline-flex items-baseline gap-1">
          <span>{formatAmount(cost.amount)}</span>
          <SectionAnchorLink sectionId={cost.currencyRef} variant="inline" theme={theme}>
            <strong>{meta.displayName}</strong>
          </SectionAnchorLink>
        </span>
      );
    }
    if (cost.type === "attribute") {
      const labels = cost.definitionsRef
        ? attributeLabelByDefinitionAndKey.get(cost.definitionsRef)
        : undefined;
      const label = cost.attributeKey
        ? labels?.get(cost.attributeKey) || cost.attributeKey
        : "?";
      const refLink = cost.definitionsRef ? (
        <SectionAnchorLink sectionId={cost.definitionsRef} variant="inline" theme={theme}>
          <strong>{label}</strong>
        </SectionAnchorLink>
      ) : (
        <strong>{label}</strong>
      );
      return (
        <span className="inline-flex items-baseline gap-1">
          <span>{formatAmount(cost.amount)}</span>
          {refLink}
        </span>
      );
    }
    // charges
    return (
      <span>
        {formatAmount(cost.amount)} {t("skillsAddon.chargesShort", "carga(s)")}
      </span>
    );
  };

  const renderUnlock = (entry: SkillEntry): React.ReactNode => {
    const u = entry.unlock;
    if (!u) return null;
    const parts: React.ReactNode[] = [];
    if (u.level?.enabled && u.level.level != null) {
      const xpName = u.level.xpAddonRef ? xpTitleBySectionId.get(u.level.xpAddonRef) : null;
      parts.push(
        <span key="lv">
          {t("skillsAddon.unlockLvShort", "Lv")} {u.level.level}
          {xpName && u.level.xpAddonRef ? (
            <>
              {" ("}
              <SectionAnchorLink sectionId={u.level.xpAddonRef} variant="inline" theme={theme}>
                {xpName}
              </SectionAnchorLink>
              {")"}
            </>
          ) : null}
        </span>
      );
    }
    if (u.currency?.enabled && u.currency.amount != null) {
      const meta = u.currency.currencyAddonRef ? currencyByRef.get(u.currency.currencyAddonRef) : null;
      parts.push(
        <span key="cur">
          {formatAmount(u.currency.amount)}{" "}
          {meta && u.currency.currencyAddonRef ? (
            <SectionAnchorLink sectionId={u.currency.currencyAddonRef} variant="inline" theme={theme}>
              <strong>{meta.displayName}</strong>
            </SectionAnchorLink>
          ) : (
            "🪙"
          )}
        </span>
      );
    }
    if (u.item?.enabled && u.item.quantity != null) {
      const itemTitle = u.item.itemRef ? itemTitleBySectionId.get(u.item.itemRef) : null;
      parts.push(
        <span key="item">
          {u.item.quantity}×{" "}
          {itemTitle && u.item.itemRef ? (
            <SectionAnchorLink sectionId={u.item.itemRef} variant="inline" theme={theme}>
              <strong>{itemTitle}</strong>
            </SectionAnchorLink>
          ) : (
            "🗡 ?"
          )}
        </span>
      );
    }
    if (parts.length === 0) return null;
    return (
      <div className="mt-1 text-xs">
        <span className={`font-medium ${isLight ? "text-emerald-700" : "text-emerald-300"}`}>🔓 </span>
        {parts.map((p, i) => (
          <span key={i}>
            {i > 0 ? " · " : null}
            {p}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className={outerClass}>
      {!bare && (
        <h5 className={`text-sm font-semibold ${isLight ? "text-gray-900" : "text-gray-200"}`}>
          {addon.name || t("skillsAddon.defaultName", "Skills")}
        </h5>
      )}
      {entries.length === 0 ? (
        <p className={`${bare ? "" : "mt-2"} text-xs ${isLight ? "text-gray-600" : "text-gray-400"}`}>
          {t("skillsAddon.readOnlyEmpty", "Nenhuma habilidade configurada.")}
        </p>
      ) : (
        <ul className={`${bare ? "" : "mt-2"} space-y-2 ${isLight ? "text-gray-900" : "text-gray-200"}`}>
          {entries.map((entry) => {
            const kindLabel = entry.kind === "active"
              ? t("skillsAddon.kindActive", "ativa")
              : t("skillsAddon.kindPassive", "passiva");
            const kindBadgeClass =
              entry.kind === "active"
                ? isLight ? "bg-amber-100 text-amber-800" : "bg-amber-900/40 text-amber-300"
                : isLight ? "bg-cyan-100 text-cyan-800" : "bg-cyan-900/40 text-cyan-300";
            return (
              <li key={entry.id} className={bare ? "" : "text-sm"}>
                <div className="flex flex-wrap items-baseline gap-1.5">
                  <span>{entry.kind === "active" ? "⚡" : "🛡"}</span>
                  <strong>{entry.name?.trim() || t("skillsAddon.untitled", "(sem nome)")}</strong>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${kindBadgeClass}`}>{kindLabel}</span>
                  {(entry.tags || []).map((tag) => (
                    <span
                      key={tag}
                      className={`rounded-full px-1.5 py-0.5 text-[10px] ${isLight ? "bg-gray-100 text-gray-600" : "bg-gray-800 text-gray-400"}`}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
                {entry.description && (
                  <p className={`mt-0.5 text-xs ${isLight ? "text-gray-600" : "text-gray-400"}`}>
                    {entry.description}
                  </p>
                )}
                {entry.kind === "active" && entry.cooldownSeconds && entry.cooldownSeconds > 0 && (
                  <p className="mt-0.5 text-xs">
                    <span className={`${isLight ? "text-gray-500" : "text-gray-500"}`}>
                      {t("skillsAddon.cooldownShort", "Cooldown:")}
                    </span>{" "}
                    {entry.cooldownSeconds}s
                  </p>
                )}
                {(entry.costs || []).length > 0 && (
                  <p className="mt-0.5 text-xs">
                    <span className={isLight ? "text-gray-500" : "text-gray-500"}>
                      {t("skillsAddon.costsShort", "Custos:")}
                    </span>{" "}
                    {(entry.costs || []).map((c, i) => (
                      <span key={c.id}>
                        {i > 0 ? " · " : null}
                        {renderCost(c)}
                      </span>
                    ))}
                  </p>
                )}
                {(entry.effects || []).length > 0 && (
                  <p className="mt-0.5 text-xs">
                    <span className={isLight ? "text-gray-500" : "text-gray-500"}>
                      {t("skillsAddon.effectsShort", "Efeitos:")}
                    </span>{" "}
                    {(entry.effects || []).map((eff, i) => {
                      const meta = effectsByKey.get(
                        `${eff.attributeModifiersSectionId}::${eff.attributeModifiersAddonId}::${eff.modifierEntryId}`
                      );
                      if (!meta) {
                        return (
                          <span key={eff.id} className={isLight ? "text-amber-700" : "text-amber-300"}>
                            {i > 0 ? " · " : null}
                            ↯ {t("skillsAddon.brokenEffect", "Efeito quebrado")}
                          </span>
                        );
                      }
                      // Prefer the user-provided name when set (e.g. "Fireball
                      // burn"). The auto-formatted technical label is shown
                      // tucked in parentheses so context isn't lost.
                      const customName = meta.entry.name?.trim();
                      const technical = formatModifier(meta.entry, meta.attrLabel);
                      return (
                        <span key={eff.id}>
                          {i > 0 ? " · " : null}
                          <SectionAnchorLink sectionId={eff.attributeModifiersSectionId} variant="inline" theme={theme}>
                            {customName ? (
                              <>
                                {customName}
                                <span className={isLight ? "ml-1 text-gray-500" : "ml-1 text-gray-400"}>
                                  ({technical})
                                </span>
                              </>
                            ) : (
                              technical
                            )}
                          </SectionAnchorLink>
                        </span>
                      );
                    })}
                  </p>
                )}
                {renderUnlock(entry)}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
