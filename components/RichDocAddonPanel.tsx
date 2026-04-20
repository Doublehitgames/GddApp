"use client";

import dynamic from "next/dynamic";
import type { RichDocAddonDraft, RichDocBlock } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { CommitTextInput } from "@/components/common/CommitInput";

const RichDocEditor = dynamic(() => import("@/components/RichDocEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[160px] items-center justify-center rounded-xl border border-dashed border-gray-700 bg-gray-950/40 text-xs text-gray-500">
      …
    </div>
  ),
});

interface RichDocAddonPanelProps {
  addon: RichDocAddonDraft;
  onChange: (next: RichDocAddonDraft) => void;
  onRemove: () => void;
}

const PANEL_SHELL_CLASS = "px-1 py-2";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-gray-500";
const BUTTON_DANGER_CLASS =
  "rounded-lg border border-rose-700/60 bg-rose-900/30 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-900/50";

export function RichDocAddonPanel({ addon, onChange, onRemove }: RichDocAddonPanelProps) {
  const { t } = useI18n();

  const handleBlocksChange = (nextBlocks: RichDocBlock[]) => {
    onChange({ ...addon, blocks: nextBlocks });
  };

  return (
    <div className={PANEL_SHELL_CLASS}>
      <div className="mb-4 flex items-center gap-2">
        <CommitTextInput
          value={addon.name}
          onCommit={(name) => onChange({ ...addon, name })}
          className={INPUT_CLASS}
          placeholder={t("richDocAddon.namePlaceholder", "Nome do documento")}
        />
        <button type="button" onClick={onRemove} className={BUTTON_DANGER_CLASS}>
          {t("common.remove", "Remover")}
        </button>
      </div>
      <div className="rich-doc-editor-host">
        <RichDocEditor
          blocks={addon.blocks}
          editable
          theme="dark"
          onChange={handleBlocksChange}
        />
      </div>
    </div>
  );
}
