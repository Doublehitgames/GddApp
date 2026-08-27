"use client";

import { useEffect, useMemo, useState } from "react";
import { getDriveImageDisplayCandidates } from "@/lib/googleDrivePicker";

type Props = {
  src?: string | null;
  alt: string;
  /** Width in pixels. */
  width: number;
};

/**
 * Large thumbnail rendered at the top-left of a section description, with
 * `float: left` so the surrounding markdown text wraps around it.
 *
 * Falls back through Google Drive image URL candidates on load error so a
 * Drive-hosted thumbnail has a good chance of resolving.
 */
export function SectionHeroThumb({ src, alt, width }: Props) {
  const [candidateIndex, setCandidateIndex] = useState(0);
  // Pede o dobro da largura de exibição (telas 2x) em vez do w1600 padrão: é o
  // que evita o Drive estrangular quando várias seções carregam a miniatura.
  const candidates = useMemo(
    () => getDriveImageDisplayCandidates(src || "", Math.min(1600, Math.max(120, width * 2))),
    [src, width],
  );

  useEffect(() => {
    setCandidateIndex(0);
  }, [src]);

  if (!src) return null;
  if (candidateIndex >= candidates.length) return null;

  return (
    <img
      src={candidates[candidateIndex]}
      alt={alt}
      loading="lazy"
      onError={() => setCandidateIndex((prev) => prev + 1)}
      className="gdd-section-hero-thumb rounded-lg border border-gray-200 bg-gray-100 object-cover shadow-sm"
      style={{
        float: "left",
        // Sem isto, quando o float de uma seção vaza, a thumb da seção seguinte
        // não cabe na esquerda e vai em escadinha para a direita.
        clear: "left",
        width: `${width}px`,
        maxWidth: "100%",
        marginTop: 0,
        marginBottom: "0.5rem",
        marginRight: "1rem",
      }}
    />
  );
}
