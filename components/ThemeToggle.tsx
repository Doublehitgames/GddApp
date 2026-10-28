"use client";

import { useTheme } from "@/lib/theme/provider";
import type { ThemePreference } from "@/lib/theme/config";
import { useI18n } from "@/lib/i18n/provider";

const NEXT: Record<ThemePreference, ThemePreference> = { system: "light", light: "dark", dark: "system" };

/** Botão de um clique que alterna Sistema → Claro → Escuro. */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { preference, setPreference } = useTheme();
  const { t } = useI18n();
  const label = {
    system: t("theme.system", "Tema: igual ao sistema"),
    light: t("theme.light", "Tema: claro"),
    dark: t("theme.dark", "Tema: escuro"),
  }[preference];

  return (
    <button
      type="button"
      onClick={() => setPreference(NEXT[preference])}
      title={label}
      aria-label={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {preference === "light" && (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        )}
        {preference === "dark" && <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />}
        {preference === "system" && (
          <>
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M8 20h8M12 16v4" />
          </>
        )}
      </svg>
    </button>
  );
}
