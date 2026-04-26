import Link from "next/link";
import type { ReactNode } from "react";

interface FeatureCardProps {
  /** Optional emoji shown large at top-left of the card. */
  emoji?: string;
  /** Card title — usually a noun phrase. */
  title: string;
  /** Internal link the whole card is clickable for. */
  href: string;
  /** 1-2 sentence description. */
  children?: ReactNode;
}

/**
 * Clickable card used on landing/index pages to surface major sections.
 * Designed to live inside a CSS grid with `gap-3` (the wrapper handles
 * layout; the card just fills its cell).
 */
export function FeatureCard({ emoji, title, href, children }: FeatureCardProps) {
  return (
    <Link
      href={href}
      className="group block rounded-xl border border-gray-800 bg-gray-900/60 p-4 transition-colors hover:border-indigo-500/60 hover:bg-gray-900"
    >
      <div className="flex items-start gap-3">
        {emoji ? (
          <span aria-hidden="true" className="text-2xl leading-none">
            {emoji}
          </span>
        ) : null}
        <div className="flex-1">
          <h3 className="text-base font-semibold text-gray-100 group-hover:text-indigo-300 transition-colors">
            {title}
            <span aria-hidden="true" className="ml-1 text-gray-500 group-hover:text-indigo-400">
              →
            </span>
          </h3>
          {/* MDX wraps loose text inside JSX components in <p>, so we use a
              <div> here instead of <p> to avoid the invalid <p><p> nesting
              that triggers a React hydration error. */}
          {children ? (
            <div className="mt-1 text-sm text-gray-400 leading-snug">{children}</div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
