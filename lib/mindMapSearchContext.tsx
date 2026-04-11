"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type MindMapSearchContextValue = {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  /** IDs of matched sections in the order they should be cycled through. Empty when no term. */
  resultIds: string[];
  /** Total number of results. */
  resultCount: number;
  /** 0-based index of the active result. Always 0 when `resultCount` is 0. */
  activeIndex: number;
  /** ID of the currently active result, or null if there are none. */
  activeResultId: string | null;
  /** Replace the list of results. Called by the mindmap whenever the search recomputes. */
  setResults: (ids: string[]) => void;
  /** Jump to a specific result index (clamped to valid range). */
  setActiveIndex: (index: number) => void;
  /** Move to next (+1) or previous (-1) result, wrapping around. */
  navigate: (direction: 1 | -1) => void;
};

const MindMapSearchContext = createContext<MindMapSearchContextValue | null>(null);

export function MindMapSearchProvider({ children }: { children: ReactNode }) {
  const [searchTerm, setSearchTermState] = useState("");
  const [resultIds, setResultIds] = useState<string[]>([]);
  const [activeIndex, setActiveIndexState] = useState(0);

  const setSearchTerm = useCallback((term: string) => {
    setSearchTermState(term);
    setActiveIndexState(0);
  }, []);

  const setResults = useCallback((ids: string[]) => {
    setResultIds((prev) => {
      if (prev.length === ids.length && prev.every((id, i) => id === ids[i])) return prev;
      return ids;
    });
    setActiveIndexState((prev) => {
      if (ids.length === 0) return 0;
      if (prev >= ids.length) return 0;
      return prev;
    });
  }, []);

  const setActiveIndex = useCallback((index: number) => {
    setActiveIndexState((prev) => {
      if (resultIds.length === 0) return 0;
      const clamped = Math.max(0, Math.min(resultIds.length - 1, index));
      return clamped === prev ? prev : clamped;
    });
  }, [resultIds.length]);

  const navigate = useCallback((direction: 1 | -1) => {
    setActiveIndexState((prev) => {
      if (resultIds.length === 0) return 0;
      return (prev + direction + resultIds.length) % resultIds.length;
    });
  }, [resultIds.length]);

  const value = useMemo(
    () => ({
      searchTerm,
      setSearchTerm,
      resultIds,
      resultCount: resultIds.length,
      activeIndex,
      activeResultId: resultIds[activeIndex] ?? null,
      setResults,
      setActiveIndex,
      navigate,
    }),
    [searchTerm, setSearchTerm, resultIds, activeIndex, setResults, setActiveIndex, navigate]
  );

  return <MindMapSearchContext.Provider value={value}>{children}</MindMapSearchContext.Provider>;
}

/**
 * Returns the shared mindmap search context. Returns a no-op fallback when
 * used outside a provider so components don't crash on other routes.
 */
export function useMindMapSearch(): MindMapSearchContextValue {
  const ctx = useContext(MindMapSearchContext);
  if (ctx) return ctx;
  return {
    searchTerm: "",
    setSearchTerm: () => {},
    resultIds: [],
    resultCount: 0,
    activeIndex: 0,
    activeResultId: null,
    setResults: () => {},
    setActiveIndex: () => {},
    navigate: () => {},
  };
}
