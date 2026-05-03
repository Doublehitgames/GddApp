"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";
import { useAuthStore } from "@/store/authStore";
import { PAGE_TYPES } from "@/lib/pageTypes/registry";
import type { PageTypeId } from "@/lib/pageTypes/registry";
import { toSlug, sectionPathById } from "@/lib/utils/slug";

export const QUICK_NEW_PAGE_EVENT = "gdd:open-new-page";

export function openQuickNewPage() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(QUICK_NEW_PAGE_EVENT));
}

function getProjectIdFromPath(pathname: string | null): string | null {
  if (!pathname) return null;
  const match = pathname.match(/^\/projects\/([^/]+)/);
  return match ? match[1] : null;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function QuickNewPageModal() {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const projectId = getProjectIdFromPath(pathname);

  const projects = useProjectStore((s) => s.projects);
  const addSection = useProjectStore((s) => s.addSection);
  const addSubsection = useProjectStore((s) => s.addSubsection);
  const hasDuplicateName = useProjectStore((s) => s.hasDuplicateName);
  const { user, profile } = useAuthStore();
  const sectionAuditBy = user
    ? { userId: user.id, displayName: profile?.display_name ?? user.email ?? null }
    : undefined;

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pageTypeId, setPageTypeId] = useState<PageTypeId>("blank");
  const [parentId, setParentId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const project = useMemo(
    () => (projectId ? projects.find((p) => toSlug(p.title) === projectId) : null),
    [projectId, projects]
  );
  const realProjectId = project?.id ?? "";

  const sectionOptions = useMemo(() => {
    const sections = project?.sections || [];
    return [...sections]
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((s) => ({ id: s.id, title: s.title, depth: 0 }));
  }, [project]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        event.preventDefault();
        setOpen(false);
        return;
      }
      // Trigger with `N` (no modifier, outside input) when inside a project.
      // Also allow Ctrl/Cmd+Shift+N as a modifier-based alternative (Ctrl+N
      // alone is reserved by most browsers for new window).
      const withMod = event.ctrlKey || event.metaKey;
      const isN = event.key === "n" || event.key === "N";
      if (!isN || !projectId) return;
      if (withMod && event.shiftKey) {
        event.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      if (!withMod && !event.altKey && !event.shiftKey && !isEditableTarget(event.target)) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    const openFromEvent = () => {
      if (projectId) setOpen(true);
    };
    window.addEventListener("keydown", handler);
    window.addEventListener(QUICK_NEW_PAGE_EVENT, openFromEvent);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener(QUICK_NEW_PAGE_EVENT, openFromEvent);
    };
  }, [open, projectId]);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setPageTypeId("blank");
      setParentId("");
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const handleSubmit = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!realProjectId) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setError(t("quickNewPage.errors.titleRequired", "Digite um nome para a página."));
      inputRef.current?.focus();
      return;
    }
    if (hasDuplicateName(realProjectId, trimmed, parentId || undefined)) {
      setError(t("quickNewPage.errors.duplicateName", "Já existe uma página com esse nome neste nível. Escolha um nome diferente."));
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const newId = parentId
        ? addSubsection(realProjectId, parentId, trimmed, "", sectionAuditBy, pageTypeId)
        : addSection(realProjectId, trimmed, "", sectionAuditBy, pageTypeId);
      if (!newId) throw new Error("create_failed");
      setOpen(false);
      router.push(sectionPathById(project ?? { title: "", sections: [] }, newId));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("sections_per_project")) {
        setError(t("quickNewPage.errors.limitPerProject", "Limite de páginas por projeto atingido."));
      } else if (msg.includes("sections_total")) {
        setError(t("quickNewPage.errors.limitTotal", "Limite total de páginas da conta atingido."));
      } else {
        setError(t("quickNewPage.errors.generic", "Não foi possível criar a página."));
      }
      setBusy(false);
    }
  };

  if (!open || !projectId) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("quickNewPage.modalTitle", "Nova página")}
      className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-24 bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900/95 shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-semibold text-gray-100">
              {t("quickNewPage.modalTitle", "Nova página")}
            </h2>
            <p className="mt-0.5 text-xs text-gray-400">
              {t("quickNewPage.modalHint", "Atalho: N · Enter para criar · Esc para fechar")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("quickNewPage.close", "Fechar")}
            className="shrink-0 h-8 w-8 rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
          >
            ✕
          </button>
        </header>

        <div className="px-5 py-4 space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-300">
              {t("quickNewPage.titleLabel", "Nome da página")}
            </span>
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError(null);
              }}
              placeholder={t("quickNewPage.titlePlaceholder", "Ex.: Armas de fogo")}
              className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400"
              autoComplete="off"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-300">
              {t("quickNewPage.typeLabel", "Tipo da página")}
            </span>
            <select
              value={pageTypeId}
              onChange={(e) => setPageTypeId(e.target.value as PageTypeId)}
              className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400"
            >
              {PAGE_TYPES.map((pt) => (
                <option key={pt.id} value={pt.id}>
                  {pt.emoji} {pt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-300">
              {t("quickNewPage.parentLabel", "Criar dentro de (opcional)")}
            </span>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400"
            >
              <option value="">{t("quickNewPage.parentRoot", "— Raiz do projeto —")}</option>
              {sectionOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title || s.id}
                </option>
              ))}
            </select>
          </label>

          {error && (
            <p className="text-xs text-red-400" role="alert">
              {error}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-800 bg-gray-900/60 rounded-b-2xl">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
          >
            {t("quickNewPage.cancel", "Cancelar")}
          </button>
          <button
            type="submit"
            disabled={busy || !title.trim()}
            className="rounded-lg border border-indigo-400/60 bg-indigo-600/90 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("quickNewPage.submit", "Criar página")}
          </button>
        </footer>
      </form>
    </div>
  );
}
