"use client";

import { useState } from "react";
import { SPECIAL_TOKEN_HELP_ITEMS } from "@/lib/addons/projectSpecialTokens";

type SpecialTokensHelpProps = {
  title?: string;
  onInsertToken?: (token: string) => void;
  theme?: "dark" | "light";
};

export default function SpecialTokensHelp({
  title = "Chaves especiais",
  onInsertToken,
  theme = "dark",
}: SpecialTokensHelpProps) {
  const [open, setOpen] = useState(false);
  const isLight = theme === "light";

  return (
    <div className={`rounded-xl border p-3 ${isLight ? "border-gray-300 bg-gray-50" : "border-gray-700 bg-gray-900/40"}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between text-left ${isLight ? "text-gray-900" : "text-gray-100"}`}
        aria-expanded={open}
      >
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs">{open ? "Ocultar" : "Mostrar"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <p className={`text-xs ${isLight ? "text-gray-600" : "text-gray-400"}`}>
            Use o formato <code>@[token]</code> ou com filtro <code>@[token(chave=valor)]</code>.
          </p>
          <div className="space-y-2">
            {SPECIAL_TOKEN_HELP_ITEMS.map((item) => (
              <div
                key={item.token}
                className={`rounded-lg border p-2 ${isLight ? "border-gray-300 bg-white" : "border-gray-700 bg-gray-950/60"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold ${isLight ? "text-gray-900" : "text-gray-200"}`}>{item.label}</p>
                    <p className={`text-[11px] ${isLight ? "text-gray-600" : "text-gray-400"}`}>{item.description}</p>
                    <code className={`mt-1 inline-block break-all text-[11px] ${isLight ? "text-blue-700" : "text-blue-300"}`}>
                      {item.token}
                    </code>
                  </div>
                  {onInsertToken && (
                    <button
                      type="button"
                      onClick={() => onInsertToken(item.token)}
                      className={`shrink-0 rounded px-2 py-1 text-[11px] ${isLight ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-blue-700 text-white hover:bg-blue-600"}`}
                    >
                      Inserir
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

