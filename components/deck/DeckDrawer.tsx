"use client";

import type React from "react";
import SectionDescriptionReadOnly from "@/components/SectionDescriptionReadOnly";
import PageModeLinks from "@/components/project/PageModeLinks";
import DeckThumb from "@/components/deck/DeckThumb";
import { isRichDocEmpty } from "@/components/SectionDescriptionEditor";
import { useI18n } from "@/lib/i18n/provider";
import { PAGE_STATUS_META } from "@/lib/pageStatus/types";
import {
  DECK_STALE_GLYPH,
  DECK_STATUS_GLYPH,
  colorOf,
  iconOf,
  inkOn,
  isInventory,
  labelOf,
  pathOf,
  type DeckNode,
  type DeckSection,
  type DeckTree,
} from "@/lib/deck/deck";

export interface DeckDrawerProps<S extends DeckSection> {
  tree: DeckTree<S>;
  /** O que a direita mostra. */
  content: DeckNode<S>;
  /** De quem a esquerda lista as filhas. `null` esconde a coluna. */
  menu: DeckNode<S> | null;
  staleIds: Set<string>;
  projectId: string;
  sections: unknown[];
  projectTokenSource?: unknown;
  /** Posição da setinha, em px a partir da borda esquerda da grade. */
  caretLeft: number;
  onPick: (sectionId: string) => void;
  onBack: (sectionId: string) => void;
  onEnterFloor: (sectionId: string) => void;
  onClose: () => void;
  onReferenceNavigate: (sectionId: string) => void;
  /** Um passo da trilha: leva a gaveta (ou o andar) até aquela página. */
  onTrailNavigate: (sectionId: string) => void;
  /** Slug do projeto e token público: o trio de "ver noutro modo" monta as rotas. */
  projectSlug: string;
  publicToken?: string;
}

/** Ícone curto para menu, trilha e cabeçalho: emoji, ou as iniciais em cinza. */
function MiniIcon({ section }: { section: DeckSection }) {
  const icon = iconOf(section);
  if (icon.kind === "initials") {
    return <span className="w-5 shrink-0 text-center text-[11px] font-extrabold tracking-wide text-gray-400">{icon.text}</span>;
  }
  if (icon.kind === "image") {
    return (
      <span className="grid w-5 shrink-0 place-items-center">
        <DeckThumb url={icon.url} className="h-[18px] w-[18px]" />
      </span>
    );
  }
  return <span className="w-5 shrink-0 text-center text-[15px]">{icon.char}</span>;
}

/**
 * A gaveta que abre na linha da carta.
 *
 * Esquerda navega, direita mostra — e é a mesma gramática em qualquer andar.
 * Uma filha que é inventário não cabe nesta coluna: clicar nela vira andar.
 */
export default function DeckDrawer<S extends DeckSection>({
  tree,
  content,
  menu,
  staleIds,
  projectId,
  sections,
  projectTokenSource,
  caretLeft,
  onPick,
  onBack,
  onEnterFloor,
  onClose,
  onReferenceNavigate,
  onTrailNavigate,
  projectSlug,
  publicToken,
}: DeckDrawerProps<S>) {
  const { t } = useI18n();

  const kids = menu ? menu.children : [];
  const parent = menu ? tree.parentOf.get(menu.section.id) ?? null : null;
  const trail = pathOf(tree, content);
  const color = colorOf(tree, content);
  const status = content.section.status ? PAGE_STATUS_META[content.section.status] : null;
  const stale = staleIds.has(content.section.id);
  const contentIsInventory = isInventory(content, tree);
  const hasBody =
    !isRichDocEmpty(content.section.contentBlocks as never) ||
    Boolean((content.section.content || "").trim());

  const statusLabel = status ? t(status.labelKey, status.labelFallback) : "";
  const headIcon = iconOf(content.section);

  return (
    <div
      style={{ ["--deck-card" as string]: color }}
      className="relative col-[1/-1] my-3.5 mb-1.5 overflow-hidden rounded-[18px] border border-gray-200 bg-white shadow-[0_12px_40px_-12px_rgba(16,24,40,0.22)] motion-safe:animate-[deckDrawerIn_220ms_cubic-bezier(0.2,0.7,0.3,1)_both]"
    >
      <span
        aria-hidden
        style={{ left: caretLeft }}
        className="absolute top-0 h-[15px] w-[15px] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-tl-[3px] border-l border-t border-gray-200 bg-white transition-[left] duration-200"
      />

      <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3">
        <span
          style={{ background: color, color: inkOn(color) }}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] text-[17px] font-extrabold leading-none"
        >
          {headIcon.kind === "emoji" ? (
            headIcon.char
          ) : headIcon.kind === "initials" ? (
            <span className="text-[11px] tracking-wide">{headIcon.text}</span>
          ) : (
            <DeckThumb url={headIcon.url} className="h-[26px] w-[26px]" />
          )}
        </span>
        <span className="text-[15px] font-bold -tracking-[0.01em] text-gray-900">{labelOf(content.section)}</span>

        {status && (
          <span className="shrink-0 whitespace-nowrap rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-[11.5px] font-semibold text-gray-500">
            {DECK_STATUS_GLYPH[content.section.status!]} {statusLabel}
          </span>
        )}
        {stale && (
          <span
            title={t("deck.staleHint", "O texto de uma página citada mudou depois do carimbo")}
            className="shrink-0 whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-amber-800"
          >
            {DECK_STALE_GLYPH} {t("deck.stale", "pode estar desatualizada")}
          </span>
        )}

        <span className="ml-auto flex shrink-0 items-center gap-1">
          <PageModeLinks
            current="deck"
            projectId={projectSlug}
            project={projectTokenSource}
            sectionId={content.section.id}
            publicToken={publicToken}
          />
          <span aria-hidden className="mx-0.5 h-5 w-px bg-gray-200" />
          <button
            type="button"
            onClick={onClose}
            title={t("deck.close", "Fechar")}
            aria-label={t("deck.close", "Fechar")}
            className="grid h-[30px] w-[30px] place-items-center rounded-lg border border-gray-200 bg-white text-sm text-gray-500 hover:border-gray-300 hover:text-gray-900"
          >
            ✕
          </button>
        </span>
      </div>

      <div className={`grid min-h-[330px] ${kids.length ? "md:grid-cols-[262px_1fr]" : "grid-cols-1"}`}>
        {kids.length > 0 && (
          <nav className="max-h-none overflow-auto border-b border-gray-200 bg-[#fcfcfd] p-2.5 md:max-h-[60vh] md:border-b-0 md:border-r">
            {parent && (
              <button
                type="button"
                onClick={() => onBack(parent.section.id)}
                className="mb-1 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                ← {labelOf(parent.section)}
              </button>
            )}
            <div className="px-2 pb-1.5 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400">
              {labelOf(menu!.section)}
            </div>

            {kids.map((kid) => {
              const kidStatus = kid.section.status ? PAGE_STATUS_META[kid.section.status] : null;
              const kidInventory = isInventory(kid, tree);
              const active = kid.section.id === content.section.id;
              return (
                <button
                  key={kid.section.id}
                  type="button"
                  onClick={() => (kidInventory ? onEnterFloor(kid.section.id) : onPick(kid.section.id))}
                  className={`flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left text-[13.5px] leading-tight ${
                    active ? "bg-emerald-50 font-semibold text-emerald-800" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <MiniIcon section={kid.section} />
                  <span className="min-w-0 truncate">{labelOf(kid.section)}</span>
                  <span className="ml-auto flex shrink-0 items-center gap-1.5">
                    {kidStatus && (
                      <span
                        title={t(kidStatus.labelKey, kidStatus.labelFallback)}
                        className={`text-xs leading-none ${active ? "text-emerald-700" : "text-gray-400"}`}
                      >
                        {DECK_STATUS_GLYPH[kid.section.status!]}
                      </span>
                    )}
                    {staleIds.has(kid.section.id) && (
                      <span
                        title={t("deck.stale", "pode estar desatualizada")}
                        className={`text-xs leading-none ${active ? "text-emerald-700" : "text-gray-400"}`}
                      >
                        {DECK_STALE_GLYPH}
                      </span>
                    )}
                    {kid.children.length > 0 &&
                      (kidInventory ? (
                        <span className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-px text-[11px] font-semibold text-emerald-700">
                          ▦ {kid.children.length}
                        </span>
                      ) : (
                        <span className="whitespace-nowrap text-[11px] text-gray-400">{kid.children.length} ›</span>
                      ))}
                  </span>
                </button>
              );
            })}
          </nav>
        )}

        <article className="max-h-none overflow-auto px-5 pb-7 pt-5 md:max-h-[60vh] md:px-6">
          <h2 className="text-[19px] font-semibold -tracking-[0.02em] text-gray-900">{labelOf(content.section)}</h2>
          {/*
            A trilha do conteúdo é o atalho de subir sem rolar até o topo: quem
            lê uma carta no fundo de um inventário volta ao capítulo daqui mesmo.
            Ela é a única da gaveta — o cabeçalho tinha uma segunda, que dizia o
            mesmo depois de dois selos e só atrasava a leitura.
          */}
          <nav className="-ml-1 mb-4 mt-0.5 flex flex-wrap items-center gap-0.5 text-[12.5px] text-gray-400">
            {trail.map((node, index) => (
              <span key={node.section.id} className="flex items-center gap-0.5">
                {index > 0 && (
                  <span aria-hidden className="select-none">
                    ›
                  </span>
                )}
                {index === trail.length - 1 ? (
                  <span className="px-1 py-0.5">{labelOf(node.section)}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onTrailNavigate(node.section.id)}
                    title={t("deck.trailGo", "Ir para {{title}}").replace("{{title}}", labelOf(node.section))}
                    className="rounded px-1 py-0.5 hover:bg-gray-100 hover:text-gray-900"
                  >
                    {labelOf(node.section)}
                  </button>
                )}
              </span>
            ))}
          </nav>

          {hasBody ? (
            <div className="gdd-light-prose gdd-reading-prose prose max-w-none">
              <SectionDescriptionReadOnly
                blocks={content.section.contentBlocks as never}
                markdown={content.section.content}
                projectId={projectId}
                sections={sections as never}
                projectTokenSource={projectTokenSource as never}
                currentSectionId={content.section.id}
                theme="light"
                onReferenceNavigate={onReferenceNavigate}
              />
            </div>
          ) : (
            <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm italic text-gray-500">
              {t("deck.emptyContent", "Esta página ainda não tem descrição.")}
            </p>
          )}

          {contentIsInventory && (
            <button
              type="button"
              onClick={() => onEnterFloor(content.section.id)}
              className="mt-4 inline-flex items-center gap-2 rounded-[10px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13.5px] font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              ▦{" "}
              {t("deck.enterFloor", "Ver as {{count}} páginas de {{title}}")
                .replace("{{count}}", String(content.children.length))
                .replace("{{title}}", labelOf(content.section))}
            </button>
          )}
        </article>
      </div>
    </div>
  );
}
