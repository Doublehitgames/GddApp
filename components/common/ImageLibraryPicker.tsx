"use client";

import { useMemo, useState } from "react";
import type { ProjectImage } from "@/store/slices/types";
import { imageLabel } from "@/lib/googleDriveFolder";
import { useI18n } from "@/lib/i18n/provider";
import { DriveThumb } from "@/components/common/DriveThumb";

interface ImageLibraryPickerProps {
  files: ProjectImage[];
  /** Nome do arquivo já usado nesta página, para marcar o selecionado. */
  selectedName?: string;
  onPick: (file: ProjectImage) => void;
  onClose: () => void;
  /** Escape hatch: abrir o picker do Google para pegar algo fora da pasta. */
  onUseDrivePicker?: () => void;
}

/** Grade das imagens já indexadas no projeto — evita abrir o picker do Google a cada ícone. */
export function ImageLibraryPicker({
  files,
  selectedName,
  onPick,
  onClose,
  onUseDrivePicker,
}: ImageLibraryPickerProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;
    // Busca no caminho também: digitar "sementes" filtra a subpasta inteira.
    return files.filter((f) => imageLabel(f).toLowerCase().includes(q));
  }, [files, query]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-2xl border border-gray-700 bg-gray-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-white">{t("imageLibrary.pickerTitle")}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 text-xl text-gray-400 hover:text-white"
            aria-label={t("imageLibrary.pickerClose")}
          >
            ×
          </button>
        </div>

        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("imageLibrary.pickerFilterPlaceholder")}
          className="mb-4 w-full rounded-lg border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white outline-none placeholder-gray-500 focus:border-gray-500"
        />

        <div className="grid flex-1 grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-5 md:grid-cols-6">
          {filtered.map((file) => {
            const isSelected = selectedName && file.name === selectedName;
            return (
              <button
                key={file.fileId}
                type="button"
                onClick={() => onPick(file)}
                title={imageLabel(file)}
                className={`rounded-lg border p-1 text-left transition-all ${
                  isSelected
                    ? "border-emerald-400 ring-2 ring-emerald-500/40"
                    : "border-gray-700 hover:border-emerald-400"
                }`}
              >
                <DriveThumb
                  fileId={file.fileId}
                  alt={file.name}
                  size={240}
                  className="h-20 w-full rounded bg-gray-950 object-contain"
                />
                <div className="mt-1 truncate text-[10px] text-gray-400">{file.name}</div>
                {file.path && (
                  <div className="truncate text-[9px] text-gray-600">{file.path}</div>
                )}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-gray-500">
              {t("imageLibrary.pickerEmptyFilter")}
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-800 pt-3">
          <span className="text-xs text-gray-500">
            {t("imageLibrary.pickerCount")
              .replace("{shown}", String(filtered.length))
              .replace("{total}", String(files.length))}
          </span>
          {onUseDrivePicker && (
            <button
              type="button"
              onClick={onUseDrivePicker}
              className="rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700/40"
            >
              {t("imageLibrary.pickerUseDrive")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
