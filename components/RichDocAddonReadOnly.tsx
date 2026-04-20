"use client";

import dynamic from "next/dynamic";
import type { RichDocAddonDraft } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";

const RichDocEditor = dynamic(() => import("@/components/RichDocEditor"), {
  ssr: false,
  loading: () => (
    <div className="min-h-[60px] text-xs text-gray-500">…</div>
  ),
});

interface RichDocAddonReadOnlyProps {
  addon: RichDocAddonDraft;
  theme?: "dark" | "light";
  bare?: boolean;
}

export function RichDocAddonReadOnly({ addon, theme = "dark", bare = false }: RichDocAddonReadOnlyProps) {
  const { t } = useI18n();
  const isLight = theme === "light";
  const blocks = addon.blocks || [];

  const inner =
    blocks.length === 0 ? (
      <div className={`text-xs italic ${isLight ? "text-gray-500" : "text-gray-500"}`}>
        {t("richDocAddon.emptyState", "Documento vazio")}
      </div>
    ) : (
      <RichDocEditor blocks={blocks} editable={false} theme={theme} />
    );

  if (bare) return <div className="rich-doc-readonly-host" data-theme={theme}>{inner}</div>;
  return (
    <div
      data-theme={theme}
      className={`rich-doc-readonly-host rounded-xl border p-3 ${
        isLight ? "border-gray-200 bg-white" : "border-gray-800 bg-gray-900/50"
      }`}
    >
      {inner}
    </div>
  );
}
