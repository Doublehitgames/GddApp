"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n/provider";

/* A prosa curta que este modal mostra vem de `toPreviewText`, em
   `lib/richDoc/previewText.ts` — é a régua única de prévia, e é ela que
   garante que o texto de um spoiler não apareça num card onde não há o que
   clicar para revelar. */

interface SectionPreviewDialogProps {
  title: string;
  description: string;
  /** Texto do CTA. Cada tela define o seu: no documento é "ir para a seção", no mapa é "ir para a bolinha". */
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal de confirmação com prévia do conteúdo, usado antes de saltar para uma
 * seção referenciada. O ponto é nunca navegar direto no clique: o usuário vê
 * pra onde vai antes de perder o lugar onde estava.
 *
 * Só a apresentação mora aqui — o que "ir" significa é responsabilidade de quem
 * usa: rolar até a âncora no documento, selecionar a bolinha no mapa mental.
 *
 * A cor sai dos tokens, então o modal segue o `data-theme` de onde ele é
 * montado: claro dentro do Modo Doc e do Deck (que são `paper`), escuro dentro
 * do app no tema escuro. Antes cada tela carregava a própria cópia com cinza
 * fixo, e no escuro abria um retângulo branco no meio da tela.
 */
export function SectionPreviewDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}: SectionPreviewDialogProps) {
  const { t } = useI18n();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (cardRef.current?.contains(event.target as Node)) return;
      onCancel();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("view.anchorPreview.title", "Pré-visualização")}
        className="w-full max-w-lg rounded-2xl border border-line bg-surface shadow-2xl"
      >
        <div className="border-b border-line px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
            {t("view.anchorPreview.title", "Pré-visualização")}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-ink">{title}</h3>
        </div>
        <div className="px-5 py-4">
          <p className={`text-sm leading-6 ${description ? "text-ink-2" : "italic text-subtle"}`}>
            {description || t("view.anchorPreview.noDescription", "Sem descrição.")}
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            {t("common.cancel", "Cancelar")}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className="max-w-[20rem] truncate rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:opacity-90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
