"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { useTheme } from "@/lib/theme/provider";
import ThemeToggle from "@/components/ThemeToggle";
import { PublicShareButton } from "@/components/PublicShareButton";
import { openShortcutsHelp } from "@/components/KeyboardShortcutsModal";
import { openPagePicker } from "@/components/GlobalPagePicker";
import { IconPlay } from "@/components/project/ProjectSidebar";
import type { Project } from "@/store/slices/types";

/** A barra de cima da casca do projeto: onde estou, busca, apresentar, compartilhar. */
export function ProjectShellBar({
  title,
  projectSlug,
  project,
  onOpenMenu,
}: {
  title: React.ReactNode;
  projectSlug: string;
  project?: Project;
  onOpenMenu: () => void;
}) {
  const { t } = useI18n();
  const { theme } = useTheme();
  const base = `/projects/${projectSlug}`;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface/90 px-3 backdrop-blur md:gap-3 md:px-6 print:hidden">
      <button
        type="button"
        onClick={onOpenMenu}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink lg:hidden"
        aria-label={t("projectShell.openMenu", "Abrir menu do projeto")}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      <div className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{title}</div>

      <button
        type="button"
        onClick={openPagePicker}
        className="hidden h-9 w-64 items-center gap-2 rounded-lg border border-line bg-canvas px-3 text-sm text-subtle transition-colors hover:border-line-strong sm:flex"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        {t("projectShell.search", "Buscar páginas…")}
        <kbd className="ml-auto rounded border border-line px-1.5 font-sans text-[11px]">Ctrl K</kbd>
      </button>
      <button
        type="button"
        onClick={openPagePicker}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink sm:hidden"
        aria-label={t("projectShell.search", "Buscar páginas…")}
      >
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      </button>

      <Link
        href={`${base}/deck`}
        className="hidden h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface-2 md:inline-flex"
      >
        <IconPlay className="h-4 w-4" />
        {t("projectShell.present.action", "Apresentar")}
      </Link>

      <PublicShareButton
        shareToken={project?.mindMapSettings?.sharing?.shareToken}
        isPublic={project?.mindMapSettings?.sharing?.isPublic}
        variant="inline"
        theme={theme}
      />

      <ThemeToggle />
      <MoreMenu base={base} />
    </header>
  );
}

function MoreMenu({ base }: { base: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const item = "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-ink hover:bg-surface-2";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("projectShell.more", "Mais")}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="ui-menu-pop absolute right-0 top-11 z-40 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-xl">
          <Link role="menuitem" href={`${base}/settings`} className={item} onClick={() => setOpen(false)}>
            {t("projectDetail.settingsLabel", "Configurações")}
          </Link>
          <Link role="menuitem" href={`${base}/export`} className={item} onClick={() => setOpen(false)}>
            {t("projectDetail.exportLabel", "Exportar")}
          </Link>
          <Link role="menuitem" href={`${base}/backup`} className={item} onClick={() => setOpen(false)}>
            {t("projectShell.backup", "Backup")}
          </Link>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false);
              openShortcutsHelp();
            }}
          >
            {t("shortcuts.modalTitle", "Atalhos de teclado")}
            <kbd className="ml-auto text-[11px] text-subtle">?</kbd>
          </button>
        </div>
      )}
    </div>
  );
}
