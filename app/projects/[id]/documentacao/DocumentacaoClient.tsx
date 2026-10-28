"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useShellProject } from "@/components/project/useShellProject";
import { DomainIcon, domainVisual } from "@/components/project/domainVisual";
import { CoverImage } from "@/components/project/ProjectCover";
import { IconHome } from "@/components/project/ProjectSidebar";
import { useTimeAgo } from "@/hooks/useTimeAgo";
import { useI18n } from "@/lib/i18n/provider";
import { DOMAIN_I18N_KEYS, isValidDomainId, type GameDesignDomainId } from "@/lib/gameDesignDomains";
import { PAGE_STATUS_META, type PageStatus } from "@/lib/pageStatus/types";
import { toPreviewText } from "@/lib/richDoc/previewText";
import { sectionPath } from "@/lib/utils/slug";
import { useProjectStore } from "@/store/projectStore";
import type { Section } from "@/store/slices/types";

type SortMode = "recent" | "alpha" | "gdd";

/** A categoria de um documento é o primeiro domínio de game design da página. */
function categoryOf(section: Section): GameDesignDomainId {
  const first = section.domainTags?.find(isValidDomainId);
  return first ?? "other";
}

function updatedAt(section: Section): string {
  return section.content_updated_at || section.updated_at || section.created_at;
}

/**
 * A porta de entrada para o conteúdo do GDD: todos os documentos do projeto,
 * filtráveis por categoria, estado e busca.
 */
export default function DocumentacaoClient({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const timeAgo = useTimeAgo();
  const project = useShellProject(projectId);
  const [category, setCategory] = useState<GameDesignDomainId | "all">("all");
  const [status, setStatus] = useState<PageStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("recent");

  const sections = useMemo(() => project?.sections ?? [], [project?.sections]);
  const byId = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<GameDesignDomainId, number>();
    for (const s of sections) counts.set(categoryOf(s), (counts.get(categoryOf(s)) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [sections]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = sections.filter((s) => {
      if (category !== "all" && categoryOf(s) !== category) return false;
      if (status !== "all" && s.status !== status) return false;
      if (q && !`${s.title} ${s.content ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    if (sort === "alpha") return list.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "recent") return list.sort((a, b) => updatedAt(b).localeCompare(updatedAt(a)));
    // ordem do GDD: a árvore em pré-ordem, como no documento
    const rank = new Map<string, number>();
    let i = 0;
    const walk = (parent: string | undefined) => {
      sections
        .filter((s) => (s.parentId ?? undefined) === parent)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .forEach((s) => {
          rank.set(s.id, i++);
          walk(s.id);
        });
    };
    walk(undefined);
    return list.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  }, [sections, category, status, query, sort]);

  if (!project) return null;
  const base = `/projects/${projectId}`;
  const label = (id: GameDesignDomainId) => t(DOMAIN_I18N_KEYS[id], id);

  return (
    <div className="mx-auto max-w-6xl">
      <nav className="mb-4 flex items-center gap-2 text-sm text-muted" aria-label="breadcrumb">
        <Link href={base} className="hover:text-ink" aria-label={t("projectShell.home", "Início")}>
          <IconHome className="h-4 w-4" />
        </Link>
        <span aria-hidden>›</span>
        <span className="text-ink">{t("projectShell.docs", "Documentação")}</span>
      </nav>

      <header className="relative mb-6 overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-area-doc-soft via-surface to-area-vis-soft p-6 md:p-8">
        <BookArt className="pointer-events-none absolute -right-6 -top-4 hidden h-56 w-80 md:block" />
        <div className="relative max-w-xl">
          <h1 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">{t("projectShell.docs", "Documentação")}</h1>
          <p className="mt-2 text-sm text-muted md:text-base">
            {t("docsArea.lead", "Aqui moram as regras, os sistemas e as histórias que explicam como o jogo funciona. Organize as ideias, crie documentos novos e ligue um ao outro.")}
          </p>
          <NewDocumentButton projectId={project.id} projectTitle={project.title} sections={sections} />
        </div>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <CategoryCard
          active={category === "all"}
          onClick={() => setCategory("all")}
          icon={<DomainIcon id="other" className="h-5 w-5" />}
          tile="bg-accent-soft text-accent"
          title={t("docsArea.all", "Todos os documentos")}
          count={sections.length}
        />
        {categoryCounts.map(([id, count]) => (
          <CategoryCard
            key={id}
            active={category === id}
            onClick={() => setCategory(category === id ? "all" : id)}
            icon={<DomainIcon id={id} className="h-5 w-5" />}
            tile={domainVisual(id).tile}
            title={id === "other" ? t("docsArea.uncategorized", "Sem categoria") : label(id)}
            count={count}
          />
        ))}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">{t("docsArea.search", "Buscar documentos")}</span>
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("docsArea.searchPlaceholder", "Buscar documentos…")}
            className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as PageStatus | "all")}
          className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink"
          aria-label={t("docsArea.statusFilter", "Filtrar por estado")}
        >
          <option value="all">{t("docsArea.allStatuses", "Todos os estados")}</option>
          {(Object.keys(PAGE_STATUS_META) as PageStatus[]).map((st) => (
            <option key={st} value={st}>
              {t(PAGE_STATUS_META[st].labelKey, PAGE_STATUS_META[st].labelFallback)}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink"
          aria-label={t("docsArea.sort", "Ordenar")}
        >
          <option value="recent">{t("docsArea.sortRecent", "Mais recentes")}</option>
          <option value="alpha">{t("docsArea.sortAlpha", "A–Z")}</option>
          <option value="gdd">{t("docsArea.sortGdd", "Ordem do GDD")}</option>
        </select>
      </div>

      <h2 className="mb-3 text-base font-semibold text-ink">{t("docsArea.listTitle", "Documentos do projeto")}</h2>
      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong p-10 text-center text-sm text-muted">
          {sections.length === 0
            ? t("docsArea.empty", "Nenhum documento ainda. Comece pelo que você mais tem vontade de escrever.")
            : t("docsArea.noMatch", "Nenhum documento com esses filtros.")}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((section) => (
            <DocumentCard
              key={section.id}
              section={section}
              href={sectionPath(project, section)}
              docHref={`${base}/view#section-${section.id}`}
              parent={section.parentId ? byId.get(section.parentId) : undefined}
              updatedLabel={timeAgo(updatedAt(section))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CategoryCard({ active, onClick, icon, tile, title, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; tile: string; title: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
        active ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-line-strong"
      }`}
    >
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tile}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-medium leading-tight text-ink">{title}</span>
        <span className="block text-xs tabular-nums text-muted">{count}</span>
      </span>
    </button>
  );
}

function DocumentCard({
  section,
  href,
  docHref,
  parent,
  updatedLabel,
}: {
  section: Section;
  href: string;
  docHref: string;
  parent?: Section;
  updatedLabel: string;
}) {
  const { t } = useI18n();
  const category = categoryOf(section);
  const visual = domainVisual(category);
  const preview = toPreviewText(section.content ?? "", 140);
  const tags = (section.domainTags ?? []).filter(isValidDomainId).slice(0, 3);
  const status = section.status ? PAGE_STATUS_META[section.status] : null;

  return (
    <li className="group relative flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-sm transition-colors hover:border-line-strong">
      <div className="mb-3 flex items-center gap-2">
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${visual.tile}`}>
          <DomainIcon id={category} />
        </span>
        <span className={`text-xs font-semibold ${visual.label}`}>
          {category === "other" ? t("docsArea.uncategorized", "Sem categoria") : t(DOMAIN_I18N_KEYS[category], category)}
        </span>
        <CardMenu href={href} docHref={docHref} />
      </div>

      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <Link href={href} className="block text-base font-semibold leading-snug text-ink after:absolute after:inset-0 hover:text-accent">
            {section.title}
          </Link>
          {parent && <span className="mt-0.5 block truncate text-xs text-subtle">{t("docsArea.inside", "em")} {parent.title}</span>}
          <p className={`mt-1.5 line-clamp-2 text-sm ${preview ? "text-muted" : "italic text-subtle"}`}>
            {preview || t("docsArea.noText", "Ainda sem texto.")}
          </p>
        </div>
        {section.thumbImageUrl && (
          <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-surface-2">
            <CoverImage src={section.thumbImageUrl} alt="" />
          </span>
        )}
      </div>

      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${domainVisual(tag).tile}`}>
              {t(DOMAIN_I18N_KEYS[tag], tag)}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center gap-2 pt-4 text-xs text-subtle">
        <span>
          {t("docsArea.updated", "Atualizado")} {updatedLabel}
        </span>
        {status && (
          <span className={`ml-auto rounded-full border px-2 py-0.5 text-[11px] font-medium ${status.badgeClass}`}>
            {t(status.labelKey, status.labelFallback)}
          </span>
        )}
      </div>
    </li>
  );
}

function CardMenu({ href, docHref }: { href: string; docHref: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const item = "block rounded-md px-3 py-2 text-sm text-ink hover:bg-surface-2";
  return (
    <div className="relative z-10 ml-auto" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid h-7 w-7 place-items-center rounded-md text-subtle hover:bg-surface-2 hover:text-ink"
        aria-label={t("docsArea.cardMenu", "Ações do documento")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="19" cy="12" r="1.7" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="ui-menu-pop absolute right-0 top-8 w-48 rounded-xl border border-line bg-surface p-1.5 shadow-xl">
          <Link role="menuitem" href={href} className={item}>
            {t("docsArea.open", "Abrir")}
          </Link>
          <Link role="menuitem" href={docHref} className={item}>
            {t("docsArea.openInDocument", "Ver no documento")}
          </Link>
        </div>
      )}
    </div>
  );
}

function NewDocumentButton({ projectId, projectTitle, sections }: { projectId: string; projectTitle: string; sections: Section[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const addSection = useProjectStore((s) => s.addSection);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent hover:opacity-90"
      >
        <span className="text-base leading-none">+</span>
        {t("docsArea.new", "Novo documento")}
      </button>
    );
  }

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    const name = title.trim();
    if (!name) return;
    if (sections.some((s) => !s.parentId && s.title.trim().toLowerCase() === name.toLowerCase())) {
      setError(t("projectDetail.rootSectionDuplicate", "Já existe um documento com esse nome."));
      return;
    }
    try {
      addSection(projectId, name);
      router.push(sectionPath({ title: projectTitle }, { title: name }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <form onSubmit={create} className="mt-5 flex max-w-md flex-wrap gap-2">
      <input
        autoFocus
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setError("");
        }}
        placeholder={t("docsArea.newPlaceholder", "Nome do documento")}
        className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
      />
      <button type="submit" disabled={!title.trim()} className="h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-40">
        {t("docsArea.create", "Criar")}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-xl px-3 text-sm text-muted hover:text-ink">
        {t("common.cancel", "Cancelar")}
      </button>
      {error && <p className="w-full text-sm text-danger">{error}</p>}
    </form>
  );
}

/** Livro aberto desenhado em código, na cor da área — o mock pede uma ilustração e o app não tem arte. */
function BookArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 220" className={className} aria-hidden>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M40 150 C90 120 140 125 160 140 C180 125 230 120 280 150 L280 188 C230 160 180 165 160 180 C140 165 90 160 40 188 Z" fill="var(--surface)" stroke="var(--area-doc)" strokeWidth="2.5" opacity="0.95" />
        <path d="M160 140 V180" stroke="var(--area-doc)" strokeWidth="2" />
        {[0, 1, 2, 3].map((i) => (
          <g key={i} stroke="var(--area-doc)" strokeOpacity="0.35" strokeWidth="2">
            <path d={`M62 ${156 + i * 7} C90 ${144 + i * 7} 120 ${145 + i * 7} 146 ${152 + i * 7}`} />
            <path d={`M174 ${152 + i * 7} C200 ${145 + i * 7} 230 ${144 + i * 7} 258 ${156 + i * 7}`} />
          </g>
        ))}
        <path d="M196 40 l14 26 -14 26 -14 -26 z" fill="var(--area-vis-soft)" stroke="var(--area-vis)" strokeWidth="2.5" />
        <path d="M196 40 v52 M182 66 h28" stroke="var(--area-vis)" strokeOpacity="0.5" strokeWidth="1.5" />
        {[
          [120, 70, 5],
          [248, 92, 4],
          [150, 40, 3],
          [270, 52, 3],
          [104, 110, 3],
        ].map(([x, y, r], i) => (
          <path key={i} d={`M${x} ${y - r * 2} L${x + r * 0.6} ${y - r * 0.6} L${x + r * 2} ${y} L${x + r * 0.6} ${y + r * 0.6} L${x} ${y + r * 2} L${x - r * 0.6} ${y + r * 0.6} L${x - r * 2} ${y} L${x - r * 0.6} ${y - r * 0.6} Z`} fill="var(--area-lib)" fillOpacity="0.55" />
        ))}
        <path d="M70 150 c-6 -20 4 -34 18 -40 M78 128 c10 -2 18 2 22 10" stroke="var(--area-doc)" strokeWidth="2.5" />
      </g>
    </svg>
  );
}
