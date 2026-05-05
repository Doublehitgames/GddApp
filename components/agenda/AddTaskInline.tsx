"use client";

import { useState, useRef, useEffect } from "react";
import { useI18n } from "@/lib/i18n/provider";

interface Props {
  onAdd: (title: string) => void;
  autoFocus?: boolean;
}

export default function AddTaskInline({ onAdd, autoFocus }: Props) {
  const { t } = useI18n();
  const [active, setActive] = useState(autoFocus ?? false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [active]);

  const submit = () => {
    const trimmed = value.trim();
    if (trimmed) {
      onAdd(trimmed);
      setValue("");
      inputRef.current?.focus();
    }
  };

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => setActive(true)}
        className="flex w-full items-center gap-2 rounded-xl border border-dashed border-gray-700 px-4 py-3 text-sm text-gray-500 transition-all hover:border-gray-500 hover:text-gray-300 hover:bg-gray-800/30 group"
      >
        <svg className="h-4 w-4 shrink-0 text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        {t("agenda.addTask")}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-sky-500/50 bg-sky-950/20 px-4 py-3">
      <svg className="h-4 w-4 shrink-0 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") { setValue(""); setActive(false); }
        }}
        onBlur={() => {
          if (!value.trim()) setActive(false);
        }}
        placeholder={`${t("agenda.addTaskPlaceholder")} (Enter)`}
        className="flex-1 bg-transparent text-sm text-gray-100 placeholder:text-gray-500 outline-none"
      />
      {value.trim() && (
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); submit(); }}
          className="shrink-0 rounded-lg bg-sky-500/20 px-2.5 py-1 text-xs font-medium text-sky-300 hover:bg-sky-500/30 transition-colors"
        >
          {t("agenda.addTask").replace("…", "")}
        </button>
      )}
    </div>
  );
}
