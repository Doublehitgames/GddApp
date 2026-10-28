"use client";

import { useId, useMemo, useState } from "react";
import { getDriveImageDisplayCandidates } from "@/lib/googleDrivePicker";
import type { Project } from "@/store/slices/types";

/**
 * A capa de um projeto que ainda não tem imagem não pode ser um quadro cinza:
 * é a primeira coisa que se vê. Desenha um entardecer de conto — colinas, uma
 * casinha-cogumelo com a janela acesa, lua e vaga-lumes. A paleta e a
 * disposição saem do id: cada projeto ganha a sua, e ela não muda entre visitas.
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

type CozyPalette = {
  skyTop: string;
  skyLow: string;
  horizon: string;
  far: string;
  mid: string;
  near: string;
  moon: string;
  cap: string;
};

/** Escolhidas à mão: céu escuro o bastante para o texto creme, e nada de cor crua. */
const PALETTES: CozyPalette[] = [
  { skyTop: "#3f3a6b", skyLow: "#8a68a8", horizon: "#f6b49a", far: "#7d72aa", mid: "#566596", near: "#38466f", moon: "#fff1c9", cap: "#e8636b" },
  { skyTop: "#5e3557", skyLow: "#c2667a", horizon: "#ffc48a", far: "#a8607a", mid: "#734c70", near: "#4c3456", moon: "#fff4d6", cap: "#f08a5d" },
  { skyTop: "#1f4656", skyLow: "#3f8a8a", horizon: "#d8ecb4", far: "#4f9a84", mid: "#2f7464", near: "#1f5248", moon: "#fff6d8", cap: "#e86f6f" },
  { skyTop: "#1d2350", skyLow: "#43458f", horizon: "#a99ae0", far: "#52579e", mid: "#383d7a", near: "#252a5a", moon: "#ffe9a8", cap: "#d9547a" },
  { skyTop: "#55303d", skyLow: "#a95a45", horizon: "#f7c46c", far: "#a0653f", mid: "#7a4733", near: "#523026", moon: "#fff0c2", cap: "#e04f4f" },
  { skyTop: "#4f2c5c", skyLow: "#b05d8f", horizon: "#ffc0c8", far: "#9b5b92", mid: "#6c4277", near: "#48305a", moon: "#fff2e0", cap: "#f2a33a" },
];

const STEM = "#fbeedd";
const WINDOW = "#ffd27a";

export function coverPalette(seedSource: string): CozyPalette {
  return PALETTES[hashString(seedSource) % PALETTES.length];
}

/** Duas casas bastam para desenhar, e evitam que servidor e navegador discordem na 15ª casa (erro de hidratação). */
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Linha de colina suave por pontos sorteados, fechada até o chão. */
function hillPath(rand: () => number, width: number, height: number, base: number, amp: number, bumps: number) {
  const pts = Array.from({ length: bumps + 1 }, (_, i) => [-40 + ((width + 80) * i) / bumps, base + (rand() - 0.5) * amp * 2]);
  let d = `M${r2(pts[0][0])} ${r2(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1];
    const [x, y] = pts[i];
    d += ` Q${r2(px + (x - px) / 2)} ${r2(Math.min(py, y) - amp * 0.6)} ${r2(x)} ${r2(y)}`;
  }
  return `${d} L${width + 40} ${height} L-40 ${height} Z`;
}

/** Estrelinha de quatro pontas. */
const sparkle = (x: number, y: number, s: number) =>
  `M${r2(x)} ${r2(y - s)} Q${r2(x)} ${r2(y)} ${r2(x + s)} ${r2(y)} Q${r2(x)} ${r2(y)} ${r2(x)} ${r2(y + s)} Q${r2(x)} ${r2(y)} ${r2(x - s)} ${r2(y)} Q${r2(x)} ${r2(y)} ${r2(x)} ${r2(y - s)} Z`;

const cloud = (x: number, y: number, s: number) =>
  `M${r2(x - 34 * s)} ${r2(y)} a${r2(14 * s)} ${r2(14 * s)} 0 0 1 ${r2(20 * s)} ${r2(-12 * s)} a${r2(18 * s)} ${r2(18 * s)} 0 0 1 ${r2(32 * s)} ${r2(-4 * s)} a${r2(14 * s)} ${r2(14 * s)} 0 0 1 ${r2(16 * s)} ${r2(16 * s)} Z`;

function CoverArt({ seedSource, width, height }: { seedSource: string; width: number; height: number }) {
  const uid = useId().replace(/:/g, "");
  const p = coverPalette(seedSource);
  const art = useMemo(() => {
    const rand = seededRandom(hashString(seedSource) || 7);
    const hx = r2(width * (0.74 + rand() * 0.06));
    const moon = { x: r2(width * (0.6 + rand() * 0.1)), y: r2(height * (0.32 + rand() * 0.08)) };
    // O morrinho da casa é uma curva quadrática: y em x sai da fórmula, e as árvores pousam nela.
    const moundTop = height * 0.74;
    const moundCtrl = 2 * moundTop - height;
    const moundAt = (x: number) => {
      const t = Math.min(1, Math.max(0, (x - (hx - 280)) / 560));
      return (1 - t) ** 2 * height + 2 * t * (1 - t) * moundCtrl + t ** 2 * height;
    };
    const trees = [hx - 120 - rand() * 30, hx - 175 - rand() * 30, hx + 105 + rand() * 30].map((x, i) => ({
      x: r2(x),
      y: r2(moundAt(x) + 2),
      r: r2(i === 1 ? 16 + rand() * 4 : 20 + rand() * 6),
      pine: i === 2,
    }));
    const stars = Array.from({ length: 14 }, () => ({
      x: r2(width * (0.3 + rand() * 0.7)),
      y: r2(height * (0.06 + rand() * 0.4)),
      s: r2(2.5 + rand() * 4),
      o: r2(0.45 + rand() * 0.5),
    }));
    const fireflies = Array.from({ length: 9 }, () => ({
      x: r2(width * (0.5 + rand() * 0.5)),
      y: r2(height * (0.58 + rand() * 0.34)),
      r: r2(1.4 + rand() * 1.4),
    }));
    const clouds = [
      { x: r2(width * (0.42 + rand() * 0.1)), y: r2(height * (0.3 + rand() * 0.12)), s: r2(1 + rand() * 0.4) },
      { x: r2(width * (0.9 + rand() * 0.06)), y: r2(height * (0.16 + rand() * 0.1)), s: r2(0.7 + rand() * 0.3) },
    ];
    return {
      hx,
      by: r2(moundTop + 1),
      moon,
      moundCtrl: r2(moundCtrl),
      trees,
      stars,
      fireflies,
      clouds,
      far: hillPath(rand, width, height, height * 0.66, height * 0.05, 5),
      near: hillPath(rand, width, height, height * 0.9, height * 0.025, 7),
    };
  }, [seedSource, width, height]);
  const { hx, by } = art;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMaxYMax slice" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={`${uid}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.skyTop} />
          <stop offset="0.62" stopColor={p.skyLow} />
          <stop offset="1" stopColor={p.horizon} />
        </linearGradient>
        <radialGradient id={`${uid}halo`}>
          <stop offset="0" stopColor={p.moon} stopOpacity="0.55" />
          <stop offset="1" stopColor={p.moon} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}warm`}>
          <stop offset="0" stopColor={WINDOW} stopOpacity="0.9" />
          <stop offset="1" stopColor={WINDOW} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}scrim`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={p.skyTop} stopOpacity="0.85" />
          <stop offset="0.5" stopColor={p.skyTop} stopOpacity="0.25" />
          <stop offset="0.75" stopColor={p.skyTop} stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width={width} height={height} fill={`url(#${uid}sky)`} />
      {art.stars.map((s, i) => (
        <path key={i} d={sparkle(s.x, s.y, s.s)} fill={p.moon} fillOpacity={s.o} />
      ))}
      <circle cx={art.moon.x} cy={art.moon.y} r={height * 0.3} fill={`url(#${uid}halo)`} />
      <circle cx={art.moon.x} cy={art.moon.y} r={height * 0.1} fill={p.moon} />
      <circle cx={r2(art.moon.x - height * 0.03)} cy={r2(art.moon.y + height * 0.02)} r={height * 0.018} fill={p.horizon} fillOpacity={0.35} />
      {art.clouds.map((c, i) => (
        <path key={i} d={cloud(c.x, c.y, c.s)} fill="#ffffff" fillOpacity={0.22} />
      ))}

      <path d={art.far} fill={p.far} />
      <path d={`M${hx - 280} ${height} Q${hx} ${art.moundCtrl} ${hx + 280} ${height} Z`} fill={p.mid} />

      {art.trees.map((t, i) =>
        t.pine ? (
          <g key={i}>
            <rect x={t.x - 2.5} y={t.y - 10} width={5} height={10} rx={2} fill={p.near} />
            <path d={`M${t.x} ${r2(t.y - t.r * 2.6)} L${r2(t.x + t.r * 0.8)} ${r2(t.y - 8)} L${r2(t.x - t.r * 0.8)} ${r2(t.y - 8)} Z`} fill={p.near} />
          </g>
        ) : (
          <g key={i}>
            <rect x={t.x - 2.5} y={r2(t.y - t.r - 6)} width={5} height={r2(t.r + 6)} rx={2} fill={p.near} />
            <circle cx={t.x} cy={r2(t.y - t.r * 1.6)} r={t.r} fill={p.near} />
            <circle cx={r2(t.x - t.r * 0.35)} cy={r2(t.y - t.r * 1.95)} r={r2(t.r * 0.35)} fill="#ffffff" fillOpacity={0.12} />
          </g>
        ),
      )}

      {/* Casinha-cogumelo: a janela acesa é o "tem alguém em casa" da cena. */}
      <circle cx={hx} cy={by - 22} r={46} fill={`url(#${uid}warm)`} opacity={0.5} />
      <rect x={hx - 21} y={by - 42} width={42} height={44} rx={10} fill={STEM} />
      <path d={`M${hx - 8} ${by + 1} V${by - 14} a8 8 0 0 1 16 0 V${by + 1} Z`} fill={p.near} />
      <circle cx={hx + 12} cy={by - 26} r={5} fill={WINDOW} />
      <circle cx={hx + 12} cy={by - 26} r={12} fill={`url(#${uid}warm)`} />
      <path d={`M${hx - 50} ${by - 36} Q${hx - 52} ${by - 92} ${hx} ${by - 94} Q${hx + 52} ${by - 92} ${hx + 50} ${by - 36} Q${hx} ${by - 26} ${hx - 50} ${by - 36} Z`} fill={p.cap} />
      <circle cx={hx - 24} cy={by - 62} r={7} fill={STEM} fillOpacity={0.9} />
      <circle cx={hx + 6} cy={by - 78} r={5} fill={STEM} fillOpacity={0.9} />
      <circle cx={hx + 28} cy={by - 54} r={6} fill={STEM} fillOpacity={0.9} />
      <path d={`M${hx - 38} ${by - 72} Q${hx - 26} ${by - 88} ${hx - 6} ${by - 90}`} fill="none" stroke="#ffffff" strokeOpacity={0.35} strokeWidth={4} strokeLinecap="round" />

      <path d={art.near} fill={p.near} />
      {art.fireflies.map((f, i) => (
        <g key={i}>
          <circle cx={f.x} cy={f.y} r={f.r * 4} fill={`url(#${uid}warm)`} opacity={0.6} />
          <circle cx={f.x} cy={f.y} r={f.r} fill={WINDOW} />
        </g>
      ))}
      <rect width={width} height={height} fill={`url(#${uid}scrim)`} />
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
  const { skyTop, skyLow } = coverPalette(seedSource);
  const image = project?.coverImageUrl;

  return (
    <div
      className={`relative isolate flex overflow-hidden rounded-2xl text-[#fbf6ea] ${className}`}
      style={{ background: `linear-gradient(180deg, ${skyTop}, ${skyLow})` }}
    >
      {image ? (
        <>
          <CoverImage src={image} alt="" fallback={<CoverArt seedSource={seedSource} width={1600} height={300} />} />
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-transparent" aria-hidden />
        </>
      ) : (
        <CoverArt seedSource={seedSource} width={1600} height={300} />
      )}
      <div className="relative flex w-full flex-col gap-2.5">{children}</div>
    </div>
  );
}

const MINI_SPARKLE = sparkle(8, 9, 2.6);

/** Ícone quadrado do projeto: o da Ficha técnica, a capa, ou a cena em miniatura. */
export function ProjectGlyph({ project, className = "" }: { project: Project; className?: string }) {
  const icon = project.mindMapSettings?.documentView?.spotlight?.titleIconUrl || project.coverImageUrl;
  const p = coverPalette(project.id);
  const mini = (
    <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full" aria-hidden>
      <circle cx="26" cy="10" r="4" fill={p.moon} />
      <path d={MINI_SPARKLE} fill={p.moon} fillOpacity={0.8} />
      <path d="M0 25 Q9 19 18 23 T36 22 V36 H0 Z" fill={p.far} />
      <rect x="14.5" y="24" width="7" height="7" rx="2" fill={STEM} />
      <path d="M10 26 Q10 17 18 17 Q26 17 26 26 Q18 27.5 10 26 Z" fill={p.cap} />
      <circle cx="15" cy="21.5" r="1.4" fill={STEM} />
      <circle cx="21" cy="20.5" r="1.1" fill={STEM} />
      <path d="M0 31 Q12 28 22 31 T36 30 V36 H0 Z" fill={p.near} />
    </svg>
  );
  return (
    <span className={`relative block overflow-hidden ${className}`} style={{ background: `linear-gradient(180deg, ${p.skyTop}, ${p.skyLow})` }}>
      {icon ? <CoverImage src={icon} alt="" fallback={mini} /> : mini}
    </span>
  );
}
