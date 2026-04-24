"use client";

import { useEffect, useRef } from "react";

/**
 * Fires `onOpen` once on every false→true transition of `open`. Useful for
 * dialogs that need to reset internal state when shown without listing every
 * default prop as an effect dependency (which causes infinite loops when the
 * parent passes inline objects/arrays).
 */
export function useResetOnOpen(open: boolean, onOpen: () => void): void {
  const prevRef = useRef(false);
  useEffect(() => {
    const justOpened = open && !prevRef.current;
    prevRef.current = open;
    if (justOpened) onOpen();
    // onOpen is intentionally not a dep — callers pass an ad-hoc closure
    // that reads the latest state via lexical scope on each fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
