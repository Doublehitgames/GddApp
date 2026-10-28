const PILLAR_BAR = ["bg-red-500", "bg-amber-500", "bg-sky-500", "bg-emerald-500", "bg-violet-500", "bg-pink-500"];
const PILLAR_SOFT = [
  "bg-red-50 dark:bg-red-950/40",
  "bg-amber-50 dark:bg-amber-950/40",
  "bg-sky-50 dark:bg-sky-950/40",
  "bg-emerald-50 dark:bg-emerald-950/40",
  "bg-violet-50 dark:bg-violet-950/40",
  "bg-pink-50 dark:bg-pink-950/40",
];

/** Os pilares numerados e coloridos — a mesma cara na home, na Documentação e onde mais aparecerem. */
export function PillarList({ pillars, compact = false }: { pillars: string[]; compact?: boolean }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {pillars.map((pillar, i) => (
        <li
          key={`${i}-${pillar}`}
          className={`relative overflow-hidden rounded-lg ${PILLAR_SOFT[i % PILLAR_SOFT.length]} ${compact ? "py-1.5 pl-3.5 pr-2.5 text-xs" : "py-2 pl-4 pr-3 text-sm"} font-medium text-ink`}
        >
          <span className={`absolute inset-y-0 left-0 w-1 ${PILLAR_BAR[i % PILLAR_BAR.length]}`} aria-hidden />
          <span className="mr-1.5 text-xs font-bold tabular-nums text-muted">{String(i + 1).padStart(2, "0")}</span>
          {pillar}
        </li>
      ))}
    </ul>
  );
}
