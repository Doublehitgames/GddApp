"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { projectPath } from "@/lib/utils/slug";
import type { Project } from "@/store/slices/types";
import { ProjectGlyph } from "@/components/project/ProjectCover";
import { IconVision } from "@/components/project/ProjectSidebar";

export type HomeFilter = "all" | "shared";

const svg = (path: React.ReactNode) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {path}
  </svg>
);
const ICONS = {
  grid: svg(<><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>),
  shared: svg(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20c0-2.6-1.6-4.4-3.8-5.1" /></>),
  ai: svg(<path d="M12 3l1.8 4.8L19 9.6l-4.1 3.2L16.2 18 12 15l-4.2 3 1.3-5.2L5 9.6l5.2-1.8z" />),
  sync: svg(<path d="M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6L4 15M4 20v-5h5" />),
  key: svg(<><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3M15 8l2 2" /></>),
  backup: svg(<path d="M12 3v12M7 10l5 5 5-5M5 19h14" />),
  help: svg(<><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01" /></>),
};

/**
 * A barra da esquerda da tela inicial — a mesma moldura que o projeto tem por
 * dentro: navegar entre os projetos, e o que é do app (configurações, backup, ajuda).
 */
export function AppSidebar({
  myProjects,
  sharedProjects,
  filter,
  onFilter,
}: {
  myProjects: Project[];
  sharedProjects: Project[];
  filter: HomeFilter;
  onFilter: (f: HomeFilter) => void;
}) {
  const { t } = useI18n();
  const item = (active: boolean) =>
    `flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
      active ? "bg-accent-soft font-semibold text-accent" : "text-ink hover:bg-surface-2"
    }`;
  const label = "px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle";

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto px-3 py-4 scrollbar-premium">
      <Link href="/" className="flex items-center gap-2.5 px-2 text-[15px] font-bold tracking-tight text-ink">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-on-accent">
          <IconVision className="h-4 w-4" />
        </span>
        {t("common.appName", "GDD Manager")}
      </Link>

      <nav aria-label={t("appSidebar.browse", "Projetos")}>
        <ul className="flex flex-col gap-px">
          <li>
            <button type="button" onClick={() => onFilter("all")} className={item(filter === "all")}>
              {ICONS.grid}
              {t("home.projects.myProjectsTitle", "Meus projetos")}
              <span className="ml-auto text-xs tabular-nums text-muted">{myProjects.length + sharedProjects.length}</span>
            </button>
          </li>
          {sharedProjects.length > 0 && (
            <li>
              <button type="button" onClick={() => onFilter("shared")} className={item(filter === "shared")}>
                {ICONS.shared}
                {t("home.projects.sharedTitle", "Compartilhados comigo")}
                <span className="ml-auto text-xs tabular-nums text-muted">{sharedProjects.length}</span>
              </button>
            </li>
          )}
        </ul>
      </nav>

      {myProjects.length + sharedProjects.length > 0 && (
        <nav aria-label={t("appSidebar.projects", "Seus jogos")}>
          <div className={label}>{t("appSidebar.projects", "Seus jogos")}</div>
          <ul className="flex flex-col gap-px">
            {[...myProjects, ...sharedProjects].map((p) => (
              <li key={p.id}>
                <Link href={projectPath(p)} prefetch={false} className={item(false)}>
                  <ProjectGlyph project={p} className="h-6 w-6 shrink-0 rounded-md" />
                  <span className="min-w-0 flex-1 truncate">{p.title}</span>
                  {sharedProjects.includes(p) && <span className="text-subtle">{ICONS.shared}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <nav aria-label={t("appSidebar.settings", "Configurações")} className="mt-auto">
        <div className={label}>{t("appSidebar.settings", "Configurações")}</div>
        <ul className="flex flex-col gap-px">
          <li>
            <Link href="/settings/ai" className={item(false)}>
              {ICONS.ai}
              {t("appSidebar.ai", "Inteligência artificial")}
            </Link>
          </li>
          <li>
            <Link href="/settings/persistence" className={item(false)}>
              {ICONS.sync}
              {t("appSidebar.sync", "Salvamento e sync")}
            </Link>
          </li>
          <li>
            <Link href="/settings/api-keys" className={item(false)}>
              {ICONS.key}
              {t("appSidebar.apiKeys", "Conectar o Claude (MCP)")}
            </Link>
          </li>
          <li>
            <Link href="/backup" className={item(false)}>
              {ICONS.backup}
              {t("home.quickActions.backup", "Backup & Restaurar")}
            </Link>
          </li>
          <li>
            <Link href="/docs" className={item(false)}>
              {ICONS.help}
              {t("home.docs", "Ajuda")}
            </Link>
          </li>
          <li>
            <a href="https://discord.gg/cqPsj7DhEr" target="_blank" rel="noopener noreferrer" className={item(false)}>
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] shrink-0 fill-current">
                <path d="M20.317 4.37A19.791 19.791 0 0 0 15.885 3c-.191.328-.403.768-.552 1.11a18.27 18.27 0 0 0-5.666 0A11.69 11.69 0 0 0 9.115 3a19.736 19.736 0 0 0-4.432 1.37C1.884 8.58 1.128 12.685 1.507 16.73a19.93 19.93 0 0 0 5.993 3.03c.486-.66.918-1.36 1.285-2.09-.708-.268-1.387-.598-2.028-.98.17-.124.336-.254.496-.388 3.91 1.84 8.16 1.84 12.023 0 .16.134.326.264.496.388a12.9 12.9 0 0 1-2.032.982c.367.73.8 1.43 1.286 2.09a19.88 19.88 0 0 0 5.995-3.03c.444-4.69-.759-8.757-3.704-12.36ZM8.02 14.12c-1.18 0-2.15-1.08-2.15-2.41 0-1.33.95-2.41 2.15-2.41 1.21 0 2.17 1.09 2.15 2.41 0 1.33-.95 2.41-2.15 2.41Zm7.96 0c-1.18 0-2.15-1.08-2.15-2.41 0-1.33.95-2.41 2.15-2.41 1.21 0 2.17 1.09 2.15 2.41 0 1.33-.94 2.41-2.15 2.41Z" />
              </svg>
              {t("appSidebar.discord", "Comunidade no Discord")}
            </a>
          </li>
        </ul>
      </nav>
    </div>
  );
}
