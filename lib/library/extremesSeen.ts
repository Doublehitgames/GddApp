/**
 * As pontas de cada coluna como estavam da última vez que alguém conferiu a
 * coleção neste aparelho — o "antes" de "a maior era Trigo, agora é Nabo".
 *
 * Mora no localStorage pelo mesmo motivo do marcador do changelog
 * (lib/changelog/seen.ts): é o que *eu* já vi, não um fato do projeto. Se o
 * registro some (aba anônima, cache limpo), a tela só deixa de avisar uma vez.
 */

import type { Extremes } from "./audit";

const KEY = "gdd_library_extremes_v1";

type Store = Record<string, Extremes>;

function readAll(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

/** As pontas registradas da coleção, ou null se ela nunca foi conferida aqui. */
export function readSeenExtremes(collectionId: string): Extremes | null {
  return readAll()[collectionId] ?? null;
}

export function writeSeenExtremes(collectionId: string, extremes: Extremes): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [collectionId]: extremes }));
  } catch {
    // Sem armazenamento: o aviso só não persiste.
  }
}
