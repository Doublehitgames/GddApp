"use client";

import { useEffect, useState, type ReactNode } from "react";

interface NumericLimitsToggleProps {
  /**
   * True when any limit data is already set (min/max or bindings).
   * When true, the toggle forces itself open even if the user hasn't clicked.
   */
  hasData: boolean;
  /**
   * Called when the user turns the toggle off.
   * Parent is responsible for clearing min, max, and any related bindings.
   */
  onClear: () => void;
  /** Content shown when expanded (the min/max fields). */
  children: ReactNode;
  /** Override the separator label. Default: "Limites". */
  label?: string;
}

/**
 * Collapsible "Limites" section for any numeric field.
 *
 * Shows a thin divider row with a label and an on/off chip.
 * When on, renders `children` (the min/max inputs or FieldBindingPickers).
 * When turned off, calls `onClear` so the parent can wipe the stored values.
 *
 * Toggle state is derived: if `hasData` is true the section stays open.
 * If `hasData` is false, local state controls visibility until the user types.
 */
export function NumericLimitsToggle({
  hasData,
  onClear,
  children,
  label = "Limites",
}: NumericLimitsToggleProps) {
  const [isOpen, setIsOpen] = useState(hasData);

  // Sync open state when external data changes (e.g. after a clear)
  useEffect(() => {
    if (hasData) setIsOpen(true);
  }, [hasData]);

  const effectivelyOpen = isOpen || hasData;

  function handleToggle() {
    if (effectivelyOpen) {
      // Turn off — clear stored values then collapse
      onClear();
      setIsOpen(false);
    } else {
      setIsOpen(true);
    }
  }

  return (
    <div className="mt-2">
      {/* Divider row */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          {label}
        </span>
        <div className="flex-1 border-t border-gray-700" />
        <button
          type="button"
          onClick={handleToggle}
          className={`inline-flex h-5 items-center rounded px-1.5 text-[10px] font-semibold transition-colors ${
            effectivelyOpen
              ? "bg-sky-800 text-sky-200 hover:bg-sky-700"
              : "bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-gray-200"
          }`}
        >
          {effectivelyOpen ? "ON" : "OFF"}
        </button>
      </div>

      {/* Expandable content */}
      {effectivelyOpen && <div className="mt-2">{children}</div>}
    </div>
  );
}
