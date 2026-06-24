"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useI18n } from "@/lib/i18n/provider";

export const SECTION_PICKER_ROOT = "__root__";

export type SectionLite = {
  id: string;
  title: string;
  parentId?: string | null;
  order?: number;
  color?: string;
};

type ConfirmVariant = "blue" | "sky" | "emerald";

type SectionPickerModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (selection: string) => void;
  onConfirmMulti?: (selections: string[]) => void;

  multiSelect?: boolean;

  title: string;
  description?: ReactNode;
  confirmLabel: string;
  confirmVariant?: ConfirmVariant;

  sections: SectionLite[];

  allowRoot?: boolean;
  rootLabel?: string;
  rootDescription?: string;

  disabledSectionIds?: string[];
  disabledReason?: (sectionId: string) => string | null;

  initialSelection?: string | null;

  /** Optional content rendered at the top of the scroll body, above the tree. */
  prelude?: ReactNode;
};

const CONFIRM_CLASSES: Record<ConfirmVariant, string> = {
  blue: "bg-blue-600 hover:bg-blue-700",
  sky: "bg-sky-600 hover:bg-sky-700",
  emerald: "bg-emerald-600 hover:bg-emerald-700",
};

const normalize = (s: string): string =>
  s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

export function SectionPickerModal({
  open,
  onClose,
  onConfirm,
  onConfirmMulti,
  multiSelect = false,
  title,
  description,
  confirmLabel,
  confirmVariant = "blue",
  sections,
  allowRoot = false,
  rootLabel,
  rootDescription,
  disabledSectionIds = [],
  disabledReason,
  initialSelection = null,
  prelude,
}: SectionPickerModalProps) {
  const { t } = useI18n();
  const [selection, setSelection] = useState<string | null>(initialSelection);
  const [multiSelection, setMultiSelection] = useState<Set<string>>(() => new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [manuallyCollapsed, setManuallyCollapsed] = useState<Set<string>>(
    () => new Set<string>()
  );
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const disabledSet = useMemo(
    () => new Set(disabledSectionIds),
    [disabledSectionIds]
  );

  // Reset transient state every time the modal opens.
  useEffect(() => {
    if (!open) return;
    setSelection(initialSelection);
    setMultiSelection(new Set());
    setSearchTerm("");
    setManuallyCollapsed(new Set());
    // Delay focus until after modal render
    const handle = window.setTimeout(() => {
      searchRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [open, initialSelection]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, SectionLite[]>();
    for (const s of sections) {
      const key = s.parentId ?? "__roots__";
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    return map;
  }, [sections]);

  const sectionById = useMemo(() => {
    const map = new Map<string, SectionLite>();
    for (const s of sections) map.set(s.id, s);
    return map;
  }, [sections]);

  const pathById = useCallback(
    (id: string): SectionLite[] => {
      const chain: SectionLite[] = [];
      let current = sectionById.get(id);
      const guard = new Set<string>();
      while (current && !guard.has(current.id)) {
        guard.add(current.id);
        chain.unshift(current);
        current = current.parentId ? sectionById.get(current.parentId) : undefined;
      }
      return chain;
    },
    [sectionById]
  );

  const term = searchTerm.trim();
  const hasSearch = term.length > 0;
  const normTerm = normalize(term);

  const matchesDirectly = useCallback(
    (id: string): boolean => {
      if (!hasSearch) return true;
      const s = sectionById.get(id);
      if (!s) return false;
      return normalize(s.title).includes(normTerm);
    },
    [hasSearch, normTerm, sectionById]
  );

  // Walk tree, compute which sections should be visible + auto-expanded.
  const { visibleIds, autoExpand } = useMemo(() => {
    const visible = new Set<string>();
    const expand = new Set<string>();
    const visit = (id: string): boolean => {
      const kids = childrenByParent.get(id) ?? [];
      let anyChildMatched = false;
      for (const child of kids) {
        const childVisible = visit(child.id);
        if (childVisible) anyChildMatched = true;
      }
      const selfMatches = matchesDirectly(id);
      const show = selfMatches || anyChildMatched;
      if (show) visible.add(id);
      if (hasSearch && anyChildMatched) expand.add(id);
      return show;
    };
    const roots = childrenByParent.get("__roots__") ?? [];
    for (const root of roots) visit(root.id);
    return { visibleIds: visible, autoExpand: expand };
  }, [childrenByParent, matchesDirectly, hasSearch]);

  const isExpanded = useCallback(
    (id: string): boolean => {
      if (hasSearch) return autoExpand.has(id) || matchesDirectly(id);
      return !manuallyCollapsed.has(id);
    },
    [hasSearch, autoExpand, matchesDirectly, manuallyCollapsed]
  );

  const toggleCollapse = useCallback((id: string) => {
    setManuallyCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Flat list of currently visible, selectable rows for keyboard navigation.
  const flatVisibleSelectable = useMemo(() => {
    const rows: Array<{ id: string; disabled: boolean }> = [];
    if (allowRoot && !hasSearch) {
      rows.push({ id: SECTION_PICKER_ROOT, disabled: false });
    }
    const walk = (id: string) => {
      if (!visibleIds.has(id)) return;
      const disabled = disabledSet.has(id);
      rows.push({ id, disabled });
      if (!isExpanded(id)) return;
      const kids = childrenByParent.get(id) ?? [];
      for (const child of kids) walk(child.id);
    };
    const roots = childrenByParent.get("__roots__") ?? [];
    for (const root of roots) walk(root.id);
    return rows;
  }, [
    allowRoot,
    hasSearch,
    visibleIds,
    disabledSet,
    isExpanded,
    childrenByParent,
  ]);

  const selectableVisibleIds = useMemo(
    () =>
      flatVisibleSelectable
        .filter((r) => !r.disabled && r.id !== SECTION_PICKER_ROOT)
        .map((r) => r.id),
    [flatVisibleSelectable]
  );

  const allVisibleSelected =
    selectableVisibleIds.length > 0 &&
    selectableVisibleIds.every((id) => multiSelection.has(id));

  const toggleAllVisible = useCallback(() => {
    if (allVisibleSelected) {
      setMultiSelection((prev) => {
        const next = new Set(prev);
        selectableVisibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setMultiSelection((prev) => {
        const next = new Set(prev);
        selectableVisibleIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [allVisibleSelected, selectableVisibleIds]);

  const toggleMultiItem = useCallback((id: string) => {
    setMultiSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Pais (seções com filhos) atualmente selecionados → habilitam "Selecionar filhos".
  const hasSelectedParent = useMemo(
    () =>
      Array.from(multiSelection).some(
        (id) => (childrenByParent.get(id)?.length ?? 0) > 0
      ),
    [multiSelection, childrenByParent]
  );

  // Adiciona toda a subárvore (filhos, netos…) de cada pai já selecionado,
  // pulando os desabilitados. Mantém o pai selecionado.
  const selectChildrenOfSelectedParents = useCallback(() => {
    setMultiSelection((prev) => {
      const next = new Set(prev);
      const addDescendants = (id: string) => {
        for (const child of childrenByParent.get(id) ?? []) {
          if (!disabledSet.has(child.id)) next.add(child.id);
          addDescendants(child.id);
        }
      };
      for (const id of prev) {
        if ((childrenByParent.get(id)?.length ?? 0) > 0) addDescendants(id);
      }
      return next;
    });
  }, [childrenByParent, disabledSet]);

  // Keyboard handling while modal is open.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Enter") {
        if (document.activeElement instanceof HTMLButtonElement) return;
        if (multiSelect) {
          if (multiSelection.size > 0) {
            e.preventDefault();
            onConfirmMulti?.(Array.from(multiSelection));
          }
        } else {
          const canConfirm =
            selection !== null && !disabledSet.has(selection);
          if (canConfirm && selection) {
            e.preventDefault();
            onConfirm(selection);
          }
        }
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (flatVisibleSelectable.length === 0) return;
        e.preventDefault();
        const selectable = flatVisibleSelectable.filter((r) => !r.disabled);
        if (selectable.length === 0) return;
        const currentIdx = selection
          ? selectable.findIndex((r) => r.id === selection)
          : -1;
        const delta = e.key === "ArrowDown" ? 1 : -1;
        const nextIdx =
          currentIdx < 0
            ? e.key === "ArrowDown"
              ? 0
              : selectable.length - 1
            : (currentIdx + delta + selectable.length) % selectable.length;
        setSelection(selectable[nextIdx].id);
        // Scroll row into view.
        window.requestAnimationFrame(() => {
          const el = listRef.current?.querySelector<HTMLElement>(
            `[data-picker-row="${selectable[nextIdx].id}"]`
          );
          el?.scrollIntoView({ block: "nearest" });
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, onConfirm, onConfirmMulti, multiSelect, multiSelection, selection, disabledSet, flatVisibleSelectable]);

  if (!open) return null;

  const totalPages = sections.length;
  const selectedSection =
    selection && selection !== SECTION_PICKER_ROOT
      ? sectionById.get(selection) ?? null
      : null;
  const selectedBreadcrumb = selectedSection
    ? pathById(selectedSection.id)
    : null;
  const confirmDisabled =
    selection === null || disabledSet.has(selection);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-gray-900 border border-gray-700/80 text-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-700/80">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                {title}
                <span className="text-xs text-gray-500 font-normal">
                  {t("sectionDetail.picker.pageCount", "{count} páginas").replace(
                    "{count}",
                    String(totalPages)
                  )}
                </span>
              </h2>
              {description && (
                <p className="text-sm text-gray-400 mt-1">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 transition-colors shrink-0"
              aria-label={t("common.cancel", "Cancelar")}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="mt-3 relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t("sectionDetail.picker.search", "Buscar página...")}
              className="w-full bg-gray-800/80 border border-gray-700 rounded-lg pl-9 pr-8 py-2 text-sm text-gray-100 placeholder-gray-500 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-200"
                aria-label={t("sectionDetail.picker.clearSearch", "Limpar busca")}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Selection toolbar — fixo, fora da área de rolagem */}
        {multiSelect && (
          <div className="flex items-center justify-between px-5 py-2 border-b border-gray-700/80 shrink-0">
            <span className="text-xs text-gray-400">
              {multiSelection.size > 0
                ? t(
                    multiSelection.size === 1
                      ? "sectionDetail.picker.selectedCountOne"
                      : "sectionDetail.picker.selectedCountMany",
                    multiSelection.size === 1 ? "{count} selecionada" : "{count} selecionadas"
                  ).replace("{count}", String(multiSelection.size))
                : t("sectionDetail.picker.noneSelected", "Nenhuma selecionada")}
            </span>
            <div className="flex items-center gap-3">
              {multiSelection.size > 0 && (
                <button
                  type="button"
                  onClick={() => setMultiSelection(new Set())}
                  className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
                >
                  {t("sectionDetail.picker.clear", "Limpar")}
                </button>
              )}
              {hasSelectedParent && (
                <button
                  type="button"
                  onClick={selectChildrenOfSelectedParents}
                  className="text-xs text-violet-400 hover:text-violet-300 transition-colors font-medium"
                >
                  {t("sectionDetail.picker.selectChildren", "Selecionar filhos")}
                </button>
              )}
              <button
                type="button"
                onClick={toggleAllVisible}
                className="text-xs text-sky-400 hover:text-sky-300 transition-colors font-medium"
              >
                {allVisibleSelected
                  ? t("sectionDetail.picker.deselectVisible", "Desmarcar visíveis")
                  : t("sectionDetail.picker.selectVisible", "Selecionar visíveis")}
              </button>
            </div>
          </div>
        )}

        {/* Body */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3">
          {prelude && <div className="mb-3 px-2">{prelude}</div>}
          <div className="space-y-0.5">
            {allowRoot && !hasSearch && (
              <RootRow
                label={rootLabel || t("sectionDetail.picker.rootDefault", "📁 Raiz do Projeto")}
                description={rootDescription}
                selected={selection === SECTION_PICKER_ROOT}
                onSelect={() => setSelection(SECTION_PICKER_ROOT)}
              />
            )}
            {flatVisibleSelectable.length === 0 && hasSearch && (
              <div className="px-3 py-6 text-center text-sm text-gray-500">
                {t(
                  "sectionDetail.picker.noMatch",
                  "Nenhuma página encontrada para \"{term}\""
                ).replace("{term}", term)}
              </div>
            )}
            {(childrenByParent.get("__roots__") ?? [])
              .filter((s) => visibleIds.has(s.id))
              .map((s) => (
                <PickerRow
                  key={s.id}
                  section={s}
                  level={0}
                  selection={selection}
                  onSelect={setSelection}
                  childrenByParent={childrenByParent}
                  visibleIds={visibleIds}
                  expanded={isExpanded(s.id)}
                  isExpandedFn={isExpanded}
                  onToggleCollapse={toggleCollapse}
                  disabledSet={disabledSet}
                  disabledReason={disabledReason}
                  searchTerm={hasSearch ? term : ""}
                  normTerm={normTerm}
                  t={t}
                  multiSelect={multiSelect}
                  multiSelection={multiSelection}
                  onToggleMulti={toggleMultiItem}
                />
              ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-700/80 flex items-center gap-3">
          <div className="flex-1 min-w-0 text-xs text-gray-400">
            {multiSelect ? (
              multiSelection.size > 0 ? (
                <span className="text-gray-200 font-medium">
                  {t(
                    multiSelection.size === 1
                      ? "sectionDetail.picker.selectedPagesOne"
                      : "sectionDetail.picker.selectedPagesMany",
                    multiSelection.size === 1 ? "{count} página selecionada" : "{count} páginas selecionadas"
                  ).replace("{count}", String(multiSelection.size))}
                </span>
              ) : (
                <span className="text-gray-600 italic">{t("sectionDetail.picker.selectAtLeastOne", "Selecione pelo menos uma página")}</span>
              )
            ) : selection === SECTION_PICKER_ROOT && allowRoot ? (
              <span>
                <span className="text-gray-500">
                  {t("sectionDetail.picker.destination", "Destino:")}
                </span>{" "}
                <span className="text-gray-200 font-medium">
                  {rootLabel || t("sectionDetail.picker.rootDefault", "📁 Raiz do Projeto")}
                </span>
              </span>
            ) : selectedBreadcrumb ? (
              <span className="flex items-center gap-1 truncate">
                <span className="text-gray-500 shrink-0">
                  {t("sectionDetail.picker.destination", "Destino:")}
                </span>
                <span className="truncate">
                  {selectedBreadcrumb.map((seg, idx) => (
                    <span key={seg.id}>
                      {idx > 0 && <span className="text-gray-600 mx-1">›</span>}
                      <span
                        className={
                          idx === selectedBreadcrumb.length - 1
                            ? "text-gray-100 font-medium"
                            : "text-gray-400"
                        }
                      >
                        {seg.title}
                      </span>
                    </span>
                  ))}
                </span>
              </span>
            ) : (
              <span className="text-gray-600 italic">
                {t(
                  "sectionDetail.picker.selectDestination",
                  "Selecione um destino"
                )}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-sm border border-gray-600 text-gray-200 rounded-lg hover:bg-gray-800 transition-colors"
          >
            {t("common.cancel", "Cancelar")}
          </button>
          <button
            type="button"
            onClick={() => {
              if (multiSelect) {
                if (multiSelection.size === 0) return;
                onConfirmMulti?.(Array.from(multiSelection));
              } else {
                if (confirmDisabled || selection === null) return;
                onConfirm(selection);
              }
            }}
            disabled={multiSelect ? multiSelection.size === 0 : confirmDisabled}
            className={`px-4 py-1.5 text-sm text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${CONFIRM_CLASSES[confirmVariant]}`}
          >
            {multiSelect && multiSelection.size > 0
              ? `${confirmLabel} (${multiSelection.size})`
              : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function RootRow({
  label,
  description,
  selected,
  onSelect,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      data-picker-row={SECTION_PICKER_ROOT}
      onClick={onSelect}
      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
        selected
          ? "bg-blue-900/30 ring-1 ring-blue-500/60"
          : "hover:bg-gray-800/80"
      }`}
    >
      <div
        className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
          selected ? "border-blue-400" : "border-gray-600"
        }`}
      >
        {selected && <div className="w-2 h-2 rounded-full bg-blue-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-100">{label}</div>
        {description && (
          <div className="text-xs text-gray-500">{description}</div>
        )}
      </div>
    </button>
  );
}

type PickerRowProps = {
  section: SectionLite;
  level: number;
  selection: string | null;
  onSelect: (id: string) => void;
  childrenByParent: Map<string, SectionLite[]>;
  visibleIds: Set<string>;
  expanded: boolean;
  isExpandedFn: (id: string) => boolean;
  onToggleCollapse: (id: string) => void;
  disabledSet: Set<string>;
  disabledReason?: (id: string) => string | null;
  searchTerm: string;
  normTerm: string;
  t: (key: string, fallback?: string) => string;
  multiSelect?: boolean;
  multiSelection?: Set<string>;
  onToggleMulti?: (id: string) => void;
};

function PickerRow({
  section,
  level,
  selection,
  onSelect,
  childrenByParent,
  visibleIds,
  expanded,
  isExpandedFn,
  onToggleCollapse,
  disabledSet,
  disabledReason,
  searchTerm,
  normTerm,
  t,
  multiSelect = false,
  multiSelection,
  onToggleMulti,
}: PickerRowProps) {
  const kids = (childrenByParent.get(section.id) ?? []).filter((k) =>
    visibleIds.has(k.id)
  );
  const hasChildren = kids.length > 0;
  const isDisabled = disabledSet.has(section.id);
  const isMultiSelected = multiSelect && !!(multiSelection?.has(section.id));
  const isSelected = multiSelect ? isMultiSelected : selection === section.id;
  const reason = isDisabled ? disabledReason?.(section.id) ?? null : null;
  const indent = level * 20;

  return (
    <div>
      <div
        data-picker-row={section.id}
        className={`group flex items-stretch rounded-lg transition-colors ${
          isSelected
            ? multiSelect
              ? "bg-sky-900/30 ring-1 ring-sky-500/60"
              : "bg-blue-900/30 ring-1 ring-blue-500/60"
            : isDisabled
              ? "opacity-50"
              : "hover:bg-gray-800/70"
        }`}
        style={{ paddingLeft: `${indent}px` }}
      >
        {/* Color strip */}
        <div
          className="w-1 rounded-l-lg shrink-0"
          style={{
            backgroundColor: section.color || "transparent",
          }}
        />

        {/* Toggle chevron */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggleCollapse(section.id);
          }}
          className={`w-6 flex items-center justify-center text-gray-500 ${
            hasChildren ? "hover:text-gray-200 cursor-pointer" : "cursor-default"
          }`}
          tabIndex={-1}
          aria-hidden={!hasChildren}
        >
          {hasChildren && (
            <svg
              className={`w-3 h-3 transition-transform ${
                expanded ? "rotate-90" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            if (!isDisabled) {
              if (multiSelect) onToggleMulti?.(section.id);
              else onSelect(section.id);
            }
          }}
          disabled={isDisabled}
          className={`flex-1 min-w-0 flex items-center gap-2 text-left px-2 py-2 rounded-r-lg ${
            isDisabled ? "cursor-not-allowed" : "cursor-pointer"
          }`}
        >
          {multiSelect && (
            <div
              className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                isMultiSelected
                  ? "bg-sky-500 border-sky-500"
                  : "bg-transparent border-gray-500 group-hover:border-gray-300"
              }`}
            >
              {isMultiSelected && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          )}
          <span className="text-base shrink-0" aria-hidden="true">
            {hasChildren ? "📁" : "📄"}
          </span>
          <span
            className={`text-sm truncate ${
              isDisabled
                ? "text-gray-500"
                : isSelected
                  ? "text-white font-medium"
                  : "text-gray-200"
            }`}
          >
            {renderHighlight(section.title, searchTerm, normTerm)}
          </span>
          {reason && (
            <span className="ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 bg-amber-500/15 text-amber-300 rounded shrink-0">
              {reason}
            </span>
          )}
        </button>
      </div>

      {expanded && hasChildren && (
        <div>
          {kids.map((child) => (
            <PickerRow
              key={child.id}
              section={child}
              level={level + 1}
              selection={selection}
              onSelect={onSelect}
              childrenByParent={childrenByParent}
              visibleIds={visibleIds}
              expanded={isExpandedFn(child.id)}
              isExpandedFn={isExpandedFn}
              onToggleCollapse={onToggleCollapse}
              disabledSet={disabledSet}
              disabledReason={disabledReason}
              searchTerm={searchTerm}
              normTerm={normTerm}
              t={t}
              multiSelect={multiSelect}
              multiSelection={multiSelection}
              onToggleMulti={onToggleMulti}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function renderHighlight(text: string, searchTerm: string, normTerm: string): ReactNode {
  if (!searchTerm) return text;
  const normText = normalize(text);
  const idx = normText.indexOf(normTerm);
  if (idx < 0) return text;
  const end = idx + normTerm.length;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-amber-400/30 text-amber-100 rounded px-0.5">
        {text.slice(idx, end)}
      </mark>
      {text.slice(end)}
    </>
  );
}
