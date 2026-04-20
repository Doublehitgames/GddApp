"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ADDON_CATEGORY_ORDER, ADDON_REGISTRY, type AddonCategory, type AddonRegistryEntry } from "@/lib/addons/registry";
import type { SectionAddonType } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";

interface AddonPickerModalProps {
  open: boolean;
  onClose: () => void;
  onPick: (type: SectionAddonType) => void;
}

function normalizeForSearch(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function AddonPickerModal({ open, onClose, onPick }: AddonPickerModalProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Reset query + focus search when opened
  useEffect(() => {
    if (!open) return;
    setQuery("");
    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  // Escape + click-outside to close
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const getLabel = (type: SectionAddonType, fallback: string) => {
    if (type === "xpBalance") return t("balanceAddon.addonTypeLabel", fallback);
    if (type === "progressionTable") return t("progressionTableAddon.addonTypeLabel", fallback);
    if (type === "economyLink") return t("economyLinkAddon.addonTypeLabel", fallback);
    if (type === "currency") return t("currencyAddon.addonTypeLabel", fallback);
    if (type === "globalVariable") return t("globalVariableAddon.addonTypeLabel", fallback);
    if (type === "inventory") return t("inventoryAddon.addonTypeLabel", fallback);
    if (type === "production") return t("productionAddon.addonTypeLabel", fallback);
    if (type === "dataSchema" || type === "genericStats") return t("dataSchemaAddon.addonTypeLabel", fallback);
    if (type === "attributeDefinitions") return t("attributeDefinitionsAddon.addonTypeLabel", fallback);
    if (type === "attributeProfile") return t("attributeProfileAddon.addonTypeLabel", fallback);
    if (type === "attributeModifiers") return t("attributeModifiersAddon.addonTypeLabel", fallback);
    if (type === "fieldLibrary") return t("fieldLibraryAddon.addonTypeLabel", fallback);
    if (type === "exportSchema") return t("exportSchemaAddon.addonTypeLabel", fallback);
    if (type === "richDoc") return t("richDocAddon.addonTypeLabel", fallback);
    return fallback;
  };

  const getDescription = (type: SectionAddonType) => {
    return t(`addonCatalog.${type}.description`, "");
  };

  const grouped = useMemo(() => {
    const q = normalizeForSearch(query.trim());
    const filtered = ADDON_REGISTRY.filter((entry) => {
      if (!q) return true;
      const label = getLabel(entry.type, entry.label);
      const description = getDescription(entry.type);
      return (
        normalizeForSearch(label).includes(q) ||
        normalizeForSearch(description).includes(q) ||
        normalizeForSearch(entry.type).includes(q)
      );
    });
    const byCategory = new Map<AddonCategory, AddonRegistryEntry[]>();
    for (const entry of filtered) {
      const bucket = byCategory.get(entry.category);
      if (bucket) bucket.push(entry);
      else byCategory.set(entry.category, [entry]);
    }
    return ADDON_CATEGORY_ORDER.filter((cat) => byCategory.has(cat)).map((cat) => ({
      category: cat,
      entries: byCategory.get(cat) || [],
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, t]);

  if (!open) return null;

  const hasResults = grouped.length > 0;

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto p-4 sm:p-6">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={t("addonPicker.title", "Adicionar addon")}
          className="w-full max-w-3xl mt-10 rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-800 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-gray-100">
                {t("addonPicker.title", "Adicionar addon")}
              </h3>
              <p className="mt-0.5 text-xs text-gray-400">
                {t("addonPicker.subtitle", "Escolha o que você quer configurar nesta página")}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("addonPicker.closeAriaLabel", "Fechar")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-gray-100"
            >
              ✕
            </button>
          </div>

          {/* Search */}
          <div className="px-5 pt-4">
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("addonPicker.searchPlaceholder", "Buscar addon...")}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
            />
          </div>

          {/* Content */}
          <div className="px-5 py-4 max-h-[min(70vh,640px)] overflow-y-auto space-y-5">
            {hasResults ? (
              grouped.map((group) => (
                <div key={group.category}>
                  <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    {t(`addonPicker.category.${group.category}`, group.category)}
                  </h4>
                  <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {group.entries.map((entry) => {
                      const label = getLabel(entry.type, entry.label);
                      const description = getDescription(entry.type);
                      return (
                        <button
                          key={entry.type}
                          type="button"
                          onClick={() => {
                            onPick(entry.type);
                            onClose();
                          }}
                          className="group text-left rounded-xl border border-gray-700 bg-gray-850 bg-gray-800/70 hover:bg-gray-800 hover:border-cyan-500/60 px-3 py-3 transition-colors focus:outline-none focus-visible:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-500/30"
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="text-2xl leading-none select-none" aria-hidden>
                              {entry.emoji}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-100 truncate">{label}</p>
                              {description && (
                                <p className="mt-0.5 text-[11px] text-gray-400 leading-snug line-clamp-2">
                                  {description}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-gray-400">
                {t("addonPicker.emptyResults", "Nenhum addon encontrado")}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
