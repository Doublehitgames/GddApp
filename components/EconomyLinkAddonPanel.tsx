"use client";

import { useMemo } from "react";
import type { EconomyLinkAddonDraft } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";
import { useCurrentProjectId } from "@/hooks/useCurrentProjectId";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { CommitOptionalNumberInput } from "@/components/common/CommitInput";

interface EconomyLinkAddonPanelProps {
  addon: EconomyLinkAddonDraft;
  onChange: (next: EconomyLinkAddonDraft) => void;
  onRemove: () => void;
}

const PANEL_SHELL_CLASS = "rounded-2xl border border-gray-700/80 bg-gray-900/70 p-4 md:p-5";
const PANEL_BLOCK_CLASS = "rounded-xl border border-gray-700/80 bg-gray-800/70 p-3";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-gray-500";
const BUTTON_DANGER_CLASS = "rounded-lg border border-rose-700/60 bg-rose-900/30 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-900/50";

function clampInteger(value: number, min?: number, max?: number): number {
  let next = Math.floor(value);
  if (min != null) next = Math.max(min, next);
  if (max != null) next = Math.min(max, next);
  return next;
}

function uniqueRefs(items: Array<{ refId: string }>): Array<{ refId: string }> {
  const out: Array<{ refId: string }> = [];
  const seen = new Set<string>();
  for (const item of items) {
    const refId = item.refId.trim();
    if (!refId || seen.has(refId)) continue;
    seen.add(refId);
    out.push({ refId });
  }
  return out;
}

function formatDisplayNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}

type GlobalVariableCalcMeta = {
  valueType: "percent" | "multiplier" | "flat" | "boolean";
  defaultValue: number | boolean;
};

function computeEffectiveValue(
  baseValue: number | undefined,
  modifiers: Array<{ refId: string }>,
  globalVariableByRefId: Map<string, GlobalVariableCalcMeta>,
  bounds?: { min?: number; max?: number }
): number | undefined {
  if (baseValue == null || !Number.isFinite(baseValue)) return undefined;
  if (!Array.isArray(modifiers) || modifiers.length === 0) {
    if (bounds?.min != null || bounds?.max != null) {
      return clampInteger(baseValue, bounds?.min, bounds?.max);
    }
    return undefined;
  }
  let next = baseValue;
  let appliedCount = 0;
  for (const modifier of modifiers) {
    const meta = globalVariableByRefId.get(modifier.refId);
    if (!meta) continue;
    if (typeof meta.defaultValue !== "number" || !Number.isFinite(meta.defaultValue)) continue;
    const modifierValue = meta.defaultValue;
    if (meta.valueType === "percent") {
      next += (next * modifierValue) / 100;
      appliedCount += 1;
      continue;
    }
    if (meta.valueType === "multiplier") {
      next *= modifierValue;
      appliedCount += 1;
      continue;
    }
    if (meta.valueType === "flat") {
      next += modifierValue;
      appliedCount += 1;
      continue;
    }
  }
  if (appliedCount === 0) {
    if (bounds?.min != null || bounds?.max != null) {
      return clampInteger(baseValue, bounds?.min, bounds?.max);
    }
    return undefined;
  }
  const nonNegative = Math.max(0, next);
  return clampInteger(nonNegative, bounds?.min, bounds?.max);
}

function formatModifierPreview(meta: GlobalVariableCalcMeta): string | null {
  if (typeof meta.defaultValue !== "number" || !Number.isFinite(meta.defaultValue)) {
    return null;
  }
  const valueText = formatDisplayNumber(meta.defaultValue);
  if (meta.valueType === "percent") {
    const signed = meta.defaultValue > 0 ? `+${valueText}` : valueText;
    return `${signed}%`;
  }
  if (meta.valueType === "multiplier") {
    return `x${valueText}`;
  }
  if (meta.valueType === "flat") {
    return meta.defaultValue > 0 ? `+${valueText}` : valueText;
  }
  return null;
}

export function EconomyLinkAddonPanel({ addon, onChange, onRemove }: EconomyLinkAddonPanelProps) {
  const { t } = useI18n();
  const projects = useProjectStore((state) => state.projects);
  const currentProjectId = useCurrentProjectId();
  const scopedProjects = useMemo(
    () => (currentProjectId ? projects.filter((p) => p.id === currentProjectId) : projects),
    [projects, currentProjectId]
  );

  const currencyRefOptions = useMemo(() => {
    const out: Array<{ refId: string; label: string }> = [];
    const seen = new Set<string>();
    for (const project of scopedProjects) {
      for (const section of project.sections || []) {
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type !== "currency") continue;
          const refId = section.id;
          if (seen.has(refId)) continue;
          seen.add(refId);
          const displayName = sectionAddon.data.displayName?.trim() || sectionAddon.name || section.title;
          const code = sectionAddon.data.code?.trim();
          out.push({
            refId,
            label: code ? `${displayName} (${code})` : displayName,
          });
        }
      }
    }
    return out;
  }, [scopedProjects]);

  const globalVariableRefOptions = useMemo(() => {
    const out: Array<{ refId: string; label: string; projectId: string; sectionId: string; meta: GlobalVariableCalcMeta }> = [];
    const seen = new Set<string>();
    for (const project of scopedProjects) {
      for (const section of project.sections || []) {
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type !== "globalVariable") continue;
          const refId = section.id;
          if (seen.has(refId)) continue;
          seen.add(refId);
          const displayName = sectionAddon.data.displayName?.trim() || sectionAddon.name || section.title;
          out.push({
            refId,
            label: displayName,
            projectId: project.id,
            sectionId: section.id,
            meta: {
              valueType: sectionAddon.data.valueType,
              defaultValue: sectionAddon.data.defaultValue,
            },
          });
        }
      }
    }
    return out;
  }, [scopedProjects]);

  const xpRefOptions = useMemo(() => {
    const out: Array<{ refId: string; label: string; minLevel?: number; maxLevel?: number }> = [];
    const seen = new Set<string>();
    for (const project of scopedProjects) {
      for (const section of project.sections || []) {
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type !== "xpBalance") continue;
          const refId = section.id;
          if (seen.has(refId)) continue;
          seen.add(refId);
          const sectionTitle = section.title?.trim() || section.id;
          const addonName = sectionAddon.name?.trim() || "XP";
          out.push({
            refId,
            label: `${sectionTitle} - ${addonName}`,
            minLevel:
              typeof sectionAddon.data.startLevel === "number" && Number.isFinite(sectionAddon.data.startLevel)
                ? Math.max(1, Math.floor(sectionAddon.data.startLevel))
                : undefined,
            maxLevel:
              typeof sectionAddon.data.endLevel === "number" && Number.isFinite(sectionAddon.data.endLevel)
                ? Math.max(1, Math.floor(sectionAddon.data.endLevel))
                : undefined,
          });
        }
      }
    }
    return out;
  }, [scopedProjects]);

  const globalVariableByRefId = useMemo(() => {
    const map = new Map<string, GlobalVariableCalcMeta>();
    for (const project of scopedProjects) {
      for (const section of project.sections || []) {
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type !== "globalVariable") continue;
          if (map.has(section.id)) continue;
          map.set(section.id, {
            valueType: sectionAddon.data.valueType,
            defaultValue: sectionAddon.data.defaultValue,
          });
        }
      }
    }
    return map;
  }, [scopedProjects]);

  const validationMessages = useMemo(() => {
    const messages: string[] = [];
    const hasBuyConfig =
      addon.hasBuyConfig ?? Boolean(addon.buyCurrencyRef || addon.buyValue != null || (addon.buyModifiers || []).length > 0);
    const hasSellConfig =
      addon.hasSellConfig ?? Boolean(addon.sellCurrencyRef || addon.sellValue != null || (addon.sellModifiers || []).length > 0);
    if (hasBuyConfig && addon.buyValue != null && addon.buyValue > 0 && !addon.buyCurrencyRef) {
      messages.push(
        t("economyLinkAddon.validation.buyCurrencyRequired", "Preencha a moeda de compra quando houver valor de compra.")
      );
    }
    if (hasSellConfig && addon.sellValue != null && addon.sellValue > 0 && !addon.sellCurrencyRef) {
      messages.push(
        t("economyLinkAddon.validation.sellCurrencyRequired", "Preencha a moeda de venda quando houver valor de venda.")
      );
    }
    return messages;
  }, [addon, t]);

  const commit = (patch: Partial<EconomyLinkAddonDraft>) => {
    onChange({
      ...addon,
      ...patch,
    });
  };

  const toggleModifier = (field: "buyModifiers" | "sellModifiers", refId: string, enabled: boolean) => {
    const current = field === "buyModifiers" ? addon.buyModifiers || [] : addon.sellModifiers || [];
    const next = enabled
      ? uniqueRefs([...current, { refId }])
      : current.filter((item) => item.refId !== refId);
    commit({ [field]: next } as Partial<EconomyLinkAddonDraft>);
  };

  const hasBuyConfig =
    addon.hasBuyConfig ?? Boolean(addon.buyCurrencyRef || addon.buyValue != null || (addon.buyModifiers || []).length > 0);
  const hasSellConfig =
    addon.hasSellConfig ?? Boolean(addon.sellCurrencyRef || addon.sellValue != null || (addon.sellModifiers || []).length > 0);

  const buySelectedKnown = addon.buyCurrencyRef
    ? currencyRefOptions.some((item) => item.refId === addon.buyCurrencyRef)
    : false;
  const sellSelectedKnown = addon.sellCurrencyRef
    ? currencyRefOptions.some((item) => item.refId === addon.sellCurrencyRef)
    : false;
  const unlockSelectedKnown = addon.unlockRef ? xpRefOptions.some((item) => item.refId === addon.unlockRef) : false;
  const hasUnlockConfig = addon.hasUnlockConfig ?? Boolean(addon.unlockRef || addon.unlockValue != null);
  const unlockBounds = useMemo(() => {
    if (!addon.unlockRef) return { min: undefined as number | undefined, max: undefined as number | undefined };
    const xp = xpRefOptions.find((item) => item.refId === addon.unlockRef);
    if (!xp) return { min: undefined as number | undefined, max: undefined as number | undefined };
    const min = xp.minLevel;
    const max = xp.maxLevel;
    if (min != null && max != null && max < min) {
      return { min, max: min };
    }
    return { min, max };
  }, [addon.unlockRef, xpRefOptions]);
  const buyEffectiveValue = useMemo(
    () =>
      computeEffectiveValue(addon.buyValue, addon.buyModifiers || [], globalVariableByRefId, {
        min: addon.minBuyValue,
      }),
    [addon.buyModifiers, addon.buyValue, addon.minBuyValue, globalVariableByRefId]
  );
  const sellEffectiveValue = useMemo(
    () =>
      computeEffectiveValue(addon.sellValue, addon.sellModifiers || [], globalVariableByRefId, {
        max: addon.maxSellValue,
      }),
    [addon.sellModifiers, addon.sellValue, addon.maxSellValue, globalVariableByRefId]
  );

  return (
    <section className={PANEL_SHELL_CLASS}>
      <div className="space-y-4">
        <div className={PANEL_BLOCK_CLASS}>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs uppercase tracking-wide text-gray-400">
              {t("economyLinkAddon.buyShortTitle", "Compra")}
            </h4>
            <div className="flex items-center">
              <ToggleSwitch
                checked={hasBuyConfig}
                onChange={(enabled) => {
                  commit(
                    enabled
                      ? { hasBuyConfig: true }
                      : {
                          hasBuyConfig: false,
                          buyCurrencyRef: undefined,
                          buyValue: undefined,
                          minBuyValue: undefined,
                          buyModifiers: [],
                        }
                  );
                }}
                ariaLabel={t("economyLinkAddon.hasBuyConfig", "Tem configuracao de compra")}
              />
            </div>
          </div>
          <div className="space-y-2">
            {hasBuyConfig && (
              <>
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-400">{t("economyLinkAddon.buyCurrency", "Moeda de compra")}</span>
                    <select
                      value={
                        addon.buyCurrencyRef
                          ? buySelectedKnown
                            ? addon.buyCurrencyRef
                            : "__invalid__"
                          : ""
                      }
                      onChange={(event) => {
                        const next = event.target.value;
                        if (next === "__invalid__") return;
                        commit({ buyCurrencyRef: next || undefined });
                      }}
                      className={`${INPUT_CLASS} mb-2`}
                    >
                      <option value="">{t("economyLinkAddon.selectNone", "Sem referencia")}</option>
                      {addon.buyCurrencyRef && !buySelectedKnown && (
                        <option value="__invalid__">
                          {t("economyLinkAddon.invalidBuyCurrencyRef", "Referencia invalida (moeda nao encontrada)")}
                        </option>
                      )}
                      {currencyRefOptions.map((option) => (
                        <option key={option.refId} value={option.refId}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-400">
                      {buyEffectiveValue != null
                        ? `${t("economyLinkAddon.buyValue", "Valor de compra")}: ${formatDisplayNumber(buyEffectiveValue)}`
                        : t("economyLinkAddon.buyValue", "Valor de compra")}
                    </span>
                    <CommitOptionalNumberInput
                      value={addon.buyValue}
                      onCommit={(next) => commit({ buyValue: next })}
                      placeholder="0"
                      min={0}
                      integer
                      step={1}
                      className={INPUT_CLASS}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-400">
                      {t("economyLinkAddon.minBuyValue", "Minimo de compra")}
                    </span>
                    <CommitOptionalNumberInput
                      value={addon.minBuyValue}
                      onCommit={(next) => commit({ minBuyValue: next })}
                      placeholder="0"
                      min={0}
                      integer
                      step={1}
                      className={INPUT_CLASS}
                    />
                  </label>
                </div>
            <label className="block">
              <span className="mb-1 block text-xs text-gray-400">{t("economyLinkAddon.buyModifiers", "Variaveis de compra (refs, separadas por virgula)")}</span>
              {globalVariableRefOptions.length > 0 && (
                <div className="mb-2 max-h-28 space-y-1 overflow-auto rounded-lg border border-gray-700 bg-gray-900/40 p-2">
                  {globalVariableRefOptions.map((option) => {
                    const checked = (addon.buyModifiers || []).some((item) => item.refId === option.refId);
                    return (
                      <div key={option.refId} className="flex items-center gap-2 text-xs text-gray-300">
                        <ToggleSwitch
                          checked={checked}
                          onChange={(next) => toggleModifier("buyModifiers", option.refId, next)}
                          ariaLabel={option.label}
                        />
                        <a
                          href={`/projects/${option.projectId}/sections/${option.sectionId}`}
                          className="text-blue-300 hover:text-blue-200 underline"
                          title={t("economyLinkAddon.openVariableLinkTitle", "Abrir variavel global")}
                        >
                          {option.label}
                        </a>
                        {checked && formatModifierPreview(option.meta) && (
                          <span className="rounded border border-emerald-500/40 bg-emerald-900/20 px-1.5 py-0.5 text-[10px] text-emerald-300">
                            {formatModifierPreview(option.meta)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </label>
              </>
            )}
          </div>
        </div>

        <div className={PANEL_BLOCK_CLASS}>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs uppercase tracking-wide text-gray-400">
              {t("economyLinkAddon.sellShortTitle", "Venda")}
            </h4>
            <div className="flex items-center">
              <ToggleSwitch
                checked={hasSellConfig}
                onChange={(enabled) => {
                  commit(
                    enabled
                      ? { hasSellConfig: true }
                      : {
                          hasSellConfig: false,
                          sellCurrencyRef: undefined,
                          sellValue: undefined,
                          maxSellValue: undefined,
                          sellModifiers: [],
                        }
                  );
                }}
                ariaLabel={t("economyLinkAddon.hasSellConfig", "Tem configuracao de venda")}
              />
            </div>
          </div>
          <div className="space-y-2">
            {hasSellConfig && (
              <>
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-400">{t("economyLinkAddon.sellCurrency", "Moeda de venda")}</span>
                    <select
                      value={
                        addon.sellCurrencyRef
                          ? sellSelectedKnown
                            ? addon.sellCurrencyRef
                            : "__invalid__"
                          : ""
                      }
                      onChange={(event) => {
                        const next = event.target.value;
                        if (next === "__invalid__") return;
                        commit({ sellCurrencyRef: next || undefined });
                      }}
                      className={`${INPUT_CLASS} mb-2`}
                    >
                      <option value="">{t("economyLinkAddon.selectNone", "Sem referencia")}</option>
                      {addon.sellCurrencyRef && !sellSelectedKnown && (
                        <option value="__invalid__">
                          {t("economyLinkAddon.invalidSellCurrencyRef", "Referencia invalida (moeda nao encontrada)")}
                        </option>
                      )}
                      {currencyRefOptions.map((option) => (
                        <option key={option.refId} value={option.refId}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 flex items-center gap-2 text-xs text-gray-400">
                      <span>{t("economyLinkAddon.sellValue", "Valor de venda")}</span>
                      {sellEffectiveValue != null && (
                        <span className="rounded-full border border-emerald-500/40 bg-emerald-900/25 px-2 py-0.5 text-[10px] text-emerald-200">
                          $ {formatDisplayNumber(sellEffectiveValue)}
                        </span>
                      )}
                    </span>
                    <CommitOptionalNumberInput
                      value={addon.sellValue}
                      onCommit={(next) => commit({ sellValue: next })}
                      placeholder="0"
                      min={0}
                      integer
                      step={1}
                      className={INPUT_CLASS}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-400">
                      {t("economyLinkAddon.maxSellValue", "Maximo de venda")}
                    </span>
                    <CommitOptionalNumberInput
                      value={addon.maxSellValue}
                      onCommit={(next) => commit({ maxSellValue: next })}
                      placeholder="0"
                      min={0}
                      integer
                      step={1}
                      className={INPUT_CLASS}
                    />
                  </label>
                </div>
            <label className="block">
              {globalVariableRefOptions.length > 0 && (
                <div className="mb-2 max-h-28 space-y-1 overflow-auto rounded-lg border border-gray-700 bg-gray-900/40 p-2">
                  {globalVariableRefOptions.map((option) => {
                    const checked = (addon.sellModifiers || []).some((item) => item.refId === option.refId);
                    return (
                      <div key={option.refId} className="flex items-center gap-2 text-xs text-gray-300">
                        <ToggleSwitch
                          checked={checked}
                          onChange={(next) => toggleModifier("sellModifiers", option.refId, next)}
                          ariaLabel={option.label}
                        />
                        <a
                          href={`/projects/${option.projectId}/sections/${option.sectionId}`}
                          className="text-blue-300 hover:text-blue-200 underline"
                          title={t("economyLinkAddon.openVariableLinkTitle", "Abrir variavel global")}
                        >
                          {option.label}
                        </a>
                        {checked && formatModifierPreview(option.meta) && (
                          <span className="rounded border border-emerald-500/40 bg-emerald-900/20 px-1.5 py-0.5 text-[10px] text-emerald-300">
                            {formatModifierPreview(option.meta)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </label>
              </>
            )}
          </div>
        </div>
        <div className={PANEL_BLOCK_CLASS}>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs uppercase tracking-wide text-gray-400">
              {t("economyLinkAddon.unlockTitle", "Desbloqueio")}
            </h4>
            <ToggleSwitch
              checked={hasUnlockConfig}
              onChange={(enabled) =>
                commit(
                  enabled
                    ? { hasUnlockConfig: true }
                    : {
                        hasUnlockConfig: false,
                        unlockRef: undefined,
                        unlockValue: undefined,
                      }
                )
              }
              ariaLabel={t("economyLinkAddon.hasUnlockConfig", "Tem configuracao de desbloqueio")}
            />
          </div>
          <div className="space-y-2">
            {hasUnlockConfig && (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-400">{t("economyLinkAddon.unlockRef", "Pagina de XP")}</span>
                    <select
                      value={
                        addon.unlockRef
                          ? unlockSelectedKnown
                            ? addon.unlockRef
                            : "__invalid__"
                          : ""
                      }
                      onChange={(event) => {
                        const next = event.target.value;
                        if (next === "__invalid__") return;
                        const nextRef = next || undefined;
                        const xp = nextRef ? xpRefOptions.find((item) => item.refId === nextRef) : undefined;
                        const min = xp?.minLevel;
                        const max = xp?.maxLevel;
                        const clampedUnlockValue =
                          addon.unlockValue == null
                            ? addon.unlockValue
                            : clampInteger(addon.unlockValue, min, max);
                        commit({ unlockRef: nextRef, unlockValue: clampedUnlockValue });
                      }}
                      className={INPUT_CLASS}
                    >
                      <option value="">{t("economyLinkAddon.selectNone", "Sem referencia")}</option>
                      {addon.unlockRef && !unlockSelectedKnown && (
                        <option value="__invalid__">
                          {t("economyLinkAddon.invalidUnlockRef", "Referencia invalida (nao encontrada em paginas com addon de XP)")}
                        </option>
                      )}
                      {xpRefOptions.map((option) => (
                        <option key={option.refId} value={option.refId}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {xpRefOptions.length === 0 && (
                      <p className="mt-1 text-[11px] text-amber-300">
                        {t("economyLinkAddon.noXpPages", "Nenhuma pagina com addon de XP encontrada.")}
                      </p>
                    )}
                  </label>
                  <label className="block">
                    <span className="mb-1 flex items-center gap-2 text-xs text-gray-400">
                      <span>{t("economyLinkAddon.unlockValue", "LV de desbloqueio")}</span>
                      {unlockSelectedKnown && unlockBounds.min != null && unlockBounds.max != null && (
                        <span className="rounded-full border border-blue-500/40 bg-blue-900/25 px-2 py-0.5 text-[10px] text-blue-200">
                          {t("economyLinkAddon.unlockRangeLabel", "LV permitido")}: {unlockBounds.min}-{unlockBounds.max}
                        </span>
                      )}
                    </span>
                    <CommitOptionalNumberInput
                      value={addon.unlockValue}
                      onCommit={(next) =>
                        commit({
                          unlockValue:
                            next == null ? undefined : clampInteger(next, unlockBounds.min, unlockBounds.max),
                        })
                      }
                      placeholder="0"
                      min={unlockBounds.min ?? 0}
                      max={unlockBounds.max}
                      integer
                      step={1}
                      className={INPUT_CLASS}
                    />
                  </label>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {validationMessages.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-700/60 bg-amber-900/20 p-3 text-xs text-amber-200">
          {validationMessages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}

    </section>
  );
}
