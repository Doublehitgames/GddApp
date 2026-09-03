/**
 * O selo de "pode estar desatualizada".
 *
 * Sozinho, um estado é uma etiqueta que envelhece em silêncio: a página segue
 * marcada como aprovada meses depois de tudo que ela promete ter mudado. O que
 * dá vida à etiqueta é cruzá-la com o grafo de referências que o GDD já tem —
 * se uma página aprovada cita $[Moinho] e o Moinho foi reescrito depois da
 * aprovação, alguém precisa reler aquela página.
 *
 * Só páginas em estado firme (aprovado / no jogo) são avaliadas: um rascunho
 * está desatualizado por definição e não precisa de aviso.
 */

import { extractSectionReferences, findSection } from "@/utils/sectionReferences";
import { isSettled, type PageStatus } from "./types";

export type StaleCandidate = {
  id: string;
  title: string;
  content?: string;
  updated_at?: string | null;
  status?: PageStatus;
  statusAt?: string | null;
};

export type StaleVerdict = {
  stale: boolean;
  /** Páginas citadas que mudaram depois da última confirmação, da mais recente. */
  changedRefs: Array<{ id: string; title: string; updatedAt: string }>;
};

const NOT_STALE: StaleVerdict = { stale: false, changedRefs: [] };

function time(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const value = new Date(iso).getTime();
  return Number.isNaN(value) ? null : value;
}

/**
 * Avalia uma página contra as páginas que ela cita.
 *
 * Nunca acusa a própria página: reescrevê-la é justamente o ato de atualizá-la,
 * e o `statusAt` acompanha esse movimento.
 */
export function checkStale(section: StaleCandidate, all: StaleCandidate[]): StaleVerdict {
  if (!isSettled(section.status)) return NOT_STALE;

  const since = time(section.statusAt);
  if (since == null) return NOT_STALE;

  const content = section.content ?? "";
  if (content === "") return NOT_STALE;

  const seen = new Set<string>();
  const changedRefs: StaleVerdict["changedRefs"] = [];

  for (const reference of extractSectionReferences(content)) {
    const target = findSection(all, reference);
    if (!target || target.id === section.id || seen.has(target.id)) continue;
    seen.add(target.id);

    const full = all.find((s) => s.id === target.id);
    const updated = time(full?.updated_at);
    if (updated != null && updated > since) {
      changedRefs.push({ id: target.id, title: target.title, updatedAt: full!.updated_at as string });
    }
  }

  changedRefs.sort((a, b) => (time(b.updatedAt) ?? 0) - (time(a.updatedAt) ?? 0));
  return { stale: changedRefs.length > 0, changedRefs };
}

/** Ids de todas as páginas do projeto que estão pedindo releitura. */
export function listStaleSections(sections: StaleCandidate[]): Set<string> {
  const stale = new Set<string>();
  for (const section of sections) {
    if (checkStale(section, sections).stale) stale.add(section.id);
  }
  return stale;
}
