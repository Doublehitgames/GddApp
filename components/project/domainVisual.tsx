import type { GameDesignDomainId } from "@/lib/gameDesignDomains";

/**
 * Cara de cada categoria de documento (os domínios de game design da página):
 * um ícone e uma cor que funciona nos dois temas. Página sem domínio usa `other`.
 */
type DomainVisual = { tile: string; label: string; path: React.ReactNode };

const P = {
  combat: <path d="M14.5 4.5l5 5-9 9H5.5v-5zM4 20l3-3M13 6l5 5" />,
  economy: <><circle cx="12" cy="12" r="8" /><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.6 0-2.5.9-2.5 2s1 1.6 2.5 2 2.5.9 2.5 2-1 2-2.5 2c-1.2 0-2.1-.6-2.5-1.5M12 6.5V8M12 16v1.5" /></>,
  progression: <path d="M4 19h4v-5h4v-4h4V5h4" />,
  crafting: <><path d="M6 20h12M8 20v-4h8v4" /><path d="M9 16l-1-6h8l-1 6M10 7a2 2 0 1 1 4 0" /></>,
  items: <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M4 7.5l8 4.5 8-4.5M12 12v9" /></>,
  characters: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" /></>,
  world: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.5 5.7 3.5 9s-1 6.3-3.5 9c-2.5-2.7-3.5-5.7-3.5-9s1-6.3 3.5-9z" /></>,
  narrative: <path d="M4 5.5C6 4.5 9 4.5 12 6c3-1.5 6-1.5 8-.5V19c-2-1-5-1-8 .5-3-1.5-6-1.5-8-.5zM12 6v13.5" />,
  audio: <path d="M5 10v4h3l4 4V6L8 10zM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />,
  ui: <><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M3 9h18M8 21h8" /></>,
  technology: <path d="M8 8l-5 4 5 4M16 8l5 4-5 4M14 5l-4 14" />,
  other: <><path d="M4 5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M14 3v5h5" /></>,
};

const VISUALS: Record<GameDesignDomainId, DomainVisual> = {
  combat: { tile: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", label: "text-red-700 dark:text-red-300", path: P.combat },
  economy: { tile: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", label: "text-amber-700 dark:text-amber-300", path: P.economy },
  progression: { tile: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300", label: "text-violet-700 dark:text-violet-300", path: P.progression },
  crafting: { tile: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300", label: "text-orange-700 dark:text-orange-300", path: P.crafting },
  items: { tile: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300", label: "text-yellow-800 dark:text-yellow-300", path: P.items },
  characters: { tile: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300", label: "text-indigo-700 dark:text-indigo-300", path: P.characters },
  world: { tile: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300", label: "text-teal-700 dark:text-teal-300", path: P.world },
  narrative: { tile: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300", label: "text-pink-700 dark:text-pink-300", path: P.narrative },
  audio: { tile: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300", label: "text-sky-700 dark:text-sky-300", path: P.audio },
  ui: { tile: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", label: "text-blue-700 dark:text-blue-300", path: P.ui },
  technology: { tile: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300", label: "text-slate-700 dark:text-slate-300", path: P.technology },
  other: { tile: "bg-surface-2 text-muted", label: "text-muted", path: P.other },
};

export function domainVisual(id: string | undefined): DomainVisual {
  return VISUALS[(id as GameDesignDomainId) ?? "other"] ?? VISUALS.other;
}

export function DomainIcon({ id, className = "h-4 w-4" }: { id?: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {domainVisual(id).path}
    </svg>
  );
}
