"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

type Shortcut = {
  keys: string[];
  descriptionKey: string;
  descriptionFallback: string;
};

type ShortcutGroup = {
  titleKey: string;
  titleFallback: string;
  shortcuts: Shortcut[];
};

const IS_MAC =
  typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

const MOD = IS_MAC ? "⌘" : "Ctrl";

export const SHORTCUTS_OPEN_EVENT = "gdd:open-shortcuts-help";

/** Dispatch from any client code to open the modal. */
export function openShortcutsHelp() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SHORTCUTS_OPEN_EVENT));
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    titleKey: "shortcuts.groups.global",
    titleFallback: "Geral",
    shortcuts: [
      {
        keys: [MOD, "K"],
        descriptionKey: "shortcuts.keys.openPagePicker",
        descriptionFallback: "Abrir o buscador rápido de páginas",
      },
      {
        keys: ["?"],
        descriptionKey: "shortcuts.keys.openHelp",
        descriptionFallback: "Abrir esta lista de atalhos",
      },
      {
        keys: ["Esc"],
        descriptionKey: "shortcuts.keys.closeDialog",
        descriptionFallback: "Fechar diálogos e menus abertos",
      },
    ],
  },
  {
    titleKey: "shortcuts.groups.section",
    titleFallback: "Página de seção",
    shortcuts: [
      {
        keys: ["N"],
        descriptionKey: "shortcuts.keys.newPage",
        descriptionFallback: "Criar uma nova página (modal rápido)",
      },
      {
        keys: [MOD, "I"],
        descriptionKey: "shortcuts.keys.addAddon",
        descriptionFallback: "Adicionar um addon nesta página",
      },
      {
        keys: [MOD, "D"],
        descriptionKey: "shortcuts.keys.duplicateSection",
        descriptionFallback: "Duplicar a página atual",
      },
      {
        keys: IS_MAC ? [MOD, "Shift", "M"] : [MOD, "M"],
        descriptionKey: "shortcuts.keys.moveSection",
        descriptionFallback: "Mover a seção para outro local",
      },
    ],
  },
  {
    titleKey: "shortcuts.groups.flowchart",
    titleFallback: "Fluxograma",
    shortcuts: [
      {
        keys: [MOD, "Z"],
        descriptionKey: "shortcuts.keys.undo",
        descriptionFallback: "Desfazer",
      },
      {
        keys: [MOD, "Y"],
        descriptionKey: "shortcuts.keys.redo",
        descriptionFallback: "Refazer",
      },
      {
        keys: [MOD, "C"],
        descriptionKey: "shortcuts.keys.copyBlocks",
        descriptionFallback: "Copiar blocos selecionados",
      },
      {
        keys: [MOD, "V"],
        descriptionKey: "shortcuts.keys.pasteBlocks",
        descriptionFallback: "Colar blocos",
      },
      {
        keys: [MOD, "D"],
        descriptionKey: "shortcuts.keys.duplicateNode",
        descriptionFallback: "Duplicar bloco selecionado",
      },
      {
        keys: ["Esc"],
        descriptionKey: "shortcuts.keys.deselectAll",
        descriptionFallback: "Desselecionar tudo",
      },
    ],
  },
  {
    titleKey: "shortcuts.groups.search",
    titleFallback: "Busca no mapa mental",
    shortcuts: [
      {
        keys: ["↓"],
        descriptionKey: "shortcuts.keys.nextResult",
        descriptionFallback: "Próximo resultado",
      },
      {
        keys: ["↑"],
        descriptionKey: "shortcuts.keys.prevResult",
        descriptionFallback: "Resultado anterior",
      },
      {
        keys: ["Enter"],
        descriptionKey: "shortcuts.keys.jumpResult",
        descriptionFallback: "Ir para resultado (Shift+Enter = anterior)",
      },
    ],
  },
];

function Kbd({ label }: { label: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.75rem] h-6 px-1.5 rounded-md border border-gray-600/80 bg-gray-800/80 text-[11px] font-mono text-gray-100 shadow-sm shadow-black/30">
      {label}
    </kbd>
  );
}

export function KeyboardShortcutsModal() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const isEditable = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (target.isContentEditable) return true;
      return false;
    };

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        event.preventDefault();
        setOpen(false);
        return;
      }
      const ctrlOrMeta = event.ctrlKey || event.metaKey;
      const isSlash = event.key === "/";
      const isQuestion = event.key === "?";
      if ((ctrlOrMeta && isSlash) || (isQuestion && !isEditable(event.target))) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    const openFromEvent = () => setOpen(true);
    window.addEventListener("keydown", handler);
    window.addEventListener(SHORTCUTS_OPEN_EVENT, openFromEvent);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener(SHORTCUTS_OPEN_EVENT, openFromEvent);
    };
  }, [open]);

  const groups = useMemo(() => SHORTCUT_GROUPS, []);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("shortcuts.modalTitle", "Atalhos de teclado")}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-gray-700 bg-gray-900/95 shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-800 bg-gray-900/95 backdrop-blur">
          <div>
            <h2 className="text-lg font-semibold text-gray-100">
              {t("shortcuts.modalTitle", "Atalhos de teclado")}
            </h2>
            <p className="mt-0.5 text-xs text-gray-400">
              {t("shortcuts.modalHint", "Pressione ? a qualquer momento para abrir esta lista.")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("shortcuts.close", "Fechar")}
            className="shrink-0 h-8 w-8 rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
          >
            ✕
          </button>
        </header>

        <div className="px-5 py-4 space-y-5">
          {groups.map((group) => (
            <section key={group.titleKey}>
              <h3 className="mb-2 text-[11px] uppercase tracking-wide font-semibold text-indigo-300">
                {t(group.titleKey, group.titleFallback)}
              </h3>
              <ul className="space-y-1.5">
                {group.shortcuts.map((shortcut, idx) => (
                  <li
                    key={`${group.titleKey}-${idx}`}
                    className="flex items-start justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-gray-800/60"
                  >
                    <span className="text-sm text-gray-200">
                      {t(shortcut.descriptionKey, shortcut.descriptionFallback)}
                    </span>
                    <span className="shrink-0 inline-flex items-center gap-1">
                      {shortcut.keys.map((k, i) => (
                        <span key={i} className="inline-flex items-center gap-1">
                          {i > 0 && <span className="text-gray-500 text-xs">+</span>}
                          <Kbd label={k} />
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
