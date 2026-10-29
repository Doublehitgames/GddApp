"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { Project } from "@/store/slices/types";
import { ProjectGlyph } from "@/components/project/ProjectCover";
import { detectGroups } from "@/lib/library/collections";
import { toSlug } from "@/lib/utils/slug";

/**
 * A navegação fixa do projeto: as quatro áreas do GDD (as páginas se acham
 * pela Documentação e pela busca), as coleções, o andamento e os modos de
 * apresentar.
 *
 * As coleções saem da árvore (lib/library/collections.ts): cada grupo — página
 * cujas filhas são todas coleções — vira um item. Nenhum nome é sugerido pelo
 * app; um projeto sem grupo ainda mostra só como chegar lá.
 */
export function ProjectSidebar({
  project,
  projectSlug,
  onNavigate,
}: {
  project: Project;
  projectSlug: string;
  /** Fecha a gaveta no celular depois de um clique. */
  onNavigate?: () => void;
}) {
  const { t } = useI18n();
  const pathname = (usePathname() || "").replace(/\/+$/, "");
  const base = `/projects/${projectSlug}`;
  const sectionCount = project.sections?.length ?? 0;

  const areas = [
    { href: base, label: t("projectShell.home", "Início"), icon: <IconHome />, tone: "" },
    { href: `${base}/visao`, label: t("projectShell.vision", "Visão do jogo"), icon: <IconVision />, tone: "text-area-vis" },
    { href: `${base}/documentacao`, label: t("projectShell.docs", "Documentação"), icon: <IconDoc />, tone: "text-area-doc" },
    { href: `${base}/biblioteca`, label: t("projectShell.library", "Biblioteca do jogo"), icon: <IconLibrary />, tone: "text-area-lib" },
    { href: `${base}/sistemas`, label: t("projectShell.systems", "Sistemas e relações"), icon: <IconSystems />, tone: "text-area-sys" },
  ];
  const groups = useMemo(() => detectGroups(project.sections ?? []), [project.sections]);
  const present = [
    { href: `${base}/view`, label: t("projectShell.present.document", "Documento"), icon: <IconDoc /> },
    { href: `${base}/deck`, label: t("projectShell.present.deck", "Deck"), icon: <IconPlay /> },
    { href: `${base}/export`, label: t("projectShell.present.export", "Exportar"), icon: <IconShare /> },
  ];

  const isActive = (href: string) => (href === base ? pathname === base : pathname.startsWith(href));
  const navItem = (active: boolean) =>
    `flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
      active ? "bg-accent-soft font-semibold text-accent" : "text-ink hover:bg-surface-2"
    }`;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto px-3 py-4 scrollbar-premium" onClick={(e) => {
      if ((e.target as HTMLElement).closest("a")) onNavigate?.();
    }}>
      <Link href="/" className="flex items-center gap-2.5 px-2 text-[15px] font-bold tracking-tight text-ink">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-on-accent">
          <IconVision className="h-4 w-4" />
        </span>
        GDD Manager
      </Link>

      <Link href={base} className="flex items-center gap-2.5 rounded-xl bg-surface-2 p-2">
        <ProjectGlyph project={project} className="h-9 w-9 shrink-0 rounded-lg" />
        <span className="min-w-0">
          <strong className="block truncate text-sm leading-tight text-ink">{project.title}</strong>
          <span className="block text-xs text-muted">
            {t("projectShell.pageCount", "{count} páginas").replace("{count}", String(sectionCount))}
          </span>
        </span>
      </Link>

      <nav aria-label={t("projectShell.areasLabel", "Áreas")}>
        <SectionLabel>{t("projectShell.areasLabel", "Áreas")}</SectionLabel>
        <ul className="flex flex-col gap-px">
          {areas.map((area) => (
            <li key={area.href}>
              <Link href={area.href} className={navItem(isActive(area.href))} aria-current={isActive(area.href) ? "page" : undefined}>
                <span className={isActive(area.href) ? "" : area.tone}>{area.icon}</span>
                {area.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <nav aria-label={t("projectShell.collectionsLabel", "Coleções")}>
        <SectionLabel>{t("projectShell.collectionsLabel", "Coleções")}</SectionLabel>
        {groups.length > 0 ? (
          <ul className="flex flex-col gap-px">
            {groups.map(({ section, itemCount }) => {
              const href = `${base}/sections/${toSlug(section.title)}`;
              const active = pathname === href;
              return (
                <li key={section.id}>
                  <Link href={href} className={navItem(active)} aria-current={active ? "page" : undefined} title={section.title}>
                    <span
                      className="h-2 w-2 shrink-0 rounded-full bg-area-lib"
                      style={section.color ? { backgroundColor: section.color } : undefined}
                      aria-hidden
                    />
                    <span className="min-w-0 truncate">{section.title}</span>
                    <span className="ml-auto text-xs tabular-nums text-subtle">{itemCount}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-2.5 text-xs leading-relaxed text-subtle">
            {t(
              "projectShell.collectionsEmpty",
              "Junte as páginas de cada coisa do jogo sob uma página-mãe, e as mães sob um grupo: o grupo aparece aqui.",
            )}
          </p>
        )}
      </nav>

      <nav aria-label={t("projectShell.more", "Mais")}>
        <ul className="flex flex-col gap-px">
          <li>
            <Link href={`${base}/andamento`} className={navItem(isActive(`${base}/andamento`))}>
              <IconProgress />
              {t("projectShell.progress", "Andamento")}
            </Link>
          </li>
        </ul>
      </nav>

      <nav aria-label={t("projectShell.presentLabel", "Apresentar")}>
        <SectionLabel>{t("projectShell.presentLabel", "Apresentar")}</SectionLabel>
        <ul className="flex flex-col gap-px">
          {present.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className={navItem(isActive(item.href))}>
                {item.icon}
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">{children}</div>;
}

type IconProps = { className?: string };
const svg = (path: React.ReactNode, className = "h-[18px] w-[18px]") => (
  <svg viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {path}
  </svg>
);
export const IconHome = ({ className }: IconProps) => svg(<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />, className);
export const IconVision = ({ className }: IconProps) => svg(<path d="M12 3l2.6 5.6L20 9.5l-4 4 1 5.5-5-2.7-5 2.7 1-5.5-4-4 5.4-.9z" />, className);
export const IconDoc = ({ className }: IconProps) => svg(<><path d="M4 5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M14 3v5h5M8 13h8M8 17h5" /></>, className);
export const IconLibrary = ({ className }: IconProps) => svg(<><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M4 7.5l8 4.5 8-4.5M12 12v9" /></>, className);
export const IconSystems = ({ className }: IconProps) => svg(<><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="12" cy="18" r="2.5" /><path d="M8 7.5l3 8.5M16 7.5l-3 8.5M8.5 6h7" /></>, className);
export const IconPlay = ({ className }: IconProps) => svg(<path d="M7 4l13 8-13 8z" />, className);
export const IconShare = ({ className }: IconProps) => svg(<path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />, className);
export const IconProgress = ({ className }: IconProps) => svg(<path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />, className);
