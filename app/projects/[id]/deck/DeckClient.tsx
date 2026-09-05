"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useProjectStore } from "@/store/projectStore";
import { sectionPathById } from "@/lib/utils/slug";
import { useI18n } from "@/lib/i18n/provider";
import { ProjectTopBar } from "@/components/project/ProjectTopBar";
import { PublicShareButton } from "@/components/PublicShareButton";
import SectionDescriptionReadOnly from "@/components/SectionDescriptionReadOnly";
import { isRichDocEmpty } from "@/components/SectionDescriptionEditor";
import DeckCard from "@/components/deck/DeckCard";
import DeckDrawer, { type DeckOpenTarget } from "@/components/deck/DeckDrawer";
import { listStaleSections } from "@/lib/pageStatus/stale";
import { PAGE_STATUS_META, PAGE_STATUSES } from "@/lib/pageStatus/types";
import {
  DECK_STALE_GLYPH,
  DECK_STATUS_GLYPH,
  buildDeckTree,
  caretOffset,
  colorOf,
  columnsForWidth,
  drawerInsertionIndex,
  iconOf,
  isInventory,
  labelOf,
  levelOf,
  pathOf,
  type DeckNode,
  type DeckSection,
} from "@/lib/deck/deck";

interface Props {
  projectId: string;
  publicToken?: string;
}

/**
 * Medidas da grade — as mesmas do CSS, porque o corte na linha é feito em JS.
 *
 * Uma medida só, em qualquer andar: capítulo e item cabem na mesma carta, e o
 * GDD inteiro fica com um ritmo de grade só.
 */
const GRID = { min: 118, gap: 10 };

/** Altura em que a descrição do andar fica dobrada. */
const INTRO_MAX = 104;

/** Cartas empilhadas — o Deck. */
export function IconeDeck({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="4" width="7.5" height="7.5" rx="1.6" />
      <rect x="3" y="14.5" width="7.5" height="5.5" rx="1.6" />
      <rect x="13.5" y="14.5" width="7.5" height="5.5" rx="1.6" />
    </svg>
  );
}

/**
 * Modo Deck: o GDD como um navegador de níveis.
 *
 * A grade mostra as filhas do andar atual (raízes no térreo), e clicar numa
 * carta abre uma gaveta DEPOIS da última carta daquela linha — esquerda navega,
 * direita mostra. Um nível com muitas filhas vira parede de cartas; poucos
 * filhos ficam na lista da gaveta.
 */
export default function DeckClient({ projectId, publicToken }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const getProjectBySlug = useProjectStore((s) => s.getProjectBySlug);
  const projects = useProjectStore((s) => s.projects);

  const [mounted, setMounted] = useState(false);
  const [project, setProject] = useState<any>(null);
  const isPublicMode = Boolean(publicToken);
  const [isPublicLoading, setIsPublicLoading] = useState(Boolean(publicToken));

  /** Andar atual: id da página cujas filhas estão na grade. `null` é o térreo. */
  const [floorId, setFloorId] = useState<string | null>(null);
  /** Carta aberta no andar, e o que a gaveta mostra. */
  const [openId, setOpenId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [contentId, setContentId] = useState<string | null>(null);

  const [gridWidth, setGridWidth] = useState(0);
  const [introOpen, setIntroOpen] = useState(false);
  const [introOverflows, setIntroOverflows] = useState(false);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const introRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || isPublicMode) return;
    setProject(getProjectBySlug(projectId));
  }, [mounted, projectId, projects, getProjectBySlug, isPublicMode]);

  useEffect(() => {
    if (!mounted || !isPublicMode || !publicToken) return;
    let cancelled = false;
    setIsPublicLoading(true);

    (async () => {
      try {
        const response = await fetch(`/api/public/projects/${projectId}?token=${encodeURIComponent(publicToken)}`);
        if (!response.ok) throw new Error("no");
        const payload = await response.json();
        if (!cancelled) setProject(payload?.project || null);
      } catch {
        if (!cancelled) setProject(null);
      } finally {
        if (!cancelled) setIsPublicLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mounted, isPublicMode, publicToken, projectId]);

  const sections: DeckSection[] = useMemo(() => project?.sections || [], [project]);
  const tree = useMemo(() => buildDeckTree(sections), [sections]);
  const staleIds = useMemo(() => listStaleSections(sections as never), [sections]);

  const floor = floorId ? tree.byId.get(floorId) ?? null : null;
  const level = useMemo(() => levelOf(tree, floor), [tree, floor]);
  /** O nivel e um inventario? Nao muda o tamanho da carta — muda a navegacao. */
  const inventario = isInventory(floor, tree);

  const columns = columnsForWidth(gridWidth, GRID.min, GRID.gap);
  const openIndex = openId ? level.findIndex((node) => node.section.id === openId) : -1;
  const contentNode = contentId ? tree.byId.get(contentId) ?? null : null;
  const menuNode = menuId ? tree.byId.get(menuId) ?? null : null;

  /*
   * A grade muda de largura: recontar colunas é o que mantém a gaveta na linha.
   *
   * A medição entra por ref de callback, e não por efeito: a grade só nasce
   * depois que o projeto carrega, e um efeito com lista de dependências perde
   * esse momento — as telas de "carregando" e "projeto não encontrado" rodam o
   * efeito com a ref vazia, e nada mais o dispara. Sem medida, a largura fica
   * em zero, o Deck acha que tem UMA coluna e a gaveta abre no meio da fileira,
   * empurrando o resto da linha para baixo.
   */
  const observerRef = useRef<ResizeObserver | null>(null);
  const measureGrid = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    gridRef.current = node;
    if (!node) return;

    setGridWidth(node.clientWidth);
    const observer = new ResizeObserver(() => setGridWidth(node.clientWidth));
    observer.observe(node);
    observerRef.current = observer;
  }, []);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  /* A descrição do andar só ganha o "ler tudo" quando de fato não coube. */
  useLayoutEffect(() => {
    const element = introRef.current;
    setIntroOverflows(Boolean(element && element.scrollHeight > INTRO_MAX + 8));
  }, [floorId, project]);

  const closeDrawer = useCallback(() => {
    setOpenId(null);
    setMenuId(null);
    setContentId(null);
  }, []);

  const goToFloor = useCallback(
    (nextFloorId: string | null) => {
      setFloorId(nextFloorId);
      closeDrawer();
      setIntroOpen(false);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [closeDrawer]
  );

  const openCard = useCallback(
    (node: DeckNode<DeckSection>) => {
      if (openId === node.section.id) return closeDrawer();
      setOpenId(node.section.id);
      setContentId(node.section.id);
      // Filha que é inventário não cabe na coluna da esquerda: ela vira andar,
      // então a gaveta abre sem menu e oferece a passagem no conteúdo.
      setMenuId(node.children.length && !isInventory(node, tree) ? node.section.id : null);
    },
    [openId, closeDrawer, tree]
  );

  /** Leva o Deck até uma página qualquer: andar do pai, carta aberta nela. */
  const revealSection = useCallback(
    (sectionId: string) => {
      const node = tree.byId.get(sectionId);
      if (!node) return;
      const parent = tree.parentOf.get(sectionId) ?? null;
      const grandParent = parent ? tree.parentOf.get(parent.section.id) ?? null : null;

      // Se o pai é um inventário, o andar é o próprio pai; senão é o avô, e o
      // pai é a carta aberta com a página selecionada no menu.
      if (parent && isInventory(parent, tree)) {
        setFloorId(parent.section.id);
        setOpenId(sectionId);
        setContentId(sectionId);
        setMenuId(node.children.length && !isInventory(node, tree) ? sectionId : null);
      } else if (parent) {
        setFloorId(grandParent ? grandParent.section.id : null);
        setOpenId(parent.section.id);
        setContentId(sectionId);
        setMenuId(parent.section.id);
      } else {
        setFloorId(null);
        setOpenId(sectionId);
        setContentId(sectionId);
        setMenuId(node.children.length && !isInventory(node, tree) ? sectionId : null);
      }
      setIntroOpen(false);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [tree]
  );

  /**
   * A mesma página, vista de outro jeito. Doc e mapa recebem a página em foco
   * pelo `?focus=`, que as duas telas já sabem ler; o editor abre a página pra
   * escrita. No modo público o editor não existe, então nem aparece.
   */
  const openTargets: DeckOpenTarget[] = isPublicMode ? ["doc", "graph"] : ["doc", "graph", "editor"];

  const openIn = useCallback(
    (target: DeckOpenTarget, sectionId: string) => {
      const foco = encodeURIComponent(sectionId);
      if (isPublicMode) {
        const token = encodeURIComponent(publicToken || "");
        const modo = target === "graph" ? "mindmap" : "view";
        router.push(`/s/${token}?mode=${modo}&focus=${foco}`);
        return;
      }
      if (target === "editor") return router.push(sectionPathById(project, sectionId));
      const rota = target === "graph" ? "mindmap" : "view";
      router.push(`/projects/${projectId}/${rota}?focus=${foco}`);
    },
    [isPublicMode, publicToken, project, projectId, router]
  );

  const pickInMenu = useCallback(
    (sectionId: string) => {
      const node = tree.byId.get(sectionId);
      if (!node) return;
      setContentId(sectionId);
      if (node.children.length) setMenuId(sectionId);
    },
    [tree]
  );

  /* Esc fecha a gaveta; sem gaveta aberta, sobe um andar. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (openId) return closeDrawer();
      if (floorId) {
        const parent = tree.parentOf.get(floorId) ?? null;
        goToFloor(parent ? parent.section.id : null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, floorId, tree, closeDrawer, goToFloor]);

  if (!mounted || (isPublicMode && isPublicLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-gray-600">{t("common.loading")}</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-gray-600">
          {isPublicMode ? t("view.publicProjectNotFound") : t("view.projectNotFound")}
        </div>
      </div>
    );
  }

  const trail = floor ? pathOf(tree, floor) : [];
  const floorHasBody =
    floor &&
    (!isRichDocEmpty(floor.section.contentBlocks as never) || Boolean((floor.section.content || "").trim()));

  const cards = level.map((node, index) => {
    const color = colorOf(tree, node);
    const status = node.section.status ? PAGE_STATUS_META[node.section.status] : null;
    return (
      <DeckCard
        key={node.section.id}
        label={labelOf(node.section)}
        icon={iconOf(node.section)}
        color={color}
        statusGlyph={node.section.status ? DECK_STATUS_GLYPH[node.section.status] : undefined}
        statusLabel={status ? t(status.labelKey, status.labelFallback) : undefined}
        staleGlyph={staleIds.has(node.section.id) ? DECK_STALE_GLYPH : undefined}
        staleLabel={t("deck.stale", "pode estar desatualizada")}
        directChildren={node.children.length}
        branchTotal={node.branchTotal}
        directChildrenLabel={t("deck.directChildren", "{{count}} subpáginas diretas").replace(
          "{{count}}",
          String(node.children.length)
        )}
        branchTotalLabel={t("deck.branchTotal", "{{count}} páginas no ramo inteiro").replace(
          "{{count}}",
          String(node.branchTotal)
        )}
        open={openId === node.section.id}
        onClick={() => openCard(node)}
      />
    );
  });

  if (contentNode && openIndex >= 0) {
    cards.splice(
      drawerInsertionIndex(openIndex, columns, level.length),
      0,
      <DeckDrawer
        key="deck-drawer"
        tree={tree}
        content={contentNode}
        menu={menuNode}
        staleIds={staleIds}
        projectId={project.id}
        sections={sections}
        projectTokenSource={project}
        caretLeft={caretOffset(openIndex, columns, gridWidth, GRID.gap)}
        onPick={pickInMenu}
        onBack={(id) => {
          setMenuId(id);
          setContentId(id);
        }}
        onEnterFloor={goToFloor}
        onClose={closeDrawer}
        onReferenceNavigate={revealSection}
        onOpenIn={openIn}
        openTargets={openTargets}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <ProjectTopBar
        icone={<IconeDeck />}
        iconeProjetoUrl={project.iconUrl || project.coverImageUrl}
        titulo={t("deck.title", "Deck")}
        projectSlug={projectId}
        active="deck"
        publicToken={publicToken}
        theme="light"
        posicao="sticky"
        larguraConteudo="max-w-[1180px]"
        badge={
          isPublicMode ? undefined : (
            <PublicShareButton
              shareToken={project?.mindMapSettings?.sharing?.shareToken}
              isPublic={project?.mindMapSettings?.sharing?.isPublic}
              variant="inline"
              theme="light"
            />
          )
        }
      />

      <main className="mx-auto max-w-[1180px] px-5 pb-28 pt-7">
        {/* trilha do andar */}
        <nav className="mb-3.5 flex flex-wrap items-center gap-0.5 text-[13px]">
          <button
            type="button"
            onClick={() => goToFloor(null)}
            className="rounded-md px-1.5 py-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            {t("deck.home", "Deck")}
          </button>
          {trail.map((node, index) => (
            <span key={node.section.id} className="flex items-center gap-0.5">
              <span className="select-none text-gray-400">›</span>
              {index === trail.length - 1 ? (
                <span className="px-1.5 py-1 font-semibold text-gray-900">{labelOf(node.section)}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => goToFloor(node.section.id)}
                  className="rounded-md px-1.5 py-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                >
                  {labelOf(node.section)}
                </button>
              )}
            </span>
          ))}
        </nav>

        <header className="mb-3 flex flex-wrap items-end gap-3">
          <h1 className="text-[25px] font-semibold -tracking-[0.02em] text-gray-900">
            {floor ? labelOf(floor.section) : t("deck.title", "Deck")}
          </h1>
          {!floor && <p className="mb-0.5 text-[13.5px] text-gray-500">{t("deck.rootHint", "Clique numa carta para abrir.")}</p>}
          {inventario && (
            <span className="mb-0.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-emerald-800">
              ▦ {t("deck.inventory", "inventário")}
            </span>
          )}
        </header>

        {/* A página que virou andar não perde o texto dela. */}
        {floor && floorHasBody && (
          <>
            <div
              ref={introRef}
              style={introOpen ? undefined : { maxHeight: INTRO_MAX, overflow: "hidden" }}
              className="relative max-w-[68ch] text-[14.5px] text-gray-700"
            >
              <div className="gdd-light-prose gdd-reading-prose prose max-w-none">
                <SectionDescriptionReadOnly
                  blocks={floor.section.contentBlocks as never}
                  markdown={floor.section.content}
                  projectId={project.id}
                  sections={sections as never}
                  projectTokenSource={project}
                  currentSectionId={floor.section.id}
                  theme="light"
                  onReferenceNavigate={revealSection}
                />
              </div>
              {!introOpen && introOverflows && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-b from-transparent to-white"
                />
              )}
            </div>
            {introOverflows && (
              <button
                type="button"
                onClick={() => setIntroOpen((prev) => !prev)}
                className="mt-0.5 py-1 text-[12.5px] font-semibold text-emerald-800 hover:underline"
              >
                {introOpen ? t("deck.collapse", "recolher ▴") : t("deck.readAll", "ler a página inteira ▾")}
              </button>
            )}
          </>
        )}

        {/* régua + legenda das marcas */}
        <div className="mb-3.5 mt-4 flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400">
          <span>
            {floor
              ? t("deck.levelCount", "{{count}} páginas neste nível").replace("{{count}}", String(level.length))
              : t("deck.rootLevel", "Páginas-raiz")}
          </span>
          <i className="hidden h-px flex-1 bg-gray-200 sm:block" />
          <span className="flex flex-wrap gap-2.5 text-[11.5px] font-medium normal-case tracking-normal">
            {PAGE_STATUSES.map((status) => (
              <span key={status} className="inline-flex items-center gap-1 whitespace-nowrap">
                <b className="text-xs font-bold text-gray-500">{DECK_STATUS_GLYPH[status]}</b>
                {t(PAGE_STATUS_META[status].labelKey, PAGE_STATUS_META[status].labelFallback)}
              </span>
            ))}
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <b className="text-xs font-bold text-gray-500">{DECK_STALE_GLYPH}</b>
              {t("deck.stale", "pode estar desatualizada")}
            </span>
          </span>
        </div>

        {level.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 px-5 py-10 text-center text-sm text-gray-500">
            {t("deck.emptyLevel", "Esta página não tem subpáginas.")}
          </p>
        ) : (
          <div
            ref={measureGrid}
            className="grid items-start"
            style={{
              gap: GRID.gap,
              gridTemplateColumns: `repeat(auto-fill, minmax(${GRID.min}px, 1fr))`,
            }}
          >
            {cards}
          </div>
        )}
      </main>

      <style jsx global>{`
        @keyframes deckDrawerIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
      `}</style>
    </div>
  );
}
