"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

interface PublicShareButtonProps {
  shareToken?: string | null;
  isPublic?: boolean | null;
  /** Visual variant. `card` is a solid chip (home project cards). `inline` is compact for headers/breadcrumbs. */
  variant?: "card" | "inline";
  className?: string;
}

export function PublicShareButton({
  shareToken,
  isPublic,
  variant = "inline",
  className = "",
}: PublicShareButtonProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  if (!isPublic || !shareToken) return null;

  const buildUrl = () => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/s/${encodeURIComponent(shareToken)}`;
  };

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const url = buildUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* swallow — clipboard may be blocked in some contexts */
    }
  };

  const baseLabel = copied
    ? t("publicShare.copied", "Link copiado!")
    : t("publicShare.copyTooltip", "Copiar link público");

  if (variant === "card") {
    return (
      <button
        type="button"
        onClick={handleCopy}
        title={baseLabel}
        aria-label={baseLabel}
        className={`relative z-10 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors shrink-0 ${
          copied
            ? "border-emerald-400/60 bg-emerald-600/25 text-emerald-100"
            : "border-sky-400/40 bg-sky-600/20 text-sky-100 hover:border-sky-300/70 hover:bg-sky-600/30"
        } ${className}`}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          {copied ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 11-5.656-5.656l1.5-1.5m6.656-6.656l1.5-1.5a4 4 0 115.656 5.656l-3 3a4 4 0 01-5.656 0"
            />
          )}
        </svg>
        <span className="hidden sm:inline">
          {copied ? t("publicShare.copied", "Link copiado!") : t("publicShare.labelShort", "Público")}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={baseLabel}
      aria-label={baseLabel}
      className={`shrink-0 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
        copied
          ? "border-emerald-400/60 bg-emerald-600/25 text-emerald-100"
          : "border-sky-500/40 bg-sky-600/15 text-sky-200 hover:border-sky-400/70 hover:bg-sky-600/25 hover:text-white"
      } ${className}`}
    >
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        {copied ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 11-5.656-5.656l1.5-1.5m6.656-6.656l1.5-1.5a4 4 0 115.656 5.656l-3 3a4 4 0 01-5.656 0"
          />
        )}
      </svg>
      <span>
        {copied ? t("publicShare.copied", "Copiado!") : t("publicShare.labelShort", "Público")}
      </span>
    </button>
  );
}
