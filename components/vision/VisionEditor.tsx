"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { STARTER_GENRES, localized } from "@/lib/onboarding/starterQuestions";
import { useProjectStore } from "@/store/projectStore";
import type { Project, ProjectVision } from "@/store/slices/types";
import { starterHref } from "@/components/onboarding/StarterDrawer";

type TextField = "logline" | "playerVerb" | "feeling";

/**
 * Os campos da Visão, editáveis direto. Grava ao sair do campo — é o mesmo
 * dado que as perguntas dos Primeiros passos preenchem.
 */
export function VisionEditor({ project, slug }: { project: Project; slug: string }) {
  const { t, locale } = useI18n();
  const updateProjectVision = useProjectStore((s) => s.updateProjectVision);
  const v: ProjectVision = project.vision ?? {};

  const save = (patch: Partial<ProjectVision>) => updateProjectVision(project.id, patch);

  const fields: { key: TextField; label: string; hint: string }[] = [
    { key: "logline", label: t("visionPage.logline", "Em uma frase"), hint: t("visionPage.loglineHint", "A frase que você diria para alguém no elevador.") },
    { key: "playerVerb", label: t("visionPage.playerVerb", "O que o jogador faz"), hint: t("visionPage.playerVerbHint", "O verbo principal, na maior parte do tempo.") },
    { key: "feeling", label: t("visionPage.feeling", "A sensação"), hint: t("visionPage.feelingHint", "O que a pessoa leva quando desliga o jogo.") },
  ];
  const genreOptions = STARTER_GENRES.map((g) => localized(g.label, locale));

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 md:p-6">
      <div className="mb-5 flex flex-wrap items-center gap-3">
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
        <Link href={starterHref(slug, "vision")} className="ml-auto text-sm font-medium text-accent hover:underline">
          {t("visionPage.answerQuestions", "Responder as perguntas")}
        </Link>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {fields.map((field) => (
          <TextBlock key={field.key} label={field.label} hint={field.hint} value={v[field.key] ?? ""} onSave={(text) => save({ [field.key]: text })} />
        ))}
      </div>

      <PillarsBlock pillars={v.pillars ?? []} onSave={(pillars) => save({ pillars })} />
    </section>
  );
}

function TextBlock({ label, hint, value, onSave }: { label: string; hint: string; value: string; onSave: (text: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [lastSeen, setLastSeen] = useState(value);
  // Valor mudou por fora (sync, outra aba, a gaveta de perguntas): acompanha.
  if (value !== lastSeen) {
    setLastSeen(value);
    setDraft(value);
  }
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft.trim() !== value.trim() && onSave(draft.trim())}
        placeholder={hint}
        rows={4}
        className="resize-y rounded-xl border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
      />
    </label>
  );
}

const DOTS = ["bg-red-500", "bg-amber-500", "bg-sky-500", "bg-emerald-500", "bg-violet-500", "bg-pink-500", "bg-teal-500", "bg-orange-500"];

function PillarsBlock({ pillars, onSave }: { pillars: string[]; onSave: (pillars: string[]) => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");

  const add = () => {
    const text = draft.trim();
    if (!text || pillars.length >= 8) return;
    onSave([...pillars, text]);
    setDraft("");
  };

  return (
    <div className="mt-6 border-t border-line pt-5">
      <h3 className="text-sm font-semibold text-ink">{t("visionPage.pillars", "Pilares")}</h3>
      <p className="mb-3 mt-1 text-sm text-muted">{t("visionPage.pillarsHint", "Três ou quatro regras que decidem as brigas de design.")}</p>
      <ul className="flex flex-col gap-2">
        {pillars.map((pillar, i) => (
          <li key={`${i}-${pillar}`} className="group flex items-center gap-2.5 rounded-xl border border-line px-3 py-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOTS[i % DOTS.length]}`} aria-hidden />
            <input
              defaultValue={pillar}
              onBlur={(e) => {
                const text = e.target.value.trim();
                if (text === pillar) return;
                onSave(text ? pillars.map((p, j) => (j === i ? text : p)) : pillars.filter((_, j) => j !== i));
              }}
              className="min-w-0 flex-1 bg-transparent text-sm text-ink focus:outline-none"
              aria-label={t("visionPage.pillarN", "Pilar {n}").replace("{n}", String(i + 1))}
            />
            <button
              type="button"
              onClick={() => onSave(pillars.filter((_, j) => j !== i))}
              className="text-subtle opacity-0 transition-opacity hover:text-danger group-hover:opacity-100 focus:opacity-100"
              aria-label={t("visionPage.removePillar", "Remover pilar")}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      {pillars.length < 8 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="mt-2 flex gap-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("visionPage.newPillar", "Novo pilar — ex.: combate com impacto")}
            className="h-10 min-w-0 flex-1 rounded-xl border border-dashed border-line-strong bg-transparent px-3 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
          />
          <button type="submit" disabled={!draft.trim()} className="h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-40">
            {t("visionPage.add", "Adicionar")}
          </button>
        </form>
      )}
    </div>
  );
}
