/**
 * Estado de maturidade de uma página do GDD.
 *
 * O problema que isto resolve: num GDD grande toda página parece igualmente
 * verdadeira. Um rascunho de ontem e um sistema que está no jogo há três meses
 * têm exatamente a mesma cara, e o time para de confiar no documento. O estado
 * responde, na própria página, a pergunta que se faz o dia inteiro: isso já é
 * oficial? já está no jogo?
 *
 * Página sem estado é o normal, não um erro: um GDD antigo tem centenas delas,
 * e obrigar todo mundo a classificar tudo antes de usar a feature seria o
 * caminho mais curto para ninguém usar.
 */

export type PageStatus = "draft" | "review" | "approved" | "implemented" | "obsolete";

/** Do mais cru ao mais maduro; é esta a ordem que a UI mostra. */
export const PAGE_STATUSES: readonly PageStatus[] = [
  "draft",
  "review",
  "approved",
  "implemented",
  "obsolete",
] as const;

export function isPageStatus(value: unknown): value is PageStatus {
  return typeof value === "string" && (PAGE_STATUSES as readonly string[]).includes(value);
}

/** Aceita o que vier do banco ou da API e devolve um estado válido ou undefined. */
export function parsePageStatus(value: unknown): PageStatus | undefined {
  return isPageStatus(value) ? value : undefined;
}

export type PageStatusMeta = {
  /** Chave de tradução do rótulo. */
  labelKey: string;
  /** Rótulo em pt-BR, usado enquanto a chave não existe nos locales. */
  labelFallback: string;
  /** Pílula do estado (borda + fundo + texto). */
  badgeClass: string;
  /** Bolinha para listas apertadas, onde não cabe a pílula. */
  dotClass: string;
  /**
   * Cor do nó no mapa mental quando ele é colorido por estado. Hex cru, e não
   * classe do Tailwind: quem pinta ali é o React Flow, por style inline.
   */
  graphColor: string;
};

export const PAGE_STATUS_META: Record<PageStatus, PageStatusMeta> = {
  draft: {
    labelKey: "pageStatus.draft",
    labelFallback: "Rascunho",
    badgeClass: "border-gray-600/50 bg-gray-700/25 text-gray-300",
    dotClass: "bg-gray-500",
    graphColor: "#94a3b8",
  },
  review: {
    labelKey: "pageStatus.review",
    labelFallback: "Em revisão",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    dotClass: "bg-amber-500",
    graphColor: "#f59e0b",
  },
  approved: {
    labelKey: "pageStatus.approved",
    labelFallback: "Aprovado",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    dotClass: "bg-emerald-500",
    graphColor: "#10b981",
  },
  implemented: {
    labelKey: "pageStatus.implemented",
    labelFallback: "No jogo",
    badgeClass: "border-sky-500/30 bg-sky-500/10 text-sky-400",
    dotClass: "bg-sky-500",
    graphColor: "#0ea5e9",
  },
  obsolete: {
    labelKey: "pageStatus.obsolete",
    labelFallback: "Obsoleto",
    badgeClass: "border-rose-500/25 bg-rose-500/10 text-rose-400/90",
    dotClass: "bg-rose-500/70",
    graphColor: "#f43f5e",
  },
};

/**
 * Estados em que a página é uma promessa ao resto do time — é neles que faz
 * sentido avisar que algo referenciado mudou depois da última confirmação.
 */
export const SETTLED_STATUSES: readonly PageStatus[] = ["approved", "implemented"] as const;

export function isSettled(status: PageStatus | undefined): boolean {
  return status != null && (SETTLED_STATUSES as readonly string[]).includes(status);
}
