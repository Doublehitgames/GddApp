"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";
import { projectPath } from "@/lib/utils/slug";

/**
 * Criar um projeto pede só o nome — e nem isso é obrigatório. O resto vem das
 * perguntas dos Primeiros passos, na home do projeto.
 */
export function NewProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const addProject = useProjectStore((s) => s.addProject);
  const projects = useProjectStore((s) => s.projects);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Só ao abrir: depender de onClose (função nova a cada render) zeraria o campo enquanto se digita.
  useEffect(() => {
    if (!open) return;
    setName("");
    setError("");
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  /** "Projeto sem nome", "Projeto sem nome 2"… — o nome é a rota, não pode repetir. */
  const fallbackName = () => {
    const base = t("newProject.untitled", "Projeto sem nome");
    const taken = new Set(projects.map((p) => p.title.trim().toLowerCase()));
    if (!taken.has(base.toLowerCase())) return base;
    let n = 2;
    while (taken.has(`${base} ${n}`.toLowerCase())) n++;
    return `${base} ${n}`;
  };

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    const title = name.trim() || fallbackName();
    try {
      addProject(title, "");
      onClose();
      router.push(projectPath({ title }));
    } catch (err) {
      const code = err instanceof Error ? err.message : String(err);
      setError(
        code === "duplicate_project_name"
          ? t("newProject.duplicate", "Você já tem um projeto com esse nome.")
          : code === "structural_limit_projects"
            ? t("newProject.limit", "Você chegou ao limite de projetos do seu plano.")
            : code,
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label={t("common.close", "Fechar")} onClick={onClose} />
      <form
        onSubmit={create}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-project-title"
        className="relative w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl"
      >
        <h2 id="new-project-title" className="text-xl font-semibold text-ink">
          {t("newProject.title", "Como o jogo se chama?")}
        </h2>
        <p className="mt-1 text-sm text-muted">{t("newProject.hint", "Pode ser provisório. Se ainda não tem nome, deixe em branco.")}</p>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          placeholder={t("newProject.placeholder", "Nome do jogo")}
          className="mt-4 h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
        />
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-xl px-4 text-sm text-muted hover:text-ink">
            {t("common.cancel", "Cancelar")}
          </button>
          <button type="submit" className="h-10 rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent">
            {t("newProject.create", "Criar projeto")}
          </button>
        </div>
      </form>
    </div>
  );
}
