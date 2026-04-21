"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { useProjectStore } from "@/store/projectStore";
import type { FieldLibraryEntry } from "@/lib/addons/types";

type LibraryEntry = FieldLibraryEntry & {
  libraryAddonId: string;
  libraryAddonName: string;
  projectId: string;
  sectionTitle: string;
};

/**
 * Walk the global project store to gather every fieldLibrary entry the
 * user could plausibly link this stat to. We don't filter by project
 * here because the stat block doesn't know which project owns it; the
 * picker lists everything and the user picks. Cheap to compute (small
 * arrays) so done synchronously per render.
 */
function useAllLibraryEntries(): LibraryEntry[] {
  const projects = useProjectStore((s) => s.projects);
  return useMemo(() => {
    const out: LibraryEntry[] = [];
    for (const project of projects) {
      for (const section of project.sections || []) {
        for (const addon of section.addons || []) {
          if (addon.type !== "fieldLibrary") continue;
          const entries = (addon.data as { entries?: FieldLibraryEntry[] }).entries;
          if (!Array.isArray(entries)) continue;
          for (const entry of entries) {
            out.push({
              ...entry,
              libraryAddonId: addon.id,
              libraryAddonName: addon.name || "Field Library",
              projectId: project.id as string,
              sectionTitle: section.title || "",
            });
          }
        }
      }
    }
    return out;
  }, [projects]);
}

interface StatRenderProps {
  // BlockNote's render args; we only use a subset, kept loose to avoid
  // dragging the complex generic chain across the file.
  block: { props?: Record<string, unknown> };
  editor: {
    isEditable: boolean;
    updateBlock: (
      block: { props?: Record<string, unknown> },
      next: { type: "stat"; props: Record<string, unknown> },
    ) => void;
  };
}

/** Capitalised wrapper so React's rules-of-hooks accepts the hook calls
 *  inside (BlockNote's `render: ({ block }) => ...` arrow doesn't qualify
 *  as a component by name). */
function StatBlockRender({ block, editor }: StatRenderProps) {
  const props = (block.props || {}) as {
    labelKey?: string;
    valueText?: string;
    modifier?: string;
    libraryAddonId?: string;
    libraryEntryId?: string;
  };
  const editable = editor.isEditable;
  const allEntries = useAllLibraryEntries();

  // If linked to a library entry, prefer its current label/key so
  // renames in the library show up here automatically.
  const linkedEntry = useMemo(() => {
    if (!props.libraryAddonId || !props.libraryEntryId) return null;
    return allEntries.find(
      (e) => e.libraryAddonId === props.libraryAddonId && e.id === props.libraryEntryId,
    ) || null;
  }, [allEntries, props.libraryAddonId, props.libraryEntryId]);

  const displayLabel = linkedEntry?.label || props.labelKey || "";

  const updateProps = (next: Partial<typeof props>) => {
    editor.updateBlock(block, { type: "stat", props: { ...props, ...next } });
  };

  if (!editable) {
    if (!displayLabel && !props.valueText) {
      return (
        <span className="rich-doc-stat-block rich-doc-stat-empty" data-empty="true">
          —
        </span>
      );
    }
    return (
      <span
        className="rich-doc-stat-block"
        title={linkedEntry ? `${linkedEntry.libraryAddonName} · ${linkedEntry.sectionTitle}` : undefined}
      >
        <span className="rich-doc-stat-label">{displayLabel || "?"}</span>
        <span className="rich-doc-stat-sep">:</span>
        <span className="rich-doc-stat-value">{props.valueText || "—"}</span>
        {props.modifier ? (
          <span className="rich-doc-stat-modifier">({props.modifier})</span>
        ) : null}
      </span>
    );
  }

  return (
    <StatBlockEditor
      labelKey={displayLabel}
      valueText={props.valueText || ""}
      modifier={props.modifier || ""}
      linkedEntry={linkedEntry}
      libraryEntries={allEntries}
      onChange={updateProps}
    />
  );
}

export const StatBlock = createReactBlockSpec(
  {
    type: "stat",
    propSchema: {
      labelKey: { default: "" },
      valueText: { default: "" },
      modifier: { default: "" },
      /** Optional pointer to a fieldLibrary entry. When set, the rendered
       *  label tracks the live label from that entry (renames propagate). */
      libraryAddonId: { default: "" },
      libraryEntryId: { default: "" },
    },
    content: "none",
  },
  {
    // BlockNote's render args carry a deep generic chain we don't need
    // to retype; the wrapper component just needs `block` + `editor`.
    render: (renderProps) => <StatBlockRender {...(renderProps as unknown as StatRenderProps)} />,
  },
);

interface StatBlockEditorProps {
  labelKey: string;
  valueText: string;
  modifier: string;
  linkedEntry: LibraryEntry | null;
  libraryEntries: LibraryEntry[];
  onChange: (next: {
    labelKey?: string;
    valueText?: string;
    modifier?: string;
    libraryAddonId?: string;
    libraryEntryId?: string;
  }) => void;
}

function StatBlockEditor({
  labelKey,
  valueText,
  modifier,
  linkedEntry,
  libraryEntries,
  onChange,
}: StatBlockEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const labelInputRef = useRef<HTMLInputElement | null>(null);
  const valueInputRef = useRef<HTMLInputElement | null>(null);

  const filteredEntries = useMemo(() => {
    if (!pickerQuery.trim()) return libraryEntries.slice(0, 50);
    const q = pickerQuery.toLowerCase();
    return libraryEntries
      .filter((e) => e.label.toLowerCase().includes(q) || e.key.toLowerCase().includes(q))
      .slice(0, 50);
  }, [libraryEntries, pickerQuery]);

  // Close picker when clicking outside.
  useEffect(() => {
    if (!pickerOpen) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest(".rich-doc-stat-picker, .rich-doc-stat-picker-trigger")) return;
      setPickerOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [pickerOpen]);

  return (
    <span className="rich-doc-stat-block rich-doc-stat-edit">
      <span className="rich-doc-stat-label-wrap" style={{ position: "relative" }}>
        <input
          ref={labelInputRef}
          className="rich-doc-stat-input rich-doc-stat-input-label"
          placeholder="STR"
          value={labelKey}
          onChange={(e) => onChange({ labelKey: e.target.value, libraryAddonId: "", libraryEntryId: "" })}
          style={{ width: `${Math.max(3, (labelKey?.length || 3) + 1)}ch` }}
        />
        {libraryEntries.length > 0 ? (
          <button
            type="button"
            className="rich-doc-stat-picker-trigger"
            title="Vincular a um campo da Field Library"
            onClick={() => setPickerOpen((v) => !v)}
            data-linked={linkedEntry ? "true" : "false"}
          >
            🔗
          </button>
        ) : null}
        {pickerOpen ? (
          <div className="rich-doc-stat-picker" role="listbox">
            <input
              autoFocus
              className="rich-doc-stat-picker-search"
              placeholder="Procurar campo..."
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
            />
            <div className="rich-doc-stat-picker-list">
              {filteredEntries.length === 0 ? (
                <div className="rich-doc-stat-picker-empty">Nenhum campo encontrado</div>
              ) : (
                filteredEntries.map((entry) => (
                  <button
                    type="button"
                    key={`${entry.libraryAddonId}/${entry.id}`}
                    className="rich-doc-stat-picker-item"
                    onClick={() => {
                      onChange({
                        labelKey: entry.label,
                        libraryAddonId: entry.libraryAddonId,
                        libraryEntryId: entry.id,
                      });
                      setPickerOpen(false);
                      setPickerQuery("");
                      // jump to value field after picking
                      window.setTimeout(() => valueInputRef.current?.focus(), 0);
                    }}
                  >
                    <span className="rich-doc-stat-picker-label">{entry.label}</span>
                    <span className="rich-doc-stat-picker-key">{entry.key}</span>
                    <span className="rich-doc-stat-picker-source">{entry.libraryAddonName}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : null}
      </span>
      <span className="rich-doc-stat-sep">:</span>
      <input
        ref={valueInputRef}
        className="rich-doc-stat-input rich-doc-stat-input-value"
        placeholder="0"
        value={valueText}
        onChange={(e) => onChange({ valueText: e.target.value })}
        style={{ width: `${Math.max(2, (valueText?.length || 2) + 1)}ch` }}
      />
      <input
        className="rich-doc-stat-input rich-doc-stat-input-modifier"
        placeholder="(+0)"
        value={modifier}
        onChange={(e) => onChange({ modifier: e.target.value })}
        style={{ width: `${Math.max(3, (modifier?.length || 3) + 2)}ch` }}
      />
    </span>
  );
}
