"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProjectCover } from "@/components/project/ProjectCover";
import { DomainIcon, domainVisual } from "@/components/project/domainVisual";
import { IconDoc, IconLibrary, IconSystems, IconVision } from "@/components/project/ProjectSidebar";
import { CoverImage } from "@/components/project/ProjectCover";
import { useShellProject } from "@/components/project/useShellProject";
import { useI18n } from "@/lib/i18n/provider";
import { isValidDomainId } from "@/lib/gameDesignDomains";
import { toPreviewText } from "@/lib/richDoc/previewText";
import { sectionPath } from "@/lib/utils/slug";
import { useProjectStore } from "@/store/projectStore";
import type { Project, ProjectVision, Section } from "@/store/slices/types";
import { validateReferences } from "@/utils/sectionReferences";
import { StarterDrawer, areaLabel, areaProgress, starterHref } from "@/components/onboarding/StarterDrawer";
import { STARTER_AREAS, type StarterArea } from "@/lib/onboarding/starterQuestions";

const visionOf = (project: Project): ProjectVision => project.vision ?? {};

const PILLAR_DOTS = ["bg-red-500", "bg-amber-500", "bg-sky-500", "bg-emerald-500", "bg-violet-500", "bg-pink-500"];

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

function GameHome({ project, slug }: { project: Project; slug: string }) {
  const { t } = useI18n();
  const base = `/projects/${slug}`;
  const v = visionOf(project);
  const sections = project.sections ?? [];
  const roots = sections.filter((s) => !s.parentId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const logline = v.logline?.trim() || toPreviewText(project.description ?? "", 220);

  return (
    <div className="mx-auto grid max-w-7xl items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-5">
        <ProjectCover project={project} className="min-h-[210px]">
          <div className="flex max-w-2xl flex-col gap-2.5 p-6 md:p-7">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
              {v.genre?.trim() || t("projectHome.eyebrow", "Game Design Document")}
            </span>
            <h1 className="text-3xl font-bold leading-tight md:text-4xl">{project.title}</h1>
            {logline && <p className="max-w-[52ch] text-[15px] text-white/80">{logline}</p>}
            <div className="mt-1">
              <Link href={`${base}/visao`} className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium hover:bg-white/20">
                {t("projectHome.editVision", "Editar a visão")}
              </Link>
            </div>
          </div>
        </ProjectCover>

        <Panel tone="vis" icon={<IconVision className="h-4 w-4" />} title={t("projectHome.pillars", "Pilares")} href={`${base}/visao`} linkLabel={t("projectHome.openVision", "Abrir Visão")}>
          {v.pillars?.length ? (
            <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
              {v.pillars.map((pillar, i) => (
                <li key={`${pillar}-${i}`} className="flex items-start gap-2.5 text-sm text-ink">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PILLAR_DOTS[i % PILLAR_DOTS.length]}`} aria-hidden />
                  {pillar}
                </li>
              ))}
            </ul>
          ) : (
            <Invite
              href={starterHref(slug, "vision")}
              text={t("projectHome.pillarsInvite", "Quais são as 3 ou 4 regras que decidem as brigas de design do seu jogo?")}
              action={t("projectHome.answer", "Responder")}
            />
          )}
        </Panel>

        <Panel tone="doc" icon={<IconDoc className="h-4 w-4" />} title={t("projectHome.mainDocs", "Documentos principais")} href={`${base}/documentacao`} linkLabel={t("projectHome.allDocs", "Ver todos")}>
          {roots.length ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {roots.slice(0, 9).map((s) => (
                <RootDoc key={s.id} section={s} href={sectionPath(project, s)} childCount={sections.filter((c) => c.parentId === s.id).length} />
              ))}
            </ul>
          ) : (
            <Invite href={`${base}/documentacao`} text={t("projectHome.docsInvite", "Ainda não há documentos. Comece pelo que você mais tem vontade de escrever.")} action={t("projectHome.newDoc", "Novo documento")} />
          )}
        </Panel>
      </div>

      <aside className="flex flex-col gap-5">
        <LooseEnds project={project} slug={slug} />
        <FirstStepsCard project={project} slug={slug} />
      </aside>
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

function RootDoc({ section, href, childCount }: { section: Section; href: string; childCount: number }) {
  const { t } = useI18n();
  const category = section.domainTags?.find(isValidDomainId) ?? "other";
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 rounded-xl border border-line p-3 transition-colors hover:border-line-strong hover:bg-surface-2">
        {section.thumbImageUrl ? (
          <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-surface-2">
            <CoverImage src={section.thumbImageUrl} alt="" />
          </span>
        ) : (
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${domainVisual(category).tile}`}>
            <DomainIcon id={category} className="h-5 w-5" />
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-ink">{section.title}</span>
          <span className="block text-xs text-muted">
            {childCount > 0
              ? (childCount === 1 ? t("projectHome.subpage", "1 subpágina") : t("projectHome.subpages", "{n} subpáginas").replace("{n}", String(childCount)))
              : toPreviewText(section.content ?? "", 40) || t("docsArea.noText", "Ainda sem texto.")}
          </span>
        </span>
      </Link>
    </li>
  );
}

function Panel({ tone, icon, title, href, linkLabel, children }: { tone: "vis" | "doc" | "lib" | "sys"; icon: React.ReactNode; title: string; href?: string; linkLabel?: string; children: React.ReactNode }) {
  const toneClass = { vis: "bg-area-vis-soft text-area-vis", doc: "bg-area-doc-soft text-area-doc", lib: "bg-area-lib-soft text-area-lib", sys: "bg-area-sys-soft text-area-sys" }[tone];
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${toneClass}`}>{icon}</span>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {href && linkLabel && (
          <Link href={href} className="ml-auto text-sm font-medium text-accent hover:underline">
            {linkLabel}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Invite({ href, text, action }: { href: string; text: string; action: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-line-strong p-4">
      <p className="min-w-0 flex-1 text-sm text-muted">{text}</p>
      <Link href={href} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent hover:opacity-90">
        {action}
      </Link>
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
    <div className="mx-auto grid max-w-7xl items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
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
