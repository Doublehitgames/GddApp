// src/app/page.tsx
"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useProjectStore } from "@/store/projectStore";
import { useAuthStore } from "@/store/authStore";
import UserMenu from "@/components/UserMenu";
import HomeSyncBar from "@/components/HomeSyncBar";
import { useI18n } from "@/lib/i18n/provider";
import { FREE_MAX_PROJECTS, FREE_MAX_SECTIONS_TOTAL } from "@/lib/structuralLimits";
import type { Project } from "@/store/projectStore";
import { getDriveImageDisplayCandidates } from "@/lib/googleDrivePicker";
import { PublicShareButton } from "@/components/PublicShareButton";

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 7) return `${days}d atrás`;
  if (days < 30) return `${Math.floor(days / 7)}sem atrás`;
  if (days < 365) return `${Math.floor(days / 30)}m atrás`;
  return `${Math.floor(days / 365)}a atrás`;
}

function getProjectIcon(project: Project): string | null {
  // Ícone da Ficha Técnica (spotlight) do projeto
  const spotlightIconUrl = project.mindMapSettings?.documentView?.spotlight?.titleIconUrl;
  if (spotlightIconUrl) {
    const candidates = getDriveImageDisplayCandidates(spotlightIconUrl);
    if (candidates.length > 0) return candidates[0];
  }
  return null;
}

function ProjectCard({
  project,
  showSettings = true,
}: {
  project: Project;
  showSettings?: boolean;
}) {
  const { t } = useI18n();
  const sections = project.sections || [];
  const totalSec = sections.length;
  const coverUrl =
    getDriveImageDisplayCandidates(project.coverImageUrl || "")[0] ?? null;
  const iconUrl = getProjectIcon(project);

  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-700/80 bg-gray-800/70 hover:border-indigo-500/50 hover:bg-gray-800 transition-all group min-h-[90px] flex flex-col">
      {coverUrl && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center opacity-25 group-hover:opacity-35 transition-opacity"
            style={{ backgroundImage: `url("${coverUrl}")` }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-gray-900/80 via-gray-900/50 to-gray-900/70"
            aria-hidden="true"
          />
        </>
      )}

      {/* Main link area */}
      <Link
        href={`/projects/${project.id}`}
        className="relative z-10 flex flex-1 items-center gap-3 px-4 py-4"
        prefetch={false}
      >
        {iconUrl && (
          <img
            src={iconUrl}
            alt=""
            aria-hidden="true"
            className="w-10 h-10 rounded-lg object-cover shrink-0"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-tight truncate pr-14">
            {project.title}
          </h3>
          <p className="mt-1.5 text-xs text-gray-400">
            {totalSec} {totalSec === 1 ? "página" : "páginas"}
            {project.updatedAt && (
              <> · editado {timeAgo(project.updatedAt)}</>
            )}
          </p>
        </div>
      </Link>

      {/* Actions — top-right corner */}
      {showSettings && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
          <PublicShareButton
            shareToken={project.mindMapSettings?.sharing?.shareToken}
            isPublic={project.mindMapSettings?.sharing?.isPublic}
            variant="card"
          />
          <Link
            href={`/projects/${project.id}/settings`}
            className="p-1.5 rounded-lg bg-gray-800/90 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            title={t("home.projects.settings")}
            aria-label={t("home.projects.settings")}
            onClick={(e) => e.stopPropagation()}
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </Link>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const projects = useProjectStore((s) => s.projects);
  const { user } = useAuthStore();
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const userId = user?.id ?? null;

  const { myProjects, sharedProjects } = useMemo(() => {
    const mine: Project[] = [];
    const shared: Project[] = [];
    for (const p of projects) {
      const isMine =
        userId != null && (p.ownerId === userId || p.ownerId == null);
      if (isMine) mine.push(p);
      else shared.push(p);
    }
    return { myProjects: mine, sharedProjects: shared };
  }, [projects, userId]);

  const mySections = myProjects.reduce(
    (sum, p) => sum + (p.sections || []).length,
    0
  );
  const projectsLeft = FREE_MAX_PROJECTS - myProjects.length;
  const sectionsLeft = FREE_MAX_SECTIONS_TOTAL - mySections;
  const showLimitWarning = projectsLeft <= 1 || sectionsLeft <= 10;

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <main className="min-h-screen bg-gray-900 text-white px-4 py-8 md:px-8 md:py-10 lg:px-10 pb-16">
      <div className="mx-auto w-full max-w-5xl space-y-8">

        {/* ── Header ── */}
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-indigo-300/90 font-medium">
              {t("home.workspaceTag")}
            </p>
            <h1 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight">
              {t("common.appName")}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/docs"
              aria-label="Documentação"
              title="Documentação"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-900/70 px-3 text-sm text-gray-300 hover:border-indigo-500 hover:text-white transition-colors"
            >
              <span aria-hidden="true">📚</span>
              <span className="hidden sm:inline">Docs</span>
            </Link>
            <a
              href="https://discord.gg/cqPsj7DhEr"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Discord"
              title="Discord"
              className="w-9 h-9 bg-indigo-700 hover:bg-indigo-600 rounded-lg flex items-center justify-center transition-colors"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="w-4 h-4 fill-current text-white"
              >
                <path d="M20.317 4.37A19.791 19.791 0 0 0 15.885 3c-.191.328-.403.768-.552 1.11a18.27 18.27 0 0 0-5.666 0A11.69 11.69 0 0 0 9.115 3a19.736 19.736 0 0 0-4.432 1.37C1.884 8.58 1.128 12.685 1.507 16.73a19.93 19.93 0 0 0 5.993 3.03c.486-.66.918-1.36 1.285-2.09-.708-.268-1.387-.598-2.028-.98.17-.124.336-.254.496-.388 3.91 1.84 8.16 1.84 12.023 0 .16.134.326.264.496.388a12.9 12.9 0 0 1-2.032.982c.367.73.8 1.43 1.286 2.09a19.88 19.88 0 0 0 5.995-3.03c.444-4.69-.759-8.757-3.704-12.36ZM8.02 14.12c-1.18 0-2.15-1.08-2.15-2.41 0-1.33.95-2.41 2.15-2.41 1.21 0 2.17 1.09 2.15 2.41 0 1.33-.95 2.41-2.15 2.41Zm7.96 0c-1.18 0-2.15-1.08-2.15-2.41 0-1.33.95-2.41 2.15-2.41 1.21 0 2.17 1.09 2.15 2.41 0 1.33-.94 2.41-2.15 2.41Z" />
              </svg>
            </a>
            <UserMenu />
          </div>
        </header>

        {/* ── Limit warning ── */}
        {showLimitWarning && (
          <div className="p-3 rounded-lg bg-amber-900/30 border border-amber-600/60 text-amber-200 text-sm">
            {t("home.projects.limitWarning")
              .replace("{{projectsLeft}}", String(Math.max(0, projectsLeft)))
              .replace("{{sectionsLeft}}", String(Math.max(0, sectionsLeft)))}
          </div>
        )}

        {/* ── My Projects ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-semibold">
                {t("home.projects.myProjectsTitle")}
              </h2>
              <span className="text-sm text-gray-500 tabular-nums">
                {myProjects.length}/{FREE_MAX_PROJECTS}
              </span>
            </div>

            {/* "+ Novo projeto" dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-600 bg-gray-800 text-sm text-gray-200 hover:border-indigo-500 hover:text-white transition-colors"
              >
                <span aria-hidden="true">+</span>
                <span>{t("projects.newProject")}</span>
                <svg
                  className={`w-3 h-3 text-gray-400 transition-transform ${menuOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-56 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-20 overflow-hidden py-1">
                  <Link
                    href="/ai-create-simple"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700/70 transition-colors"
                  >
                    <span aria-hidden="true">🤖</span>
                    <span>{t("home.quickActions.createAi")}</span>
                  </Link>
                  <Link
                    href="/import"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700/70 transition-colors"
                  >
                    <span aria-hidden="true">✨</span>
                    <span>{t("home.quickActions.importAi")}</span>
                  </Link>
                  <div className="my-1 border-t border-gray-700/80" />
                  <Link
                    href="/projects"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-400 hover:bg-gray-700/70 hover:text-gray-200 transition-colors"
                  >
                    <span aria-hidden="true">📝</span>
                    <span>{t("home.quickActions.createManual")}</span>
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {myProjects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
            {myProjects.length === 0 && (
              <div className="sm:col-span-2 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-700 p-10 text-center text-sm text-gray-500">
                <p>{t("home.projects.empty")}</p>
                <Link
                  href="/ai-create-simple"
                  className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  <span aria-hidden="true">🤖</span>
                  <span>{t("home.quickActions.createAi")}</span>
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* ── Shared projects ── */}
        {sharedProjects.length > 0 && (
          <section>
            <h2 className="text-base font-medium text-gray-500 mb-3">
              {t("home.projects.sharedTitle")}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sharedProjects.map((p) => (
                <ProjectCard key={p.id} project={p} showSettings={false} />
              ))}
            </div>
          </section>
        )}

        {/* ── Secondary actions bar ── */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-5 border-t border-gray-800 text-sm text-gray-500">
          <Link
            href="/ai-create-simple"
            className="inline-flex items-center gap-1.5 hover:text-gray-300 transition-colors"
          >
            <span aria-hidden="true">🤖</span>
            <span>{t("home.quickActions.createAi")}</span>
          </Link>
          <span className="text-gray-700" aria-hidden="true">·</span>
          <Link
            href="/import"
            className="inline-flex items-center gap-1.5 hover:text-gray-300 transition-colors"
          >
            <span aria-hidden="true">✨</span>
            <span>{t("home.quickActions.importAi")}</span>
          </Link>
          <span className="text-gray-700" aria-hidden="true">·</span>
          <Link
            href="/backup"
            className="inline-flex items-center gap-1.5 hover:text-gray-300 transition-colors"
          >
            <span aria-hidden="true">💾</span>
            <span>{t("home.quickActions.backup")}</span>
          </Link>
        </div>

      </div>
      <HomeSyncBar />
    </main>
  );
}
