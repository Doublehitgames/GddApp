"use client";

import { CoverImage } from "@/components/project/ProjectCover";
import { useI18n } from "@/lib/i18n/provider";
import type { ProjectDocumentSpotlight } from "@/lib/projectSpotlight";

/** "Engine: Godot 4" → ["Engine", "Godot 4"]. Linha sem rótulo fica inteira no valor. */
function splitDetail(line: string): [string, string] {
  const i = line.indexOf(":");
  return i > 0 ? [line.slice(0, i).trim(), line.slice(i + 1).trim()] : ["", line.trim()];
}

/**
 * A ficha técnica é dado curto e de consulta — mora no trilho da Visão, para
 * ler de relance. Editar abre o editor completo na coluna principal.
 */
export function SpotlightRail({ spotlight, editing, onEdit }: { spotlight?: ProjectDocumentSpotlight; editing: boolean; onEdit: () => void }) {
  const { t } = useI18n();
  const features = spotlight?.features ?? [];
  const details = spotlight?.technicalDetails ?? [];
  const links = spotlight?.storeLinks ?? [];
  const empty = !features.length && !details.length && !links.length && !spotlight?.titleIconUrl;

  return (
    <aside className="flex flex-col gap-5 xl:sticky xl:top-20">
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-4 flex items-center gap-3">
          {spotlight?.titleIconUrl ? (
            <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-surface-2">
              <CoverImage src={spotlight.titleIconUrl} alt="" />
            </span>
          ) : (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-area-vis-soft text-area-vis">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 4h6M9 4a2 2 0 0 0-2 2v0h10v0a2 2 0 0 0-2-2M7 6H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-2M8 11h8M8 15h5" />
              </svg>
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-ink">{t("projectDetail.spotlight.title", "Ficha técnica")}</h2>
            <p className="text-xs text-muted">{t("visionPage.sheetHint", "Aparece em destaque no modo Documento.")}</p>
          </div>
        </div>

        {empty ? (
          <button
            type="button"
            onClick={onEdit}
            className="w-full rounded-xl border border-dashed border-line-strong p-4 text-left text-sm text-muted hover:border-accent hover:text-ink"
          >
            {t("visionPage.sheetEmpty", "Plataformas, engine, estilo, público, links das lojas… o resumo técnico do jogo cabe aqui.")}
          </button>
        ) : (
          <div className="flex flex-col gap-4">
            {features.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">{t("visionPage.sheetFeatures", "Destaques")}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {features.map((f) => (
                    <span key={f} className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {details.length > 0 && (
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-subtle">{t("visionPage.sheetDetails", "Detalhes")}</h3>
                <dl className="divide-y divide-line">
                  {details.map((line) => {
                    const [label, value] = splitDetail(line);
                    return (
                      <div key={line} className="flex gap-3 py-2 text-sm">
                        {label && <dt className="w-24 shrink-0 text-muted">{label}</dt>}
                        <dd className="min-w-0 flex-1 font-medium text-ink">{value}</dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            )}

            {links.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">{t("visionPage.sheetLinks", "Onde jogar")}</h3>
                <div className="flex flex-col gap-1.5">
                  {links.map((link) => (
                    <a
                      key={link.url}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink hover:border-line-strong hover:bg-surface-2"
                    >
                      {link.label}
                      <span className="text-subtle" aria-hidden>
                        ↗
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!editing && (
          <button type="button" onClick={onEdit} className="mt-4 w-full rounded-lg border border-line py-2 text-sm font-medium text-ink hover:bg-surface-2">
            {t("visionPage.sheetEdit", "Editar ficha técnica")}
          </button>
        )}
      </section>
    </aside>
  );
}
