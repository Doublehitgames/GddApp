"use client";

import type { CurrencyAddonDraft, CurrencyKind } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { CommitNumberInput, CommitTextInput } from "@/components/common/CommitInput";

interface CurrencyAddonPanelProps {
  addon: CurrencyAddonDraft;
  onChange: (next: CurrencyAddonDraft) => void;
  onRemove: () => void;
}

const PANEL_SHELL_CLASS = "rounded-2xl border border-gray-700/80 bg-gray-900/70 p-4 md:p-5";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-gray-500";
const BUTTON_DANGER_CLASS = "rounded-lg border border-rose-700/60 bg-rose-900/30 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-900/50";

export function CurrencyAddonPanel({ addon, onChange, onRemove }: CurrencyAddonPanelProps) {
  const { t } = useI18n();

  const commit = (patch: Partial<CurrencyAddonDraft>) => {
    onChange({
      ...addon,
      ...patch,
    });
  };

  const kinds: CurrencyKind[] = ["soft", "premium", "event", "other"];

  return (
    <section className={PANEL_SHELL_CLASS}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
              {t("currencyAddon.codeLabel", "Codigo")}
            </span>
            <CommitTextInput
              value={addon.code}
              onCommit={(next) => commit({ code: next })}
              transform={(raw) => raw.trim().toUpperCase()}
              placeholder={t("currencyAddon.codePlaceholder", "Ex.: COINS")}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
              {t("currencyAddon.displayNameLabel", "Nome exibido")}
            </span>
            <CommitTextInput
              value={addon.displayName}
              onCommit={(next) => commit({ displayName: next })}
              placeholder={t("currencyAddon.displayNamePlaceholder", "Ex.: Moedas")}
              className={INPUT_CLASS}
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
              {t("currencyAddon.kindLabel", "Tipo de moeda")}
            </span>
            <select
              value={addon.kind}
              onChange={(event) => commit({ kind: event.target.value as CurrencyKind })}
              className={INPUT_CLASS}
            >
              {kinds.map((kind) => (
                <option key={kind} value={kind}>
                  {t(`currencyAddon.kind.${kind}`, kind)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
              {t("currencyAddon.decimalsLabel", "Casas decimais")}
            </span>
            <CommitNumberInput
              value={addon.decimals}
              onCommit={(next) => commit({ decimals: next })}
              min={0}
              step={1}
              integer
              className={INPUT_CLASS}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
            {t("currencyAddon.notesLabel", "Observacoes")}
          </span>
          <CommitTextInput
            value={addon.notes || ""}
            onCommit={(next) => commit({ notes: next || undefined })}
            placeholder={t("currencyAddon.notesPlaceholder", "Informacoes complementares desta moeda")}
            className={INPUT_CLASS}
          />
        </label>
      </div>

      {!addon.code.trim() && (
        <div className="mt-3 rounded-lg border border-amber-700/60 bg-amber-900/20 p-3 text-xs text-amber-200">
          {t("currencyAddon.validation.codeRequired", "Preencha o codigo da moeda.")}
        </div>
      )}

    </section>
  );
}
