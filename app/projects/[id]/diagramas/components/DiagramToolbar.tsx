"use client";

type ThemeOption = {
  key: string;
  label: string;
};

type DiagramToolbarProps = {
  shellClass: string;
  toolbarButtonClass: string;
  dangerButtonClass: string;
  currentTheme: string;
  themeOptions: ThemeOption[];
  onCenter: () => void;
  onClear: () => void;
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
  currentTheme,
  themeOptions,
  onCenter,
  onClear,
  snapToGrid,
  snapGridSize,
  onThemeChange,
  onToggleSnapToGrid,
  onSnapGridSizeChange,
}: DiagramToolbarProps) {
  return (
    <div className={`absolute top-3 left-3 z-20 flex items-center gap-2 p-2 ${shellClass}`}>
      <button onClick={onCenter} className={toolbarButtonClass}>Centralizar</button>
      <button onClick={onToggleSnapToGrid} className={toolbarButtonClass}>
        Snap grid: {snapToGrid ? "Ligado" : "Desligado"}
      </button>
      <label
        className={`flex items-center gap-2 text-xs rounded-xl border border-white/15 bg-black/20 px-2 py-1 ${
          snapToGrid ? "text-white/80" : "text-white/45"
        }`}
      >
        Grade
        <select
          className="rounded-md border border-white/20 bg-black/30 px-1 py-0.5 text-xs text-white disabled:opacity-45 disabled:cursor-not-allowed"
          value={snapGridSize}
          onChange={(event) => onSnapGridSizeChange(Number(event.target.value))}
          disabled={!snapToGrid}
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={30}>30</option>
        </select>
      </label>
      <button onClick={onClear} className={dangerButtonClass}>Limpar quadro</button>
      <div className="ml-1 flex items-center gap-1 rounded-xl border border-white/15 bg-black/20 p-1">
        {themeOptions.map((theme) => (
          <button
            key={theme.key}
            type="button"
            onClick={() => onThemeChange(theme.key)}
            className={`rounded-lg px-2 py-1 text-xs font-semibold transition ${
              currentTheme === theme.key
                ? "bg-white/20 text-white"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            {theme.label}
          </button>
        ))}
      </div>
    </div>
  );
}
