"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ProjectCover } from "@/components/project/ProjectCover";
import { useI18n } from "@/lib/i18n/provider";
import {
  STARTER_AREAS,
  STARTER_GENRES,
  isStarterAnswered,
  isStarterClosed,
  localized,
  starterQuestionsFor,
  type StarterArea,
  type StarterProgress,
  type StarterQuestion,
  type StarterState,
} from "@/lib/onboarding/starterQuestions";
import { projectPath, toSlug } from "@/lib/utils/slug";
import { useProjectStore } from "@/store/projectStore";
import type { Project } from "@/store/slices/types";

/** Parâmetro de URL que abre a gaveta: `?perguntas=vision|docs|library|systems|genre`. */
export const STARTER_PARAM = "perguntas";

export function areaLabel(area: StarterArea, t: (k: string, f?: string) => string) {
  return {
    vision: t("projectShell.vision", "Visão do jogo"),
    docs: t("projectShell.docs", "Documentação"),
    library: t("projectShell.library", "Biblioteca do jogo"),
    systems: t("projectShell.systems", "Sistemas e relações"),
  }[area];
}

/** Respostas já dadas a uma pergunta da Visão (para reabrir com o campo preenchido). */
function currentValue(project: Project, q: StarterQuestion): string {
  if (q.target.kind !== "vision") return "";
  const v = project.vision ?? {};
  switch (q.target.field) {
    case "title":
      return project.title;
    case "pillars":
      return (v.pillars ?? []).join("\n");
    default:
      return v[q.target.field] ?? "";
  }
}

export function starterProgress(project: Project): StarterProgress {
  return project.vision?.starter ?? { answered: [], skipped: [] };
}

export function starterState(project: Project, starter?: StarterProgress): StarterState {
  return {
    vision: { ...(project.vision ?? {}), starter: starter ?? starterProgress(project) },
    rootPageTitles: (project.sections ?? []).filter((s) => !s.parentId).map((s) => s.title),
  };
}

/** Respondidas e total de uma área, para o gênero do projeto. */
export function areaProgress(project: Project, area: StarterArea) {
  const list = starterQuestionsFor(area, project.vision?.genre);
  const state = starterState(project);
  const answered = list.filter((q) => isStarterAnswered(q, state)).length;
  const closed = list.filter((q) => isStarterClosed(q, state)).length;
  return { answered, total: list.length, done: closed === list.length };
}

/**
 * A gaveta dos Primeiros passos. Uma pergunta por vez; Pular não é falhar —
 * a pergunta fica marcada e o GDD segue. A Visão monta a capa enquanto a
 * pessoa responde.
 */
export function StarterDrawer({ project }: { project: Project }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = params.get(STARTER_PARAM);
  if (!requested) return null;
  const close = () => router.replace(pathname);
  return <DrawerBody key={requested} project={project} requested={requested} onClose={close} />;
}

function DrawerBody({ project, requested, onClose }: { project: Project; requested: string; onClose: () => void }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const editProject = useProjectStore((s) => s.editProject);
  const updateProjectVision = useProjectStore((s) => s.updateProjectVision);
  const addSection = useProjectStore((s) => s.addSection);

  const startArea: StarterArea = (STARTER_AREAS as string[]).includes(requested) ? (requested as StarterArea) : "vision";
  const [askGenre, setAskGenre] = useState(requested === "genre");
  const [area, setArea] = useState<StarterArea>(startArea);
  // A fila é fixada ao abrir a área: responder não pode fazer a pergunta atual sumir debaixo da pessoa.
  const queue = useMemo(() => {
    const state = starterState(project);
    const list = starterQuestionsFor(area, project.vision?.genre);
    const open = list.filter((q) => !isStarterClosed(q, state));
    return open.length ? open : list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area, project.vision?.genre]);
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const question = queue[index];
  const [value, setValue] = useState(() => (question ? currentValue(project, question) : ""));
  const [note, setNote] = useState("");
  const fieldRef = useRef<HTMLTextAreaElement & HTMLInputElement>(null);

  useEffect(() => {
    setValue(question ? currentValue(project, question) : "");
    setNote("");
    fieldRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mark = (id: string, how: "answered" | "skipped") => {
    const p = starterProgress(project);
    const answered = new Set(p.answered);
    const skipped = new Set(p.skipped);
    answered.delete(id);
    skipped.delete(id);
    (how === "answered" ? answered : skipped).add(id);
    const next: StarterProgress = { answered: [...answered], skipped: [...skipped] };
    const state = starterState(project, next);
    const allClosed = STARTER_AREAS.flatMap((a) => starterQuestionsFor(a, project.vision?.genre)).every((q) => isStarterClosed(q, state));
    if (allClosed) next.doneAt = p.doneAt ?? new Date().toISOString();
    else if (p.doneAt) next.doneAt = p.doneAt;
    updateProjectVision(project.id, { starter: next });
  };

  /** Grava a resposta onde a pergunta manda. Devolve false se não deu para gravar. */
  const apply = (q: StarterQuestion, raw: string): boolean => {
    const text = raw.trim();
    if (q.target.kind === "vision") {
      if (q.target.field === "title") {
        if (text === project.title) return true;
        try {
          editProject(project.id, text, project.description ?? "");
        } catch (err) {
          setNote(err instanceof Error && err.message === "duplicate_project_name" ? t("starter.duplicateName", "Você já tem um projeto com esse nome.") : String(err));
          return false;
        }
        // O endereço é o slug do nome: trocou o nome, troca a rota junto.
        router.replace(`${projectPath({ title: text })}?${STARTER_PARAM}=${area}`);
        return true;
      }
      if (q.target.field === "pillars") {
        updateProjectVision(project.id, { pillars: text.split("\n").map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim()).filter(Boolean).slice(0, 8) });
        return true;
      }
      updateProjectVision(project.id, { [q.target.field]: text });
      return true;
    }
    const title = localized(q.target.title, locale);
    const exists = (project.sections ?? []).some((s) => !s.parentId && toSlug(s.title) === toSlug(title));
    if (exists) {
      setNote(t("starter.pageExists", "Já existe uma página \"{title}\": a resposta não foi gravada para não sobrescrever o que está lá.").replace("{title}", title));
      return true;
    }
    addSection(project.id, title, text, undefined, [q.target.domain]);
    return true;
  };

  const advance = () => {
    if (index + 1 < queue.length) setIndex(index + 1);
    else setFinished(true);
  };

  const save = () => {
    if (!question) return;
    if (!value.trim()) {
      skip();
      return;
    }
    if (!apply(question, value)) return;
    mark(question.id, "answered");
    advance();
  };

  const skip = () => {
    if (!question) return;
    mark(question.id, "skipped");
    advance();
  };

  const chooseGenre = (genre: string) => {
    updateProjectVision(project.id, { genre });
    setAskGenre(false);
    setArea("vision");
    setIndex(0);
  };

  const nextArea = STARTER_AREAS[STARTER_AREAS.indexOf(area) + 1];
  const v = project.vision ?? {};
  const liveTitle = question?.target.kind === "vision" && question.target.field === "title" ? value || project.title : project.title;
  const liveLogline = question?.target.kind === "vision" && question.target.field === "logline" ? value : v.logline;
  const livePillars = question?.target.kind === "vision" && question.target.field === "pillars" ? value.split("\n").filter((l) => l.trim()) : v.pillars ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/45" aria-label={t("common.close", "Fechar")} onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="starter-title" className="relative flex h-full w-full max-w-[520px] flex-col gap-5 overflow-y-auto bg-surface p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <h2 id="starter-title" className="text-lg font-semibold text-ink">
            {askGenre ? t("starter.genreTitle", "Que tipo de jogo é?") : areaLabel(area, t)}
          </h2>
          <button type="button" onClick={onClose} className="ml-auto grid h-8 w-8 place-items-center rounded-lg bg-surface-2 text-muted hover:text-ink" aria-label={t("common.close", "Fechar")}>
            ✕
          </button>
        </div>

        {askGenre ? (
          <>
            <p className="text-sm text-muted">
              {t("starter.genreLead", "O gênero só muda as perguntas: um RPG pergunta sobre progressão, um puzzle sobre a regra central. Nenhum jogo de exemplo entra no seu projeto.")}
            </p>
            <div className="flex flex-wrap gap-2">
              {STARTER_GENRES.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => chooseGenre(localized(g.label, locale))}
                  className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                    v.genre === localized(g.label, locale) ? "border-accent bg-accent-soft font-semibold text-accent" : "border-line text-ink hover:border-line-strong"
                  }`}
                >
                  {localized(g.label, locale)}
                </button>
              ))}
            </div>
          </>
        ) : finished || !question ? (
          <div className="flex flex-col gap-3">
            <p className="text-2xl font-semibold leading-tight text-ink">
              {area === "vision" ? t("starter.visionDone", "Seu GDD começou.") : t("starter.areaDone", "Pronto por aqui.")}
            </p>
            <p className="text-sm text-muted">
              {nextArea
                ? t("starter.nextArea", "Quando quiser, as próximas perguntas são de {area}. Ou feche e continue do seu jeito.").replace("{area}", areaLabel(nextArea, t))
                : t("starter.allDone", "Os primeiros passos acabaram. Daqui em diante, o GDD é seu.")}
            </p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={onClose} className="h-10 rounded-xl border border-line px-4 text-sm text-ink hover:bg-surface-2">
                {t("common.close", "Fechar")}
              </button>
              {nextArea && (
                <button
                  type="button"
                  onClick={() => {
                    setArea(nextArea);
                    setIndex(0);
                    setFinished(false);
                  }}
                  className="h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent"
                >
                  {t("starter.goNext", "Seguir para {area}").replace("{area}", areaLabel(nextArea, t))}
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-1" aria-hidden>
              {queue.map((q, i) => (
                <span key={q.id} className={`h-1 flex-1 rounded ${i <= index ? "bg-area-vis" : "bg-surface-2"}`} />
              ))}
            </div>
            <p className="text-xs text-muted">
              {t("starter.counter", "Pergunta {n} de {total}").replace("{n}", String(index + 1)).replace("{total}", String(queue.length))}
            </p>
            <div>
              <label htmlFor="starter-field" className="block text-xl font-semibold leading-snug text-ink">
                {localized(question.question, locale)}
              </label>
              <p className="mb-3 mt-1 text-sm text-muted">{localized(question.hint, locale)}</p>
              {question.multiline ? (
                <textarea
                  id="starter-field"
                  ref={fieldRef}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === "Enter" && save()}
                  rows={5}
                  className="w-full resize-y rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
                />
              ) : (
                <input
                  id="starter-field"
                  ref={fieldRef}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && save()}
                  className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
                />
              )}
              {question.target.kind === "page" && (
                <p className="mt-2 text-xs text-subtle">
                  {t("starter.becomesPage", "Vira a página \"{title}\" — dá para editar e crescer depois.").replace("{title}", localized(question.target.title, locale))}
                </p>
              )}
              {note && <p className="mt-2 text-sm text-warn-ink">{note}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {index > 0 && (
                <button type="button" onClick={() => setIndex(index - 1)} className="h-10 rounded-xl px-3 text-sm text-muted hover:text-ink">
                  {t("starter.back", "Voltar")}
                </button>
              )}
              <span className="flex-1" />
              <button type="button" onClick={skip} className="h-10 rounded-xl border border-line px-4 text-sm text-ink hover:bg-surface-2">
                {t("starter.skip", "Pular")}
              </button>
              <button type="button" onClick={save} className="h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent">
                {index + 1 === queue.length ? t("starter.finish", "Concluir") : t("starter.saveNext", "Salvar e seguir")}
              </button>
            </div>
          </>
        )}

        {area === "vision" && (
          <div className="mt-auto">
            <p className="mb-1.5 text-xs text-muted">{t("starter.coverSoFar", "Sua capa até agora")}</p>
            <ProjectCover project={project} className="min-h-[130px]">
              <div className="flex flex-col gap-1.5 p-4">
                {v.genre && <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">{v.genre}</span>}
                <span className="text-xl font-bold">{liveTitle}</span>
                <span className={`text-sm ${liveLogline ? "text-white/80" : "italic text-white/50"}`}>
                  {liveLogline || t("projectHome.coverHint", "A frase que resume o jogo aparece aqui.")}
                </span>
                {livePillars.length > 0 && (
                  <span className="flex flex-wrap gap-1.5 pt-1">
                    {livePillars.slice(0, 4).map((p, i) => (
                      <span key={i} className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-[11px]">
                        {p}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            </ProjectCover>
          </div>
        )}
      </div>
    </div>
  );
}

/** Link que abre a gaveta numa área. */
export function starterHref(slug: string, area: StarterArea | "genre") {
  return `/projects/${slug}?${STARTER_PARAM}=${area}`;
}
