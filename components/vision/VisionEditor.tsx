"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { STARTER_GENRES, localized } from "@/lib/onboarding/starterQuestions";
import { useProjectStore } from "@/store/projectStore";
import type { Project, ProjectVision } from "@/store/slices/types";
import { starterHref } from "@/components/onboarding/StarterDrawer";

type TextField = "logline" | "playerVerb" | "feeling";

/**
 * Os campos da Visão como blocos que se leem — o texto aparece como citação,
 * e um clique abre a edição no lugar. É o mesmo dado que as perguntas dos
 * Primeiros passos preenchem.
 */
export function VisionEditor({ project, slug }: { project: Project; slug: string }) {
  const { t, locale } = useI18n();
  const updateProjectVision = useProjectStore((s) => s.updateProjectVision);
  const v: ProjectVision = project.vision ?? {};
  const save = (patch: Partial<ProjectVision>) => updateProjectVision(project.id, patch);
  const genreOptions = STARTER_GENRES.map((g) => localized(g.label, locale));

  const cards: { key: TextField; label: string; hint: string; tone: string; icon: React.ReactNode }[] = [
    {
      key: "logline",
      label: t("visionPage.logline", "Em uma frase"),
      hint: t("visionPage.loglineHint", "A frase que você diria para alguém no elevador."),
      tone: "bg-area-vis-soft text-area-vis",
      icon: <path d="M7 8h10M7 12h7M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-6l-4 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />,
    },
    {
      key: "playerVerb",
      label: t("visionPage.playerVerb", "O que o jogador faz"),
      hint: t("visionPage.playerVerbHint", "O verbo principal, na maior parte do tempo."),
      tone: "bg-area-doc-soft text-area-doc",
      icon: <><rect x="2" y="7" width="20" height="11" rx="4" /><path d="M7 11v3M5.5 12.5h3M15 12h.01M18 12h.01" /></>,
    },
    {
      key: "feeling",
      label: t("visionPage.feeling", "A sensação"),
      hint: t("visionPage.feelingHint", "O que a pessoa leva quando desliga o jogo."),
      tone: "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300",
      icon: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          {t("visionPage.genre", "Gênero")}
          <select
            value={v.genre ?? ""}
            onChange={(e) => save({ genre: e.target.value || undefined })}
            className="h-9 rounded-lg border border-line bg-canvas px-2 text-sm text-ink"
          >
            <option value="">{t("visionPage.noGenre", "Sem gênero")}</option>
            {v.genre && !genreOptions.includes(v.genre) && <option value={v.genre}>{v.genre}</option>}
            {genreOptions.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <span className="hidden text-sm text-subtle sm:inline">{t("visionPage.genreHint", "Muda as perguntas dos Primeiros passos.")}</span>
        <Link href={starterHref(slug, "vision")} className="ml-auto inline-flex h-9 items-center rounded-lg bg-accent px-3 text-sm font-semibold text-on-accent hover:opacity-90">
          {t("visionPage.answerQuestions", "Responder as perguntas")}
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {cards.map(({ key: field, ...card }) => (
          <IdentityCard key={field} {...card} value={v[field] ?? ""} onSave={(text) => save({ [field]: text })} />
        ))}
      </div>

      <PillarsBlock pillars={v.pillars ?? []} onSave={(pillars) => save({ pillars })} />
    </div>
  );
}

function IdentityCard({ label, hint, tone, icon, value, onSave }: { label: string; hint: string; tone: string; icon: React.ReactNode; value: string; onSave: (text: string) => void }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() !== value.trim()) onSave(draft.trim());
  };

  return (
    <section className="group flex min-h-[11rem] flex-col rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-line-strong">
      <div className="mb-3 flex items-center gap-2.5">
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${tone}`}>
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {icon}
          </svg>
        </span>
        <h2 className="text-[15px] font-semibold text-ink">{label}</h2>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(value);
              setEditing(true);
            }}
            className="ml-auto rounded-md px-2 py-1 text-xs font-medium text-accent opacity-0 transition-opacity hover:bg-accent-soft focus:opacity-100 group-hover:opacity-100"
          >
            {t("visionPage.editShort", "Editar")}
          </button>
        )}
      </div>
      {editing ? (
        <>
          <textarea
            ref={ref}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(false);
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") commit();
            }}
            placeholder={hint}
            rows={4}
            className="flex-1 resize-none rounded-xl border border-accent bg-canvas px-3 py-2 text-sm text-ink focus:outline-none"
          />
          <p className="mt-1.5 text-[11px] text-subtle">{t("visionPage.saveHint", "Salva ao sair do campo · Esc cancela")}</p>
        </>
      ) : value.trim() ? (
        <button type="button" onClick={() => { setDraft(value); setEditing(true); }} className="flex-1 text-left">
          <p className="border-l-2 border-line-strong pl-3 text-[15px] leading-relaxed text-ink-2">{value}</p>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => { setDraft(""); setEditing(true); }}
          className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line-strong p-4 text-center text-sm text-muted hover:border-accent hover:text-ink"
        >
          {hint}
        </button>
      )}
    </section>
  );
}

const PILLAR_TONES = [
  { bar: "bg-red-500", soft: "bg-red-50 dark:bg-red-950/40", num: "text-red-600 dark:text-red-300" },
  { bar: "bg-amber-500", soft: "bg-amber-50 dark:bg-amber-950/40", num: "text-amber-600 dark:text-amber-300" },
  { bar: "bg-sky-500", soft: "bg-sky-50 dark:bg-sky-950/40", num: "text-sky-600 dark:text-sky-300" },
  { bar: "bg-emerald-500", soft: "bg-emerald-50 dark:bg-emerald-950/40", num: "text-emerald-600 dark:text-emerald-300" },
  { bar: "bg-violet-500", soft: "bg-violet-50 dark:bg-violet-950/40", num: "text-violet-600 dark:text-violet-300" },
  { bar: "bg-pink-500", soft: "bg-pink-50 dark:bg-pink-950/40", num: "text-pink-600 dark:text-pink-300" },
  { bar: "bg-teal-500", soft: "bg-teal-50 dark:bg-teal-950/40", num: "text-teal-600 dark:text-teal-300" },
  { bar: "bg-orange-500", soft: "bg-orange-50 dark:bg-orange-950/40", num: "text-orange-600 dark:text-orange-300" },
];

function PillarsBlock({ pillars, onSave }: { pillars: string[]; onSave: (pillars: string[]) => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || pillars.length >= 8) return;
    onSave([...pillars, text]);
    setDraft("");
  };

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-on-accent">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 21h16M6 21V9M10 21V9M14 21V9M18 21V9M3 9l9-6 9 6z" />
          </svg>
        </span>
        <div>
          <h2 className="text-[15px] font-semibold text-ink">{t("visionPage.pillars", "Pilares de design")}</h2>
          <p className="text-xs text-muted">{t("visionPage.pillarsHint", "Três ou quatro regras que decidem as brigas de design.")}</p>
        </div>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {pillars.map((pillar, i) => {
          const tone = PILLAR_TONES[i % PILLAR_TONES.length];
          return (
            <li key={`${i}-${pillar}`} className={`group relative overflow-hidden rounded-xl ${tone.soft} p-4 pl-5`}>
              <span className={`absolute inset-y-0 left-0 w-1.5 ${tone.bar}`} aria-hidden />
              <span className={`block text-2xl font-bold tabular-nums ${tone.num}`}>{String(i + 1).padStart(2, "0")}</span>
              <textarea
                defaultValue={pillar}
                rows={2}
                onBlur={(e) => {
                  const text = e.target.value.trim();
                  if (text === pillar) return;
                  onSave(text ? pillars.map((p, j) => (j === i ? text : p)) : pillars.filter((_, j) => j !== i));
                }}
                className="mt-1 w-full resize-none overflow-hidden bg-transparent text-[15px] font-semibold leading-snug text-ink [field-sizing:content] focus:outline-none"
                aria-label={t("visionPage.pillarN", "Pilar {n}").replace("{n}", String(i + 1))}
              />
              <button
                type="button"
                onClick={() => onSave(pillars.filter((_, j) => j !== i))}
                className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-md text-subtle opacity-0 transition-opacity hover:bg-surface hover:text-danger focus:opacity-100 group-hover:opacity-100"
                aria-label={t("visionPage.removePillar", "Remover pilar")}
              >
                ✕
              </button>
            </li>
          );
        })}
        {pillars.length < 8 && (
          <li className="rounded-xl border border-dashed border-line-strong p-4">
            <form onSubmit={add} className="flex h-full flex-col gap-2">
              <span className="text-2xl font-bold tabular-nums text-subtle">{String(pillars.length + 1).padStart(2, "0")}</span>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t("visionPage.newPillar", "Novo pilar — ex.: combate com impacto")}
                className="w-full bg-transparent text-sm text-ink placeholder:text-subtle focus:outline-none"
              />
              <button type="submit" disabled={!draft.trim()} className="mt-auto self-start rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-on-accent disabled:opacity-40">
                {t("visionPage.add", "Adicionar")}
              </button>
            </form>
          </li>
        )}
      </ul>
    </section>
  );
}
