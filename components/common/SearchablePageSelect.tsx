"use client";

import { useState, useRef, useEffect } from "react";

export interface PageSelectOption {
  id: string;
  label: string;
}

interface Props {
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  options: PageSelectOption[];
  /** Shown when value is undefined */
  placeholder?: string;
  /** Options pinned above the search list (e.g. "Esta página") */
  prefixOptions?: PageSelectOption[];
  /** Fallback label when value exists but is not found in options */
  invalidLabel?: string;
  className?: string;
}

export function SearchablePageSelect({
  value,
  onChange,
  options,
  placeholder = "Selecione página...",
  prefixOptions = [],
  invalidLabel = "Item não encontrado",
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const allOptions = [...prefixOptions, ...options];
  const current = allOptions.find((o) => o.id === value);
  const isKnown = value === undefined || current !== undefined;

  const norm = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const filtered = search
    ? options.filter((o) => norm(o.label).includes(norm(search)))
    : options;

  const select = (id: string | undefined) => {
    onChange(id);
    setOpen(false);
    setSearch("");
  };

  const displayLabel = current
    ? current.label
    : value && !isKnown
    ? invalidLabel
    : undefined;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-left text-sm outline-none focus:border-gray-500"
      >
        <span className={displayLabel ? "text-white" : "text-gray-500"}>
          {displayLabel ?? placeholder}
        </span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] rounded-lg border border-gray-600 bg-gray-900 shadow-xl">
          <div className="p-2">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-xs text-white outline-none focus:border-gray-500 placeholder:text-gray-600"
            />
          </div>

          <ul className="max-h-52 overflow-y-auto pb-1">
            {/* Clear / none option */}
            {!search && (
              <li>
                <button
                  type="button"
                  onClick={() => select(undefined)}
                  className={`w-full px-3 py-1.5 text-left text-xs transition-colors ${
                    !value
                      ? "bg-gray-700 text-white"
                      : "text-gray-400 hover:bg-gray-800"
                  }`}
                >
                  {placeholder}
                </button>
              </li>
            )}

            {/* Pinned prefix options */}
            {!search &&
              prefixOptions.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => select(o.id)}
                    className={`w-full px-3 py-1.5 text-left text-xs transition-colors ${
                      value === o.id
                        ? "bg-green-800/70 text-white"
                        : "text-gray-200 hover:bg-gray-800"
                    }`}
                  >
                    {o.label}
                  </button>
                </li>
              ))}

            {!search && prefixOptions.length > 0 && options.length > 0 && (
              <li className="my-0.5 border-t border-gray-700/70" />
            )}

            {/* Filtered regular options */}
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-gray-500">Nenhum resultado</li>
            ) : (
              filtered.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => select(o.id)}
                    className={`w-full px-3 py-1.5 text-left text-xs transition-colors ${
                      value === o.id
                        ? "bg-green-800/70 text-white"
                        : "text-gray-200 hover:bg-gray-800"
                    }`}
                  >
                    {o.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
