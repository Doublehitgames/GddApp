"use client";

import Link from "next/link";
import { useMemo } from "react";
import { checkStale, type StaleCandidate } from "@/lib/pageStatus/stale";
import { PAGE_STATUSES, PAGE_STATUS_META, type PageStatus } from "@/lib/pageStatus/types";
import { toSlug } from "@/lib/utils/slug";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";

interface Props {
  /** Slug do projeto — usado nas URLs. */
  projectId: string;
  /** UUID do projeto — usado para achar no store. */
  realProjectId: string;
}

/** Quantas páginas pedindo releitura o widget nomeia antes de resumir. */
const STALE_PREVIEW = 4;

/** Referência estável para o projeto sem páginas — evita re-render por identidade nova. */
const NO_SECTIONS: StaleCandidate[] = [];

/**
 * A cobertura do GDD: quanto do documento é rascunho, quanto está aprovado,
 * quanto já está no jogo.
 *
 * É a única tela que responde "em que pé está o documento" sem abrir página por
 * página — e é onde as páginas que pedem releitura aparecem antes que alguém
 * tropece nelas.
 */
export default function StatusCoverageWidget({ projectId, realProjectId }: Props) {
  const { t } = useI18n();

  // Assina só as páginas deste projeto, e não a lista de projetos inteira: a
  // varredura de referências abaixo custa uma passada por todo o texto do GDD,
  // e não pode rodar de novo porque outro projeto mudou de nome.
  const sections = useProjectStore(
    (s) => (s.projects.find((p) => p.id === realProjectId)?.sections ?? NO_SECTIONS) as StaleCandidate[]
  );

  const counts = useMemo(() => {
    const byStatus = Object.fromEntries(PAGE_STATUSES.map((s) => [s, 0])) as Record<PageStatus, number>;
    let unset = 0;
    for (const section of sections) {
      if (section.status && byStatus[section.status] !== undefined) byStatus[section.status] += 1;
      else unset += 1;
    }
    return { byStatus, unset };
  }, [sections]);

  const stale = useMemo(
    () => sections.filter((section) => checkStale(section, sections).stale),
    [sections]
  );

  if (sections.length === 0) return null;

  const total = sections.length;
  const classified = total - counts.unset;
  const label = (status: PageStatus) =>
    t(PAGE_STATUS_META[status].labelKey, PAGE_STATUS_META[status].labelFallback);

  return (
    <section className="ui-card-premium overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-gray-800/60 px-4 pb-3 pt-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <span className="text-sm font-semibold text-white">
            {t("pageStatus.widgetTitle", "Maturidade do GDD")}
          </span>
          {stale.length > 0 && (
            <span className="flex items-center gap-1 rounded-full border border-amber-700/50 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              {(stale.length === 1
                ? t("pageStatus.staleBadgeOne", "1 pede releitura")
                : t("pageStatus.staleBadge", "{n} pedem releitura")
              ).replace("{n}", String(stale.length))}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500">
          {t("pageStatus.classified", "{done} de {total} classificadas")
            .replace("{done}", String(classified))
            .replace("{total}", String(total))}
        </span>
      </div>

      <div className="flex flex-col gap-3 px-4 py-3">
        {classified === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-700 px-3 py-4 text-sm text-gray-500">
            {t(
              "pageStatus.widgetEmpty",
              "Nenhuma página classificada ainda. Abra uma página e marque em que pé ela está — rascunho, aprovado, no jogo."
            )}
          </p>
        ) : (
          <>
            <div className="flex h-2 overflow-hidden rounded-full bg-gray-800">
              {PAGE_STATUSES.map((status) => {
                const count = counts.byStatus[status];
                if (count === 0) return null;
                return (
                  <div
                    key={status}
                    className={PAGE_STATUS_META[status].dotClass}
                    style={{ width: `${(count / total) * 100}%` }}
                    title={`${label(status)}: ${count}`}
                  />
                );
              })}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {PAGE_STATUSES.filter((status) => counts.byStatus[status] > 0).map((status) => (
                <span key={status} className="flex items-center gap-1.5 text-[11px] text-gray-400">
                  <span className={`h-2 w-2 rounded-full ${PAGE_STATUS_META[status].dotClass}`} />
                  {label(status)}
                  <span className="tabular-nums text-gray-500">{counts.byStatus[status]}</span>
                </span>
              ))}
              {counts.unset > 0 && (
                <span className="flex items-center gap-1.5 text-[11px] text-gray-600">
                  <span className="h-2 w-2 rounded-full border border-gray-700" />
                  {t("pageStatus.unset", "sem estado")}
                  <span className="tabular-nums">{counts.unset}</span>
                </span>
              )}
            </div>
          </>
        )}

        {stale.length > 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
            <p className="text-[11px] text-amber-300/90">
              {t(
                "pageStatus.staleExplain",
                "Páginas firmes que citam algo reescrito depois da última confirmação:"
              )}
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {stale.slice(0, STALE_PREVIEW).map((section) => (
                <li key={section.id}>
                  <Link
                    href={`/projects/${projectId}/sections/${toSlug(section.title)}`}
                    prefetch={false}
                    className="inline-block rounded-md border border-amber-500/20 px-2 py-0.5 text-[11px] text-amber-200/90 transition-colors hover:border-amber-500/40 hover:text-amber-100"
                  >
                    {section.title}
                  </Link>
                </li>
              ))}
              {stale.length > STALE_PREVIEW && (
                <li className="self-center text-[11px] text-amber-300/60">
                  {t("pageStatus.staleMore", "e mais {n}").replace(
                    "{n}",
                    String(stale.length - STALE_PREVIEW)
                  )}
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
