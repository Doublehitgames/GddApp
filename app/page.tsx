// src/app/page.tsx
"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useProjectStore } from "@/store/projectStore";
import { useAuthStore } from "@/store/authStore";
import UserMenu from "@/components/UserMenu";
import HomeSyncBar from "@/components/HomeSyncBar";
import { useI18n } from "@/lib/i18n/provider";
import { FREE_MAX_PROJECTS, FREE_MAX_SECTIONS_TOTAL } from "@/lib/structuralLimits";
import type { Project } from "@/store/projectStore";
import { getDriveImageDisplayCandidates } from "@/lib/googleDrivePicker";

export default function Home() {
  const projects = useProjectStore((s) => s.projects);
  const { user } = useAuthStore();
  const { t } = useI18n();

  const userId = user?.id ?? null;

  const { myProjects, sharedProjects } = useMemo(() => {
    const mine: Project[] = [];
    const shared: Project[] = [];
    for (const p of projects) {
      const isMine = userId != null && (p.ownerId === userId || p.ownerId == null);
      if (isMine) mine.push(p);
      else shared.push(p);
    }
    return { myProjects: mine, sharedProjects: shared };
  }, [projects, userId]);

  const mySections = myProjects.reduce((sum, p) => sum + (p.sections || []).length, 0);
  const projectsLeft = FREE_MAX_PROJECTS - myProjects.length;
  const sectionsLeft = FREE_MAX_SECTIONS_TOTAL - mySections;
  const showLimitWarning = projectsLeft <= 1 || sectionsLeft <= 10;

  const getProjectCoverUrl = (project: Project): string | null => {
    const candidates = getDriveImageDisplayCandidates(project.coverImageUrl || "");
    return candidates.length > 0 ? candidates[0] : null;
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white px-4 py-8 md:px-8 md:py-10 lg:px-10 pb-14">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-indigo-300/90 font-medium">{t("home.workspaceTag")}</p>
            <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">{t("common.appName")}</h1>
            <p className="mt-2 text-gray-300 max-w-2xl">{t("home.subtitle")}</p>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <a
              href="https://discord.gg/cqPsj7DhEr"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Discord"
              title="Discord"
              className="w-10 h-10 bg-indigo-700 hover:bg-indigo-600 rounded-lg transition-colors flex items-center justify-center"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="w-5 h-5 fill-current text-white">
                <path d="M20.317 4.37A19.791 19.791 0 0 0 15.885 3c-.191.328-.403.768-.552 1.11a18.27 18.27 0 0 0-5.666 0A11.69 11.69 0 0 0 9.115 3a19.736 19.736 0 0 0-4.432 1.37C1.884 8.58 1.128 12.685 1.507 16.73a19.93 19.93 0 0 0 5.993 3.03c.486-.66.918-1.36 1.285-2.09-.708-.268-1.387-.598-2.028-.98.17-.124.336-.254.496-.388 3.91 1.84 8.16 1.84 12.023 0 .16.134.326.264.496.388a12.9 12.9 0 0 1-2.032.982c.367.73.8 1.43 1.286 2.09a19.88 19.88 0 0 0 5.995-3.03c.444-4.69-.759-8.757-3.704-12.36ZM8.02 14.12c-1.18 0-2.15-1.08-2.15-2.41 0-1.33.95-2.41 2.15-2.41 1.21 0 2.17 1.09 2.15 2.41 0 1.33-.95 2.41-2.15 2.41Zm7.96 0c-1.18 0-2.15-1.08-2.15-2.41 0-1.33.95-2.41 2.15-2.41 1.21 0 2.17 1.09 2.15 2.41 0 1.33-.94 2.41-2.15 2.41Z" />
              </svg>
            </a>
            <UserMenu />
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="bg-gray-800/70 border border-gray-700/80 rounded-2xl p-4 md:p-6 shadow-xl shadow-black/10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-semibold tracking-tight">{t("home.projects.title")}</h2>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-gray-400">
                  <span className="font-semibold text-white">{myProjects.length}/{FREE_MAX_PROJECTS}</span> {t("home.projects.usageProjects")}
                </span>
                <span className="text-gray-500">·</span>
                <span className="text-gray-400">
                  <span className="font-semibold text-white">{mySections}/{FREE_MAX_SECTIONS_TOTAL}</span> {t("home.projects.usageSections")}
                </span>
              </div>
            </div>

            {showLimitWarning && (
              <div className="mb-4 p-3 rounded-lg bg-amber-900/30 border border-amber-600/60 text-amber-200 text-sm">
                {t("home.projects.limitWarning")
                  .replace("{{projectsLeft}}", String(Math.max(0, projectsLeft)))
                  .replace("{{sectionsLeft}}", String(Math.max(0, sectionsLeft)))}
              </div>
            )}

            <div className="flex flex-col gap-6">
              {/* Meus projetos */}
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-3">{t("home.projects.myProjectsTitle")}</h3>
                <div className="flex flex-col gap-3.5">
                  {myProjects.map((p) => {
                    const sections = p.sections || [];
                    const totalSec = sections.length;
                    const rootSections = sections.filter((s) => !s.parentId).length;
                    const subsections = totalSec - rootSections;
                    return (
                      <div
                        key={p.id}
                        className="relative overflow-hidden p-4 bg-gray-800/80 border border-gray-700 rounded-xl hover:border-gray-500 hover:bg-gray-800 transition-all flex items-center justify-between gap-3"
                      >
                        {getProjectCoverUrl(p) && (
                          <div
                            className="absolute inset-0 bg-cover bg-center"
                            style={{ backgroundImage: `url("${getProjectCoverUrl(p)}")` }}
                            aria-hidden="true"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-r from-gray-900/85 via-gray-900/70 to-gray-900/85" aria-hidden="true" />
                        <Link href={`/projects/${p.id}`} className="flex-1 min-w-0" prefetch={false}>
                          <div className="relative z-10 flex flex-col gap-2.5">
                            <h3 className="text-base md:text-lg font-semibold truncate leading-tight">{p.title}</h3>
                            <div className="flex flex-wrap gap-2 text-xs font-medium">
                              <span className="bg-blue-600/90 px-2.5 py-1 rounded-md" title="Seções raiz">📑 {rootSections}</span>
                              {subsections > 0 && <span className="bg-purple-600/90 px-2.5 py-1 rounded-md" title="Subseções">📄 {subsections}</span>}
                              <span className="bg-gray-600/90 px-2.5 py-1 rounded-md" title="Total">∑ {totalSec}</span>
                            </div>
                          </div>
                        </Link>
                        <Link
                          href={`/projects/${p.id}/settings`}
                          className="relative z-10 p-2 bg-gray-700/95 text-white rounded-lg hover:bg-gray-600 transition-colors shrink-0 inline-flex items-center justify-center"
                          title={t("home.projects.settings")}
                          aria-label={t("home.projects.settings")}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </Link>
                      </div>
                    );
                  })}
                  {myProjects.length === 0 && (
                    <p className="text-gray-400 bg-gray-800/80 border border-dashed border-gray-600 rounded-xl p-6 text-center text-sm">
                      {t("home.projects.empty")}
                    </p>
                  )}
                </div>
              </div>

              {/* Projetos compartilhados comigo */}
              {sharedProjects.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">{t("home.projects.sharedTitle")}</h3>
                  <div className="flex flex-col gap-3.5">
                    {sharedProjects.map((p) => {
                      const sections = p.sections || [];
                      const totalSec = sections.length;
                      const rootSections = sections.filter((s) => !s.parentId).length;
                      const subsections = totalSec - rootSections;
                      return (
                        <div
                          key={p.id}
                          className="relative overflow-hidden p-4 bg-gray-800/80 border border-gray-700 rounded-xl hover:border-gray-500 hover:bg-gray-800 transition-all"
                        >
                          {getProjectCoverUrl(p) && (
                            <div
                              className="absolute inset-0 bg-cover bg-center"
                              style={{ backgroundImage: `url("${getProjectCoverUrl(p)}")` }}
                              aria-hidden="true"
                            />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-r from-gray-900/85 via-gray-900/70 to-gray-900/85" aria-hidden="true" />
                          <Link href={`/projects/${p.id}`} className="block" prefetch={false}>
                            <div className="relative z-10 flex flex-col gap-2.5">
                              <h3 className="text-base md:text-lg font-semibold truncate leading-tight">{p.title}</h3>
                              <div className="flex flex-wrap gap-2 text-xs font-medium">
                                <span className="bg-blue-600/90 px-2.5 py-1 rounded-md">📑 {rootSections}</span>
                                {subsections > 0 && <span className="bg-purple-600/90 px-2.5 py-1 rounded-md">📄 {subsections}</span>}
                                <span className="bg-gray-600/90 px-2.5 py-1 rounded-md">∑ {totalSec}</span>
                              </div>
                            </div>
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="bg-gray-800/70 border border-gray-700/80 rounded-2xl p-4 md:p-6 h-fit shadow-xl shadow-black/10">
            <h2 className="text-xl font-semibold tracking-tight mb-4">{t("home.quickActions.title")}</h2>

            <div className="flex flex-col gap-3">
              <Link href="/ai-create-simple">
                <button className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all font-semibold text-base flex items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                  <span className="text-xl">🤖</span>
                  <span>{t("home.quickActions.createAi")}</span>
                </button>
              </Link>

              <Link href="/import">
                <button className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all font-semibold text-base flex items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                  <span className="text-xl">✨</span>
                  <span>{t("home.quickActions.importAi")}</span>
                </button>
              </Link>

              <Link href="/backup">
                <button className="w-full px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all font-semibold text-base flex items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                  <span className="text-xl">💾</span>
                  <span>{t("home.quickActions.backup")}</span>
                </button>
              </Link>

              <Link href="/projects">
                <button className="w-full px-6 py-3 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600 transition-colors font-medium">
                  {t("home.quickActions.createManual")}
                </button>
              </Link>
            </div>
          </aside>
        </section>
      </div>
      <HomeSyncBar />
    </main>
  );
}
