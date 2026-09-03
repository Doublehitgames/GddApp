"use client";

import Link from "next/link";
import { useMemo } from "react";
import { checkStale, type StaleCandidate } from "@/lib/pageStatus/stale";
import { PAGE_STATUS_META, type PageStatus } from "@/lib/pageStatus/types";
import { toSlug } from "@/lib/utils/slug";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";

interface Props {
  /** UUID do projeto. */
  projectId: string;
  /** Slug do projeto, para os links. */
  projectSlug: string;
  section: StaleCandidate;
  sections: StaleCandidate[];
  readOnly?: boolean;
}

/**
 * O aviso de que a página pode ter envelhecido.
 *
 * É aqui que o estado deixa de ser etiqueta e vira ferramenta: uma página
 * aprovada que cita $[Moinho] passa a pedir releitura no dia em que o Moinho é
 * reescrito. O botão de confirmar não muda o estado — só recarimba a data,
 * dizendo "reli, continua valendo".
 */
export default function StaleNotice({
  projectId,
  projectSlug,
  section,
  sections,
  readOnly = false,
}: Props) {
  const { t } = useI18n();
  const setSectionStatus = useProjectStore((s) => s.setSectionStatus);

  const verdict = useMemo(() => checkStale(section, sections), [section, sections]);
  if (!verdict.stale) return null;

  const status = section.status as PageStatus;
  const statusLabel = t(PAGE_STATUS_META[status].labelKey, PAGE_STATUS_META[status].labelFallback);

  return (
    <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-sm text-amber-300">
          {t(
            "pageStatus.staleTitle",
            "Marcada como {status}, mas algo que ela cita mudou depois."
          ).replace("{status}", statusLabel.toLowerCase())}
        </p>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setSectionStatus(projectId, section.id, status)}
            className="ml-auto rounded-lg border border-amber-500/30 px-2.5 py-1 text-xs text-amber-300 transition-colors hover:bg-amber-500/10"
          >
            {t("pageStatus.confirmStillValid", "reli, continua valendo")}
          </button>
        )}
      </div>

      <ul className="mt-2 flex flex-wrap gap-1.5">
        {verdict.changedRefs.map((ref) => (
          <li key={ref.id}>
            <Link
              href={`/projects/${projectSlug}/sections/${toSlug(ref.title)}`}
              prefetch={false}
              className="inline-block rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-0.5 text-[11px] text-amber-200/90 transition-colors hover:border-amber-500/40 hover:text-amber-100"
            >
              {ref.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
