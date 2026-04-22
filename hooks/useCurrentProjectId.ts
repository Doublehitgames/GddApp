"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";

/**
 * Extracts the current project ID from the URL path `/projects/:id/...`.
 * Returns null when the page is not under a project route.
 */
export function useCurrentProjectId(): string | null {
  const pathname = usePathname();
  return useMemo(() => {
    if (!pathname) return null;
    const match = pathname.match(/^\/projects\/([^/?#]+)/);
    if (!match) return null;
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }, [pathname]);
}
