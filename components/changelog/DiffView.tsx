"use client";

import { useMemo } from "react";
import { condenseSegments, diffText, type DiffSegment } from "@/lib/changelog/diff";

interface Props {
  before: string;
  after: string;
  /** Encolhe os trechos sem mudança — usado no cartão fechado. */
  condensed?: boolean;
  className?: string;
}

function Segment({ segment }: { segment: DiffSegment }) {
  if (segment.type === "eq") {
    return <span className="text-gray-400">{segment.text}</span>;
  }
  if (segment.type === "add") {
    return (
      <span className="rounded-[3px] bg-emerald-500/15 text-emerald-300 decoration-emerald-500/40">
        {segment.text}
      </span>
    );
  }
  return (
    <span className="rounded-[3px] bg-rose-500/10 text-rose-400/80 line-through decoration-rose-500/50">
      {segment.text}
    </span>
  );
}

/**
 * O texto antigo e o novo em cima um do outro: o que saiu riscado em vermelho,
 * o que entrou em verde, o que ficou em cinza.
 *
 * Uma coluna só, e não lado a lado: a descrição de uma página é prosa, e ler
 * prosa em duas colunas espelhadas obriga a comparar linha por linha com o
 * olho. Aqui a frase continua sendo uma frase.
 */
export default function DiffView({ before, after, condensed = false, className = "" }: Props) {
  const segments = useMemo(() => {
    const result = diffText(before, after);
    return condensed ? condenseSegments(result.segments) : result.segments;
  }, [before, after, condensed]);

  if (segments.length === 0) {
    return null;
  }

  return (
    <div
      className={`whitespace-pre-wrap break-words font-mono text-[12.5px] leading-relaxed ${className}`}
    >
      {segments.map((segment, index) => (
        <Segment key={index} segment={segment} />
      ))}
    </div>
  );
}
