"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";
import { DECK_GRID_THRESHOLD, type DeckLayout } from "@/lib/deck/deck";

/** Referência estável para o projeto sem páginas, para não re-renderizar à toa. */
const NO_SECTIONS: Array<{ id: string; parentId?: string }> = [];

interface Props {
  /** UUID do projeto, não o slug. */
  projectId: string;
  sectionId: string;
  deckLayout: DeckLayout | undefined;
  /** Membro sem permissão de escrita vê a escolha, mas não abre o menu. */
  readOnly?: boolean;
  className?: string;
}

const OPCOES: Array<{ valor: DeckLayout; glifo: string; chave: string; padrao: string; dica: string; dicaPadrao: string }> = [
  {
    valor: "grid",
    glifo: "▦",
    chave: "deckLayout.grid",
    padrao: "Grade",
    dica: "deckLayout.gridHint",
    dicaPadrao: "As subpáginas abrem como uma parede de cartas, num nível próprio.",
  },
  {
    valor: "list",
    glifo: "☰",
    chave: "deckLayout.list",
    padrao: "Lista",
    dica: "deckLayout.listHint",
    dicaPadrao: "As subpáginas ficam na lista lateral, junto do texto desta página.",
  },
];

/**
 * Como esta página mostra as filhas no modo Deck.
 *
 * Segue a mesma regra do estado de maturidade: ausência de escolha é o normal,
 * e o normal se apresenta como convite, nunca como uma pílula a mais. Sem
 * escolha, o Deck decide pela quantidade de filhas — e o menu diz qual seria a
 * decisão, para a pessoa saber o que está aceitando ao não escolher.
 */
export default function DeckLayoutPicker({
  projectId,
  sectionId,
  deckLayout,
  readOnly = false,
  className = "",
}: Props) {
  const { t } = useI18n();
  const setSectionDeckLayout = useProjectStore((s) => s.setSectionDeckLayout);
  const sections = useProjectStore(
    (s) => s.projects.find((p) => p.id === projectId)?.sections ?? NO_SECTIONS
  );
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const filhas = useMemo(
    () => sections.filter((s) => s.parentId === sectionId).length,
    [sections, sectionId]
  );
  const automaticoSeria: DeckLayout = filhas >= DECK_GRID_THRESHOLD ? "grid" : "list";

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

  // Página sem filhas não mostra nada: não há o que exibir de um jeito ou de
  // outro, e o controle seria uma pergunta sem assunto.
  if (filhas === 0) return null;

  const escolher = (valor: DeckLayout | undefined) => {
    setSectionDeckLayout(projectId, sectionId, valor);
    setOpen(false);
  };

  const escolhida = OPCOES.find((o) => o.valor === deckLayout);

  const pilula = escolhida ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-semibold leading-none text-sky-400">
      <span aria-hidden>{escolhida.glifo}</span>
      {t(escolhida.chave, escolhida.padrao)}
    </span>
  ) : (
    <span className="text-[11px] text-gray-600 transition-colors group-hover:text-gray-400">
      {t("deckLayout.set", "+ exibição no Deck")}
    </span>
  );

  if (readOnly) {
    return escolhida ? <span className={className}>{pilula}</span> : null;
  }

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="group rounded-full transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        title={t("deckLayout.pickerTitle", "Como esta página mostra as subpáginas no Deck")}
      >
        {pilula}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-30 mt-1.5 w-72 overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-xl shadow-black/40"
        >
          {OPCOES.map((opcao) => (
            <button
              key={opcao.valor}
              type="button"
              role="menuitemradio"
              aria-checked={deckLayout === opcao.valor}
              onClick={() => escolher(opcao.valor)}
              className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-gray-800 ${
                deckLayout === opcao.valor ? "text-white" : "text-gray-300"
              }`}
            >
              <span aria-hidden className="mt-0.5 w-4 shrink-0 text-center text-xs">
                {opcao.glifo}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold">{t(opcao.chave, opcao.padrao)}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-gray-500">
                  {t(opcao.dica, opcao.dicaPadrao)}
                </span>
              </span>
              {deckLayout === opcao.valor && <span className="ml-auto text-[10px] text-gray-500">✓</span>}
            </button>
          ))}

          {/*
            O automático não é "nenhum": é uma decisão que o app toma pela
            contagem. Dizer qual seria evita que a pessoa escolha à mão só para
            descobrir o que já ia acontecer.
          */}
          <button
            type="button"
            role="menuitemradio"
            aria-checked={!deckLayout}
            onClick={() => escolher(undefined)}
            className={`flex w-full items-start gap-2.5 border-t border-gray-800 bg-gray-950/60 px-3 py-2.5 text-left transition-colors hover:bg-gray-800 ${
              deckLayout ? "text-gray-400" : "text-white"
            }`}
          >
            <span aria-hidden className="mt-0.5 w-4 shrink-0 text-center text-xs">
              ✳
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold">{t("deckLayout.auto", "Automático")}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-gray-500">
                {t("deckLayout.autoHint", "Decide pela quantidade. Com {n} subpáginas, hoje seria {modo}.")
                  .replace("{n}", String(filhas))
                  .replace(
                    "{modo}",
                    t(
                      automaticoSeria === "grid" ? "deckLayout.grid" : "deckLayout.list",
                      automaticoSeria === "grid" ? "Grade" : "Lista"
                    ).toLowerCase()
                  )}
              </span>
            </span>
            {!deckLayout && <span className="ml-auto text-[10px] text-gray-500">✓</span>}
          </button>
        </div>
      )}
    </div>
  );
}
