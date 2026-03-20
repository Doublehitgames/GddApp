"use client";

import { useEffect, useRef, useState } from "react";
import { GDD_EMOJI_CATEGORIES, GDD_EMOJI_PRESETS } from "@/lib/emojiPresets";

interface EmojiQuickPickerProps {
  onSelect: (emoji: string) => void;
  title?: string;
}

export default function EmojiQuickPicker({
  onSelect,
  title = "Inserir emoji",
}: EmojiQuickPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [open]);

  const categories = [{ id: "all", label: "Todos", emojis: GDD_EMOJI_PRESETS }, ...GDD_EMOJI_CATEGORIES];
  const active = categories.find((category) => category.id === activeCategory) || categories[0];

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        title={title}
        aria-label={title}
        onClick={() => setOpen((prev) => !prev)}
        className="px-2 py-1 rounded-md bg-gray-700 text-white hover:bg-gray-600 transition-colors"
      >
        😊
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 z-50 rounded-lg border border-gray-600 bg-gray-800 p-2 shadow-xl w-[380px]">
          <div className="mb-2 flex flex-wrap gap-1 pb-1">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                className={`px-2 py-1 rounded text-xs whitespace-nowrap transition-colors ${
                  activeCategory === category.id
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-700 text-gray-200 hover:bg-gray-600"
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-10 gap-1">
            {active.emojis.map((emoji) => (
              <button
                key={`${active.id}-${emoji}`}
                type="button"
                onClick={() => {
                  onSelect(emoji);
                  setOpen(false);
                }}
                className="h-8 w-8 rounded hover:bg-gray-700 text-lg leading-none"
                title={`Inserir ${emoji}`}
                aria-label={`Inserir ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

