"use client";

import { useState, useMemo } from "react";
import type { GameGenre, KpiEntry, KpiMetrics } from "@/lib/kpi/types";
import { GENRE_BENCHMARKS, diagnose } from "@/lib/kpi/benchmarks";
import MetricInputBar from "./MetricInputBar";
import DiagnosisBlock from "./DiagnosisBlock";
import RetentionChart from "./RetentionChart";
import KpiHistoryList from "./KpiHistoryList";

interface Props {
  projectId: string;
  genre: GameGenre;
  entries: KpiEntry[];
  onSetGenre: (genre: GameGenre) => void;
  onAddEntry: (entry: Omit<KpiEntry, "id" | "createdAt">) => string;
  onUpdateEntry: (id: string, patch: Partial<Pick<KpiEntry, "hypothesis" | "hypothesisArea" | "outcome" | "learning" | "metrics">>) => void;
  onDeleteEntry: (id: string) => void;
}

const GENRES: { id: GameGenre; label: string }[] = [
  { id: "farm",    label: "Farm" },
  { id: "casual",  label: "Casual" },
  { id: "rpg",     label: "RPG" },
  { id: "puzzle",  label: "Puzzle" },
  { id: "idle",    label: "Idle" },
  { id: "shooter", label: "Shooter" },
];

const HYPOTHESIS_AREAS: { id: KpiEntry["hypothesisArea"]; label: string }[] = [
  { id: "tutorial",     label: "Tutorial" },
  { id: "loop",         label: "Loop de jogo" },
  { id: "midgame",      label: "Mid-game" },
  { id: "monetization", label: "Monetização" },
  { id: "other",        label: "Outro" },
];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function KpiMainTab({ projectId, genre, entries, onSetGenre, onAddEntry, onUpdateEntry, onDeleteEntry }: Props) {
  const bench = GENRE_BENCHMARKS[genre];

  const [date, setDate] = useState(todayISO);
  const [d1, setD1] = useState<number | undefined>(undefined);
  const [d7, setD7] = useState<number | undefined>(undefined);
  const [d30, setD30] = useState<number | undefined>(undefined);
  const [sessionsPerDay, setSessionsPerDay] = useState<number | undefined>(undefined);
  const [sessionDuration, setSessionDuration] = useState<number | undefined>(undefined);
  const [conversionRate, setConversionRate] = useState<number | undefined>(undefined);
  const [hypothesis, setHypothesis] = useState("");
  const [hypothesisArea, setHypothesisArea] = useState<KpiEntry["hypothesisArea"]>("tutorial");
  const [saved, setSaved] = useState(false);

  const currentMetrics: KpiMetrics = { d1, d7, d30, sessionsPerDay, sessionDuration, conversionRate };
  const diagnosis = useMemo(() => diagnose(currentMetrics, genre), [d1, d7, d30, conversionRate, genre]);

  function handleSave() {
    const entry: Omit<KpiEntry, "id" | "createdAt"> = {
      projectId,
      date,
      genre,
      metrics: currentMetrics,
      hypothesis: hypothesis.trim() || undefined,
      hypothesisArea: hypothesis.trim() ? hypothesisArea : undefined,
    };
    onAddEntry(entry);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setD1(undefined);
    setD7(undefined);
    setD30(undefined);
    setSessionsPerDay(undefined);
    setSessionDuration(undefined);
    setConversionRate(undefined);
    setHypothesis("");
    setDate(todayISO());
  }

  const hasData = d1 !== undefined || d7 !== undefined || d30 !== undefined;

  return (
    <div className="space-y-6">
      {/* Genre selector */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Gênero do jogo</p>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onSetGenre(g.id)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                genre === g.id
                  ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                  : "border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-600">{bench.label}</p>
      </div>

      {/* Form */}
      <div className="rounded-xl border border-gray-700/60 bg-gray-900/60 p-4 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white">Nova entrada</p>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-300 focus:border-sky-500 focus:outline-none"
          />
        </div>

        {/* All metrics as cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MetricInputBar
            label="D1 Retenção"
            value={d1}
            onChange={setD1}
            benchmark={bench.d1}
            unit="%"
            helpText="% dos jogadores que voltam no 2º dia. Indica se o jogo causou boa primeira impressão. Problemas aqui quase sempre estão no tutorial."
          />
          <MetricInputBar
            label="D7 Retenção"
            value={d7}
            onChange={setD7}
            benchmark={bench.d7}
            unit="%"
            helpText="% dos jogadores ainda ativos após 7 dias. Mede se o loop principal engaja. Uma queda brusca de D1 para D7 geralmente significa que o loop não prende."
          />
          <MetricInputBar
            label="D30 Retenção"
            value={d30}
            onChange={setD30}
            benchmark={bench.d30}
            unit="%"
            helpText="% dos jogadores ainda ativos após 30 dias. Reflete se o mid-game tem profundidade suficiente para manter o interesse a longo prazo."
          />
          <MetricInputBar
            label="Sessões / dia"
            value={sessionsPerDay}
            onChange={setSessionsPerDay}
            benchmark={bench.sessionsPerDay}
            unit="x"
            helpText="Quantas vezes por dia o jogador médio abre o jogo. Valores altos indicam boa compulsividade e hooks de retorno (notificações, energia, eventos)."
          />
          <MetricInputBar
            label="Duração média"
            value={sessionDuration}
            onChange={setSessionDuration}
            benchmark={bench.sessionDuration}
            unit="min"
            helpText="Tempo médio de cada sessão em minutos. Muito curto pode indicar sessões frustrantes ou conteúdo escasso. Muito longo pode cansar o jogador."
          />
          <MetricInputBar
            label="Conversão"
            value={conversionRate}
            onChange={setConversionRate}
            benchmark={bench.conversionRate}
            unit="%"
            helpText="% dos jogadores que fizeram ao menos uma compra (moeda, skin, passe de batalha...). É o principal indicador de saúde da monetização do jogo."
          />
        </div>

        {/* Diagnosis (real time) */}
        {hasData && (
          <DiagnosisBlock diagnosis={diagnosis} />
        )}

        {/* Retention chart */}
        {hasData && (
          <div className="rounded-xl border border-gray-700/40 bg-gray-950/50 p-3">
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-widest">Curva de retenção</p>
            <RetentionChart metrics={currentMetrics} benchmark={bench} />
          </div>
        )}

        {/* Hypothesis */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Hipótese desta semana</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {HYPOTHESIS_AREAS.map((area) => (
              <button
                key={area.id}
                type="button"
                onClick={() => setHypothesisArea(area.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  hypothesisArea === area.id
                    ? "border-sky-500 bg-sky-500/20 text-sky-300"
                    : "border-gray-600 text-gray-500 hover:border-gray-400 hover:text-gray-300"
                }`}
              >
                {area.label}
              </button>
            ))}
          </div>
          <textarea
            value={hypothesis}
            onChange={(e) => setHypothesis(e.target.value)}
            placeholder="Vou mudar X porque acredito que Y vai melhorar..."
            rows={3}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-sky-500 focus:outline-none resize-none"
          />
        </div>

        {/* Save button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasData}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Salvar entrada
          </button>
          {saved && <span className="text-sm text-emerald-400">Salvo!</span>}
        </div>
      </div>

      {/* History */}
      {entries.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">Histórico</p>
          <KpiHistoryList
            entries={entries}
            onUpdateEntry={onUpdateEntry}
            onDeleteEntry={onDeleteEntry}
          />
        </div>
      )}
    </div>
  );
}
