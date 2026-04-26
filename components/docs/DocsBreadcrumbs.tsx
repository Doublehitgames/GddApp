import Link from "next/link";
import type { Crumb } from "@/lib/docs/tree";

interface DocsBreadcrumbsProps {
  crumbs: Crumb[];
}

/**
 * Breadcrumb trail rendered above each docs article. Each intermediate
 * crumb is a link back to its folder/section index; the current page's
 * crumb is plain text. Skipped entirely on the root /docs landing.
 */
export function DocsBreadcrumbs({ crumbs }: DocsBreadcrumbsProps) {
  if (crumbs.length === 0) return null;
  return (
    <nav
      aria-label="Trilha de navegação"
      className="mb-4 flex flex-wrap items-center gap-1 text-xs text-gray-500"
    >
      <Link
        href="/docs"
        className="hover:text-indigo-300 transition-colors"
      >
        Docs
      </Link>
      {crumbs.map((c, idx) => (
        // Folders without index.mdx have href=null — rendering as plain
        // text avoids the 404 the user would otherwise hit.
        <span key={`${c.label}-${idx}`} className="flex items-center gap-1">
          <span aria-hidden="true" className="text-gray-700">
            ›
          </span>
          {c.current || c.href === null ? (
            <span
              className="text-gray-400"
              aria-current={c.current ? "page" : undefined}
            >
              {c.label}
            </span>
          ) : (
            <Link
              href={c.href}
              className="hover:text-indigo-300 transition-colors"
            >
              {c.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
