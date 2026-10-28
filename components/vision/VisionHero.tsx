"use client";

import { useMemo } from "react";
import { ProjectCover } from "@/components/project/ProjectCover";
import { useI18n } from "@/lib/i18n/provider";
import { normalizeProjectDocumentSpotlight, spotlightTags } from "@/lib/projectSpotlight";
import type { Project } from "@/store/slices/types";

/** A capa abre a Visão: é a primeira coisa que alguém vê do jogo. */
export function VisionHero({
  project,
  onPickCover,
  picking,
  coverError,
  onEdit,
}: {
  project: Project;
  onPickCover: () => void;
  picking: boolean;
  coverError?: string | null;
  onEdit: () => void;
}) {
  const { t } = useI18n();
  const v = project.vision ?? {};

  // As tags que a pessoa deu ao jogo na ficha técnica; sem elas, o gênero.
  const tags = useMemo(() => {
    const fromSheet = spotlightTags(normalizeProjectDocumentSpotlight(project.mindMapSettings?.documentView?.spotlight));
    return fromSheet.length ? fromSheet : ([v.genre?.trim()].filter(Boolean) as string[]);
  }, [project.mindMapSettings?.documentView?.spotlight, v.genre]);

  const btn = "rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#1d1a2b] transition-colors hover:bg-white disabled:opacity-60";

  return (
    <div>
      <ProjectCover project={project} className="min-h-[280px]">
        <div className="flex h-full w-full flex-col p-6 md:p-8">
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={onPickCover} disabled={picking} className={btn}>
              {picking
                ? t("projectDetail.cover.picking", "Abrindo o Drive…")
                : project.coverImageUrl
                  ? t("visionPage.changeCover", "Trocar capa")
                  : t("visionPage.pickCover", "Escolher imagem de capa")}
            </button>
            <button type="button" onClick={onEdit} className={btn}>
              {t("visionPage.editName", "Editar nome e descrição")}
            </button>
          </div>
          <div className="mt-auto flex max-w-3xl flex-col gap-3 pt-10">
            <h1 className="text-4xl font-bold leading-tight md:text-5xl">{project.title}</h1>
            {v.logline?.trim() ? (
              <p className="max-w-[62ch] text-base text-white/85 md:text-lg">{v.logline}</p>
            ) : (
              <p className="text-base italic text-white/55">{t("projectHome.coverHint", "A frase que resume o jogo aparece aqui.")}</p>
            )}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-white/25 bg-white/12 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </ProjectCover>
      {coverError && <p className="mt-2 text-sm text-danger">{coverError}</p>}
    </div>
  );
}
