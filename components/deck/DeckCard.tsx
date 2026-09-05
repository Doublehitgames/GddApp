"use client";

import { useEffect, useMemo, useState } from "react";
import { getDriveImageDisplayCandidates } from "@/lib/googleDrivePicker";
import { inkOn, plateOn, type DeckIcon } from "@/lib/deck/deck";

export interface DeckCardProps {
  label: string;
  icon: DeckIcon;
  /** Cor da página (ou herdada do ramo). */
  color: string;
  /** Glifo do estado de maturidade. Ausente é o normal. */
  statusGlyph?: string;
  statusLabel?: string;
  staleGlyph?: string;
  staleLabel?: string;
  /** Filhas diretas e páginas do ramo inteiro. */
  directChildren: number;
  branchTotal: number;
  directChildrenLabel: string;
  branchTotalLabel: string;
  open?: boolean;
  onClick: () => void;
}

/** Imagem da página, com os candidatos do Drive em cascata. */
function CardImage({ url }: { url: string }) {
  const candidates = useMemo(() => getDriveImageDisplayCandidates(url), [url]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [url]);

  if (index >= candidates.length) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={candidates[index]}
      alt=""
      loading="lazy"
      onError={() => setIndex((prev) => prev + 1)}
      className="h-[70px] w-[70px] object-contain"
    />
  );
}

/**
 * A carta do Deck.
 *
 * O ícone é o protagonista — ocupa a metade de cima inteira, e é ele que a
 * pessoa reconhece antes de ler o nome. Tudo o que a carta mostra sai de campo
 * que a página já tem: cor do mapa mental, thumb da biblioteca, emoji do
 * título, estado de maturidade.
 *
 * A carta tem um tamanho só, em qualquer andar. Capítulo e item da despensa
 * cabem na mesma moldura, e a grade do GDD inteiro fica com um ritmo só.
 */
export default function DeckCard({
  label,
  icon,
  color,
  statusGlyph,
  statusLabel,
  staleGlyph,
  staleLabel,
  directChildren,
  branchTotal,
  directChildrenLabel,
  branchTotalLabel,
  open = false,
  onClick,
}: DeckCardProps) {
  const ink = inkOn(color);
  const plate = plateOn(color);
  const markClass =
    "absolute top-1.5 z-[3] grid h-[19px] w-[19px] place-items-center rounded-md text-[10.5px] leading-none";
  const chipClass =
    "min-w-[21px] rounded-md px-[5px] py-0.5 text-[10.5px] font-bold tabular-nums shadow-[0_1px_4px_rgba(16,24,40,0.28)]";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className="group relative flex w-full flex-col pb-3 text-left transition-transform duration-150 hover:-translate-y-[3px] focus:outline-none"
    >
      <span
        style={{ background: color, color: ink }}
        className={`relative flex min-h-[156px] w-full flex-col items-center overflow-hidden rounded-[13px] px-2 pb-[22px] pt-2.5 text-center shadow-[0_3px_0_rgba(0,0,0,0.14),0_9px_18px_-11px_rgba(16,24,40,0.4)] transition-shadow duration-150 group-hover:shadow-[0_3px_0_rgba(0,0,0,0.14),0_18px_28px_-13px_rgba(16,24,40,0.5)] group-focus-visible:outline group-focus-visible:outline-[3px] group-focus-visible:outline-offset-2 group-focus-visible:outline-[#ef5f56] ${
          // A borda de selecao vai de `outline`, e nao de outra `shadow`: duas
          // utilidades de sombra na mesma classe brigam pela ordem do CSS, e a
          // que perde some sem avisar. O outline nao disputa com nada.
          open ? "outline outline-[3px] outline-offset-0 outline-[#ef5f56]" : ""
        }`}
      >
        {statusGlyph && (
          <span title={statusLabel} style={{ background: plate }} className={`${markClass} left-1.5`}>
            {statusGlyph}
          </span>
        )}
        {staleGlyph && (
          <span title={staleLabel} style={{ background: plate }} className={`${markClass} right-1.5`}>
            {staleGlyph}
          </span>
        )}

        {/* metade de cima: só o ícone */}
        <span className="relative z-[2] mt-0.5 grid min-h-[80px] flex-1 place-items-center text-[46px] leading-none">
          {icon.kind === "image" && <CardImage url={icon.url} />}
          {icon.kind === "emoji" && icon.char}
          {icon.kind === "initials" && (
            <span
              className="grid h-16 w-16 place-items-center rounded-[15px] border text-[22px] font-extrabold tracking-wide"
              style={{ background: "rgba(255,255,255,0.15)", borderColor: "rgba(255,255,255,0.3)", color: ink }}
            >
              {icon.text}
            </span>
          )}
        </span>

        {/*
          A curva que separa o desenho do rótulo: uma faixa mais clara cujo topo
          é um arco. O raio é elíptico (50% na horizontal, 26% na vertical) e vai
          por style — a barra do valor arbitrário do Tailwind seria lida como
          modificador de opacidade, e a classe não gera raio nenhum.
        */}
        <span
          aria-hidden
          style={{ borderRadius: "50% 50% 0 0 / 26% 26% 0 0" }}
          className="pointer-events-none absolute -left-[24%] -right-[24%] top-[62%] z-[1] h-[66%] bg-white/[0.13]"
        />

        <span className="relative z-[2] mt-2 text-[11.5px] font-bold">{label}</span>
      </span>

      {directChildren > 0 && (
        <span className="absolute inset-x-0 bottom-0 z-[3] flex justify-center gap-[5px]">
          <span title={directChildrenLabel} className={`${chipClass} bg-white text-gray-900`}>
            {directChildren}
          </span>
          {branchTotal > directChildren && (
            <span title={branchTotalLabel} className={`${chipClass} bg-emerald-600 text-white`}>
              {branchTotal}
            </span>
          )}
        </span>
      )}
    </button>
  );
}
