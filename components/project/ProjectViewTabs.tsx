"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";

export type ProjectView = "editor" | "doc" | "deck" | "graph";

interface Props {
  /** Slug do projeto. Ignorado em modo publico, que navega por token. */
  projectSlug: string;
  /** Aba destacada. `null` nas telas que nao sao nenhuma das tres (settings, kpi...). */
  active: ProjectView | null;
  /** Token de compartilhamento. Presente = modo publico: sem Editor, rotas via /s/. */
  publicToken?: string;
  /** `light` para as telas claras (doc, mapa), `dark` para a barra do shell. */
  theme?: "light" | "dark";
  className?: string;
}

/**
 * A fita de abas Editor / Doc / Graph, no espirito do Nuclino: rotulo simples e
 * um sublinhado no acento marcando onde voce esta.
 *
 * Existe uma copia so do componente, mas ela e montada em tres barras
 * diferentes — a do shell, a do documento e a do mapa publico. Cada barra
 * continua dona da propria busca; o que se compartilha aqui e a navegacao.
 */
export function ProjectViewTabs({
  projectSlug,
  active,
  publicToken,
  theme = "light",
  className = "",
}: Props) {
  const { t } = useI18n();
  const isPublic = Boolean(publicToken);
  const token = encodeURIComponent(publicToken || "");

  // No modo publico nao existe editor — quem chega pelo link so ve e navega.
  const abas: Array<{ id: ProjectView; label: string; href: string }> = [
    ...(isPublic
      ? []
      : [
          {
            id: "editor" as const,
            label: t("projectTabs.editor", "Editor"),
            href: `/projects/${projectSlug}`,
          },
        ]),
    {
      id: "doc",
      label: t("projectTabs.doc", "Doc"),
      href: isPublic ? `/s/${token}?mode=view` : `/projects/${projectSlug}/view`,
    },
    {
      id: "deck",
      label: t("projectTabs.deck", "Deck"),
      href: isPublic ? `/s/${token}?mode=deck` : `/projects/${projectSlug}/deck`,
    },
    {
      id: "graph",
      label: t("projectTabs.graph", "Graph"),
      href: isPublic ? `/s/${token}?mode=mindmap` : `/projects/${projectSlug}/mindmap`,
    },
  ];

  const isDark = theme === "dark";
  const repouso = isDark
    ? "text-gray-400 hover:text-gray-100"
    : "text-gray-500 hover:text-gray-900";

  return (
    <nav className={`flex shrink-0 items-center gap-1 ${className}`} aria-label={t("projectTabs.label", "Modos do projeto")}>
      {abas.map((aba) => {
        const atual = aba.id === active;
        return (
          <Link
            key={aba.id}
            href={aba.href}
            aria-current={atual ? "page" : undefined}
            className={`relative px-2.5 py-1.5 text-sm font-medium transition-colors ${
              atual ? "text-[#ef5f56]" : repouso
            }`}
          >
            {aba.label}
            <span
              aria-hidden="true"
              className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#ef5f56] transition-opacity ${
                atual ? "opacity-100" : "opacity-0"
              }`}
            />
          </Link>
        );
      })}
    </nav>
  );
}
