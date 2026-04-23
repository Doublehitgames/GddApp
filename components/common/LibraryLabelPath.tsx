"use client";

import { Fragment } from "react";

interface LibraryLabelPathProps {
  value: string;
  /** When true (default), the last segment is rendered with stronger emphasis. */
  emphasizeLast?: boolean;
  /** When the label has no `/`, render as plain text instead of a single chip. */
  plainWhenSingle?: boolean;
  className?: string;
}

/**
 * Renders a "Category/Subcategory/Leaf" style string as styled chips.
 * Intermediate segments are muted; the last is emphasized.
 */
export function LibraryLabelPath({
  value,
  emphasizeLast = true,
  plainWhenSingle = true,
  className,
}: LibraryLabelPathProps) {
  const segments = (value || "")
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (segments.length === 0) {
    return <span className={className}>{value}</span>;
  }

  if (plainWhenSingle && segments.length === 1) {
    return <span className={className}>{segments[0]}</span>;
  }

  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className ?? ""}`}>
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        const chipClass = isLast && emphasizeLast
          ? "rounded-md border border-sky-400/60 bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-sky-100"
          : "rounded-md border border-gray-500/40 bg-gray-700/40 px-1.5 py-0.5 text-[10px] text-gray-300";
        return (
          <Fragment key={`${segment}-${index}`}>
            <span className={chipClass}>{segment}</span>
            {!isLast && (
              <span aria-hidden className="text-[10px] text-gray-500">
                ▸
              </span>
            )}
          </Fragment>
        );
      })}
    </span>
  );
}
