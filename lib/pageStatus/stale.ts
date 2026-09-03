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
  /** Quando o texto mudou. Ausente em bancos sem a migração; aí vale updated_at. */
  content_updated_at?: string | null;
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
 * Quando o texto daquela página mudou pela última vez.
 *
 * `updated_at` responde outra pergunta — "a linha mudou" — e sobe também
 * quando alguém troca a cor do nó ou arrasta a página na árvore. Usar ele aqui
 * acendia o aviso em todo mundo que cita a página, sem uma palavra ter mudado.
 * O `content_updated_at` vem do trigger; onde a migração ainda não rodou ele
 * não existe, e o `updated_at` volta a ser a melhor aproximação disponível.
 */
function lastTextChange(section: StaleCandidate | undefined): number | null {
  if (!section) return null;
  return time(section.content_updated_at) ?? time(section.updated_at);
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
    const changedAt = lastTextChange(full);
    if (changedAt != null && changedAt > since) {
      changedRefs.push({
        id: target.id,
        title: target.title,
        updatedAt: new Date(changedAt).toISOString(),
      });
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
