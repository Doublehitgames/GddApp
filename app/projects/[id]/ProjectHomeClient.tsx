"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProjectCover } from "@/components/project/ProjectCover";
import { DomainIcon, domainVisual } from "@/components/project/domainVisual";
import { IconDoc, IconLibrary, IconSystems, IconVision } from "@/components/project/ProjectSidebar";
import { CoverImage } from "@/components/project/ProjectCover";
import { useShellProject } from "@/components/project/useShellProject";
import { useTimeAgo } from "@/hooks/useTimeAgo";
import { DOMAIN_I18N_KEYS, type GameDesignDomainId } from "@/lib/gameDesignDomains";
import { useI18n } from "@/lib/i18n/provider";
import { isValidDomainId } from "@/lib/gameDesignDomains";
import { toPreviewText } from "@/lib/richDoc/previewText";
import { sectionPath } from "@/lib/utils/slug";
import { useProjectStore } from "@/store/projectStore";
import type { Project, ProjectVision, Section } from "@/store/slices/types";
import { extractSectionReferences, findSection, validateReferences } from "@/utils/sectionReferences";
import { StarterDrawer, areaLabel, areaProgress, starterHref } from "@/components/onboarding/StarterDrawer";
import { STARTER_AREAS, type StarterArea } from "@/lib/onboarding/starterQuestions";

const visionOf = (project: Project): ProjectVision => project.vision ?? {};

const PILLAR_DOTS = ["bg-red-500", "bg-amber-500", "bg-sky-500", "bg-emerald-500", "bg-violet-500", "bg-pink-500"];
const PILLAR_SOFT = [
  "bg-red-50 dark:bg-red-950/40",
  "bg-amber-50 dark:bg-amber-950/40",
  "bg-sky-50 dark:bg-sky-950/40",
  "bg-emerald-50 dark:bg-emerald-950/40",
  "bg-violet-50 dark:bg-violet-950/40",
  "bg-pink-50 dark:bg-pink-950/40",
];

const AREA_TONE: Record<StarterArea, string> = {
  vision: "bg-area-vis-soft text-area-vis",
  docs: "bg-area-doc-soft text-area-doc",
  library: "bg-area-lib-soft text-area-lib",
  systems: "bg-area-sys-soft text-area-sys",
};
const AREA_ICON: Record<StarterArea, React.ReactNode> = {
  vision: <IconVision className="h-4 w-4" />,
  docs: <IconDoc className="h-4 w-4" />,
  library: <IconLibrary className="h-4 w-4" />,
  systems: <IconSystems className="h-4 w-4" />,
};

/**
 * Primeiros passos: as perguntas por área. A Visão vem primeiro; as outras
 * abrem quando ela foi respondida ou pulada. Some quando tudo foi visto — o
 * contador não pode virar uma métrica eterna.
 */
function FirstStepsCard({ project, slug }: { project: Project; slug: string }) {
  const { t } = useI18n();
  if (project.vision?.starter?.doneAt) {
    return (
      <div className="rounded-2xl bg-accent-soft p-5">
        <h2 className="text-base font-semibold text-ink">{t("projectHome.stepsDoneTitle", "Primeiros passos feitos")}</h2>
        <p className="mt-1 text-sm text-ink-2">{t("projectHome.stepsDoneText", "As perguntas iniciais já foram vistas. Daqui em diante, o GDD é seu.")}</p>
      </div>
    );
  }
  const visionDone = areaProgress(project, "vision").done;
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-base font-semibold text-ink">{t("projectHome.firstSteps", "Primeiros passos")}</h2>
      <p className="mt-1 text-sm text-muted">{t("projectHome.firstStepsLead", "Perguntas para o GDD começar. Não é o fim: depois daqui, continue como quiser.")}</p>
      <ul className="mt-3 flex flex-col gap-1">
        {STARTER_AREAS.map((area) => {
          const p = areaProgress(project, area);
          const locked = area !== "vision" && !visionDone;
          const isNext = !locked && !p.done && (area === "vision" || STARTER_AREAS.slice(0, STARTER_AREAS.indexOf(area)).every((a) => areaProgress(project, a).done));
          const body = (
            <>
              <span className={`grid h-8 w-8 place-items-center rounded-lg ${AREA_TONE[area]}`}>{AREA_ICON[area]}</span>
              <span className="min-w-0 flex-1 text-sm text-ink">
                {areaLabel(area, t)}
                <span className="block text-xs text-muted">
                  {locked ? t("projectHome.stepAfter", "Depois da Visão") : p.done ? t("projectHome.stepDone", "Feito — dá para voltar e mudar") : area === "vision" ? t("projectHome.stepIdea", "A ideia do jogo") : t("projectHome.stepNext", "Próximo passo")}
                </span>
              </span>
              {isNext && p.answered === 0 && area === "vision" ? (
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent">{t("projectHome.startHere", "Comece aqui")}</span>
              ) : (
                <span className="text-xs tabular-nums text-muted">
                  {p.answered}/{p.total}
                </span>
              )}
            </>
          );
          return (
            <li key={area}>
              {locked ? (
                <span className="flex items-center gap-3 rounded-xl p-2 opacity-60">{body}</span>
              ) : (
                <Link href={starterHref(slug, area)} scroll={false} className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface-2">
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * A home do projeto mostra o jogo — capa, pilares, documentos — e não números
 * sobre o app. Projeto vazio ganha boas-vindas e três jeitos de começar.
 */
export default function ProjectHomeClient({ projectId }: { projectId: string }) {
  const project = useShellProject(projectId);
  if (!project) return null;
  const v = visionOf(project);
  const isNew = (project.sections?.length ?? 0) === 0 && !v.logline && !(v.pillars?.length);
  return (
    <>
      {isNew ? <NewProjectHome project={project} slug={projectId} /> : <GameHome project={project} slug={projectId} />}
      <Suspense fallback={null}>
        <StarterDrawer project={project} />
      </Suspense>
    </>
  );
}

function categoryOf(section: Section): GameDesignDomainId {
  return section.domainTags?.find(isValidDomainId) ?? "other";
}

const byOrder = (a: Section, b: Section) => (a.order ?? 0) - (b.order ?? 0);
const hasText = (s: Section) => !!(s.content ?? "").trim();

const MECHANIC_DOMAINS: GameDesignDomainId[] = ["combat", "progression", "crafting", "economy", "ui", "technology"];

/** As ligações entre páginas, tiradas das refs $[...] — o esboço do diagrama de sistemas. */
function pageLinks(sections: Section[]) {
  const pairs = new Map<string, { from: Section; to: Section }>();
  const degree = new Map<string, number>();
  for (const s of sections) {
    for (const ref of extractSectionReferences(s.content ?? "")) {
      const target = findSection(sections, ref) as Section | null;
      if (!target || target.id === s.id) continue;
      const key = `${s.id}>${target.id}`;
      if (pairs.has(key)) continue;
      pairs.set(key, { from: s, to: target });
      degree.set(s.id, (degree.get(s.id) ?? 0) + 1);
      degree.set(target.id, (degree.get(target.id) ?? 0) + 1);
    }
  }
  return { links: [...pairs.values()], connected: degree.size };
}

function GameHome({ project, slug }: { project: Project; slug: string }) {
  const { t } = useI18n();
  const base = `/projects/${slug}`;
  const v = visionOf(project);
  const sections = useMemo(() => project.sections ?? [], [project.sections]);
  const logline = v.logline?.trim() || toPreviewText(project.description ?? "", 220);
  const { links, connected } = useMemo(() => pageLinks(sections), [sections]);
  const inDomain = (ids: GameDesignDomainId[]) => sections.filter((s) => ids.includes(categoryOf(s))).sort(byOrder);
  const label = (id: GameDesignDomainId) => t(DOMAIN_I18N_KEYS[id], id);

  const topDomains = useMemo(() => {
    const counts = new Map<GameDesignDomainId, number>();
    for (const s of sections) {
      const c = categoryOf(s);
      if (c !== "other") counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id);
  }, [sections]);

  const vision = areaProgress(project, "vision");
  const written = sections.filter(hasText).length;
  const docs = documentation(sections);

  return (
    <div className="grid w-full items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-5">
        <ProjectCover project={project} className="min-h-[188px]">
          <div className="flex w-full flex-wrap items-start gap-4 p-6 md:p-7">
            <div className="flex max-w-2xl flex-col gap-2.5">
              <h1 className="text-3xl font-bold leading-tight md:text-[2.5rem]">{project.title}</h1>
              {logline && <p className="max-w-[60ch] text-[15px] text-white/85">{logline}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                {[v.genre?.trim(), ...topDomains.map(label)].filter(Boolean).map((tag) => (
                  <span key={tag} className="rounded-full border border-white/25 bg-white/12 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <Link href={`${base}/visao`} className="ml-auto rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#1d1a2b] hover:bg-white">
              {t("projectHome.editVision", "Editar a visão")}
            </Link>
          </div>
        </ProjectCover>

        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          <AreaStat href={`${base}/visao`} tone="vis" icon={<IconVision className="h-5 w-5" />} title={t("projectShell.vision", "Visão do jogo")} text={t("projectHome.statVision", "Conceito, pilares e sensação.")} value={vision.answered} total={vision.total} />
          <AreaStat href={`${base}/documentacao`} tone="doc" icon={<IconDoc className="h-5 w-5" />} title={t("projectShell.docs", "Documentação")} text={t("projectHome.statDocs", "Documentos com texto escrito.")} value={written} total={sections.length} />
          <AreaStat href={`${base}/biblioteca`} tone="lib" icon={<IconLibrary className="h-5 w-5" />} title={t("projectShell.library", "Biblioteca do jogo")} text={t("projectHome.statLibrary", "Itens, personagens e números.")} soon={t("projectShell.soon", "em breve")} />
          <AreaStat href={`${base}/sistemas`} tone="sys" icon={<IconSystems className="h-5 w-5" />} title={t("projectShell.systems", "Sistemas e relações")} text={t("projectHome.statSystems", "Páginas ligadas umas às outras.")} value={connected} total={sections.length} />
        </div>

        <section className="rounded-2xl border border-line bg-surface p-5 md:p-6">
          <div className="mb-5 flex flex-wrap items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-on-accent">
              <IconVision className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold text-ink">{t("projectHome.overview", "Visão geral")}</h2>
              <p className="mt-0.5 max-w-2xl text-sm text-muted">{t("projectHome.overviewLead", "Como o jogo se monta: os pilares, as mecânicas, quem vive nele e onde tudo acontece.")}</p>
            </div>
            <Link href={`${base}/mindmap`} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-2">
              {t("projectHome.fullMap", "Ver mapa completo")} ›
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            <OverviewCard title={t("projectHome.pillars", "Pilares de design")} lead={t("projectHome.pillarsLead", "As regras que decidem as brigas de design.")} icon={<IconVision className="h-4 w-4" />} tone="bg-area-vis-soft text-area-vis" footer={<Link href={`${base}/visao`} className="text-xs font-medium text-accent hover:underline">{t("projectHome.edit", "Editar")}</Link>}>
              {v.pillars?.length ? (
                <ul className="flex flex-col gap-1.5">
                  {v.pillars.map((pillar, i) => (
                    <li key={`${pillar}-${i}`} className={`relative overflow-hidden rounded-lg ${PILLAR_SOFT[i % PILLAR_SOFT.length]} py-2 pl-4 pr-3 text-sm font-medium text-ink`}>
                      <span className={`absolute inset-y-0 left-0 w-1 ${PILLAR_DOTS[i % PILLAR_DOTS.length]}`} aria-hidden />
                      <span className="mr-1.5 text-xs font-bold tabular-nums text-muted">{String(i + 1).padStart(2, "0")}</span>
                      {pillar}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyHint href={starterHref(slug, "vision")} text={t("projectHome.pillarsInvite", "Quais são as 3 ou 4 regras que decidem as brigas de design do seu jogo?")} action={t("projectHome.answer", "Responder")} />
              )}
            </OverviewCard>

            <OverviewCard title={t("projectHome.mechanics", "Mecânicas principais")} lead={t("projectHome.mechanicsLead", "As regras que definem como o jogo funciona.")} icon={<DomainIcon id="combat" className="h-4 w-4" />} tone={domainVisual("combat").tile} footer={<SeeAll href={`${base}/documentacao`} />}>
              <DocRows items={inDomain(MECHANIC_DOMAINS).slice(0, 5)} project={project} empty={t("projectHome.mechanicsEmpty", "Combate, progressão, economia… as páginas dessas categorias aparecem aqui.")} />
            </OverviewCard>

            <OverviewCard title={t("projectHome.characters", "Personagens")} lead={t("projectHome.charactersLead", "Protagonistas, aliados e quem fica no caminho.")} icon={<DomainIcon id="characters" className="h-4 w-4" />} tone={domainVisual("characters").tile} footer={<SeeAll href={`${base}/documentacao`} />}>
              <Avatars items={inDomain(["characters"]).slice(0, 4)} project={project} empty={t("projectHome.charactersEmpty", "Marque uma página com a categoria Personagens e ela aparece aqui.")} />
            </OverviewCard>

            <OverviewCard title={t("projectHome.items", "Itens e recursos")} lead={t("projectHome.itemsLead", "O que o jogador coleta, usa e gasta.")} icon={<DomainIcon id="items" className="h-4 w-4" />} tone={domainVisual("items").tile} footer={<SeeAll href={`${base}/documentacao`} />}>
              <Tiles items={inDomain(["items"]).slice(0, 4)} project={project} empty={t("projectHome.itemsEmpty", "Itens e recursos aparecem aqui — e viram coleção quando a Biblioteca chegar.")} />
            </OverviewCard>

            <OverviewCard title={t("projectHome.places", "Locais e fases")} lead={t("projectHome.placesLead", "Mundos, regiões e cenários do jogo.")} icon={<DomainIcon id="world" className="h-4 w-4" />} tone={domainVisual("world").tile} footer={<SeeAll href={`${base}/documentacao`} />}>
              <Tiles items={inDomain(["world"]).slice(0, 3)} project={project} wide empty={t("projectHome.placesEmpty", "Marque uma página com a categoria Mundo e ela aparece aqui.")} />
            </OverviewCard>

            <OverviewCard title={t("projectHome.narrative", "Narrativa")} lead={t("projectHome.narrativeLead", "A história e quem a conta.")} icon={<DomainIcon id="narrative" className="h-4 w-4" />} tone={domainVisual("narrative").tile}>
              <NarrativeTeaser section={inDomain(["narrative"])[0]} project={project} empty={t("projectHome.narrativeEmpty", "Escreva a história numa página com a categoria Narrativa.")} />
            </OverviewCard>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-area-sys-soft text-area-sys">
              <IconSystems className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-ink">{t("projectHome.connections", "Conexões entre páginas")}</h2>
              <p className="text-xs text-muted">{t("projectHome.connectionsLead", "Quem cita quem, pelas referências $[...] do texto.")}</p>
            </div>
            <Link href={`${base}/mindmap`} className="text-sm font-medium text-accent hover:underline">
              {t("projectHome.fullMap", "Ver mapa completo")}
            </Link>
          </div>
          {links.length ? (
            <ul className="flex flex-wrap gap-x-6 gap-y-3">
              {links.slice(0, 8).map(({ from, to }) => (
                <li key={`${from.id}>${to.id}`} className="flex items-center gap-2 text-sm">
                  <PageChip section={from} project={project} />
                  <span className="text-subtle" aria-hidden>→</span>
                  <PageChip section={to} project={project} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{t("projectHome.connectionsEmpty", "Cite uma página dentro de outra escrevendo $[Nome da página] e a ligação aparece aqui.")}</p>
          )}
        </section>
      </div>

      <aside className="flex flex-col gap-5">
        <FirstStepsCard project={project} slug={slug} />
        <LooseEnds project={project} slug={slug} />
        <RecentDocs items={docs.recent} project={project} slug={slug} />
      </aside>
    </div>
  );
}

function documentation(sections: Section[]) {
  const when = (s: Section) => s.content_updated_at || s.updated_at || s.created_at;
  return { recent: [...sections].sort((a, b) => when(b).localeCompare(when(a))).slice(0, 5).map((s) => ({ section: s, at: when(s) })) };
}

function AreaStat({ href, tone, icon, title, text, value, total, soon }: { href: string; tone: "vis" | "doc" | "lib" | "sys"; icon: React.ReactNode; title: string; text: string; value?: number; total?: number; soon?: string }) {
  const tile = { vis: "bg-area-vis text-white", doc: "bg-area-doc text-white", lib: "bg-area-lib text-white", sys: "bg-area-sys text-white" }[tone];
  const bar = { vis: "bg-area-vis", doc: "bg-area-doc", lib: "bg-area-lib", sys: "bg-area-sys" }[tone];
  const pct = total ? Math.round(((value ?? 0) / total) * 100) : 0;
  return (
    <Link href={href} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong">
      <div className="flex items-start gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tile}`}>{icon}</span>
        <span className="min-w-0">
          <strong className="block text-sm text-ink">{title}</strong>
          <span className="block text-xs text-muted">{text}</span>
        </span>
      </div>
      <div className="flex items-center gap-3">
        {soon ? (
          <>
            <span className="h-1.5 flex-1 rounded-full border border-dashed border-line-strong" />
            <span className="text-[11px] text-subtle">{soon}</span>
          </>
        ) : (
          <>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <span className={`block h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
            </span>
            <span className="text-xs tabular-nums text-muted">
              {value}/{total}
            </span>
          </>
        )}
      </div>
    </Link>
  );
}

function OverviewCard({ title, lead, icon, tone, footer, children }: { title: string; lead: string; icon: React.ReactNode; tone: string; footer?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-line p-4">
      <div className="mb-1 flex items-center gap-2.5">
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${tone}`}>{icon}</span>
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      </div>
      <p className="mb-3 text-xs text-muted">{lead}</p>
      <div className="flex-1">{children}</div>
      {footer && <div className="mt-3 flex justify-end">{footer}</div>}
    </div>
  );
}

function SeeAll({ href }: { href: string }) {
  const { t } = useI18n();
  return (
    <Link href={href} className="text-xs font-medium text-accent hover:underline">
      {t("projectHome.seeAll", "Ver todos")} →
    </Link>
  );
}

function EmptyHint({ text, href, action }: { text: string; href?: string; action?: string }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-line-strong p-3">
      <p className="text-xs text-muted">{text}</p>
      {href && action && (
        <Link href={href} className="rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-on-accent hover:opacity-90">
          {action}
        </Link>
      )}
    </div>
  );
}

function DocRows({ items, project, empty }: { items: Section[]; project: Project; empty: string }) {
  const { t } = useI18n();
  if (!items.length) return <EmptyHint text={empty} />;
  return (
    <ul className="flex flex-col divide-y divide-line">
      {items.map((s) => {
        const c = categoryOf(s);
        return (
          <li key={s.id}>
            <Link href={sectionPath(project, s)} className="flex items-center gap-2.5 py-2 text-sm text-ink hover:text-accent">
              <DomainIcon id={c} className="h-4 w-4 shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate">{s.title}</span>
              <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium ${domainVisual(c).tile}`}>{t(DOMAIN_I18N_KEYS[c], c)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

const AVATAR_TONES = ["bg-violet-500", "bg-amber-500", "bg-emerald-600", "bg-rose-600", "bg-sky-600", "bg-indigo-500"];

function Avatars({ items, project, empty }: { items: Section[]; project: Project; empty: string }) {
  if (!items.length) return <EmptyHint text={empty} />;
  return (
    <ul className="grid grid-cols-4 gap-2">
      {items.map((s, i) => (
        <li key={s.id}>
          <Link href={sectionPath(project, s)} className="flex flex-col items-center gap-1.5 text-center">
            {s.thumbImageUrl ? (
              <span className="relative h-14 w-14 overflow-hidden rounded-full bg-surface-2">
                <CoverImage src={s.thumbImageUrl} alt="" />
              </span>
            ) : (
              <span className={`grid h-14 w-14 place-items-center rounded-full text-lg font-bold text-white ${AVATAR_TONES[i % AVATAR_TONES.length]}`}>{s.title.trim()[0]?.toUpperCase()}</span>
            )}
            <span className="line-clamp-2 text-xs font-medium leading-tight text-ink">{s.title}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Tiles({ items, project, empty, wide }: { items: Section[]; project: Project; empty: string; wide?: boolean }) {
  if (!items.length) return <EmptyHint text={empty} />;
  return (
    <ul className={`grid gap-2 ${wide ? "grid-cols-3" : "grid-cols-4"}`}>
      {items.map((s) => {
        const c = categoryOf(s);
        return (
          <li key={s.id}>
            <Link href={sectionPath(project, s)} className="flex flex-col gap-1.5">
              <span className={`relative grid w-full place-items-center overflow-hidden rounded-xl ${wide ? "aspect-[4/3]" : "aspect-square"} ${s.thumbImageUrl ? "bg-surface-2" : domainVisual(c).tile}`}>
                {s.thumbImageUrl ? <CoverImage src={s.thumbImageUrl} alt="" /> : <DomainIcon id={c} className="h-6 w-6" />}
              </span>
              <span className="line-clamp-2 text-[11px] font-medium leading-tight text-ink">{s.title}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function NarrativeTeaser({ section, project, empty }: { section?: Section; project: Project; empty: string }) {
  const { t } = useI18n();
  if (!section) return <EmptyHint text={empty} />;
  return (
    <div className="flex flex-col gap-2">
      {section.thumbImageUrl && (
        <span className="relative block aspect-[3/1] w-full overflow-hidden rounded-xl bg-surface-2">
          <CoverImage src={section.thumbImageUrl} alt="" />
        </span>
      )}
      <p className="line-clamp-4 text-sm text-ink-2">{toPreviewText(section.content ?? "", 260) || t("docsArea.noText", "Ainda sem texto.")}</p>
      <Link href={sectionPath(project, section)} className="text-xs font-medium text-accent hover:underline">
        {t("projectHome.readMore", "Ler mais")} →
      </Link>
    </div>
  );
}

function PageChip({ section, project }: { section: Section; project: Project }) {
  const c = categoryOf(section);
  return (
    <Link href={sectionPath(project, section)} className={`inline-flex max-w-[14rem] items-center gap-1.5 rounded-lg px-2.5 py-1 font-medium ${domainVisual(c).tile}`}>
      <DomainIcon id={c} className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{section.title}</span>
    </Link>
  );
}

function RecentDocs({ items, project, slug }: { items: { section: Section; at: string }[]; project: Project; slug: string }) {
  const { t } = useI18n();
  const timeAgo = useTimeAgo();
  if (!items.length) return null;
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-center">
        <h2 className="text-base font-semibold text-ink">{t("projectHome.recent", "Atualizados recentemente")}</h2>
      </div>
      <ul className="flex flex-col gap-1">
        {items.map(({ section, at }) => {
          const c = categoryOf(section);
          return (
            <li key={section.id}>
              <Link href={sectionPath(project, section)} className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-surface-2">
                {section.thumbImageUrl ? (
                  <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                    <CoverImage src={section.thumbImageUrl} alt="" />
                  </span>
                ) : (
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${domainVisual(c).tile}`}>
                    <DomainIcon id={c} className="h-5 w-5" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{section.title}</span>
                  <span className="block text-xs text-muted">{timeAgo(at)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link href={`/projects/${slug}/documentacao`} className="mt-2 inline-block text-xs font-medium text-accent hover:underline">
        {t("projectHome.allDocsArrow", "Ver todos os documentos")} →
      </Link>
    </div>
  );
}

/** O que o próprio GDD sugere escrever a seguir: refs para páginas que não existem e páginas sem texto. */
function LooseEnds({ project, slug }: { project: Project; slug: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const addSection = useProjectStore((s) => s.addSection);
  const sections = useMemo(() => project.sections ?? [], [project.sections]);

  const missing = useMemo(() => {
    const cited = new Map<string, { name: string; pages: Set<string> }>();
    for (const s of sections) {
      for (const ref of validateReferences(s.content ?? "", sections).invalid) {
        if (ref.refType !== "name") continue;
        const key = ref.refValue.toLowerCase();
        const entry = cited.get(key) ?? { name: ref.refValue, pages: new Set<string>() };
        entry.pages.add(s.id);
        cited.set(key, entry);
      }
    }
    return [...cited.values()].sort((a, b) => b.pages.size - a.pages.size).slice(0, 3);
  }, [sections]);
  const emptyCount = sections.filter((s) => !(s.content ?? "").trim()).length;

  if (missing.length === 0 && emptyCount === 0) return null;

  const createPage = (name: string) => {
    addSection(project.id, name);
    router.push(sectionPath(project, { title: name }));
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-base font-semibold text-ink">{t("projectHome.looseEnds", "Pontas soltas")}</h2>
      <p className="mt-1 text-sm text-muted">{t("projectHome.looseEndsLead", "Coisas que o próprio GDD sugere escrever a seguir.")}</p>
      <ul className="mt-3 flex flex-col gap-3">
        {missing.map((m) => (
          <li key={m.name} className="flex gap-2.5 text-sm text-ink-2">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-accent-soft text-accent" aria-hidden>
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
              </svg>
            </span>
            <span>
              <button type="button" onClick={() => createPage(m.name)} className="font-medium text-accent hover:underline">
                {m.name}
              </button>{" "}
              {(m.pages.size === 1
                ? t("projectHome.citedOnce", "é citado em 1 página e ainda não tem página própria.")
                : t("projectHome.citedMany", "é citado em {n} páginas e ainda não tem página própria.")
              ).replace("{n}", String(m.pages.size))}
            </span>
          </li>
        ))}
        {emptyCount > 0 && (
          <li className="flex gap-2.5 text-sm text-ink-2">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-accent-soft text-accent" aria-hidden>
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="4" y="4" width="16" height="16" rx="3" strokeDasharray="3 3" />
              </svg>
            </span>
            <Link href={`/projects/${slug}/documentacao`} className="hover:text-ink">
              {(emptyCount === 1
                ? t("projectHome.emptyOne", "1 documento ainda está sem texto.")
                : t("projectHome.emptyMany", "{n} documentos ainda estão sem texto.")
              ).replace("{n}", String(emptyCount))}
            </Link>
          </li>
        )}
      </ul>
    </div>
  );
}

function NewProjectHome({ project, slug }: { project: Project; slug: string }) {
  const { t } = useI18n();
  const doors = [
    { href: starterHref(slug, "vision"), main: true, icon: <IconVision className="h-5 w-5" />, title: t("projectHome.doorZero", "Começar do zero"), text: t("projectHome.doorZeroText", "Responda as perguntas da Visão do jogo. Leva uns cinco minutos."), cta: t("projectHome.doorZeroCta", "Responder a primeira") },
    { href: "/import", main: false, icon: <IconDoc className="h-5 w-5" />, title: t("projectHome.doorImport", "Trazer o que já tenho"), text: t("projectHome.doorImportText", "Arquivos .md, um documento, ou o Claude que já escreve o seu jogo."), cta: t("projectHome.doorImportCta", "Importar") },
    { href: starterHref(slug, "genre"), main: false, icon: <IconLibrary className="h-5 w-5" />, title: t("projectHome.doorGenre", "Partir de um gênero"), text: t("projectHome.doorGenreText", "As perguntas se ajustam ao tipo de jogo. Nada de jogo de exemplo para apagar."), cta: t("projectHome.doorGenreCta", "Escolher gênero") },
  ];
  const parts = [
    { tone: "bg-area-vis-soft text-area-vis", icon: <IconVision className="h-4 w-4" />, title: t("projectShell.vision", "Visão do jogo"), text: t("projectHome.partVision", "A ideia, os pilares e a sensação que o jogo deve deixar."), ex: t("projectHome.partVisionEx", "Ex.: \"combate com impacto\"") },
    { tone: "bg-area-doc-soft text-area-doc", icon: <IconDoc className="h-4 w-4" />, title: t("projectShell.docs", "Documentação"), text: t("projectHome.partDocs", "Como o jogo funciona: regras, história, fases."), ex: t("projectHome.partDocsEx", "Ex.: a jornada do herói") },
    { tone: "bg-area-lib-soft text-area-lib", icon: <IconLibrary className="h-4 w-4" />, title: t("projectHome.partLibraryTitle", "Biblioteca"), text: t("projectHome.partLibrary", "Tudo que existe no jogo, com seus números."), ex: t("projectHome.partLibraryEx", "Ex.: magias, inimigos, itens") },
    { tone: "bg-area-sys-soft text-area-sys", icon: <IconSystems className="h-4 w-4" />, title: t("projectHome.partSystemsTitle", "Sistemas"), text: t("projectHome.partSystems", "Como as partes se ligam: loops, progressão, economia."), ex: t("projectHome.partSystemsEx", "Ex.: XP → nível → habilidade") },
  ];

  return (
    <div className="grid w-full items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-6">
        <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div>
            <span className="text-sm font-semibold text-accent">{t("projectHome.newKicker", "Projeto novo")}</span>
            <h1 className="mt-1.5 text-3xl font-bold leading-tight tracking-tight text-ink md:text-4xl">{t("projectHome.newTitle", "Vamos começar pelo seu jogo.")}</h1>
            <p className="mt-3 max-w-[48ch] text-[15px] text-muted">
              {t("projectHome.newLead", "Cinco perguntas sobre a ideia do jogo já viram o começo do seu GDD. Responda no seu ritmo, pule o que ainda não sabe e continue do seu jeito depois.")}
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <ProjectCover project={project} className="min-h-[160px] rounded-none">
              <div className="flex flex-col gap-1.5 p-5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">{t("projectHome.coverLabel", "Capa do projeto")}</span>
                <span className="text-2xl font-bold">{project.title}</span>
                <span className="text-sm italic text-white/60">{t("projectHome.coverHint", "A frase que resume o jogo aparece aqui.")}</span>
              </div>
            </ProjectCover>
            <p className="px-4 py-2.5 text-xs text-muted">{t("projectHome.coverFoot", "A capa se monta enquanto você responde. Imagem é opcional.")}</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[1.3fr_1fr_1fr]">
          {doors.map((door) => (
            <Link
              key={door.title}
              href={door.href}
              className={`flex flex-col gap-2 rounded-2xl border p-4 transition-colors ${
                door.main ? "border-accent bg-accent text-on-accent hover:opacity-95" : "border-line bg-surface text-ink hover:border-line-strong"
              }`}
            >
              <span className={`grid h-9 w-9 place-items-center rounded-lg ${door.main ? "bg-on-accent/15" : "bg-surface-2"}`}>{door.icon}</span>
              <strong className="text-base">{door.title}</strong>
              <span className={`text-sm ${door.main ? "opacity-85" : "text-muted"}`}>{door.text}</span>
              <span className={`mt-auto pt-1 text-sm font-semibold ${door.main ? "" : "text-accent"}`}>{door.cta} →</span>
            </Link>
          ))}
        </div>

        <div>
          <h2 className="text-base font-semibold text-ink">{t("projectHome.partsTitle", "As quatro partes de um GDD")}</h2>
          <p className="mb-3 mt-1 text-sm text-muted">{t("projectHome.partsLead", "Você não precisa preencher tudo. É só um mapa de onde cada coisa mora.")}</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {parts.map((part) => (
              <div key={part.title} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
                <span className={`grid h-8 w-8 place-items-center rounded-lg ${part.tone}`}>{part.icon}</span>
                <strong className="text-sm text-ink">{part.title}</strong>
                <span className="text-sm text-muted">{part.text}</span>
                <span className="mt-auto border-t border-line pt-2 text-xs text-subtle">{part.ex}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <aside className="flex flex-col gap-5">
        <FirstStepsCard project={project} slug={slug} />
        <div className="rounded-2xl bg-area-doc-soft p-5">
          <h3 className="text-sm font-semibold text-ink">{t("projectHome.tipTitle", "Comece pelo jogador")}</h3>
          <p className="mt-1 text-sm text-ink-2">{t("projectHome.tipText", "Antes das regras, pense no que a pessoa sente nos primeiros cinco minutos. O resto do design sai daí.")}</p>
        </div>
      </aside>
    </div>
  );
}
