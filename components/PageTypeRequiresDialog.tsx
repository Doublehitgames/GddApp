"use client";

import { useEffect, useState } from "react";
import type {
  PageType,
  RequiresCandidate,
} from "@/lib/pageTypes/registry";

export type PageTypeRequiresChoice =
  | { mode: "link-existing"; candidate: RequiresCandidate }
  | { mode: "create-new" }
  | { mode: "skip" };

interface Props {
  open: boolean;
  pageType: PageType | null;
  requiredPageType: PageType | null;
  candidates: RequiresCandidate[];
  onConfirm: (choice: PageTypeRequiresChoice) => void;
  onCancel: () => void;
  /** Optional override for the intro sentence under the title. */
  introCopy?: string;
}

type Selection =
  | { kind: "candidate"; candidateId: string }
  | { kind: "create-new" }
  | { kind: "skip" };

export function PageTypeRequiresDialog({
  open,
  pageType,
  requiredPageType,
  candidates,
  onConfirm,
  onCancel,
  introCopy,
}: Props) {
  const defaultSelection: Selection =
    candidates.length > 0
      ? { kind: "candidate", candidateId: candidates[0].sectionId + "::" + candidates[0].addonId }
      : { kind: "create-new" };
  const [selection, setSelection] = useState<Selection>(defaultSelection);

  useEffect(() => {
    if (!open) return;
    setSelection(defaultSelection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, candidates.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open || !pageType || !requiredPageType) return null;

  const handleConfirm = () => {
    if (selection.kind === "candidate") {
      const picked = candidates.find(
        (c) => c.sectionId + "::" + c.addonId === selection.candidateId
      );
      if (!picked) return;
      onConfirm({ mode: "link-existing", candidate: picked });
    } else if (selection.kind === "create-new") {
      onConfirm({ mode: "create-new" });
    } else {
      onConfirm({ mode: "skip" });
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden
      />
      <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto p-4 sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Vincular ${pageType.label} a ${requiredPageType.label}`}
          className="w-full max-w-xl mt-16 rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-gray-800 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-gray-100">
                Vincular {pageType.emoji} {pageType.label} a {requiredPageType.emoji}{" "}
                {requiredPageType.label}
              </h3>
              <p className="mt-1 text-xs text-gray-400 leading-relaxed">
                {introCopy ??
                  `Páginas de ${pageType.label.toLowerCase()} costumam vincular a uma página de ${requiredPageType.label.toLowerCase()}. Escolha abaixo como vincular.`}
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Fechar"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-gray-100"
            >
              ✕
            </button>
          </div>

          <div className="px-5 py-4 max-h-[min(60vh,520px)] overflow-y-auto space-y-2">
            {candidates.length > 0 && (
              <>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                  Vincular a página existente
                </h4>
                {candidates.map((c) => {
                  const id = c.sectionId + "::" + c.addonId;
                  const active =
                    selection.kind === "candidate" && selection.candidateId === id;
                  const previewText = c.previewLines.filter(Boolean).join(" · ");
                  return (
                    <label
                      key={id}
                      className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-all ${
                        active
                          ? "border-indigo-400/70 bg-gradient-to-r from-indigo-600/25 to-fuchsia-600/20"
                          : "border-gray-700 bg-gray-800/40 hover:border-gray-600 hover:bg-gray-800/70"
                      }`}
                    >
                      <input
                        type="radio"
                        name="page-type-requires"
                        className="sr-only"
                        checked={active}
                        onChange={() =>
                          setSelection({ kind: "candidate", candidateId: id })
                        }
                      />
                      <span
                        aria-hidden
                        className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                          active
                            ? "border-indigo-300 bg-gradient-to-br from-indigo-500 to-fuchsia-500"
                            : "border-gray-500 bg-gray-900"
                        }`}
                      >
                        {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </span>
                      <span className="flex-1 min-w-0 text-sm text-gray-100">
                        <span className="block font-medium truncate">{c.sectionTitle}</span>
                        <span className="block text-xs text-gray-400 mt-0.5 truncate">
                          {c.addonName}
                          {previewText && (
                            <>
                              {" · "}
                              {previewText}
                            </>
                          )}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </>
            )}

            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mt-3 mb-1">
              Outras opções
            </h4>
            <label
              className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-all ${
                selection.kind === "create-new"
                  ? "border-emerald-400/70 bg-gradient-to-r from-emerald-600/25 to-teal-600/20"
                  : "border-gray-700 bg-gray-800/40 hover:border-gray-600 hover:bg-gray-800/70"
              }`}
            >
              <input
                type="radio"
                name="page-type-requires"
                className="sr-only"
                checked={selection.kind === "create-new"}
                onChange={() => setSelection({ kind: "create-new" })}
              />
              <span
                aria-hidden
                className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  selection.kind === "create-new"
                    ? "border-emerald-300 bg-gradient-to-br from-emerald-500 to-teal-500"
                    : "border-gray-500 bg-gray-900"
                }`}
              >
                {selection.kind === "create-new" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                )}
              </span>
              <span className="flex-1 min-w-0 text-sm text-gray-100">
                <span className="block font-medium">
                  Criar nova página {requiredPageType.emoji} {requiredPageType.label}
                </span>
                <span className="block text-xs text-gray-400 mt-0.5">
                  Cria ambas de uma vez e vincula a nova página.
                </span>
              </span>
            </label>

            <label
              className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-all ${
                selection.kind === "skip"
                  ? "border-gray-400/70 bg-gray-700/40"
                  : "border-gray-700 bg-gray-800/40 hover:border-gray-600 hover:bg-gray-800/70"
              }`}
            >
              <input
                type="radio"
                name="page-type-requires"
                className="sr-only"
                checked={selection.kind === "skip"}
                onChange={() => setSelection({ kind: "skip" })}
              />
              <span
                aria-hidden
                className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  selection.kind === "skip"
                    ? "border-gray-200 bg-gray-300"
                    : "border-gray-500 bg-gray-900"
                }`}
              >
                {selection.kind === "skip" && <span className="h-1.5 w-1.5 rounded-full bg-gray-900" />}
              </span>
              <span className="flex-1 min-w-0 text-sm text-gray-100">
                <span className="block font-medium">Continuar sem vincular</span>
                <span className="block text-xs text-gray-400 mt-0.5">
                  Cria a página sem referência; você pode vincular depois manualmente.
                </span>
              </span>
            </label>
          </div>

          <div className="px-5 py-4 border-t border-gray-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center h-9 rounded-lg border border-gray-600 bg-gray-800 px-4 text-sm text-gray-200 hover:bg-gray-700 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="ui-btn-primary-gradient inline-flex items-center h-9 rounded-lg px-4 text-sm font-medium shadow-md shadow-indigo-900/30"
            >
              Confirmar e criar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
