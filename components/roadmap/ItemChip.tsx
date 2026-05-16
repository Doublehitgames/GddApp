"use client";

import { useEffect, useRef, useState } from "react";
import type { RoadmapItem, ItemStatus, RoadmapItemTag } from "@/lib/roadmap/types";
import { ITEM_TAGS, ITEM_TAG_CONFIG } from "@/lib/roadmap/types";
import { CommitTextInput, CommitTextarea } from "@/components/common/CommitInput";
import { MarkdownContent } from "@/components/common/MarkdownContent";
import { useI18n } from "@/lib/i18n/provider";

interface Props {
  item: RoadmapItem;
  onUpdate: (patch: Partial<Pick<RoadmapItem, "title" | "description" | "thumbUrl" | "tag" | "status" | "isPublic">>) => void;
  onDelete: () => void;
  /** DnD drag handle — passed from SortableItemWrapper in RoadmapGrid */
  dragHandleListeners?: Record<string, unknown>;
  dragHandleAttributes?: Record<string, unknown>;
}

const STATUS_CYCLE: ItemStatus[] = ["planned", "in_progress", "done", "cut"];

export const STATUS_STYLES: Record<ItemStatus, { dot: string; chip: string; text: string }> = {
  planned:     { dot: "bg-slate-500",   chip: "border-slate-700/60 bg-slate-800/60",       text: "text-slate-300" },
  in_progress: { dot: "bg-sky-400",     chip: "border-sky-700/50 bg-sky-950/60",            text: "text-sky-200" },
  done:        { dot: "bg-emerald-400", chip: "border-emerald-800/50 bg-emerald-950/50",    text: "text-emerald-300 line-through opacity-60" },
  cut:         { dot: "bg-rose-500",    chip: "border-rose-800/40 bg-rose-950/30",          text: "text-rose-400 line-through opacity-50" },
};

export default function ItemChip({ item, onUpdate, onDelete, dragHandleListeners, dragHandleAttributes }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [descTab, setDescTab] = useState<"write" | "preview">("write");
  const popoverRef = useRef<HTMLDivElement>(null);
  const style = STATUS_STYLES[item.status];
  const tagCfg = item.tag ? ITEM_TAG_CONFIG[item.tag] : null;

  useEffect(() => {
    if (!open) return;
    let mousedownInside = false;
    const onMouseDown = (e: MouseEvent) => {
      mousedownInside = !!popoverRef.current?.contains(e.target as Node);
    };
    const onMouseUp = (e: MouseEvent) => {
      if (mousedownInside) return;
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [open]);

  function cycleStatus(e: React.MouseEvent) {
    e.stopPropagation();
    const idx = STATUS_CYCLE.indexOf(item.status);
    onUpdate({ status: STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length] });
  }

  async function handlePickThumb() {
    const { openGoogleDriveImagePicker, driveFileIdToImageUrl } = await import("@/lib/googleDrivePicker");
    const picked = await openGoogleDriveImagePicker();
    if (!picked?.id) return;
    onUpdate({ thumbUrl: driveFileIdToImageUrl(picked.id) });
  }

  return (
    <div ref={popoverRef} className="relative">
      {/* Chip row */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => e.key === "Enter" && setOpen((v) => !v)}
        title={item.title || undefined}
        className={`group w-full flex items-start gap-1.5 rounded-lg border px-2 py-1.5 cursor-pointer transition-all duration-150 hover:brightness-110 ${style.chip}`}
      >
        {/* Drag handle */}
        {dragHandleListeners && (
          <button
            type="button"
            {...(dragHandleListeners as React.HTMLAttributes<HTMLButtonElement>)}
            {...(dragHandleAttributes as React.HTMLAttributes<HTMLButtonElement>)}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 shrink-0 cursor-grab active:cursor-grabbing text-gray-700 hover:text-gray-500 touch-none"
            tabIndex={-1}
          >
            <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/>
            </svg>
          </button>
        )}

        {/* Tag badge */}
        {tagCfg && (
          <span className={`shrink-0 inline-flex items-center rounded px-1 text-[9px] font-bold leading-4 ${tagCfg.chipStyle}`}>
            {tagCfg.label}
          </span>
        )}

        {/* Title */}
        <span className={`flex-1 min-w-0 text-xs leading-snug truncate ${style.text}`}>
          {item.title || t("roadmap.item.titlePlaceholder")}
        </span>

        {/* Private icon */}
        {!item.isPublic && (
          <svg className="mt-0.5 h-2.5 w-2.5 shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
        )}
      </div>

      {/* Detail popover */}
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-[640px] rounded-xl border border-gray-700 bg-gray-900 shadow-2xl p-3 flex flex-col gap-2.5">

          {/* Top row: thumb (left) + title/status/tags (right) */}
          <div className="flex gap-3">

            {/* Left: Thumbnail */}
            <div
              role="button"
              tabIndex={0}
              onClick={handlePickThumb}
              onKeyDown={(e) => e.key === "Enter" && handlePickThumb()}
              title={item.thumbUrl ? t("roadmap.item.changeThumb") : t("roadmap.item.addThumb")}
              className="relative shrink-0 w-28 h-28 rounded-lg border border-gray-700 bg-gray-800/50 overflow-hidden flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-gray-500 hover:bg-gray-800 transition-colors group/thumb"
            >
              {item.thumbUrl ? (
                <>
                  <img src={item.thumbUrl} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onUpdate({ thumbUrl: undefined }); }}
                    className="absolute top-1 right-1 rounded-full bg-gray-900/80 p-0.5 text-gray-400 hover:text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                    title={t("roadmap.item.removeThumb")}
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </>
              ) : (
                <>
                  <svg className="h-6 w-6 text-gray-600 group-hover/thumb:text-gray-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-[10px] text-gray-600 group-hover/thumb:text-gray-400 text-center leading-tight px-2 transition-colors">
                    {t("roadmap.item.addThumb")}
                  </span>
                </>
              )}
            </div>

            {/* Right: title + status + tags */}
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              <CommitTextInput
                value={item.title}
                onCommit={(v) => onUpdate({ title: v })}
                autoFocus
                className="w-full bg-gray-800 rounded-lg border border-gray-700 px-2.5 py-1.5 text-sm text-white outline-none focus:border-gray-500 placeholder-gray-600"
                placeholder={t("roadmap.item.titlePlaceholder")}
              />

              {/* Status buttons */}
              <div className="flex flex-wrap gap-1">
                {STATUS_CYCLE.map((s) => {
                  const ss = STATUS_STYLES[s];
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onUpdate({ status: s })}
                      className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                        item.status === s ? ss.chip + " " + ss.text.split(" ")[0] : "border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${ss.dot}`} />
                      {t("roadmap.status." + s)}
                    </button>
                  );
                })}
              </div>

              {/* Tag picker */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                  {t("roadmap.item.tagLabel")}
                </label>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => onUpdate({ tag: undefined })}
                    className={`rounded border px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                      !item.tag
                        ? "border-gray-500 bg-gray-700 text-gray-200"
                        : "border-gray-700 text-gray-600 hover:border-gray-600 hover:text-gray-400"
                    }`}
                  >
                    —
                  </button>
                  {ITEM_TAGS.map((tag) => {
                    const cfg = ITEM_TAG_CONFIG[tag];
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => onUpdate({ tag: item.tag === tag ? undefined : tag })}
                        className={`rounded border px-1.5 py-0.5 text-[10px] font-bold transition-colors ${
                          item.tag === tag ? cfg.style : "border-gray-700 text-gray-600 hover:border-gray-600 hover:text-gray-400"
                        }`}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>{/* end tag picker */}
            </div>{/* end right column */}
          </div>{/* end top row */}

          {/* Description */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                {t("roadmap.item.descriptionLabel")}
              </label>
              <div className="flex rounded-md overflow-hidden border border-gray-700 text-[10px]">
                <button
                  type="button"
                  onClick={() => setDescTab("write")}
                  className={`px-2 py-0.5 transition-colors ${descTab === "write" ? "bg-gray-700 text-gray-200" : "text-gray-500 hover:text-gray-300"}`}
                >
                  {t("common.tabWrite")}
                </button>
                <button
                  type="button"
                  onClick={() => setDescTab("preview")}
                  className={`px-2 py-0.5 transition-colors ${descTab === "preview" ? "bg-gray-700 text-gray-200" : "text-gray-500 hover:text-gray-300"}`}
                >
                  {t("common.tabPreview")}
                </button>
              </div>
            </div>
            {descTab === "write" ? (
              <CommitTextarea
                value={item.description ?? ""}
                onCommit={(v) => onUpdate({ description: v || undefined })}
                rows={5}
                placeholder={t("roadmap.item.descriptionPlaceholder")}
                className="w-full bg-gray-800 rounded-lg border border-gray-700 px-2.5 py-1.5 text-xs text-gray-300 outline-none focus:border-gray-500 placeholder-gray-600 resize-y leading-relaxed min-h-[80px]"
              />
            ) : (
              <div className="min-h-[80px] rounded-lg border border-gray-700 bg-gray-800/50 px-2.5 py-1.5">
                {item.description ? (
                  <MarkdownContent theme="dark">{item.description}</MarkdownContent>
                ) : (
                  <p className="text-xs text-gray-600 italic">{t("roadmap.item.descriptionPlaceholder")}</p>
                )}
              </div>
            )}
          </div>

          {/* Footer: public toggle + delete */}
          <div className="flex items-center justify-between pt-0.5">
            <button
              type="button"
              onClick={() => onUpdate({ isPublic: !item.isPublic })}
              className={`flex items-center gap-1.5 text-xs transition-colors ${item.isPublic ? "text-emerald-400 hover:text-emerald-200" : "text-gray-600 hover:text-gray-400"}`}
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {item.isPublic
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                }
              </svg>
              {item.isPublic ? t("roadmap.item.public") : t("roadmap.item.private")}
            </button>
            <button
              type="button"
              onClick={() => { onDelete(); setOpen(false); }}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-rose-400 transition-colors"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {t("roadmap.item.delete")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
