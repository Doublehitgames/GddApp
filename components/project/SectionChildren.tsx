"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CoverImage } from "@/components/project/ProjectCover";
import { DomainIcon, domainVisual } from "@/components/project/domainVisual";
import { useI18n } from "@/lib/i18n/provider";
import { parseDeckLayout } from "@/lib/deck/deck";
import { isValidDomainId } from "@/lib/gameDesignDomains";
import { PAGE_STATUS_META } from "@/lib/pageStatus/types";
import { toPreviewText } from "@/lib/richDoc/previewText";
import { sectionPath } from "@/lib/utils/slug";
import { useAuthStore } from "@/store/authStore";
import { useProjectStore } from "@/store/projectStore";
import type { Project, Section } from "@/store/slices/types";

/**
 * A partir de quantas filhas a parede de cartas vira lista.
 *
 * É o contrário do limiar do Deck de propósito: lá a grade é o andar inteiro e
 * só faz sentido quando há muita coisa; aqui as cartas dividem a página com a
 * descrição, e a partir de uma dúzia elas empurram o resto para fora da tela.
 */
const CARD_LIMIT = 12;

/** A busca só aparece quando a lista já não se lê de relance. */
const SEARCH_LIMIT = 8;

type ViewMode = "cards" | "list";

function childrenOf(sections: Section[], parentId: string): Section[] {
  return sections
    .filter((s) => s.parentId === parentId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function categoryOf(section: Section): string {
  return section.domainTags?.find(isValidDomainId) ?? "other";
}

/**
 * As páginas filhas desta, na própria página.
 *
 * Até o redesenho isto morava na sidebar da árvore; sem ela, uma página mãe
 * virava um beco sem saída — dava para subir pelo caminho e não para descer.
 * A escolha entre cartas e lista é a mesma que a página já faz no Deck
 * (`deckLayout`), e a lista é onde se reordena: é a única UI de ordem que o
 * app tem, e essa ordem manda no Modo Doc, no Deck e no export.
 */
export function SectionChildren({ project, section }: { project: Project; section: Section }) {
  const { t } = useI18n();
  const { user, profile } = useAuthStore();
  const addSubsection = useProjectStore((s) => s.addSubsection);
  const reorderSections = useProjectStore((s) => s.reorderSections);
  const auditBy = user ? { userId: user.id, displayName: profile?.display_name ?? user.email ?? null } : undefined;

  const sections = useMemo(() => project.sections ?? [], [project.sections]);
  const children = useMemo(() => childrenOf(sections, section.id), [sections, section.id]);

  const preferred = parseDeckLayout(section.deckLayout);
  const [view, setView] = useState<ViewMode>(() => {
    if (preferred) return preferred === "grid" ? "cards" : "list";
    return children.length > CARD_LIMIT ? "list" : "cards";
  });
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return children;
    return children.filter((c) => `${c.title} ${c.content ?? ""}`.toLowerCase().includes(q));
  }, [children, query]);

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newTitle.trim();
    if (!name) return;
    if (children.some((c) => c.title.trim().toLowerCase() === name.toLowerCase())) {
      setError(t("sectionDetail.children.duplicate", "Já existe uma página filha com esse nome."));
      return;
    }
    try {
      addSubsection(project.id, section.id, name, "", auditBy);
      setNewTitle("");
      setCreating(false);
      setError("");
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("structural_limit")) {
        setError(t("limits.sectionsPerProject"));
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = children.findIndex((c) => c.id === active.id);
    const to = children.findIndex((c) => c.id === over.id);
    if (from === -1 || to === -1) return;
    reorderSections(
      project.id,
      arrayMove(children, from, to).map((c) => c.id)
    );
  };

  const addButton = (
    <button
      type="button"
      onClick={() => setCreating(true)}
      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-dashed border-line-strong px-3 text-sm text-muted transition-colors hover:border-accent hover:text-accent"
    >
      <span className="text-base leading-none">+</span>
      {t("sectionDetail.children.add", "Nova página filha")}
    </button>
  );

  const createForm = (
    <form onSubmit={create} className="flex max-w-md flex-wrap gap-2">
      <input
        autoFocus
        value={newTitle}
        onChange={(e) => {
          setNewTitle(e.target.value);
          setError("");
        }}
        placeholder={t("sectionDetail.children.addPlaceholder", "Nome da página")}
        className="h-9 min-w-0 flex-1 rounded-xl border border-line bg-canvas px-3 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
      />
      <button
        type="submit"
        disabled={!newTitle.trim()}
        className="h-9 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-40"
      >
        {t("docsArea.create", "Criar")}
      </button>
      <button
        type="button"
        onClick={() => {
          setCreating(false);
          setNewTitle("");
          setError("");
        }}
        className="h-9 rounded-xl px-3 text-sm text-muted hover:text-ink"
      >
        {t("common.cancel", "Cancelar")}
      </button>
    </form>
  );

  if (children.length === 0) {
    return (
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-base font-semibold text-ink">{t("sectionDetail.children.title", "Páginas dentro desta")}</h2>
        <p className="mb-3 mt-1 text-sm text-muted">
          {t("sectionDetail.children.empty", "Nada aqui dentro ainda. Uma página filha é um detalhe que merece espaço próprio.")}
        </p>
        {creating ? createForm : addButton}
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="text-base font-semibold text-ink">
          {t("sectionDetail.children.title", "Páginas dentro desta")}
          <span className="ml-1.5 font-normal tabular-nums text-subtle">{children.length}</span>
        </h2>
        <div className="ml-auto flex items-center gap-2">
          {children.length > SEARCH_LIMIT && (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("sectionDetail.children.search", "Filtrar…")}
              className="h-9 w-36 rounded-xl border border-line bg-canvas px-3 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none sm:w-44"
            />
          )}
          <div className="flex rounded-xl border border-line p-0.5" role="group" aria-label={t("sectionDetail.children.viewLabel", "Como mostrar")}>
            <ViewButton active={view === "cards"} onClick={() => setView("cards")} label={t("sectionDetail.children.viewCards", "Cartas")}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                <rect x="3" y="3" width="8" height="8" rx="1.5" />
                <rect x="13" y="3" width="8" height="8" rx="1.5" />
                <rect x="3" y="13" width="8" height="8" rx="1.5" />
                <rect x="13" y="13" width="8" height="8" rx="1.5" />
              </svg>
            </ViewButton>
            <ViewButton active={view === "list"} onClick={() => setView("list")} label={t("sectionDetail.children.viewList", "Lista (arraste para ordenar)")}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </ViewButton>
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">{t("sectionDetail.children.noMatch", "Nenhuma página com esse filtro.")}</p>
      ) : view === "cards" ? (
        <ul className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
          {visible.map((child) => (
            <ChildCard key={child.id} project={project} section={child} sections={sections} />
          ))}
        </ul>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visible.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-1.5">
              {visible.map((child) => (
                <ChildRow
                  key={child.id}
                  project={project}
                  section={child}
                  sections={sections}
                  draggable={!query.trim()}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <div className="mt-3">{creating ? createForm : addButton}</div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  );
}

function ViewButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      aria-label={label}
      className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${
        active ? "bg-accent-soft text-accent" : "text-subtle hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/** Quantas páginas existem dentro desta — só o andar de baixo, que é o que ajuda a decidir se vale entrar. */
function insideCount(sections: Section[], id: string): number {
  return sections.reduce((total, s) => (s.parentId === id ? total + 1 : total), 0);
}

function StatusDot({ section, className = "" }: { section: Section; className?: string }) {
  const { t } = useI18n();
  const meta = section.status ? PAGE_STATUS_META[section.status] : null;
  if (!meta) return null;
  const label = t(meta.labelKey, meta.labelFallback);
  return <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dotClass} ${className}`} title={label} aria-label={label} />;
}

/**
 * A cara da página: a thumb que ela escolheu na biblioteca e, sem thumb, o
 * ícone do domínio. É a mesma imagem que o cabeçalho da página mostra.
 */
function SectionThumb({
  section,
  className,
  iconClassName,
}: {
  section: Section;
  className: string;
  iconClassName: string;
}) {
  const visual = domainVisual(categoryOf(section));
  const icon = (
    <span className={`absolute inset-0 grid place-items-center ${visual.tile}`}>
      <DomainIcon id={categoryOf(section)} className={iconClassName} />
    </span>
  );
  return (
    <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-2 ${className}`}>
      {section.thumbImageUrl ? (
        <CoverImage src={section.thumbImageUrl} alt={section.title} fallback={icon} />
      ) : (
        icon
      )}
    </span>
  );
}

function ChildCard({ project, section, sections }: { project: Project; section: Section; sections: Section[] }) {
  const { t } = useI18n();
  const preview = toPreviewText(section.content ?? "", 110);
  const inside = insideCount(sections, section.id);

  return (
    <li className="group relative flex gap-2.5 rounded-xl border border-line bg-canvas/40 p-2.5 transition-colors hover:border-line-strong hover:bg-surface-2/40">
      <SectionThumb section={section} className="h-10 w-10" iconClassName="h-5 w-5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1.5">
          <StatusDot section={section} className="mt-[5px]" />
          <Link
            href={sectionPath(project, section)}
            className="min-w-0 text-[13px] font-semibold leading-snug text-ink after:absolute after:inset-0 group-hover:text-accent line-clamp-2"
          >
            {section.title}
          </Link>
        </div>
        <p className={`mt-0.5 line-clamp-2 text-[11px] leading-snug ${preview ? "text-muted" : "italic text-subtle"}`}>
          {preview || t("docsArea.noText", "Ainda sem texto.")}
        </p>
        {inside > 0 && (
          <span className="mt-1 block text-[11px] tabular-nums text-subtle">
            {t("sectionDetail.children.inside", "{count} dentro").replace("{count}", String(inside))}
          </span>
        )}
      </div>
    </li>
  );
}

function ChildRow({
  project,
  section,
  sections,
  draggable,
}: {
  project: Project;
  section: Section;
  sections: Section[];
  draggable: boolean;
}) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    disabled: !draggable,
  });
  const inside = insideCount(sections, section.id);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-xl border border-line bg-canvas/40 px-2 py-1.5 transition-colors hover:border-line-strong ${
        isDragging ? "z-10 opacity-80 shadow-lg" : ""
      }`}
    >
      {draggable && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={t("sectionDetail.children.dragAria", "Arraste para reordenar")}
          title={t("sectionDetail.children.dragAria", "Arraste para reordenar")}
          className="grid h-7 w-5 shrink-0 cursor-grab place-items-center text-subtle hover:text-ink active:cursor-grabbing"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
            <circle cx="9" cy="6" r="1.4" />
            <circle cx="15" cy="6" r="1.4" />
            <circle cx="9" cy="12" r="1.4" />
            <circle cx="15" cy="12" r="1.4" />
            <circle cx="9" cy="18" r="1.4" />
            <circle cx="15" cy="18" r="1.4" />
          </svg>
        </button>
      )}
      <SectionThumb section={section} className="h-7 w-7" iconClassName="h-3.5 w-3.5" />
      <StatusDot section={section} />
      <Link href={sectionPath(project, section)} className="min-w-0 flex-1 truncate text-sm text-ink hover:text-accent">
        {section.title}
      </Link>
      {inside > 0 && (
        <span className="shrink-0 rounded-md bg-surface-2 px-1.5 text-[11px] tabular-nums text-subtle">{inside}</span>
      )}
    </li>
  );
}

export default SectionChildren;
