"use client";

import { useMemo, useState } from "react";
import { getDriveImageDisplayCandidates } from "@/lib/googleDrivePicker";
import type { Project } from "@/store/slices/types";

/**
 * A capa de um projeto que ainda não tem imagem não pode ser um quadro cinza:
 * é a primeira coisa que se vê. Desenha um mostrador de relógio rachado com
 * cores tiradas do id — cada projeto ganha a sua, e ela não muda entre visitas.
 */

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function coverPalette(seedSource: string) {
  const hue = hashString(seedSource) % 360;
  return {
    from: `oklch(22% 0.05 ${hue})`,
    to: `oklch(34% 0.08 ${(hue + 40) % 360})`,
    glow: `oklch(80% 0.12 ${(hue + 180) % 360})`,
  };
}

/** Duas casas bastam para desenhar, e evitam que servidor e navegador discordem na 15ª casa (erro de hidratação). */
const r2 = (n: number) => Math.round(n * 100) / 100;

function CoverArt({ seedSource, width, height }: { seedSource: string; width: number; height: number }) {
  const art = useMemo(() => {
    const rand = seededRandom(hashString(seedSource) || 7);
    const r = height * 0.72;
    const cx = width - r * 0.9;
    const cy = height / 2;
    const ticks = Array.from({ length: 60 }, (_, i) => {
      const a = (i / 60) * Math.PI * 2;
      const big = i % 5 === 0;
      const r1 = r * (big ? 0.86 : 0.92);
      const rOuter = r * 0.97;
      return { x1: r2(cx + Math.cos(a) * r1), y1: r2(cy + Math.sin(a) * r1), x2: r2(cx + Math.cos(a) * rOuter), y2: r2(cy + Math.sin(a) * rOuter), big };
    });
    let x = cx - r * 1.1;
    let y = cy - r * 0.2;
    let crack = `M${x.toFixed(1)} ${y.toFixed(1)}`;
    for (let i = 0; i < 9; i++) {
      x += r * 0.26;
      y += (rand() - 0.45) * r * 0.35;
      crack += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    const sand = Array.from({ length: 60 }, () => ({
      cx: r2(cx - r * 1.4 + rand() * r * 2.6),
      cy: r2(rand() * height),
      r: r2(rand() * 1.8 + 0.4),
      o: r2(rand() * 0.5 + 0.15),
    }));
    return { r, cx, cy, ticks, crack, sand };
  }, [seedSource, width, height]);
  const { glow } = coverPalette(seedSource);
  const { r, cx, cy } = art;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={glow} strokeOpacity={0.5} strokeWidth={2} />
      <circle cx={cx} cy={cy} r={r * 0.82} fill="none" stroke={glow} strokeOpacity={0.22} />
      {art.ticks.map((tk, i) => (
        <line key={i} x1={tk.x1} y1={tk.y1} x2={tk.x2} y2={tk.y2} stroke={glow} strokeOpacity={tk.big ? 0.7 : 0.3} strokeWidth={tk.big ? 2.5 : 1} />
      ))}
      <line x1={cx} y1={cy} x2={cx + r * 0.5} y2={cy - r * 0.35} stroke="#fbf6ea" strokeOpacity={0.75} strokeWidth={4} strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={cx - r * 0.12} y2={cy - r * 0.72} stroke="#fbf6ea" strokeOpacity={0.6} strokeWidth={2.5} strokeLinecap="round" />
      <path d={art.crack} fill="none" stroke={glow} strokeOpacity={0.35} strokeWidth={7} />
      <path d={art.crack} fill="none" stroke="#fbf6ea" strokeOpacity={0.85} strokeWidth={2} />
      {art.sand.map((p, i) => (
        <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={glow} fillOpacity={p.o} />
      ))}
    </svg>
  );
}

/**
 * Imagem do Drive que tenta os endereços candidatos em ordem. Se todos
 * falharem (arquivo não compartilhado, apagado), mostra `fallback` — um
 * quadrado cinza vazio não diz nada a ninguém.
 */
export function CoverImage({ src, alt, fallback = null }: { src: string; alt: string; fallback?: React.ReactNode }) {
  const candidates = useMemo(() => getDriveImageDisplayCandidates(src), [src]);
  const [attempt, setAttempt] = useState(0);
  if (attempt >= candidates.length) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={candidates[attempt]}
      alt={alt}
      className="absolute inset-0 h-full w-full object-cover"
      onError={() => setAttempt((a) => a + 1)}
    />
  );
}

/** Faixa de capa: a imagem do projeto, ou a arte gerada. O conteúdo vai por cima. */
export function ProjectCover({
  project,
  children,
  className = "",
  seed,
}: {
  project?: Pick<Project, "id" | "title" | "coverImageUrl">;
  children?: React.ReactNode;
  className?: string;
  /** Semente da arte quando ainda não há projeto (a prévia do projeto novo). */
  seed?: string;
}) {
  const seedSource = seed ?? project?.id ?? "gdd";
  const { from, to } = coverPalette(seedSource);
  const image = project?.coverImageUrl;

  return (
    <div
      className={`relative isolate flex overflow-hidden rounded-2xl text-[#fbf6ea] ${className}`}
      style={{ background: `linear-gradient(120deg, ${from}, ${to})` }}
    >
      {image ? (
        <>
          <CoverImage src={image} alt="" fallback={<CoverArt seedSource={seedSource} width={1200} height={300} />} />
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-transparent" aria-hidden />
        </>
      ) : (
        <CoverArt seedSource={seedSource} width={1200} height={300} />
      )}
      <div className="relative flex w-full flex-col gap-2.5">{children}</div>
    </div>
  );
}

/** Ícone quadrado do projeto: o da Ficha técnica, a capa, ou um mini mostrador. */
export function ProjectGlyph({ project, className = "" }: { project: Project; className?: string }) {
  const icon = project.mindMapSettings?.documentView?.spotlight?.titleIconUrl || project.coverImageUrl;
  const { from, to, glow } = coverPalette(project.id);
  const mini = (
    <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full" aria-hidden>
      <circle cx="20" cy="18" r="11" fill="none" stroke={glow} strokeWidth="1.5" />
      <path d="M4 16 L12 19 L18 14 L26 20 L34 17" stroke="#fbf6ea" strokeWidth="1.5" fill="none" />
    </svg>
  );
  return (
    <span className={`relative block overflow-hidden ${className}`} style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
      {icon ? <CoverImage src={icon} alt="" fallback={mini} /> : mini}
    </span>
  );
}
