"use client";

import { useMemo, useState } from "react";
import type {
  CurrencyExchangeAddonDraft,
  CurrencyExchangeDirection,
  CurrencyExchangeEntry,
} from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";
import { useAuthStore } from "@/store/authStore";
import { useCurrentProjectId } from "@/hooks/useCurrentProjectId";
import { CommitNumberInput, CommitTextInput } from "@/components/common/CommitInput";
import { openQuickNewPage } from "@/components/QuickNewPageModal";

interface CurrencyExchangeAddonPanelProps {
  addon: CurrencyExchangeAddonDraft;
  onChange: (next: CurrencyExchangeAddonDraft) => void;
  onRemove: () => void;
}

const PANEL_SHELL_CLASS = "rounded-2xl border border-gray-700/80 bg-gray-900/70 p-4 md:p-5";
const PANEL_BLOCK_CLASS = "rounded-xl border border-gray-700/80 bg-gray-800/70 p-3";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-gray-500";
const BUTTON_CLASS =
  "rounded-lg border border-gray-600 bg-gray-800 px-2.5 py-1 text-xs text-gray-100 hover:bg-gray-700";
const BUTTON_DANGER_CLASS =
  "rounded-lg border border-rose-700/60 bg-rose-900/30 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-900/50";

type CurrencyOption = {
  refId: string;
  label: string;
  code: string;
};

function newEntryId(): string {
  return `cex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function CurrencyExchangeAddonPanel({ addon, onChange }: CurrencyExchangeAddonPanelProps) {
  const { t } = useI18n();
  const allProjects = useProjectStore((state) => state.projects);
  const addSection = useProjectStore((state) => state.addSection);
  const updateSectionAddon = useProjectStore((state) => state.updateSectionAddon);
  const { user, profile } = useAuthStore();
  const sectionAuditBy = user
    ? { userId: user.id, displayName: profile?.display_name ?? user.email ?? null }
    : undefined;
  const currentProjectId = useCurrentProjectId();
  const [wizardSkipped, setWizardSkipped] = useState(false);
  const [wizardName, setWizardName] = useState("");
  const [wizardCode, setWizardCode] = useState("");
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [wizardBusy, setWizardBusy] = useState(false);

  const currencyOptions = useMemo<CurrencyOption[]>(() => {
    const out: CurrencyOption[] = [];
    const projects = currentProjectId
      ? allProjects.filter((p) => p.id === currentProjectId)
      : allProjects;
    for (const project of projects) {
      for (const section of project.sections || []) {
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type !== "currency") continue;
          const data = sectionAddon.data;
          const code = data.code?.trim();
          const display = data.displayName?.trim() || data.name?.trim() || section.title || section.id;
          out.push({
            refId: section.id,
            label: code ? `${display} (${code})` : display,
            code: code || display,
          });
        }
      }
    }
    return out;
  }, [allProjects, currentProjectId]);

  const optionByRef = useMemo(() => {
    const map = new Map<string, CurrencyOption>();
    for (const o of currencyOptions) map.set(o.refId, o);
    return map;
  }, [currencyOptions]);

  const commit = (entries: CurrencyExchangeEntry[]) => {
    onChange({ ...addon, entries });
  };

  const updateEntry = (id: string, patch: Partial<CurrencyExchangeEntry>) => {
    commit(
      (addon.entries || []).map((entry) => {
        if (entry.id !== id) return entry;
        const next = { ...entry, ...patch };
        // Prevent same-currency exchange. If user picks a "from" that equals
        // current "to" (or vice versa), clear the other side so they have to
        // re-pick — silent overwrite would be confusing.
        if (
          patch.fromCurrencyRef &&
          next.fromCurrencyRef &&
          next.toCurrencyRef === next.fromCurrencyRef
        ) {
          next.toCurrencyRef = undefined;
        }
        if (
          patch.toCurrencyRef &&
          next.toCurrencyRef &&
          next.fromCurrencyRef === next.toCurrencyRef
        ) {
          next.fromCurrencyRef = undefined;
        }
        return next;
      })
    );
  };

  const removeEntry = (id: string) => {
    commit((addon.entries || []).filter((entry) => entry.id !== id));
  };

  const addEntry = () => {
    const next: CurrencyExchangeEntry = {
      id: newEntryId(),
      fromCurrencyRef: currencyOptions[0]?.refId,
      fromAmount: 1,
      // Default the "to" to the second distinct option; never the same as "from".
      toCurrencyRef: currencyOptions[1]?.refId,
      toAmount: 1,
      direction: "oneWay",
    };
    commit([...(addon.entries || []), next]);
  };

  const handleWizardCreate = () => {
    if (!currentProjectId) return;
    const name = wizardName.trim();
    if (!name) {
      setWizardError(t("currencyExchangeAddon.wizard.nameRequired", "Digite um nome para a moeda."));
      return;
    }
    setWizardBusy(true);
    try {
      // Reuse the "economy" page type so the new section is properly seeded
      // with a Currency addon following the standard convention.
      const newSectionId = addSection(currentProjectId, name, "", sectionAuditBy, "economy");
      if (!newSectionId) throw new Error("create_failed");
      // Customize the seeded currency: set displayName to the typed name and
      // code to whatever the user typed (or auto-derive from name).
      const code = wizardCode.trim().toUpperCase() || name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 8);
      const project = allProjects.find((p) => p.id === currentProjectId);
      const newSection = project?.sections?.find((s) => s.id === newSectionId);
      const currencyAddon = newSection?.addons?.find((a) => a.type === "currency");
      if (currencyAddon && currencyAddon.type === "currency") {
        updateSectionAddon(
          currentProjectId,
          newSectionId,
          currencyAddon.id,
          {
            ...currencyAddon,
            data: { ...currencyAddon.data, displayName: name, code },
          },
          sectionAuditBy
        );
      }
      setWizardName("");
      setWizardCode("");
      setWizardError(null);
    } catch {
      setWizardError(t("currencyExchangeAddon.wizard.createFailed", "Não foi possível criar a moeda."));
    } finally {
      setWizardBusy(false);
    }
  };

  const showWizard =
    !wizardSkipped &&
    (addon.entries || []).length === 0 &&
    currencyOptions.length < 2;

  const renderWizard = () => {
    const stepIndex = currencyOptions.length + 1;
    const created = currencyOptions.map((c) => c.label);
    return (
      <div className="mb-3 rounded-xl border border-indigo-500/40 bg-indigo-600/10 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-indigo-100">
              {t("currencyExchangeAddon.wizard.title", "Vamos configurar a Casa de Câmbio")}
            </h4>
            <p className="mt-1 text-xs text-indigo-200/80">
              {t(
                "currencyExchangeAddon.wizard.intro",
                "Para definir uma conversão você precisa de pelo menos 2 moedas no projeto."
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setWizardSkipped(true)}
            className="shrink-0 text-[11px] text-indigo-200/70 hover:text-indigo-100 underline"
          >
            {t("currencyExchangeAddon.wizard.skip", "Pular wizard")}
          </button>
        </div>

        {created.length > 0 && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-600/15 px-3 py-2 text-[11px] text-emerald-100">
            <span className="font-semibold">
              {t("currencyExchangeAddon.wizard.alreadyHave", "Você já tem:")}
            </span>{" "}
            {created.join(" · ")}
          </div>
        )}

        <div className="rounded-lg border border-indigo-500/30 bg-gray-900/60 p-3 space-y-2">
          <p className="text-[11px] uppercase tracking-wide text-indigo-200/80">
            {t("currencyExchangeAddon.wizard.stepLabel", "Etapa {step} de 2").replace(
              "{step}",
              String(stepIndex)
            )}
          </p>
          <p className="text-xs text-gray-200">
            {stepIndex === 1
              ? t(
                  "currencyExchangeAddon.wizard.stepFirstHint",
                  "Crie a primeira moeda. Ex.: Gold, Coins, Diamonds."
                )
              : t(
                  "currencyExchangeAddon.wizard.stepSecondHint",
                  "Crie a segunda moeda — algo que faça sentido converter pra primeira."
                )}
          </p>
          <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
            <label className="block">
              <span className="mb-1 block text-[11px] text-gray-400">
                {t("currencyExchangeAddon.wizard.nameLabel", "Nome")}
              </span>
              <input
                type="text"
                value={wizardName}
                onChange={(e) => {
                  setWizardName(e.target.value);
                  if (wizardError) setWizardError(null);
                }}
                placeholder={t("currencyExchangeAddon.wizard.namePlaceholder", "Ex.: Gold")}
                className={INPUT_CLASS}
                autoComplete="off"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-gray-400">
                {t("currencyExchangeAddon.wizard.codeLabel", "Código (opcional)")}
              </span>
              <input
                type="text"
                value={wizardCode}
                onChange={(e) => setWizardCode(e.target.value)}
                placeholder={t("currencyExchangeAddon.wizard.codePlaceholder", "GOLD")}
                className={INPUT_CLASS}
                autoComplete="off"
              />
            </label>
          </div>
          {wizardError && (
            <p className="text-xs text-red-400" role="alert">
              {wizardError}
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleWizardCreate}
              disabled={wizardBusy || !wizardName.trim()}
              className="rounded-lg border border-indigo-400/60 bg-indigo-600/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {stepIndex === 1
                ? t("currencyExchangeAddon.wizard.createFirst", "Criar primeira moeda")
                : t("currencyExchangeAddon.wizard.createSecond", "Criar segunda moeda")}
            </button>
          </div>
        </div>

        <p className="text-[10px] text-indigo-200/60">
          {t(
            "currencyExchangeAddon.wizard.afterHint",
            "Cada moeda vira uma página própria do projeto — você pode editar nome, código e tipo depois."
          )}
        </p>
      </div>
    );
  };

  const renderCurrencyEmptyHint = () => (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200">
      <span>
        {t(
          "currencyExchangeAddon.currencyEmptyHint",
          "Nenhuma página com Moeda neste projeto. Crie pelo menos duas para definir uma conversão."
        )}
      </span>
      <button
        type="button"
        onClick={openQuickNewPage}
        className="inline-flex items-center gap-1 rounded-md border border-amber-400/60 bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-50 hover:bg-amber-500/30"
      >
        <span aria-hidden="true">+</span>
        <span>{t("currencyExchangeAddon.createCurrencyCta", "Criar página de Moeda")}</span>
      </button>
    </div>
  );

  return (
    <section className={PANEL_SHELL_CLASS}>
      <div className="space-y-3">
        {showWizard && renderWizard()}

        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-100">
            {t("currencyExchangeAddon.entriesTitle", "Conversões")}
          </h4>
          <button
            type="button"
            onClick={addEntry}
            className={BUTTON_CLASS}
            disabled={currencyOptions.length < 2}
          >
            {t("currencyExchangeAddon.addEntryButton", "+ Conversão")}
          </button>
        </div>

        {!showWizard && currencyOptions.length === 0 ? renderCurrencyEmptyHint() : null}

        {(addon.entries || []).length === 0 ? (
          <div className={PANEL_BLOCK_CLASS}>
            <p className="text-xs text-gray-300">
              {t(
                "currencyExchangeAddon.emptyState",
                "Nenhuma conversão configurada ainda. Adicione uma para definir uma taxa entre duas moedas."
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {(addon.entries || []).map((entry) => {
              const fromOption = entry.fromCurrencyRef ? optionByRef.get(entry.fromCurrencyRef) : undefined;
              const toOption = entry.toCurrencyRef ? optionByRef.get(entry.toCurrencyRef) : undefined;
              const fromBroken = entry.fromCurrencyRef && !fromOption;
              const toBroken = entry.toCurrencyRef && !toOption;
              return (
                <div key={entry.id} className={PANEL_BLOCK_CLASS}>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] items-end">
                    <div>
                      <span className="mb-1 block text-xs text-gray-400">
                        {t("currencyExchangeAddon.fromLabel", "Gasta")}
                      </span>
                      <div className="flex items-center gap-2">
                        <CommitNumberInput
                          value={entry.fromAmount}
                          onCommit={(next) => updateEntry(entry.id, { fromAmount: next < 0 ? 0 : next })}
                          min={0}
                          step={1}
                          integer={false}
                          className={`${INPUT_CLASS} max-w-[110px]`}
                        />
                        <select
                          value={entry.fromCurrencyRef || ""}
                          onChange={(event) =>
                            updateEntry(entry.id, { fromCurrencyRef: event.target.value || undefined })
                          }
                          className={`${INPUT_CLASS} ${fromBroken ? "border-amber-500/70" : ""}`}
                        >
                          <option value="">{t("currencyExchangeAddon.selectNone", "Selecione a moeda")}</option>
                          {currencyOptions
                            .filter((option) => option.refId !== entry.toCurrencyRef)
                            .map((option) => (
                              <option key={option.refId} value={option.refId}>
                                {option.label}
                              </option>
                            ))}
                          {fromBroken ? (
                            <option value={entry.fromCurrencyRef}>
                              {t("currencyExchangeAddon.brokenCurrency", "Moeda removida")} ↯
                            </option>
                          ) : null}
                        </select>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        updateEntry(entry.id, {
                          direction: entry.direction === "bidirectional" ? "oneWay" : "bidirectional",
                        })
                      }
                      title={
                        entry.direction === "bidirectional"
                          ? t(
                              "currencyExchangeAddon.makeOneWay",
                              "Tornar mão única (somente De → Para)"
                            )
                          : t(
                              "currencyExchangeAddon.makeBidirectional",
                              "Tornar mão dupla (Para → De também)"
                            )
                      }
                      aria-pressed={entry.direction === "bidirectional"}
                      className={`shrink-0 self-end rounded-lg border px-2.5 py-1.5 text-base font-bold transition-colors ${
                        entry.direction === "bidirectional"
                          ? "border-indigo-400/60 bg-indigo-600/25 text-indigo-100 hover:bg-indigo-600/35"
                          : "border-gray-600 bg-gray-800/70 text-gray-200 hover:border-indigo-400/40 hover:text-white"
                      }`}
                    >
                      {entry.direction === "bidirectional" ? "⇄" : "→"}
                    </button>

                    <div>
                      <span className="mb-1 block text-xs text-gray-400">
                        {t("currencyExchangeAddon.toLabel", "Recebe")}
                      </span>
                      <div className="flex items-center gap-2">
                        <CommitNumberInput
                          value={entry.toAmount}
                          onCommit={(next) => updateEntry(entry.id, { toAmount: next < 0 ? 0 : next })}
                          min={0}
                          step={1}
                          integer={false}
                          className={`${INPUT_CLASS} max-w-[110px]`}
                        />
                        <select
                          value={entry.toCurrencyRef || ""}
                          onChange={(event) =>
                            updateEntry(entry.id, { toCurrencyRef: event.target.value || undefined })
                          }
                          className={`${INPUT_CLASS} ${toBroken ? "border-amber-500/70" : ""}`}
                        >
                          <option value="">{t("currencyExchangeAddon.selectNone", "Selecione a moeda")}</option>
                          {currencyOptions
                            .filter((option) => option.refId !== entry.fromCurrencyRef)
                            .map((option) => (
                              <option key={option.refId} value={option.refId}>
                                {option.label}
                              </option>
                            ))}
                          {toBroken ? (
                            <option value={entry.toCurrencyRef}>
                              {t("currencyExchangeAddon.brokenCurrency", "Moeda removida")} ↯
                            </option>
                          ) : null}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2">
                    <span className="mb-1 block text-xs text-gray-400">
                      {t("currencyExchangeAddon.notesLabel", "Notas (limites, condições)")}
                    </span>
                    <CommitTextInput
                      value={entry.notes || ""}
                      onCommit={(next) =>
                        updateEntry(entry.id, { notes: next.trim() ? next : undefined })
                      }
                      placeholder={t(
                        "currencyExchangeAddon.notesPlaceholder",
                        "Ex.: até 5x por dia"
                      )}
                      className={INPUT_CLASS}
                    />
                  </div>

                  {(fromBroken || toBroken) && (
                    <p className="mt-2 text-[11px] text-amber-300">
                      {t(
                        "currencyExchangeAddon.brokenLinkExplain",
                        "Uma das moedas não existe mais. Selecione outra ou remova esta conversão."
                      )}
                    </p>
                  )}

                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeEntry(entry.id)}
                      className={BUTTON_DANGER_CLASS}
                    >
                      {t("currencyExchangeAddon.removeEntryButton", "Remover")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
