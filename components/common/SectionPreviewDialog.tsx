"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Reduz markdown a uma linha de prosa curta, pra caber na previa do modal.
 */
export function toShortDescription(raw: string): string {
  const plain = (raw || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*`~_-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return "";
  return plain.length > 160 ? `${plain.slice(0, 157)}...` : plain;
}

interface SectionPreviewDialogProps {
  title: string;
  description: string;
  /** Texto do CTA. Cada tela define o seu: no documento e "ir para a secao", no mapa e "ir para a bolinha". */
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** `light` para telas de fundo claro (documento), `dark` para o mapa mental. */
  theme?: "dark" | "light";
}

/**
 * Modal de confirmacao com previa do conteudo, usado antes de saltar para uma
 * secao referenciada. O ponto e nunca navegar direto no clique: o usuario ve
 * pra onde vai antes de perder o lugar onde estava.
 *
 * So a apresentacao mora aqui — o que "ir" significa e responsabilidade de quem
 * usa: rolar ate a ancora no documento, selecionar a bolinha no mapa mental.
 */
export function SectionPreviewDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  theme = "light",
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

  const isDark = theme === "dark";
  const card = isDark
    ? "border-gray-700 bg-gray-800"
    : "border-gray-200 bg-white";
  const divider = isDark ? "border-gray-700" : "border-gray-200";
  const eyebrow = isDark ? "text-gray-400" : "text-gray-500";
  const heading = isDark ? "text-white" : "text-gray-900";
  const body = isDark ? "text-gray-300" : "text-gray-700";
  const cancelButton = isDark
    ? "border-gray-600 text-gray-300 hover:bg-gray-700"
    : "border-gray-300 text-gray-700 hover:bg-gray-100";

  return (
    <div className="fixed inset-0 z-50 bg-black/30 p-4 flex items-center justify-center">
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("view.anchorPreview.title", "Pré-visualização")}
        className={`w-full max-w-lg rounded-xl border shadow-2xl ${card}`}
      >
        <div className={`px-5 py-4 border-b ${divider}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide ${eyebrow}`}>
            {t("view.anchorPreview.title", "Pré-visualização")}
          </p>
          <h3 className={`mt-1 text-lg font-semibold ${heading}`}>{title}</h3>
        </div>
        <div className="px-5 py-4">
          <p className={`text-sm leading-6 ${body}`}>
            {description || t("view.anchorPreview.noDescription", "Sem descrição.")}
          </p>
        </div>
        <div className={`px-5 py-4 border-t ${divider} flex justify-end gap-2`}>
          <button
            type="button"
            onClick={onCancel}
            className={`rounded-lg border px-4 py-2 text-sm font-medium ${cancelButton}`}
          >
            {t("common.cancel", "Cancelar")}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
