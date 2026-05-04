"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useProjectStore } from "@/store/projectStore";
import { toSlug } from "@/lib/utils/slug";

/**
 * Extracts the current project ID from the URL path `/projects/:id/...` and
 * resolves it to the internal UUID.
 *
 * After the slug migration the URL segment is a human-readable slug
 * (e.g. "meu-projeto"), NOT a UUID.  All store slices key projects by UUID,
 * so this hook maps slug → UUID before returning.  Components that previously
 * received the raw URL segment and compared it against `project.id` now
 * continue to work without changes.
 *
 * Returns null when the page is not under a project route or the project
 * cannot be resolved.
 */
export function useCurrentProjectId(): string | null {
  const pathname = usePathname();
  const projects = useProjectStore((state) => state.projects);

  return useMemo(() => {
    if (!pathname) return null;
    const match = pathname.match(/^\/projects\/([^/?#]+)/);
    if (!match) return null;

    let segment: string;
    try {
      segment = decodeURIComponent(match[1]);
    } catch {
      segment = match[1];
    }

    // Fast path: URL still contains a UUID (backwards compat / direct links)
    const byId = projects.find((p) => p.id === segment);
    if (byId) return byId.id;

    // Slug path: resolve slug → UUID
    const bySlug = projects.find((p) => toSlug(p.title) === segment);
    if (bySlug) return bySlug.id;

    // Unknown — return segment as-is so callers don't silently break
    return segment;
  }, [pathname, projects]);
}
