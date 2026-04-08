"use client";

import { useMemo } from "react";
import type {
  GlobalVariableAddonDraft,
  GlobalVariableScope,
  GlobalVariableValueType,
} from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { blurOnEnterKey } from "@/hooks/useBlurCommitText";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { useProjectStore } from "@/store/projectStore";

interface GlobalVariableAddonPanelProps {
  addon: GlobalVariableAddonDraft;
  onChange: (next: GlobalVariableAddonDraft) => void;
  onRemove: () => void;
}

const PANEL_SHELL_CLASS = "rounded-2xl border border-gray-700/80 bg-gray-900/70 p-4 md:p-5";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-gray-500";
const BUTTON_DANGER_CLASS = "rounded-lg border border-rose-700/60 bg-rose-900/30 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-900/50";

function toSlugKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-\s]+/g, "")
    .replace(/\s+/g, "_");
}

function toNumberOrZero(raw: string): number {
  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function CommitTextInput({
  resetKey,
  value,
  onCommit,
  placeholder,
}: {
  resetKey: string;
  value: string;
  onCommit: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      key={resetKey}
      type="text"
      defaultValue={value}
      onBlur={(event) => {
        const next = event.currentTarget.value;
        if (next !== value) onCommit(next);
      }}
      onKeyDown={blurOnEnterKey}
      placeholder={placeholder}
      className={INPUT_CLASS}
    />
  );
}

export function GlobalVariableAddonPanel({ addon, onChange, onRemove }: GlobalVariableAddonPanelProps) {
  const { t } = useI18n();
  const projects = useProjectStore((state) => state.projects);

  const commit = (patch: Partial<GlobalVariableAddonDraft>) => {
    onChange({
      ...addon,
      ...patch,
    });
  };

  const valueTypes: GlobalVariableValueType[] = ["percent", "multiplier", "flat", "boolean"];
  const scopes: GlobalVariableScope[] = ["global", "mode", "event", "season"];
  const isBoolean = addon.valueType === "boolean";
  const currentSectionId = useMemo(() => {
    for (const project of projects) {
      for (const section of project.sections || []) {
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type !== "globalVariable") continue;
          if (sectionAddon.id === addon.id || sectionAddon.data?.id === addon.id) {
            return section.id;
          }
        }
      }
    }
    return null;
  }, [addon.id, projects]);

  const usedBySections = useMemo(() => {
    if (!currentSectionId) return [] as Array<{ projectId: string; sectionId: string; title: string; inBuy: boolean; inSell: boolean }>;
    const out: Array<{ projectId: string; sectionId: string; title: string; inBuy: boolean; inSell: boolean }> = [];
    const seen = new Set<string>();
    for (const project of projects) {
      for (const section of project.sections || []) {
        let inBuy = false;
        let inSell = false;
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type !== "economyLink") continue;
          inBuy = inBuy || (sectionAddon.data.buyModifiers || []).some((item) => item.refId === currentSectionId);
          inSell = inSell || (sectionAddon.data.sellModifiers || []).some((item) => item.refId === currentSectionId);
        }
        if (!inBuy && !inSell) continue;
        if (seen.has(section.id)) continue;
        seen.add(section.id);
        out.push({
          projectId: project.id,
          sectionId: section.id,
          title: section.title || section.id,
          inBuy,
          inSell,
        });
      }
    }
    return out.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
  }, [currentSectionId, projects]);

  return (
    <section className={PANEL_SHELL_CLASS}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
              {t("globalVariableAddon.keyLabel", "Chave")}
            </span>
            <CommitTextInput
              resetKey={`${addon.id}-key-${addon.key}`}
              value={addon.key}
              onCommit={(next) => commit({ key: toSlugKey(next) })}
              placeholder={t("globalVariableAddon.keyPlaceholder", "Ex.: sell_bonus_pct")}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
              {t("globalVariableAddon.displayNameLabel", "Nome exibido")}
            </span>
            <CommitTextInput
              resetKey={`${addon.id}-displayName-${addon.displayName}`}
              value={addon.displayName}
              onCommit={(next) => commit({ displayName: next })}
              placeholder={t("globalVariableAddon.displayNamePlaceholder", "Ex.: Vende mais caro")}
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
              {t("globalVariableAddon.valueTypeLabel", "Tipo de valor")}
            </span>
            <select
              value={addon.valueType}
              onChange={(event) => {
                const nextType = event.target.value as GlobalVariableValueType;
                if (nextType === "boolean") {
                  commit({ valueType: nextType, defaultValue: Boolean(addon.defaultValue) });
                  return;
                }
                const currentAsNumber =
                  typeof addon.defaultValue === "boolean" ? (addon.defaultValue ? 1 : 0) : Number(addon.defaultValue || 0);
                commit({ valueType: nextType, defaultValue: currentAsNumber });
              }}
              className={INPUT_CLASS}
            >
              {valueTypes.map((valueType) => (
                <option key={valueType} value={valueType}>
                  {t(`globalVariableAddon.valueType.${valueType}`, valueType)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
              {t("globalVariableAddon.scopeLabel", "Escopo")}
            </span>
            <select
              value={addon.scope}
              onChange={(event) => commit({ scope: event.target.value as GlobalVariableScope })}
              className={INPUT_CLASS}
            >
              {scopes.map((scope) => (
                <option key={scope} value={scope}>
                  {t(`globalVariableAddon.scope.${scope}`, scope)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
            {t("globalVariableAddon.defaultValueLabel", "Valor padrao")}
          </span>
          {isBoolean ? (
            <div className="flex items-center">
              <ToggleSwitch
                checked={Boolean(addon.defaultValue)}
                onChange={(next) => commit({ defaultValue: next })}
                ariaLabel={t("globalVariableAddon.defaultValueLabel", "Valor padrao")}
              />
            </div>
          ) : (
            <input
              type="number"
              step="0.01"
              value={typeof addon.defaultValue === "number" ? addon.defaultValue : 0}
              onChange={(event) => commit({ defaultValue: toNumberOrZero(event.target.value) })}
              className={INPUT_CLASS}
            />
          )}
        </label>

        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
            {t("globalVariableAddon.notesLabel", "Observacoes")}
          </span>
          <CommitTextInput
            resetKey={`${addon.id}-notes-${addon.notes || ""}`}
            value={addon.notes || ""}
            onCommit={(next) => commit({ notes: next || undefined })}
            placeholder={t("globalVariableAddon.notesPlaceholder", "Informacoes complementares desta variavel")}
          />
        </label>
      </div>

      {usedBySections.length > 0 && (
        <div className="mt-3 rounded-lg border border-gray-700/80 bg-gray-900/60 p-3 space-y-2">
          <p className="text-xs uppercase tracking-wide text-gray-400">
            {t("globalVariableAddon.usedByTitle", "Usado por")}
          </p>
          <div className="space-y-1">
            {usedBySections.map((usage) => (
              <p key={usage.sectionId} className="text-xs text-gray-200">
                <a
                  href={`/projects/${usage.projectId}/sections/${usage.sectionId}`}
                  className="text-blue-300 hover:text-blue-200 underline"
                  title={t("globalVariableAddon.openUsageLinkTitle", "Abrir secao que usa esta variavel")}
                >
                  {usage.title}
                </a>
                {usage.inBuy && (
                  <span className="ml-2 rounded-full border border-emerald-500/40 bg-emerald-900/25 px-2 py-0.5 text-[10px] text-emerald-200">
                    {t("globalVariableAddon.usedByBuyBadge", "Compra")}
                  </span>
                )}
                {usage.inSell && (
                  <span className="ml-1 rounded-full border border-cyan-500/40 bg-cyan-900/25 px-2 py-0.5 text-[10px] text-cyan-200">
                    {t("globalVariableAddon.usedBySellBadge", "Venda")}
                  </span>
                )}
              </p>
            ))}
          </div>
        </div>
      )}

      {!addon.key.trim() && (
        <div className="mt-3 rounded-lg border border-amber-700/60 bg-amber-900/20 p-3 text-xs text-amber-200">
          {t("globalVariableAddon.validation.keyRequired", "Preencha a chave da variavel global.")}
        </div>
      )}

    </section>
  );
}
