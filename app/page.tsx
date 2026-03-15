// src/app/page.tsx
"use client";

import Link from "next/link";
import { useProjectStore } from "@/store/projectStore";
import UserMenu from "@/components/UserMenu";
import HomeSyncBar from "@/components/HomeSyncBar";
import { useI18n } from "@/lib/i18n/provider";
import { FREE_MAX_PROJECTS, FREE_MAX_SECTIONS_TOTAL } from "@/lib/structuralLimits";

export default function Home() {
  const projects = useProjectStore((s) => s.projects);
  const removeProject = useProjectStore((s) => s.removeProject);
  const { t } = useI18n();

  const totalSections = projects.reduce((sum, p) => sum + (p.sections || []).length, 0);
  const projectsLeft = FREE_MAX_PROJECTS - projects.length;
  const sectionsLeft = FREE_MAX_SECTIONS_TOTAL - totalSections;
  const showLimitWarning = projectsLeft <= 1 || sectionsLeft <= 10;

  const downloadProjectBackup = (project: (typeof projects)[number]) => {
    const backupData = {
      project,
      exportDate: new Date().toISOString(),
      version: "1.0",
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.title.replace(/[^a-z0-9]/gi, "_")}_backup_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
                  <span className="font-semibold text-white">{projects.length}/{FREE_MAX_PROJECTS}</span> {t("home.projects.usageProjects")}
                </span>
                <span className="text-gray-500">·</span>
                <span className="text-gray-400">
                  <span className="font-semibold text-white">{totalSections}/{FREE_MAX_SECTIONS_TOTAL}</span> {t("home.projects.usageSections")}
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

            <div className="flex flex-col gap-3.5">
              {projects.map((p) => {
                const sections = p.sections || [];
                const totalSections = sections.length;
                const rootSections = sections.filter((s) => !s.parentId).length;
                const subsections = totalSections - rootSections;

                return (
                  <div
                    key={p.id}
                    className="p-4 bg-gray-800/80 border border-gray-700 rounded-xl hover:border-gray-500 hover:bg-gray-800 transition-all flex items-center justify-between gap-3"
                  >
                    <Link href={`/projects/${p.id}`} className="flex-1 min-w-0">
                      <div className="flex flex-col gap-2.5">
                        <h3 className="text-base md:text-lg font-semibold truncate leading-tight">{p.title}</h3>
                        <div className="flex flex-wrap gap-2 text-xs font-medium">
                          <span className="bg-blue-600/90 px-2.5 py-1 rounded-md" title="Seções raiz">
                            📑 {rootSections}
                          </span>
                          {subsections > 0 && (
                            <span className="bg-purple-600/90 px-2.5 py-1 rounded-md" title="Subseções">
                              📄 {subsections}
                            </span>
                          )}
                          <span className="bg-gray-600/90 px-2.5 py-1 rounded-md" title="Total">
                            ∑ {totalSections}
                          </span>
                        </div>
                      </div>
                    </Link>

                    <button
                      className="px-3 py-1.5 bg-red-700/80 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                      onClick={() => {
                        const shouldRemove = window.confirm(
                          t("home.projects.confirmRemove", `Are you sure you want to remove project "${p.title}"?`).replace("{title}", p.title)
                        );

                        if (!shouldRemove) {
                          return;
                        }

                        const shouldBackup = window.confirm(
                          t("home.projects.confirmBackup", `Do you want to create a local backup of "${p.title}" before deleting?`).replace("{title}", p.title)
                        );

                        if (shouldBackup) {
                          try {
                            downloadProjectBackup(p);
                          } catch (error) {
                            console.error("Erro ao gerar backup antes da exclusão:", error);
                            const continueWithoutBackup = window.confirm(
                              t("home.projects.confirmDeleteWithoutBackup")
                            );
                            if (!continueWithoutBackup) {
                              return;
                            }
                          }
                        }

                        removeProject(p.id);
                      }}
                    >
                      {t("home.projects.remove")}
                    </button>
                  </div>
                );
              })}

              {projects.length === 0 && (
                <p className="text-gray-400 bg-gray-800/80 border border-dashed border-gray-600 rounded-xl p-6 text-center text-sm">
                  {t("home.projects.empty")}
                </p>
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
