"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collectDescendantIds } from "@/lib/pageStatus/subtree";
import { PAGE_STATUSES, PAGE_STATUS_META, type PageStatus } from "@/lib/pageStatus/types";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";

/** Referência estável para o projeto sem páginas, para não re-renderizar à toa. */
const NO_SECTIONS: Array<{ id: string; parentId?: string }> = [];

interface Props {
  /** UUID do projeto, não o slug. */
  projectId: string;
  sectionId: string;
  status: PageStatus | undefined;
  /** Membro sem permissão de escrita vê a pílula, mas não abre o menu. */
  readOnly?: boolean;
  className?: string;
}

/**
 * A pílula de maturidade da página, e o menu para trocá-la.
 *
 * Página sem estado mostra um convite discreto em vez de uma pílula cinza:
 * "sem estado" não é uma etiqueta que alguém escolheu, é a ausência de escolha,
 * e desenhar as duas coisas iguais faria um GDD antigo parecer todo classificado.
 */
export default function StatusPicker({
  projectId,
  sectionId,
  status,
  readOnly = false,
  className = "",
}: Props) {
  const { t } = useI18n();
  const setSectionsStatus = useProjectStore((s) => s.setSectionsStatus);
  const sections = useProjectStore(
    (s) => s.projects.find((p) => p.id === projectId)?.sections ?? NO_SECTIONS
  );
  const [open, setOpen] = useState(false);
  // Vale só enquanto o menu está aberto: aplicar ao ramo é uma decisão daquela
  // vez, não um modo em que a pessoa fica.
  const [includeSubtree, setIncludeSubtree] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Só quando o menu abre — varrer a árvore a cada render de uma página com
  // 250 irmãs não se paga para um menu que passa fechado a maior parte do tempo.
  const descendantIds = useMemo(
    () => (open ? collectDescendantIds(sections, sectionId) : []),
    [open, sections, sectionId]
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = (value: PageStatus) => {
    const meta = PAGE_STATUS_META[value];
    return t(meta.labelKey, meta.labelFallback);
  };

  const choose = (value: PageStatus | undefined) => {
    const targets = includeSubtree ? [sectionId, ...descendantIds] : [sectionId];
    setSectionsStatus(projectId, targets, value);
    setOpen(false);
    setIncludeSubtree(false);
  };

  const pill = status ? (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-none ${PAGE_STATUS_META[status].badgeClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${PAGE_STATUS_META[status].dotClass}`} />
      {label(status)}
    </span>
  ) : (
    <span className="text-[11px] text-gray-600 transition-colors group-hover:text-gray-400">
      {t("pageStatus.setStatus", "+ estado")}
    </span>
  );

  if (readOnly) {
    return status ? <span className={className}>{pill}</span> : null;
  }

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="group rounded-full transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        title={t("pageStatus.pickerTitle", "Maturidade desta página")}
      >
        {pill}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-30 mt-1.5 w-52 overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-xl shadow-black/40"
        >
          {PAGE_STATUSES.map((value) => (
            <button
              key={value}
              type="button"
              role="menuitemradio"
              aria-checked={status === value}
              onClick={() => choose(value)}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-gray-800 ${
                status === value ? "text-white" : "text-gray-300"
              }`}
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${PAGE_STATUS_META[value].dotClass}`} />
              {label(value)}
              {status === value && <span className="ml-auto text-[10px] text-gray-500">✓</span>}
            </button>
          ))}

          {status && (
            <button
              type="button"
              role="menuitem"
              onClick={() => choose(undefined)}
              className="w-full border-t border-gray-800 px-3 py-2 text-left text-xs text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-300"
            >
              {t("pageStatus.clear", "sem estado")}
            </button>
          )}

          {/* O ramo é o lote natural do GDD: "Sementes" e as 30 sementes
              embaixo dela nascem e entram no jogo juntas. Só aparece onde
              existe ramo — numa folha seria um controle sem nada para pegar. */}
          {descendantIds.length > 0 && (
            <label className="flex cursor-pointer items-start gap-2 border-t border-gray-800 bg-gray-950/60 px-3 py-2.5 text-[11px] text-gray-400 transition-colors hover:text-gray-200">
              <input
                type="checkbox"
                checked={includeSubtree}
                onChange={(event) => setIncludeSubtree(event.target.checked)}
                className="mt-0.5 h-3 w-3 shrink-0 accent-emerald-500"
              />
              <span>
                {(descendantIds.length === 1
                  ? t("pageStatus.applySubtreeOne", "aplicar também à subpágina")
                  : t("pageStatus.applySubtree", "aplicar também às {n} subpáginas")
                ).replace("{n}", String(descendantIds.length))}
              </span>
            </label>
          )}
        </div>
      )}
    </div>
  );
}
