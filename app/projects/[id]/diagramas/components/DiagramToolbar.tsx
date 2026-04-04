"use client";

type ThemeOption = {
  key: string;
  label: string;
};

function ToolbarIcon({
  children,
}: {
  children: React.ReactNode;
}) {
  return <span className="inline-flex h-5 w-5 items-center justify-center md:h-6 md:w-6">{children}</span>;
}

function CenterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3" />
      <path d="M12 19v3" />
      <path d="M2 12h3" />
      <path d="M19 12h3" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full" aria-hidden="true">
      <path d="M9 14L4 9l5-5" />
      <path d="M20 20a8 8 0 0 0-8-8H4" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full" aria-hidden="true">
      <path d="M15 14l5-5-5-5" />
      <path d="M4 20a8 8 0 0 1 8-8h8" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function PasteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full" aria-hidden="true">
      <rect x="8" y="3" width="8" height="4" rx="1" />
      <path d="M8 5H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M3 15h18" />
      <path d="M9 3v18" />
      <path d="M15 3v18" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function ThemeIcon({ themeKey }: { themeKey: string }) {
  if (themeKey === "neon") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full" aria-hidden="true">
        <path d="M12 2l2.2 4.7L19 9l-4.8 2.3L12 16l-2.2-4.7L5 9l4.8-2.3L12 2z" />
      </svg>
    );
  }
  if (themeKey === "pastel") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full" aria-hidden="true">
        <circle cx="7" cy="12" r="2" />
        <circle cx="12" cy="7" r="2" />
        <circle cx="17" cy="12" r="2" />
        <path d="M12 19a7 7 0 1 1 7-7" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

type DiagramToolbarProps = {
  shellClass: string;
  toolbarButtonClass: string;
  dangerButtonClass: string;
  isReadOnly?: boolean;
  topClassName?: string;
  currentTheme: string;
  themeOptions: ThemeOption[];
  onCenter: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onClear: () => void;
  onCopyDiagram: () => void;
  onPasteDiagram: () => void;
  canPasteDiagram: boolean;
  snapToGrid: boolean;
  snapGridSize: number;
  onThemeChange: (theme: string) => void;
  onToggleSnapToGrid: () => void;
  onSnapGridSizeChange: (size: number) => void;
};

export default function DiagramToolbar({
  shellClass,
  toolbarButtonClass,
  dangerButtonClass,
  isReadOnly = false,
  topClassName = "top-3",
  currentTheme,
  themeOptions,
  onCenter,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onClear,
  onCopyDiagram,
  onPasteDiagram,
  canPasteDiagram,
  snapToGrid,
  snapGridSize,
  onThemeChange,
  onToggleSnapToGrid,
  onSnapGridSizeChange,
}: DiagramToolbarProps) {
  const iconButtonClass = "!h-8 !w-8 !p-1 md:!h-9 md:!w-9 md:!p-1";

  return (
    <div className={`absolute ${topClassName} left-2 right-2 z-20 max-w-[calc(100vw-1rem)] md:left-3 md:right-auto`}>
      <div className={`relative ${shellClass} !p-0.5 md:!p-1`}>
        <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap p-0.5 md:gap-1.5 md:p-1">
          <button
            onClick={onCenter}
            className={`${toolbarButtonClass} ${iconButtonClass}`}
            aria-label="Centralizar"
            title="Centralizar"
            type="button"
          >
            <ToolbarIcon>
              <CenterIcon />
            </ToolbarIcon>
          </button>
          {!isReadOnly && (
            <>
              <button
                onClick={onUndo}
                className={`${toolbarButtonClass} ${iconButtonClass} ${!canUndo ? "opacity-45 cursor-not-allowed" : ""}`}
                disabled={!canUndo}
                title="Ctrl+Z"
                aria-label="Desfazer"
                type="button"
              >
                <ToolbarIcon>
                  <UndoIcon />
                </ToolbarIcon>
              </button>
              <button
                onClick={onRedo}
                className={`${toolbarButtonClass} ${iconButtonClass} ${!canRedo ? "opacity-45 cursor-not-allowed" : ""}`}
                disabled={!canRedo}
                title="Ctrl+Y"
                aria-label="Refazer"
                type="button"
              >
                <ToolbarIcon>
                  <RedoIcon />
                </ToolbarIcon>
              </button>
              <button
                onClick={onCopyDiagram}
                className={`${toolbarButtonClass} ${iconButtonClass}`}
                aria-label="Copiar quadro"
                title="Copiar quadro"
                type="button"
              >
                <ToolbarIcon>
                  <CopyIcon />
                </ToolbarIcon>
              </button>
              <button
                onClick={onPasteDiagram}
                className={`${toolbarButtonClass} ${iconButtonClass} ${!canPasteDiagram ? "opacity-45 cursor-not-allowed" : ""}`}
                disabled={!canPasteDiagram}
                aria-label="Colar quadro"
                title="Colar quadro"
                type="button"
              >
                <ToolbarIcon>
                  <PasteIcon />
                </ToolbarIcon>
              </button>
              <button
                onClick={onToggleSnapToGrid}
                className={`${toolbarButtonClass} ${iconButtonClass} ${snapToGrid ? "ring-1 ring-emerald-300/60" : ""}`}
                aria-label={snapToGrid ? "Desligar snap de grade" : "Ligar snap de grade"}
                title={snapToGrid ? "Snap ligado" : "Snap desligado"}
                type="button"
              >
                <ToolbarIcon>
                  <GridIcon />
                </ToolbarIcon>
              </button>
              <label
                className={`flex items-center gap-1.5 rounded-xl border border-white/15 bg-black/20 px-1.5 py-1 text-xs md:gap-2 md:px-2 ${
                  snapToGrid ? "text-white/80" : "text-white/45"
                }`}
              >
                <span className="hidden md:inline">Grade</span>
                <select
                  className="w-12 rounded-md border border-white/20 bg-black/30 px-1 py-0.5 text-xs text-white disabled:cursor-not-allowed disabled:opacity-45"
                  value={snapGridSize}
                  onChange={(event) => onSnapGridSizeChange(Number(event.target.value))}
                  disabled={!snapToGrid}
                  aria-label="Tamanho da grade"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={30}>30</option>
                </select>
              </label>
              <button
                onClick={onClear}
                className={`${dangerButtonClass} ${iconButtonClass}`}
                aria-label="Limpar quadro"
                title="Limpar quadro"
                type="button"
              >
                <ToolbarIcon>
                  <TrashIcon />
                </ToolbarIcon>
              </button>
            </>
          )}
          <div className="ml-0 flex items-center gap-1 rounded-xl border border-white/15 bg-black/20 p-1 md:ml-1">
            {themeOptions.map((theme) => (
              <button
                key={theme.key}
                type="button"
                onClick={() => onThemeChange(theme.key)}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg p-1 text-xs font-semibold transition md:h-9 md:w-9 ${
                  currentTheme === theme.key
                    ? "bg-white/20 text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
                aria-label={`Tema ${theme.label}`}
                title={theme.label}
              >
                <ToolbarIcon>
                  <ThemeIcon themeKey={theme.key} />
                </ToolbarIcon>
              </button>
            ))}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-black/45 to-transparent md:hidden" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-black/45 to-transparent md:hidden" />
      </div>
    </div>
  );
}
