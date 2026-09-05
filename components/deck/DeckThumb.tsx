"use client";

import { useEffect, useMemo, useState } from "react";
import { getDriveImageDisplayCandidates } from "@/lib/googleDrivePicker";

interface Props {
  url: string;
  className?: string;
}

/**
 * A imagem da página, com os candidatos do Drive em cascata.
 *
 * Um link do Drive tem mais de uma forma de virar imagem e nem toda conta serve
 * todas: quando uma falha, tenta a próxima, e some quando acabam — melhor um
 * buraco do que um ícone de imagem quebrada.
 */
export default function DeckThumb({ url, className = "" }: Props) {
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
      className={`object-contain ${className}`}
    />
  );
}
