"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

export type CurrencyPickChoice =
  | { mode: "link-existing"; sectionId: string; label: string }
  | { mode: "create-new"; name: string; code: string };

export type CurrencyExchangePairResult = {
  first: CurrencyPickChoice;
  second: CurrencyPickChoice;
  fromAmount: number;
  toAmount: number;
  direction: "oneWay" | "bidirectional";
};

export type CurrencyExchangePairCandidate = {
  sectionId: string;
  sectionTitle: string;
  code?: string;
  displayName?: string;
};

interface Props {
  open: boolean;
  pageTitle: string;
  candidates: CurrencyExchangePairCandidate[];
  onConfirm: (result: CurrencyExchangePairResult) => void;
  onCancel: () => void;
}

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400";

function deriveCode(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 8) || "COIN";
}

function CurrencyPicker({
  label,
  intro,
  candidates,
  excludeSectionId,
  value,
  defaultName,
  onChange,
}: {
  label: string;
  intro: string;
  candidates: CurrencyExchangePairCandidate[];
  excludeSectionId?: string;
  value: CurrencyPickChoice;
  defaultName: string;
  onChange: (next: CurrencyPickChoice) => void;
}) {
  const { t } = useI18n();
  const filtered = candidates.filter((c) => c.sectionId !== excludeSectionId);
  const isExisting = value.mode === "link-existing";
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900/40 p-3 space-y-2">
      <p className="text-[11px] uppercase tracking-wide text-indigo-200/80">{label}</p>
      <p className="text-xs text-gray-300">{intro}</p>

      {filtered.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wide text-gray-400">
            {t("currencyExchangePair.useExisting", "Usar moeda existente")}
          </p>
          <select
            value={isExisting ? value.sectionId : ""}
            onChange={(event) => {
              const sid = event.target.value;
              if (!sid) {
                onChange({ mode: "create-new", name: defaultName, code: deriveCode(defaultName) });
                return;
              }
              const cand = filtered.find((c) => c.sectionId === sid);
              if (!cand) return;
              const labelStr =
                cand.displayName?.trim() ||
                cand.code?.trim() ||
                cand.sectionTitle ||
                cand.sectionId;
              onChange({ mode: "link-existing", sectionId: sid, label: labelStr });
            }}
            className={INPUT_CLASS}
          >
            <option value="">— {t("currencyExchangePair.createNewPlaceholder", "Criar nova moeda")} —</option>
            {filtered.map((c) => {
              const display = c.displayName?.trim() || c.sectionTitle;
              const code = c.code?.trim();
              return (
                <option key={c.sectionId} value={c.sectionId}>
                  {display}
                  {code && code !== display ? ` (${code})` : ""}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {value.mode === "create-new" && (
        <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
              {t("currencyExchangePair.nameLabel", "Nome")}
            </span>
            <input
              type="text"
              value={value.name}
              onChange={(e) => {
                const name = e.target.value;
                onChange({ ...value, name, code: value.code || deriveCode(name) });
              }}
              placeholder={t("currencyExchangePair.namePlaceholder", "Ex.: Gold")}
              className={INPUT_CLASS}
              autoComplete="off"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
              {t("currencyExchangePair.codeLabel", "Código")}
            </span>
            <input
              type="text"
              value={value.code}
              onChange={(e) => onChange({ ...value, code: e.target.value.toUpperCase() })}
              placeholder={t("currencyExchangePair.codePlaceholder", "GOLD")}
              className={INPUT_CLASS}
              autoComplete="off"
            />
          </label>
        </div>
      )}
    </div>
  );
}

export function CurrencyExchangePairDialog({
  open,
  pageTitle,
  candidates,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useI18n();

  const [first, setFirst] = useState<CurrencyPickChoice>(
    candidates[0]
      ? {
          mode: "link-existing",
          sectionId: candidates[0].sectionId,
          label: candidates[0].displayName || candidates[0].code || candidates[0].sectionTitle,
        }
      : { mode: "create-new", name: "Gold", code: "GOLD" }
  );

  const [second, setSecond] = useState<CurrencyPickChoice>(() => {
    const cand2 = candidates.find((c) => c.sectionId !== (first.mode === "link-existing" ? first.sectionId : ""));
    return cand2
      ? {
          mode: "link-existing",
          sectionId: cand2.sectionId,
          label: cand2.displayName || cand2.code || cand2.sectionTitle,
        }
      : { mode: "create-new", name: "Gem", code: "GEM" };
  });

  const [fromAmount, setFromAmount] = useState(1);
  const [toAmount, setToAmount] = useState(1);
  const [direction, setDirection] = useState<"oneWay" | "bidirectional">("oneWay");

  // Reset when dialog opens with a new context.
  useEffect(() => {
    if (!open) return;
    if (candidates[0]) {
      setFirst({
        mode: "link-existing",
        sectionId: candidates[0].sectionId,
        label: candidates[0].displayName || candidates[0].code || candidates[0].sectionTitle,
      });
    } else {
      setFirst({ mode: "create-new", name: "Gold", code: "GOLD" });
    }
    const cand2 = candidates.find(
      (c) => c.sectionId !== (candidates[0]?.sectionId ?? "")
    );
    if (cand2) {
      setSecond({
        mode: "link-existing",
        sectionId: cand2.sectionId,
        label: cand2.displayName || cand2.code || cand2.sectionTitle,
      });
    } else {
      setSecond({ mode: "create-new", name: "Gem", code: "GEM" });
    }
    setFromAmount(1);
    setToAmount(1);
    setDirection("oneWay");
  }, [open, candidates]);

  const excludeForSecond =
    first.mode === "link-existing" ? first.sectionId : undefined;
  const excludeForFirst =
    second.mode === "link-existing" ? second.sectionId : undefined;

  const isValid = useMemo(() => {
    if (first.mode === "create-new" && !first.name.trim()) return false;
    if (second.mode === "create-new" && !second.name.trim()) return false;
    if (
      first.mode === "link-existing" &&
      second.mode === "link-existing" &&
      first.sectionId === second.sectionId
    )
      return false;
    if (fromAmount <= 0 || toAmount <= 0) return false;
    return true;
  }, [first, second, fromAmount, toAmount]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("currencyExchangePair.title", "Configurar Casa de Câmbio")}
      className="fixed inset-0 z-[110] flex items-start justify-center p-4 pt-16 bg-black/60 backdrop-blur-sm overflow-y-auto"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-gray-700 bg-gray-900/95 shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-semibold text-gray-100">
              {t("currencyExchangePair.titleFor", "Configurar conversão para {name}").replace(
                "{name}",
                pageTitle
              )}
            </h2>
            <p className="mt-0.5 text-xs text-gray-400">
              {t(
                "currencyExchangePair.intro",
                "Escolha as duas moedas envolvidas e a taxa inicial. Você pode adicionar mais conversões depois."
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={t("common.cancel", "Cancelar")}
            className="shrink-0 h-8 w-8 rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
          >
            ✕
          </button>
        </header>

        <div className="px-5 py-4 space-y-3">
          <CurrencyPicker
            label={t("currencyExchangePair.firstStep", "Moeda 1 — a que o jogador gasta")}
            intro={t(
              "currencyExchangePair.firstHint",
              "Linka uma moeda existente ou crie uma nova (vira uma página própria do projeto)."
            )}
            candidates={candidates}
            excludeSectionId={excludeForFirst}
            value={first}
            defaultName="Gold"
            onChange={setFirst}
          />

          <CurrencyPicker
            label={t("currencyExchangePair.secondStep", "Moeda 2 — a que o jogador recebe")}
            intro={t(
              "currencyExchangePair.secondHint",
              "Linka outra moeda existente ou crie uma nova. Não pode ser a mesma da Moeda 1."
            )}
            candidates={candidates}
            excludeSectionId={excludeForSecond}
            value={second}
            defaultName="Gem"
            onChange={setSecond}
          />

          <div className="rounded-xl border border-gray-700 bg-gray-900/40 p-3 space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-indigo-200/80">
              {t("currencyExchangePair.ratioLabel", "Taxa de conversão")}
            </p>
            <p className="text-xs text-gray-300">
              {t(
                "currencyExchangePair.ratioHint",
                "Quanto da Moeda 1 vale quanto da Moeda 2. Use ⇄ se a troca também valer no sentido oposto."
              )}
            </p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <label className="block">
                <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
                  {t("currencyExchangePair.fromAmount", "Gasta")}
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={fromAmount}
                  onChange={(e) => setFromAmount(Math.max(0, Number(e.target.value) || 0))}
                  className={INPUT_CLASS}
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  setDirection((prev) => (prev === "oneWay" ? "bidirectional" : "oneWay"))
                }
                title={
                  direction === "bidirectional"
                    ? t("currencyExchangePair.makeOneWay", "Tornar mão única")
                    : t("currencyExchangePair.makeBidirectional", "Tornar mão dupla")
                }
                aria-pressed={direction === "bidirectional"}
                className={`shrink-0 self-end h-[38px] rounded-lg border px-3 text-base font-bold transition-colors ${
                  direction === "bidirectional"
                    ? "border-indigo-400/60 bg-indigo-600/25 text-indigo-100 hover:bg-indigo-600/35"
                    : "border-gray-600 bg-gray-800/70 text-gray-200 hover:border-indigo-400/40 hover:text-white"
                }`}
              >
                {direction === "bidirectional" ? "⇄" : "→"}
              </button>
              <label className="block">
                <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
                  {t("currencyExchangePair.toAmount", "Recebe")}
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={toAmount}
                  onChange={(e) => setToAmount(Math.max(0, Number(e.target.value) || 0))}
                  className={INPUT_CLASS}
                />
              </label>
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-800 bg-gray-900/60 rounded-b-2xl">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
          >
            {t("common.cancel", "Cancelar")}
          </button>
          <button
            type="button"
            disabled={!isValid}
            onClick={() => onConfirm({ first, second, fromAmount, toAmount, direction })}
            className="rounded-lg border border-indigo-400/60 bg-indigo-600/90 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("currencyExchangePair.confirm", "Confirmar e criar")}
          </button>
        </footer>
      </div>
    </div>
  );
}
