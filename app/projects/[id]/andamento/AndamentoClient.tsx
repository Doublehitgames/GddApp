"use client";

import Link from "next/link";
import StatusCoverageWidget from "@/components/pageStatus/StatusCoverageWidget";
import RoadmapWidget from "@/components/roadmap/RoadmapWidget";
import RecentActivityWidget from "@/components/project/RecentActivityWidget";
import { AreaHeader } from "@/components/project/AreaHeader";
import { IconProgress } from "@/components/project/ProjectSidebar";
import { useShellProject } from "@/components/project/useShellProject";
import { useI18n } from "@/lib/i18n/provider";

/** Onde moram os números do GDD: maturidade das páginas, roadmap e o que mudou. */
export default function AndamentoClient({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const project = useShellProject(projectId);
  if (!project) return null;

  return (
    <div className="w-full">
      <AreaHeader
        icon={<IconProgress className="h-5 w-5" />}
        tone="neutral"
        title={t("progressPage.title", "Andamento")}
        lead={t("progressPage.lead", "Em que pé está cada página, as próximas fases do jogo e o que mudou desde a última visita.")}
        actions={
          <Link
            href={`/projects/${projectId}/changelog`}
            className="inline-flex h-9 items-center rounded-lg border border-line px-3 text-sm font-medium text-ink hover:bg-surface-2"
          >
            {t("progressPage.changelog", "O que mudou")}
          </Link>
        }
      />
      <div className="flex flex-col gap-5">
        <StatusCoverageWidget projectId={projectId} realProjectId={project.id} />
        <div className="grid gap-5 lg:grid-cols-2">
          <RoadmapWidget projectId={projectId} realProjectId={project.id} />
          <RecentActivityWidget projectId={projectId} realProjectId={project.id} />
        </div>
      </div>
    </div>
  );
}
