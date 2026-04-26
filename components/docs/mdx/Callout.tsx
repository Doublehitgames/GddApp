import type { ReactNode } from "react";

type CalloutType = "note" | "info" | "tip" | "warning" | "danger";

interface CalloutProps {
  type?: CalloutType;
  title?: string;
  children?: ReactNode;
}

/**
 * Visual callout box used inside MDX. Five variants cover the typical
 * docs taxonomy:
 *
 *   - note     → a side-comment, neutral colour
 *   - info     → contextual fact, indigo
 *   - tip      → actionable advice, emerald
 *   - warning  → "watch out", amber
 *   - danger   → "this will hurt", rose
 *
 * No imports needed inside .mdx — `mdx-components.tsx` exposes <Callout />
 * globally.
 */
export function Callout({ type = "note", title, children }: CalloutProps) {
  const styles: Record<CalloutType, { box: string; icon: string; iconText: string }> = {
    note: {
      box: "border-gray-700 bg-gray-800/40 text-gray-200",
      icon: "💬",
      iconText: "text-gray-400",
    },
    info: {
      box: "border-indigo-500/40 bg-indigo-500/10 text-indigo-100",
      icon: "ℹ️",
      iconText: "text-indigo-300",
    },
    tip: {
      box: "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
      icon: "💡",
      iconText: "text-emerald-300",
    },
    warning: {
      box: "border-amber-500/40 bg-amber-500/10 text-amber-100",
      icon: "⚠️",
      iconText: "text-amber-300",
    },
    danger: {
      box: "border-rose-500/40 bg-rose-500/10 text-rose-100",
      icon: "🚫",
      iconText: "text-rose-300",
    },
  };

  const style = styles[type];

  return (
    <aside
      role="note"
      className={`my-5 flex gap-3 rounded-xl border px-4 py-3 ${style.box}`}
    >
      <span aria-hidden="true" className={`text-lg leading-tight ${style.iconText}`}>
        {style.icon}
      </span>
      <div className="flex-1 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
        {title ? (
          <p className="font-semibold text-current mb-1 mt-0">{title}</p>
        ) : null}
        {children}
      </div>
    </aside>
  );
}
