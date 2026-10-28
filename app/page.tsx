// src/app/page.tsx
"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useProjectStore } from "@/store/projectStore";
import { useAuthStore } from "@/store/authStore";
import UserMenu from "@/components/UserMenu";
import HomeSyncBar from "@/components/HomeSyncBar";
import ThemeToggle from "@/components/ThemeToggle";
import { useI18n } from "@/lib/i18n/provider";
import type { Project, ProjectOwner } from "@/store/projectStore";
import { PublicShareButton } from "@/components/PublicShareButton";
import { projectPath } from "@/lib/utils/slug";
import { limitsForProject } from "@/store/slices/limits";
import { NewProjectDialog } from "@/components/NewProjectDialog";
import { ProjectCover, ProjectGlyph } from "@/components/project/ProjectCover";
import { IconDoc, IconLibrary, IconSystems, IconVision } from "@/components/project/ProjectSidebar";
import { useTimeAgo } from "@/hooks/useTimeAgo";
import { toPreviewText } from "@/lib/richDoc/previewText";
import { normalizeProjectDocumentSpotlight, spotlightTags } from "@/lib/projectSpotlight";

/** Nome curto do dono para o card: prefere o nome de exibição e, na falta dele,
 *  usa o e-mail cortado no "@" — o domínio não ajuda a identificar ninguém e
 *  ainda estoura a largura do card. O e-mail inteiro fica no title. */
function ownerLabel(owner: ProjectOwner | null | undefined): string | null {
  if (!owner) return null;
  const name = owner.displayName?.trim();
  if (name) return name;
  const email = owner.email?.trim();
  if (!email) return null;
  return email.split("@")[0] || email;
}

type SortMode = "recent" | "name" | "created";
type ViewMode = "grid" | "list";

/** Uso de páginas do projeto contra o teto do DONO — num projeto compartilhado não é o de quem olha. */
function usePagesUsage(project: Project) {
  const appLimits = useProjectStore((s) => s.appLimits);
  const limitsByOwner = useProjectStore((s) => s.limitsByOwner);
  const storeUserId = useProjectStore((s) => s.userId);
  const max = limitsForProject({ appLimits, limitsByOwner, userId: storeUserId }, project).FREE_MAX_SECTIONS_PER_PROJECT;
  const used = project.sections?.length ?? 0;
  return { used, max, left: max - used };
}

function projectSubtitle(project: Project): string {
  const sheet = spotlightTags(normalizeProjectDocumentSpotlight(project.mindMapSettings?.documentView?.spotlight));
  return [project.vision?.genre?.trim(), ...sheet.slice(0, 2)].filter(Boolean).join(" · ");
}

function projectLine(project: Project): string {
  return project.vision?.logline?.trim() || toPreviewText(project.description ?? "", 140);
}

function ProjectCard({ project, owner = null, showSettings = true }: { project: Project; owner?: ProjectOwner | null; showSettings?: boolean }) {
  const { t } = useI18n();
  const timeAgo = useTimeAgo();
  const usage = usePagesUsage(project);
  const ownerName = ownerLabel(owner);
  const subtitle = projectSubtitle(project);
  const line = projectLine(project);
  const usageTone = usage.left <= 0 ? "text-red-700 dark:text-red-300" : usage.left <= 10 ? "text-amber-700 dark:text-amber-300" : "text-ink";

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-line-strong">
      <Link href={projectPath(project)} prefetch={false} className="block" aria-label={project.title}>
        <ProjectCover project={project} className="h-36 rounded-none">
          <div className="p-3">
            <span className={`inline-flex items-center rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold ${usageTone}`} title={t("home.projects.pagesLeft").replace("{count}", String(Math.max(0, usage.left)))}>
              {t("home.projects.pagesUsage").replace("{used}", String(usage.used)).replace("{max}", String(usage.max))}
            </span>
          </div>
        </ProjectCover>
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <Link href={projectPath(project)} prefetch={false} className="flex items-center gap-3">
          <ProjectGlyph project={project} className="h-10 w-10 shrink-0 rounded-xl" />
          <span className="min-w-0">
            <strong className="block truncate text-[15px] text-ink group-hover:text-accent">{project.title}</strong>
            {(subtitle || ownerName) && (
              <span className="block truncate text-xs text-muted" title={owner?.email || undefined}>
                {ownerName ? `${t("home.projects.ownerPrefix", "de")} ${ownerName}` : subtitle}
              </span>
            )}
          </span>
        </Link>
        {line && <p className="mt-2.5 line-clamp-2 text-sm text-muted">{line}</p>}
        <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-subtle">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
          {project.updatedAt && (
            <span>
              {t("home.projects.edited", "Editado")} {timeAgo(project.updatedAt)}
            </span>
          )}
          {showSettings && (
            <span className="ml-auto flex items-center gap-1">
              <PublicShareButton shareToken={project.mindMapSettings?.sharing?.shareToken} isPublic={project.mindMapSettings?.sharing?.isPublic} variant="card" />
              <Link
                href={`${projectPath(project)}/settings`}
                className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
                title={t("home.projects.settings")}
                aria-label={t("home.projects.settings")}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <circle cx="5" cy="12" r="1.7" />
                  <circle cx="12" cy="12" r="1.7" />
                  <circle cx="19" cy="12" r="1.7" />
                </svg>
              </Link>
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function ProjectRow({ project, owner = null }: { project: Project; owner?: ProjectOwner | null }) {
  const { t } = useI18n();
  const timeAgo = useTimeAgo();
  const usage = usePagesUsage(project);
  const ownerName = ownerLabel(owner);
  return (
    <li>
      <Link href={projectPath(project)} prefetch={false} className="flex items-center gap-4 rounded-xl border border-line bg-surface p-3 hover:border-line-strong">
        <ProjectGlyph project={project} className="h-11 w-11 shrink-0 rounded-xl" />
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-sm text-ink">{project.title}</strong>
          <span className="block truncate text-xs text-muted">{ownerName ? `${t("home.projects.ownerPrefix", "de")} ${ownerName}` : projectLine(project) || projectSubtitle(project)}</span>
        </span>
        <span className="hidden text-xs tabular-nums text-muted sm:block">
          {t("home.projects.pagesUsage").replace("{used}", String(usage.used)).replace("{max}", String(usage.max))}
        </span>
        {project.updatedAt && <span className="hidden w-28 text-right text-xs text-subtle md:block">{timeAgo(project.updatedAt)}</span>}
      </Link>
    </li>
  );
}

export default function Home() {
  const projects = useProjectStore((s) => s.projects);
  // Limites efetivos do usuário logado (já com overrides individuais).
  const { FREE_MAX_PROJECTS } = useProjectStore((s) => s.appLimits);
  // Dono de cada projeto compartilhado: sem isso o card não diz de quem é.
  const ownersById = useProjectStore((s) => s.ownersById);
  const { user } = useAuthStore();
  const { t } = useI18n();
  const [dialog, setDialog] = useState<null | "blank" | "genre">(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("recent");
  const [view, setView] = useState<ViewMode>("grid");
  const searchRef = useRef<HTMLInputElement>(null);

  const userId = user?.id ?? null;

  const { myProjects, sharedProjects } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...projects]
      .filter((p) => !q || p.title.toLowerCase().includes(q))
      .sort((a, b) =>
        sort === "name"
          ? a.title.localeCompare(b.title)
          : sort === "created"
            ? (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
            : (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
      );
    const mine: Project[] = [];
    const shared: Project[] = [];
    for (const p of sorted) {
      const isMine = userId != null && (p.ownerId === userId || p.ownerId == null);
      if (isMine) mine.push(p);
      else shared.push(p);
    }
    return { myProjects: mine, sharedProjects: shared };
  }, [projects, userId, query, sort]);

  // Os donos são buscados no login, mas os projetos podem chegar depois (sync).
  // Uma tentativa por montagem: se o servidor não souber o dono, não insiste.
  const fetchProjectOwners = useProjectStore((s) => s.fetchProjectOwners);
  const ownersFetched = useRef(false);
  useEffect(() => {
    if (!userId || ownersFetched.current || sharedProjects.length === 0) return;
    ownersFetched.current = true;
    void fetchProjectOwners();
  }, [userId, sharedProjects.length, fetchProjectOwners]);

  // Ctrl+K busca nos projetos, como a busca de páginas faz dentro de um projeto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ownedCount = projects.filter((p) => userId != null && (p.ownerId === userId || p.ownerId == null)).length;
  const projectsLeft = FREE_MAX_PROJECTS - ownedCount;
  // Páginas não têm cota de conta: cada projeto tem seu próprio teto, e o card
  // de cada um mostra quanto falta. Aqui só avisamos sobre projetos.
  const showLimitWarning = projectsLeft <= 1;
  const canCreate = projectsLeft > 0;

  const areas = [
    { tone: "bg-area-vis-soft", tile: "bg-area-vis text-white", icon: <IconVision className="h-5 w-5" />, title: t("home.areas.visionTitle", "Organize suas ideias"), text: t("home.areas.visionText", "A ideia, os pilares e a sensação do jogo, num lugar só.") },
    { tone: "bg-area-doc-soft", tile: "bg-area-doc text-white", icon: <IconDoc className="h-5 w-5" />, title: t("home.areas.docsTitle", "Documente como funciona"), text: t("home.areas.docsText", "Regras, história e fases, ligadas umas às outras.") },
    { tone: "bg-area-lib-soft", tile: "bg-area-lib text-white", icon: <IconLibrary className="h-5 w-5" />, title: t("home.areas.libraryTitle", "Dê vida ao seu jogo"), text: t("home.areas.libraryText", "Personagens, itens e lugares com os seus números.") },
    { tone: "bg-area-sys-soft", tile: "bg-area-sys text-white", icon: <IconSystems className="h-5 w-5" />, title: t("home.areas.systemsTitle", "Conecte seus sistemas"), text: t("home.areas.systemsText", "Veja como cada parte do jogo puxa a outra.") },
  ];

  const ways = [
    { key: "blank", onClick: () => setDialog("blank"), tone: "bg-accent-soft text-accent", icon: <span className="text-lg leading-none">+</span>, title: t("home.ways.blank", "Projeto em branco"), text: t("home.ways.blankText", "Só o nome. As perguntas guiam o resto.") },
    { key: "genre", onClick: () => setDialog("genre"), tone: "bg-area-lib-soft text-area-lib", icon: <IconLibrary className="h-4 w-4" />, title: t("home.ways.genre", "Partir de um gênero"), text: t("home.ways.genreText", "RPG, puzzle, simulação… as perguntas se ajustam.") },
    { key: "import", href: "/import", tone: "bg-area-doc-soft text-area-doc", icon: <IconDoc className="h-4 w-4" />, title: t("home.ways.import", "Trazer o que já tenho"), text: t("home.ways.importText", "Arquivos .md, .docx ou .txt viram páginas.") },
    { key: "ai", href: "/ai-create-simple", tone: "bg-area-sys-soft text-area-sys", icon: <IconSystems className="h-4 w-4" />, title: t("home.ways.ai", "Criar com IA"), text: t("home.ways.aiText", "Descreva o jogo e receba um GDD inicial.") },
  ];

  return (
    <main className="min-h-screen bg-canvas pb-16 text-ink">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur md:px-8">
        <Link href="/" className="flex items-center gap-2.5 text-[15px] font-bold tracking-tight text-ink">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-on-accent">
            <IconVision className="h-4 w-4" />
          </span>
          <span className="hidden sm:inline">{t("common.appName", "GDD Manager")}</span>
        </Link>
        <label className="relative ml-2 hidden max-w-md flex-1 sm:block">
          <span className="sr-only">{t("home.search", "Buscar em seus projetos")}</span>
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("home.searchPlaceholder", "Buscar em seus projetos…")}
            className="h-9 w-full rounded-lg border border-line bg-canvas pl-9 pr-16 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-line px-1.5 font-sans text-[11px] text-subtle">Ctrl K</kbd>
        </label>
        <div className="ml-auto flex items-center gap-1.5">
          <Link href="/docs" className="hidden h-9 items-center rounded-lg px-3 text-sm text-muted hover:bg-surface-2 hover:text-ink sm:inline-flex">
            {t("home.docs", "Ajuda")}
          </Link>
          <a
            href="https://discord.gg/cqPsj7DhEr"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Discord"
            title="Discord"
            className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] fill-current">
              <path d="M20.317 4.37A19.791 19.791 0 0 0 15.885 3c-.191.328-.403.768-.552 1.11a18.27 18.27 0 0 0-5.666 0A11.69 11.69 0 0 0 9.115 3a19.736 19.736 0 0 0-4.432 1.37C1.884 8.58 1.128 12.685 1.507 16.73a19.93 19.93 0 0 0 5.993 3.03c.486-.66.918-1.36 1.285-2.09-.708-.268-1.387-.598-2.028-.98.17-.124.336-.254.496-.388 3.91 1.84 8.16 1.84 12.023 0 .16.134.326.264.496.388a12.9 12.9 0 0 1-2.032.982c.367.73.8 1.43 1.286 2.09a19.88 19.88 0 0 0 5.995-3.03c.444-4.69-.759-8.757-3.704-12.36ZM8.02 14.12c-1.18 0-2.15-1.08-2.15-2.41 0-1.33.95-2.41 2.15-2.41 1.21 0 2.17 1.09 2.15 2.41 0 1.33-.95 2.41-2.15 2.41Zm7.96 0c-1.18 0-2.15-1.08-2.15-2.41 0-1.33.95-2.41 2.15-2.41 1.21 0 2.17 1.09 2.15 2.41 0 1.33-.94 2.41-2.15 2.41Z" />
            </svg>
          </a>
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      <div className="grid w-full items-start gap-6 px-4 py-6 md:px-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-7">
          <section className="flex flex-wrap items-end gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted">{t("home.welcome", "Bem-vindo de volta!")}</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">{t("home.projects.myProjectsTitle", "Meus projetos")}</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted">
                {t("home.lead", "Aqui estão os seus jogos. Crie um novo, continue de onde parou ou abra um projeto para ver como ele está.")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDialog("blank")}
              disabled={!canCreate}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent hover:opacity-90 disabled:opacity-40"
            >
              <span className="text-lg leading-none">+</span>
              {t("projects.newProject", "Novo projeto")}
            </button>
          </section>

          {showLimitWarning && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-100 dark:bg-amber-900/30 p-3 text-sm text-amber-800 dark:text-amber-200">
              {t("home.projects.limitWarning").replace("{{projectsLeft}}", String(Math.max(0, projectsLeft)))}
            </div>
          )}

          <section className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            {areas.map((a) => (
              <div key={a.title} className={`rounded-2xl ${a.tone} p-4`}>
                <span className={`grid h-10 w-10 place-items-center rounded-xl ${a.tile}`}>{a.icon}</span>
                <strong className="mt-3 block text-sm text-ink">{a.title}</strong>
                <span className="mt-1 block text-sm text-ink-2">{a.text}</span>
              </div>
            ))}
          </section>

          <section>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold">{t("home.projects.yourProjects", "Seus projetos")}</h2>
              <span className="text-sm tabular-nums text-subtle">
                {ownedCount}/{FREE_MAX_PROJECTS}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortMode)}
                  aria-label={t("docsArea.sort", "Ordenar")}
                  className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-ink"
                >
                  <option value="recent">{t("docsArea.sortRecent", "Mais recentes")}</option>
                  <option value="name">{t("docsArea.sortAlpha", "A–Z")}</option>
                  <option value="created">{t("home.sortCreated", "Criados por último")}</option>
                </select>
                <div className="flex rounded-lg border border-line bg-surface p-0.5">
                  {(["grid", "list"] as ViewMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setView(mode)}
                      aria-pressed={view === mode}
                      aria-label={mode === "grid" ? t("home.viewGrid", "Ver em grade") : t("home.viewList", "Ver em lista")}
                      className={`grid h-8 w-8 place-items-center rounded-md ${view === mode ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"}`}
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
                        {mode === "grid" ? (
                          <>
                            <rect x="4" y="4" width="7" height="7" rx="1.5" />
                            <rect x="13" y="4" width="7" height="7" rx="1.5" />
                            <rect x="4" y="13" width="7" height="7" rx="1.5" />
                            <rect x="13" y="13" width="7" height="7" rx="1.5" />
                          </>
                        ) : (
                          <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
                        )}
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {view === "grid" ? (
              <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                {canCreate && !query && (
                  <button
                    type="button"
                    onClick={() => setDialog("blank")}
                    className="flex min-h-[18rem] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong p-6 text-center hover:border-accent"
                  >
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-2xl text-accent">+</span>
                    <strong className="mt-1 text-sm text-ink">{t("projects.newProject", "Novo projeto")}</strong>
                    <span className="max-w-[16rem] text-xs text-muted">{t("home.newCardText", "Só o nome do jogo. As perguntas dos primeiros passos guiam o resto.")}</span>
                    <span className="mt-2 rounded-lg bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent">{t("home.createProject", "Criar projeto")}</span>
                  </button>
                )}
                {myProjects.map((p) => (
                  <ProjectCard key={p.id} project={p} />
                ))}
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {myProjects.map((p) => (
                  <ProjectRow key={p.id} project={p} />
                ))}
              </ul>
            )}

            {myProjects.length === 0 && query && (
              <p className="mt-4 text-sm text-muted">{t("home.noMatch", "Nenhum projeto com esse nome.")}</p>
            )}
          </section>

          {sharedProjects.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-semibold">{t("home.projects.sharedTitle", "Compartilhados comigo")}</h2>
              {view === "grid" ? (
                <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                  {sharedProjects.map((p) => (
                    <ProjectCard key={p.id} project={p} showSettings={false} owner={(p.ownerId && ownersById[p.ownerId]) || null} />
                  ))}
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {sharedProjects.map((p) => (
                    <ProjectRow key={p.id} project={p} owner={(p.ownerId && ownersById[p.ownerId]) || null} />
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-5">
          <section className="overflow-hidden rounded-2xl border border-line bg-surface">
            <ProjectCover seed="gdd-manager-welcome" className="h-28 rounded-none" />
            <div className="p-5">
              <h2 className="text-base font-semibold text-ink">{t("home.heroTitle", "Vamos criar algo incrível?")}</h2>
              <p className="mt-1 text-sm text-muted">{t("home.heroText", "Todo jogo começa com uma ideia. Aqui ela vira um GDD que você consegue mostrar para alguém.")}</p>
              <Link href="/docs/comecar/primeiro-projeto" className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-accent-soft px-3 text-sm font-semibold text-accent hover:opacity-90">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                  <path d="M7 4l13 8-13 8z" />
                </svg>
                {t("home.tutorial", "Ver o passo a passo")}
              </Link>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="mb-3 text-base font-semibold text-ink">{t("home.waysTitle", "Jeitos de começar")}</h2>
            <ul className="flex flex-col gap-1">
              {ways.map((w) => {
                const body = (
                  <>
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${w.tone}`}>{w.icon}</span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-sm text-ink">{w.title}</strong>
                      <span className="block text-xs text-muted">{w.text}</span>
                    </span>
                    <span className="text-subtle" aria-hidden>
                      →
                    </span>
                  </>
                );
                const cls = "flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-surface-2 disabled:opacity-40";
                return (
                  <li key={w.key}>
                    {w.href ? (
                      <Link href={w.href} className={cls}>
                        {body}
                      </Link>
                    ) : (
                      <button type="button" onClick={w.onClick} disabled={!canCreate} className={cls}>
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            <Link href="/backup" className="mt-3 inline-block text-xs font-medium text-muted hover:text-ink">
              {t("home.quickActions.backup", "Backup & Restaurar")} →
            </Link>
          </section>

          <section className="rounded-2xl bg-accent-soft p-5">
            <p className="text-base font-medium leading-snug text-ink">“{t("home.quote", "A melhor forma de prever o futuro é inventá-lo.")}”</p>
            <p className="mt-2 text-sm text-muted">— Alan Kay</p>
          </section>
        </aside>
      </div>

      <HomeSyncBar />
      <NewProjectDialog open={dialog !== null} then={dialog === "genre" ? "genre" : undefined} onClose={() => setDialog(null)} />
    </main>
  );
}
