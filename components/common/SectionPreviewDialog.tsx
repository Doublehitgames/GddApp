"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { SectionThumb, type ThumbSection } from "@/components/common/SectionThumb";
import { shortenBreadcrumb } from "@/lib/sections/breadcrumb";
import { PAGE_STATUS_META, type PageStatus } from "@/lib/pageStatus/types";

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
  /** A página sendo prevista, só para a imagem: thumb dela, ou o ícone do domínio. */
  thumb?: ThumbSection | null;
  /** O caminho na árvore, da raiz até a página, incluindo ela — `sectionBreadcrumb`. */
  path?: string[];
  /**
   * O estado de maturidade da página de destino. É o que responde "dá pra
   * confiar nisso?", que é metade da decisão de saltar — sem ele um rascunho
   * de três meses atrás tem a mesma cara de algo que está no jogo.
   */
  status?: PageStatus | null;
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
  thumb,
  path,
  status,
}: SectionPreviewDialogProps) {
  const { t } = useI18n();
  const cardRef = useRef<HTMLDivElement>(null);
  // Caminho de uma página só é o próprio título, que já está logo acima: não vira linha.
  const trail = path ?? [];
  const statusMeta = status ? PAGE_STATUS_META[status] : null;

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
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <SectionThumb section={{ ...thumb, title }} className="h-12 w-12" iconClassName="h-6 w-6" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="min-w-0 truncate text-lg font-semibold leading-tight text-ink">{title}</h3>
              {statusMeta && (
                <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${statusMeta.badgeClass}`}>
                  {t(statusMeta.labelKey, statusMeta.labelFallback)}
                </span>
              )}
            </div>
            {trail.length > 1 && (
              <p className="mt-1 truncate text-xs text-subtle" title={trail.join(" / ")}>
                {shortenBreadcrumb(trail).map((step, i, all) => (
                  <span key={`${step}-${i}`}>
                    {i > 0 && <span className="px-1 text-line-strong">/</span>}
                    <span className={i === all.length - 1 ? "text-muted" : undefined}>{step}</span>
                  </span>
                ))}
              </p>
            )}
          </div>
        </div>
        <div className="max-h-[45vh] overflow-y-auto px-5 py-4">
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
