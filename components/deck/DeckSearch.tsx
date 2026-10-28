"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { labelOf, pathOf, type DeckSection, type DeckTree } from "@/lib/deck/deck";
import { buildSectionSearchIndex, searchSectionIndex, type SearchRange } from "@/lib/search/sectionSearch";

/** Quantos resultados a lista desenha; o resto fica no contador. */
const MAX_RESULTS = 40;

interface Props {
  tree: DeckTree<DeckSection>;
  /** Leva o Deck até a página — o mesmo caminho do `?focus=`. */
  onPick: (sectionId: string) => void;
}

/** O alvo do teclado é um campo de texto? Então `/` é só uma barra. */
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function Marked({ text, range }: { text: string; range: SearchRange | null }) {
  if (!range) return <>{text}</>;
  return (
    <>
      {text.slice(0, range.start)}
      <mark className="rounded-sm bg-amber-100 px-px text-inherit">{text.slice(range.start, range.end)}</mark>
      {text.slice(range.end)}
    </>
  );
}

/**
 * A busca do Deck: acha a página pelo título ou pelo texto e leva até ela.
 *
 * Diferente do documento, que rola até a âncora, o Deck não tem a página na
 * tela — ela pode estar três andares abaixo, numa lista de gaveta. Por isso a
 * busca mostra o caminho de cada resultado, e escolher um abre os níveis até
 * lá.
 *
 * O atalho é `/`, e não Ctrl+F: o do navegador continua sendo do navegador.
 */
export default function DeckSearch({ tree, onPick }: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  /* Na ordem da árvore, que é a ordem em que o Deck mostra as páginas. */
  const index = useMemo(() => {
    const ordered: DeckSection[] = [];
    const walk = (nodes: typeof tree.roots) =>
      nodes.forEach((node) => {
        ordered.push(node.section);
        walk(node.children);
      });
    walk(tree.roots);
    return buildSectionSearchIndex(ordered);
  }, [tree]);

  const hits = useMemo(() => searchSectionIndex(index, query), [index, query]);
  const shown = hits.slice(0, MAX_RESULTS);
  const hasQuery = query.trim().length > 0;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditable(event.target)) return;
      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* Clique fora fecha a lista, mas guarda o que foi digitado. */
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const pick = (id: string) => {
    onPick(id);
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      // Esc aqui é da busca: não pode chegar no Deck, que fecharia a gaveta.
      event.preventDefault();
      event.stopPropagation();
      if (open && hasQuery) setOpen(false);
      else {
        setQuery("");
        inputRef.current?.blur();
      }
      return;
    }
    if (!shown.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((prev) => (prev + 1) % shown.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActive((prev) => (prev - 1 + shown.length) % shown.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const hit = shown[active];
      if (hit) pick(hit.id);
    }
  };

  const listId = "deck-search-results";

  return (
    <div ref={boxRef} className="relative min-w-0 max-w-md flex-1">
      <svg
        className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
      </svg>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open && hasQuery}
        aria-controls={listId}
        aria-activedescendant={open && shown[active] ? `deck-search-${shown[active].id}` : undefined}
        aria-autocomplete="list"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={t("deck.searchPlaceholder", "Buscar página…")}
        className="h-8 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-8 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-600/60"
      />
      {!hasQuery && (
        <kbd
          aria-hidden
          className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-gray-300 px-1.5 text-[11px] leading-[18px] text-gray-400 sm:block"
        >
          /
        </kbd>
      )}
      {hasQuery && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setActive(0);
            inputRef.current?.focus();
          }}
          className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          title={t("view.clearSearch")}
          aria-label={t("view.clearSearch")}
        >
          ×
        </button>
      )}

      {open && hasQuery && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 min-w-[300px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          {shown.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-500">{t("deck.searchEmpty", "Nenhuma página encontrada.")}</p>
          ) : (
            <ul ref={listRef} id={listId} role="listbox" className="max-h-[60vh] overflow-y-auto py-1">
              {shown.map((hit, i) => {
                const node = tree.byId.get(hit.id);
                if (!node) return null;
                const parents = pathOf(tree, node).slice(0, -1);
                return (
                  <li
                    key={hit.id}
                    id={`deck-search-${hit.id}`}
                    data-index={i}
                    role="option"
                    aria-selected={i === active}
                    onPointerEnter={() => setActive(i)}
                    // `pointerdown` e não `click`: o clique-fora fecharia a lista antes.
                    onPointerDown={(event) => {
                      event.preventDefault();
                      pick(hit.id);
                    }}
                    className={`cursor-pointer px-4 py-2 ${i === active ? "bg-emerald-50" : ""}`}
                  >
                    {parents.length > 0 && (
                      <div className="truncate text-[11.5px] text-gray-400">
                        {parents.map((parent) => labelOf(parent.section)).join(" › ")}
                      </div>
                    )}
                    <div className="truncate text-sm font-semibold text-gray-900">
                      <Marked text={node.section.title || ""} range={hit.titleRange} />
                    </div>
                    {hit.snippet && (
                      <div className="mt-0.5 line-clamp-2 text-[12.5px] text-gray-600">
                        {hit.snippet.before}
                        <mark className="rounded-sm bg-amber-100 px-px text-inherit">{hit.snippet.match}</mark>
                        {hit.snippet.after}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {hits.length > shown.length && (
            <p className="border-t border-gray-100 px-4 py-2 text-[11.5px] text-gray-400">
              {t("deck.searchMore", "Mostrando {{shown}} de {{count}} — refine a busca.")
                .replace("{{shown}}", String(shown.length))
                .replace("{{count}}", String(hits.length))}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
