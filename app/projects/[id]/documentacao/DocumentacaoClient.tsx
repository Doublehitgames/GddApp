"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AreaHeader } from "@/components/project/AreaHeader";
import { IconDoc } from "@/components/project/ProjectSidebar";
import { useShellProject } from "@/components/project/useShellProject";
import { useI18n } from "@/lib/i18n/provider";
import { toPreviewText } from "@/lib/richDoc/previewText";
import { sectionPath } from "@/lib/utils/slug";
import { useProjectStore } from "@/store/projectStore";
import type { Section } from "@/store/slices/types";

/** O índice do GDD: as páginas de cima da árvore, cada uma com o começo do texto. */
export default function DocumentacaoClient({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const project = useShellProject(projectId);
  const addSection = useProjectStore((s) => s.addSection);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  if (!project) return null;

  const sections = project.sections ?? [];
  const roots = sections.filter((s) => !s.parentId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const childrenOf = (id: string) => sections.filter((s) => s.parentId === id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    const name = title.trim();
    if (!name) return;
    if (sections.some((s) => !s.parentId && s.title.trim().toLowerCase() === name.toLowerCase())) {
      setError(t("projectDetail.rootSectionDuplicate", "Já existe uma página com esse nome."));
      return;
    }
    try {
      addSection(project.id, name);
      setTitle("");
      setError("");
      router.push(sectionPath(project, { title: name }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <AreaHeader
        icon={<IconDoc className="h-5 w-5" />}
        tone="doc"
        title={t("projectShell.docs", "Documentação")}
        lead={t("docsArea.lead", "Como o jogo funciona: regras, história, fases. Cada página pode ter subpáginas — a árvore completa fica na barra ao lado.")}
      />

      <form onSubmit={create} className="mb-6 flex max-w-xl gap-2">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError("");
          }}
          placeholder={t("docsArea.newPlaceholder", "Nome da nova página")}
          className="ui-input-dark ui-focus-ring-indigo min-w-0 flex-1 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={!title.trim()}
          className="rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-40"
        >
          {t("docsArea.create", "Criar página")}
        </button>
      </form>
      {error && <p className="-mt-4 mb-4 text-sm text-danger">{error}</p>}

      {roots.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-sm text-muted">
          {t("docsArea.empty", "Nenhuma página ainda. Comece pela que você mais tem vontade de escrever.")}
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {roots.map((section) => (
            <RootCard key={section.id} href={sectionPath(project, section)} section={section} kids={childrenOf(section.id)} projectTitle={project.title} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RootCard({ href, section, kids, projectTitle }: { href: string; section: Section; kids: Section[]; projectTitle: string }) {
  const { t } = useI18n();
  const preview = toPreviewText(section.content ?? "", 180);
  return (
    <li className="flex flex-col rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong">
      <Link href={href} className="text-base font-semibold text-ink hover:text-accent">
        {section.title}
      </Link>
      <p className={`mt-1 line-clamp-3 text-sm ${preview ? "text-muted" : "italic text-subtle"}`}>
        {preview || t("docsArea.noText", "Ainda sem texto.")}
      </p>
      {kids.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
          {kids.slice(0, 6).map((kid) => (
            <Link
              key={kid.id}
              href={sectionPath({ title: projectTitle }, kid)}
              className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-ink-2 hover:text-ink"
            >
              {kid.title}
            </Link>
          ))}
          {kids.length > 6 && <span className="px-1 text-xs text-subtle">+{kids.length - 6}</span>}
        </div>
      )}
    </li>
  );
}
