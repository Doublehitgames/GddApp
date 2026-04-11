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
  const candidates = useMemo(() => getDriveImageDisplayCandidates(src || ""), [src]);

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
        width: `${width}px`,
        maxWidth: "100%",
        marginTop: 0,
        marginBottom: "0.5rem",
        marginRight: "1rem",
      }}
    />
  );
}
