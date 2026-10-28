/** Cabeçalho das telas de área: ícone na cor da área, título e uma frase. */
export function AreaHeader({
  icon,
  tone,
  title,
  lead,
  actions,
}: {
  icon: React.ReactNode;
  tone: "vis" | "doc" | "lib" | "sys" | "neutral";
  title: string;
  lead?: string;
  actions?: React.ReactNode;
}) {
  const toneClass = {
    vis: "bg-area-vis-soft text-area-vis",
    doc: "bg-area-doc-soft text-area-doc",
    lib: "bg-area-lib-soft text-area-lib",
    sys: "bg-area-sys-soft text-area-sys",
    neutral: "bg-surface-2 text-ink",
  }[tone];
  return (
    <header className="mb-6 flex flex-wrap items-start gap-4">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${toneClass}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {lead && <p className="mt-1 max-w-2xl text-sm text-muted">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
