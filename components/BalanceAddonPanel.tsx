"use client";

import { useMemo, useState } from "react";
import {
  calculateCurveMetrics,
  createProfileDefaults,
  generateBalanceCurve,
  suggestTargetTuning,
  simulateProgressionBySession,
} from "@/lib/balance/formulaEngine";
import type { BalanceAddonDraft } from "@/lib/balance/types";
import { BalanceComparisonPanel } from "@/components/BalanceComparisonPanel";
import { calculateSensitivity, compareCurves } from "@/lib/balance/simulationEngine";
import { useI18n } from "@/lib/i18n/provider";

interface BalanceAddonPanelProps {
  addon: BalanceAddonDraft;
  onChange: (next: BalanceAddonDraft) => void;
  onRemove: () => void;
}

function getPresetLabels(t: (key: string, fallback?: string) => string): Record<BalanceAddonDraft["preset"], string> {
  return {
    linear: t("balanceAddon.presets.linear.label", "Linear"),
    exponential: t("balanceAddon.presets.exponential.label", "Exponencial"),
    tiered: t("balanceAddon.presets.tiered.label", "Por tiers"),
    softCap: t("balanceAddon.presets.softCap.label", "Soft cap"),
    hardCap: t("balanceAddon.presets.hardCap.label", "Hard cap"),
    diminishingReturns: t("balanceAddon.presets.diminishingReturns.label", "Retorno decrescente"),
    piecewise: t("balanceAddon.presets.piecewise.label", "Por estagios"),
  };
}

function getPresetTips(t: (key: string, fallback?: string) => string): Record<BalanceAddonDraft["preset"], string> {
  return {
    linear: t(
      "balanceAddon.presets.linear.tip",
      "Linear aumenta sempre no mesmo ritmo (ex.: +50 XP por level). Use quando voce quer uma progressao simples e previsivel. Funciona muito bem em jogos casuais, educativos ou projetos pequenos onde a leitura precisa ser facil."
    ),
    exponential: t(
      "balanceAddon.presets.exponential.tip",
      "Exponencial comeca suave e fica mais pesado conforme o level sobe. Use quando voce quer que os primeiros niveis sejam rapidos e o endgame seja desafiador. Comum em RPGs, MMOs e jogos com foco em longo prazo."
    ),
    tiered: t(
      "balanceAddon.presets.tiered.tip",
      "Por tiers divide a progressao em faixas (ex.: 1-10, 11-20...) e cada faixa pode subir mais forte. Use quando voce quer marcos claros de dificuldade, como novos mundos/atos/ranks. Muito util em idle games, roguelites e jogos por capitulos."
    ),
    softCap: t(
      "balanceAddon.presets.softCap.tip",
      "Soft cap cresce rapido no inicio e desacelera perto de um teto, sem travar de forma brusca. Ideal para jogos com progressao longa e necessidade de controle no endgame."
    ),
    hardCap: t(
      "balanceAddon.presets.hardCap.tip",
      "Hard cap define um limite maximo absoluto. Quando chega no teto, para de subir. Ideal para evitar inflacao total em jogos competitivos ou economias muito sensiveis."
    ),
    diminishingReturns: t(
      "balanceAddon.presets.diminishingReturns.tip",
      "Retorno decrescente aumenta cada vez menos a cada level. Bom para sistemas de atributos/passivas onde voce quer evitar que um stat escale demais."
    ),
    piecewise: t(
      "balanceAddon.presets.piecewise.tip",
      "Por estagios usa um ritmo antes de um marco e outro ritmo depois. Bom para jogos por capitulos, temporadas ou mudancas de meta no mid/endgame."
    ),
  };
}

function getProfileLabels(t: (key: string, fallback?: string) => string): Record<NonNullable<BalanceAddonDraft["profile"]>, string> {
  return {
    rpg: t("balanceAddon.profile.rpg", "RPG"),
    idle: t("balanceAddon.profile.idle", "Idle"),
    roguelite: t("balanceAddon.profile.roguelite", "Roguelite"),
    casual: t("balanceAddon.profile.casual", "Casual"),
  };
}

function getParamMeta(
  t: (key: string, fallback?: string) => string
): Record<keyof BalanceAddonDraft["params"], { label: string; tooltip: string; expected: string }> {
  return {
  base: {
    label: t("balanceAddon.params.base.label", "base"),
    tooltip: t("balanceAddon.params.base.tooltip", "Define o ponto de partida. E quanto custa (ou vale) no comeco dos levels."),
    expected: t("balanceAddon.params.base.expected", "Se aumentar base, os niveis iniciais ficam mais caros/fortes. Se reduzir, o inicio fica mais leve."),
  },
  growth: {
    label: t("balanceAddon.params.growth.label", "growth"),
    tooltip: t("balanceAddon.params.growth.tooltip", "Controla o ritmo de crescimento entre os levels. Pense como o 'acelerador' da curva."),
    expected: t("balanceAddon.params.growth.expected", "Growth maior faz a curva subir mais rapido. Growth menor deixa a progressao mais suave."),
  },
  offset: {
    label: t("balanceAddon.params.offset.label", "offset"),
    tooltip: t("balanceAddon.params.offset.tooltip", "Ajuste fixo somado no final. Serve para corrigir tudo de uma vez sem mexer no formato da curva."),
    expected: t("balanceAddon.params.offset.expected", "Offset positivo sobe todos os valores. Offset negativo desce todos os valores."),
  },
  tierStep: {
    label: t("balanceAddon.params.tierStep.label", "tierStep"),
    tooltip: t("balanceAddon.params.tierStep.tooltip", "Define de quantos em quantos levels muda a faixa (tier). Ex.: 10 cria faixas 1-10, 11-20..."),
    expected: t("balanceAddon.params.tierStep.expected", "TierStep menor cria mudancas mais frequentes. TierStep maior deixa as mudancas mais espacadas."),
  },
  tierMultiplier: {
    label: t("balanceAddon.params.tierMultiplier.label", "tierMultiplier"),
    tooltip: t("balanceAddon.params.tierMultiplier.tooltip", "Forca de aumento aplicada quando troca de faixa. E o tamanho do 'degrau' entre tiers."),
    expected: t("balanceAddon.params.tierMultiplier.expected", "Multiplier maior gera saltos mais agressivos. Multiplier menor deixa transicoes mais suaves."),
  },
  capValue: {
    label: t("balanceAddon.params.capValue.label", "capValue"),
    tooltip: t("balanceAddon.params.capValue.tooltip", "Valor de teto usado por formulas de cap (soft/hard/diminishing)."),
    expected: t("balanceAddon.params.capValue.expected", "Aumentar capValue permite endgame mais alto antes de estabilizar."),
  },
  capStrength: {
    label: t("balanceAddon.params.capStrength.label", "capStrength"),
    tooltip: t("balanceAddon.params.capStrength.tooltip", "Forca da aproximacao ao cap no soft cap."),
    expected: t("balanceAddon.params.capStrength.expected", "Maior capStrength faz a curva encostar no teto mais cedo."),
  },
  plateauStartLevel: {
    label: t("balanceAddon.params.plateauStartLevel.label", "plateauStartLevel"),
    tooltip: t("balanceAddon.params.plateauStartLevel.tooltip", "Level em que comeca o segundo estagio da curva piecewise."),
    expected: t("balanceAddon.params.plateauStartLevel.expected", "Menor valor antecipa a mudanca de ritmo da progressao."),
  },
  plateauFactor: {
    label: t("balanceAddon.params.plateauFactor.label", "plateauFactor"),
    tooltip: t("balanceAddon.params.plateauFactor.tooltip", "Redutor de crescimento no segundo estagio da curva piecewise."),
    expected: t("balanceAddon.params.plateauFactor.expected", "Menor plateauFactor deixa o trecho final mais suave."),
  },
  };
}

const PARAM_KEYS: Array<keyof BalanceAddonDraft["params"]> = [
  "base",
  "growth",
  "offset",
  "tierStep",
  "tierMultiplier",
  "capValue",
  "capStrength",
  "plateauStartLevel",
  "plateauFactor",
];

const ALLOWED_FN_NAMES = new Set(["min", "max", "abs", "floor", "ceil", "round", "sqrt", "log", "exp", "pow"]);

export function BalanceAddonPanel({ addon, onChange, onRemove }: BalanceAddonPanelProps) {
  const { t } = useI18n();
  const presetLabels = useMemo(() => getPresetLabels(t), [t]);
  const presetTips = useMemo(() => getPresetTips(t), [t]);
  const profileLabels = useMemo(() => getProfileLabels(t), [t]);
  const paramMeta = useMemo(() => getParamMeta(t), [t]);
  const [showTable, setShowTable] = useState(true);

  const curveState = useMemo(() => {
    try {
      const curve = generateBalanceCurve({
        mode: addon.mode,
        preset: addon.preset,
        expression: addon.expression,
        startLevel: addon.startLevel,
        endLevel: addon.endLevel,
        decimals: addon.decimals,
        clampMin: addon.clampMin,
        clampMax: addon.clampMax,
        params: addon.params,
      });
      return { curve, error: "" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao calcular a curva.";
      return { curve: null, error: message };
    }
  }, [addon]);

  const points = useMemo(() => curveState.curve?.points ?? [], [curveState.curve]);
  const metrics = useMemo(() => calculateCurveMetrics(points), [points]);
  const simulationInput = useMemo(
    () =>
      addon.simulationInput || {
        mode: "continuous" as const,
        xpRateMode: "fixed" as const,
        xpPerMinute: 220,
        xpRanges: [
          { fromLevel: 1, toLevel: 10, xpPerMinute: 220 },
          { fromLevel: 11, toLevel: 25, xpPerMinute: 180 },
          { fromLevel: 26, toLevel: 100, xpPerMinute: 140 },
        ],
        winRate: 0.72,
        matchDurationMinutes: 8,
        sessionsPerDay: 3,
        bonusMultiplier: 1,
      },
    [addon.simulationInput]
  );
  const normalizedXpRanges = useMemo(() => {
    return (simulationInput.xpRanges || [])
      .map((range, index) => ({
        index,
        fromLevel: Math.max(1, Math.floor(Number(range.fromLevel) || 1)),
        toLevel: Math.max(1, Math.floor(Number(range.toLevel) || 1)),
        xpPerMinute: Math.max(0.1, Number(range.xpPerMinute) || 0.1),
      }))
      .sort((a, b) => a.fromLevel - b.fromLevel);
  }, [simulationInput.xpRanges]);
  const xpRangeWarnings = useMemo(() => {
    const warnings: string[] = [];
    for (const range of normalizedXpRanges) {
      if (range.fromLevel > range.toLevel) {
        warnings.push(`Faixa Lv ${range.fromLevel}-${range.toLevel} esta invertida (inicio maior que fim).`);
      }
      if (range.xpPerMinute <= 0) {
        warnings.push(`Faixa Lv ${range.fromLevel}-${range.toLevel} precisa de XP/min maior que zero.`);
      }
    }

    for (let i = 1; i < normalizedXpRanges.length; i += 1) {
      const previous = normalizedXpRanges[i - 1];
      const current = normalizedXpRanges[i];
      if (current.fromLevel <= previous.toLevel) {
        warnings.push(`Ha sobreposicao entre Lv ${previous.fromLevel}-${previous.toLevel} e Lv ${current.fromLevel}-${current.toLevel}.`);
      } else if (current.fromLevel > previous.toLevel + 1) {
        warnings.push(`Ha gap entre Lv ${previous.toLevel} e Lv ${current.fromLevel}. Levels sem faixa usam fallback automatico.`);
      }
    }
    return warnings;
  }, [normalizedXpRanges]);
  const simulation = useMemo(
    () => simulateProgressionBySession(points, simulationInput),
    [points, simulationInput]
  );
  const targetSuggestion = useMemo(() => {
    if (!addon.target) return null;
    return suggestTargetTuning(points, addon.target, simulationInput, addon.preset, addon.params);
  }, [addon.target, points, simulationInput, addon.preset, addon.params]);
  const targetUnit: "hours" | "days" = simulationInput.mode === "sessionBased" ? "days" : "hours";
  const targetValue = useMemo(() => {
    if (!addon.target) return targetUnit === "days" ? 7 : 10;
    const raw =
      addon.target.targetValue ??
      addon.target.targetHours ??
      (targetUnit === "days" ? 7 : 10);
    return Math.max(0.1, Number(raw || (targetUnit === "days" ? 7 : 10)));
  }, [addon.target, targetUnit]);
  const targetComparison = useMemo(() => {
    if (!addon.target) return null;
    const milestone = simulation.hoursToMilestones.find((entry) => entry.level === addon.target?.targetLevel);
    if (!milestone) return null;
    const measured = targetUnit === "days" ? milestone.calendarDays : milestone.hours;
    if (!Number.isFinite(measured)) return null;
    const diffPercent = (Math.abs((measured as number) - targetValue) / targetValue) * 100;
    return { measured: measured as number, diffPercent };
  }, [addon.target, simulation.hoursToMilestones, targetUnit, targetValue]);
  const targetStatus = useMemo(() => {
    if (!targetComparison) return null;
    const diffPercent = targetComparison.diffPercent;
    const unitLabel = targetUnit === "days" ? "dias reais" : "horas ativas";

    if (diffPercent <= 5) {
      return {
        label: "Na meta",
        detail: `Diferenca de ${roundDisplay(diffPercent)}% em relacao ao alvo de ${unitLabel}.`,
        className: "bg-emerald-900/40 border-emerald-700 text-emerald-200",
      };
    }
    if (diffPercent <= 15) {
      return {
        label: "Aproximando",
        detail: `Diferenca de ${roundDisplay(diffPercent)}% em relacao ao alvo de ${unitLabel}.`,
        className: "bg-amber-900/40 border-amber-700 text-amber-200",
      };
    }
    return {
      label: "Longe da meta",
      detail: `Diferenca de ${roundDisplay(diffPercent)}% em relacao ao alvo de ${unitLabel}.`,
      className: "bg-rose-900/40 border-rose-700 text-rose-200",
    };
  }, [targetComparison, targetUnit]);
  const sensitivity = useMemo(() => {
    if (!addon.comparisonBaseline || addon.comparisonBaseline.length === 0) return null;
    return calculateSensitivity(addon.comparisonBaseline, points, "growth", 5);
  }, [addon.comparisonBaseline, points]);
  const baselineStatus = useMemo(() => {
    const baseline = addon.comparisonBaseline || [];
    if (baseline.length === 0) return null;
    const rows = compareCurves(baseline, points);
    const changed = rows.filter((row) => Math.abs(row.absoluteDelta) > 0.0001);
    if (changed.length === 0) {
      return {
        label: "Sem diferencas entre A e B",
        detail: "Voce salvou a baseline, mas ainda nao mudou a curva. Ajuste parametros para comparar o antes/depois.",
      };
    }
    const averageAbsDeltaPercent =
      changed.reduce((sum, row) => sum + Math.abs(row.percentDelta), 0) / changed.length;
    return {
      label: "Comparacao ativa",
      detail: `${changed.length} niveis mudaram. Variacao media aproximada: ${roundDisplay(averageAbsDeltaPercent)}%.`,
    };
  }, [addon.comparisonBaseline, points]);
  const suggestedAdjustments = useMemo(() => {
    if (!targetSuggestion) return null;
    const entries = Object.entries(targetSuggestion.recommendedAdjustments || {}).filter(([, value]) =>
      Number.isFinite(value as number)
    ) as Array<[keyof BalanceAddonDraft["params"], number]>;
    if (entries.length === 0) return null;
    const next = { ...addon.params };
    for (const [key, value] of entries) {
      next[key] = value;
    }
    return next;
  }, [addon.params, targetSuggestion]);
  const adjustmentLabel = useMemo(() => {
    if (!suggestedAdjustments) return "";
    const changed = Object.entries(suggestedAdjustments).filter(([key, value]) => {
      const current = addon.params[key as keyof BalanceAddonDraft["params"]];
      return Math.abs(Number(current) - Number(value)) > 0.0001;
    });
    if (changed.length === 0) return "Sem ajuste necessario";
    return changed
      .map(([key, value]) => `${key}: ${roundDisplay(addon.params[key as keyof BalanceAddonDraft["params"]])} -> ${roundDisplay(Number(value))}`)
      .join(" | ");
  }, [addon.params, suggestedAdjustments]);
  const metricExamples = useMemo(() => {
    const first = points[0];
    const second = points[1];
    const last = points[points.length - 1];
    const levelSpan = first && last ? Math.max(1, last.level - first.level) : 1;
    const totalPerLevel = metrics.cumulativeValue / levelSpan;

    return {
      stepExample:
        first && second
          ? `Exemplo atual: do Lv ${first.level} para o Lv ${second.level}, voce sobe cerca de ${
              formatReadableNumber(roundDisplay(second.value - first.value))
            } pontos.`
          : "Exemplo atual: a subida fica proxima desse valor na maior parte dos levels.",
      growthExample:
        first && second && first.value !== 0
          ? `Exemplo atual: de Lv ${first.level} para Lv ${second.level}, o aumento e ${roundDisplay(
              ((second.value - first.value) / Math.abs(first.value)) * 100
            )}%.`
          : "Exemplo atual: este percentual mostra o ritmo medio de aceleracao da curva.",
      cumulativeExample:
        first && last
          ? `Exemplo atual: para atravessar do Lv ${first.level} ao Lv ${last.level}, o total e ${formatReadableNumber(
              metrics.cumulativeValue
            )} (media de ${formatReadableNumber(roundDisplay(totalPerLevel))} por level).`
          : "Exemplo atual: representa o esforco total para completar a faixa selecionada.",
    };
  }, [metrics.cumulativeValue, points]);
  const visibleParams = useMemo(() => {
    if (addon.mode === "preset") {
      if (addon.preset === "tiered") return PARAM_KEYS;
      if (addon.preset === "softCap") return ["base", "growth", "offset", "capValue", "capStrength"] as Array<keyof BalanceAddonDraft["params"]>;
      if (addon.preset === "hardCap") return ["base", "growth", "offset", "capValue"] as Array<keyof BalanceAddonDraft["params"]>;
      if (addon.preset === "diminishingReturns") return ["base", "growth", "offset", "capValue"] as Array<keyof BalanceAddonDraft["params"]>;
      if (addon.preset === "piecewise") return ["base", "growth", "offset", "plateauStartLevel", "plateauFactor"] as Array<keyof BalanceAddonDraft["params"]>;
      return ["base", "growth", "offset"] as Array<keyof BalanceAddonDraft["params"]>;
    }

    const matches = addon.expression.match(/\b[A-Za-z_][A-Za-z0-9_]*\b/g) || [];
    const used = new Set(matches.filter((token) => !ALLOWED_FN_NAMES.has(token)));
    return PARAM_KEYS.filter((key) => used.has(key));
  }, [addon.mode, addon.preset, addon.expression]);

  const exportLevelXpJson = () => {
    if (!points.length) return;

    const payload = {
      version: 1,
      generatedAt: new Date().toISOString(),
      addon: {
        id: addon.id,
        name: addon.name,
        startLevel: addon.startLevel,
        endLevel: addon.endLevel,
      },
      levelXpTable: points.map((point) => ({
        level: point.level,
        xp: point.value,
      })),
    };

    const safeName = (addon.name || "balanceamento")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const filename = `${safeName || "balanceamento"}-lv-xp.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-2xl border border-cyan-700/50 bg-gray-900/70 p-4 md:p-5">
      <div className="mb-4 space-y-3">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-cyan-300">
            {t("balanceAddon.nameLabel", "Nome do bloco")}
          </label>
          <input
            type="text"
            value={addon.name}
            onChange={(e) => onChange({ ...addon, name: e.target.value })}
            className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
            placeholder={t("balanceAddon.namePlaceholder", "Ex.: XP por Level")}
          />
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              if (window.confirm(t("balanceAddon.removeConfirm", "Tem certeza que deseja remover este addon de balanceamento?"))) {
                onRemove();
              }
            }}
            className="rounded-lg border border-red-700/60 bg-red-900/30 px-3 py-2 text-sm text-red-200 hover:bg-red-900/50"
          >
            {t("balanceAddon.removeButton", "Remover addon")}
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-3">
          <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">Modo de formula</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...addon, mode: "preset" })}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                addon.mode === "preset" ? "bg-cyan-600 text-white" : "bg-gray-700 text-gray-200 hover:bg-gray-600"
              }`}
            >
              Preset
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...addon, mode: "advanced" })}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                addon.mode === "advanced" ? "bg-cyan-600 text-white" : "bg-gray-700 text-gray-200 hover:bg-gray-600"
              }`}
            >
              Avancado
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-3">
          <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">Faixa de niveis</p>
          <div className="grid grid-cols-3 gap-2">
            <NumberInput
              label="Inicio"
              value={addon.startLevel}
              onChange={(value) => onChange({ ...addon, startLevel: value })}
            />
            <NumberInput
              label="Fim"
              value={addon.endLevel}
              onChange={(value) => onChange({ ...addon, endLevel: value })}
            />
            <NumberInput
              label="Decimais"
              value={addon.decimals}
              onChange={(value) => onChange({ ...addon, decimals: value })}
            />
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-gray-700 bg-gray-800/60 p-3">
        <label className="mb-2 block text-xs uppercase tracking-wide text-gray-400">Perfil de jogo (atalho)</label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(profileLabels) as Array<keyof typeof profileLabels>).map((profileId) => (
            <button
              key={profileId}
              type="button"
              onClick={() =>
                onChange({
                  ...addon,
                  profile: profileId,
                  params: createProfileDefaults(profileId),
                })
              }
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                addon.profile === profileId ? "bg-emerald-600 text-white" : "bg-gray-700 text-gray-200 hover:bg-gray-600"
              }`}
            >
              {profileLabels[profileId]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Estes perfis aplicam valores iniciais recomendados. Depois ajuste fino conforme seu projeto.
        </p>
      </div>

      {addon.mode === "preset" ? (
        <div className="mb-4 rounded-xl border border-gray-700 bg-gray-800/60 p-3">
          <label className="mb-2 block text-xs uppercase tracking-wide text-gray-400">Preset</label>
          <select
            value={addon.preset}
            onChange={(e) => onChange({ ...addon, preset: e.target.value as BalanceAddonDraft["preset"] })}
            className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
          >
            {Object.entries(presetLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-gray-400">{presetTips[addon.preset]}</p>
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-gray-700 bg-gray-800/60 p-3">
          <label className="mb-2 block text-xs uppercase tracking-wide text-gray-400">Expressao</label>
          <input
            type="text"
            value={addon.expression}
            onChange={(e) => onChange({ ...addon, expression: e.target.value })}
            className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
            placeholder="base * pow(level, growth) + offset"
          />
          <p className="mt-2 text-xs text-gray-400">
            Modo avancado para quem quer controle total da formula. Use as variaveis <code>level</code>, <code>base</code>, <code>growth</code>,{" "}
            <code>offset</code>, <code>tierStep</code>, <code>tierMultiplier</code> e as funcoes <code>min</code>, <code>max</code>, <code>abs</code>,{" "}
            <code>floor</code>, <code>ceil</code>, <code>round</code>, <code>sqrt</code>, <code>log</code>, <code>exp</code>, <code>pow</code>. Se estiver comecando,
            teste primeiro um preset e depois ajuste no avancado.
          </p>
        </div>
      )}

      {visibleParams.length > 0 ? (
        <div className="mb-4 grid gap-3 md:grid-cols-5">
          {visibleParams.map((paramKey) => (
            <NumberInput
              key={paramKey}
              label={paramMeta[paramKey].label}
              tooltip={paramMeta[paramKey].tooltip}
              expected={paramMeta[paramKey].expected}
              value={addon.params[paramKey]}
              onChange={(value) => onChange({ ...addon, params: { ...addon.params, [paramKey]: value } })}
            />
          ))}
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-gray-700 bg-gray-800/60 p-3 text-xs text-gray-300">
          Nenhum parametro detectado nesta formula. Inclua variaveis como <code>base</code>, <code>growth</code> ou{" "}
          <code>offset</code> para exibir controles.
        </div>
      )}

      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <NumberInput
          label="Clamp minimo (opcional)"
          tooltip="Limite inferior da curva. Impede que o valor calculado fique abaixo deste numero."
          expected="Use para garantir piso minimo (ex.: nunca exigir menos de 100 XP)."
          value={addon.clampMin}
          onChange={(value) => onChange({ ...addon, clampMin: Number.isFinite(value) ? value : undefined })}
          allowEmpty
        />
        <NumberInput
          label="Clamp maximo (opcional)"
          tooltip="Limite superior da curva. Impede que o valor calculado passe deste numero."
          expected="Use para evitar picos exagerados (ex.: cap de custo no endgame)."
          value={addon.clampMax}
          onChange={(value) => onChange({ ...addon, clampMax: Number.isFinite(value) ? value : undefined })}
          allowEmpty
        />
      </div>

      {curveState.error ? (
        <div className="rounded-lg border border-amber-700/70 bg-amber-900/20 p-3 text-sm text-amber-200">{curveState.error}</div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-gray-300">
            <span>Pontos: {points.length}</span>
            <span>Min: {curveState.curve?.minValue}</span>
            <span>Max: {curveState.curve?.maxValue}</span>
          </div>
          <div className="mb-3 grid gap-2 md:grid-cols-3 text-xs">
            <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-2 text-gray-200">
              <strong className="text-gray-100">Subida media por level:</strong> {formatReadableNumber(metrics.averageStep)}
              <p className="mt-1 text-gray-400">
                Em media, quanto o valor aumenta de um level para o proximo.
              </p>
              <p className="mt-1 text-gray-500">{metricExamples.stepExample}</p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-2 text-gray-200">
              <strong className="text-gray-100">Ritmo medio de crescimento:</strong> {metrics.averageGrowthPercent}%
              <p className="mt-1 text-gray-400">
                Percentual medio de aumento entre levels consecutivos.
              </p>
              <p className="mt-1 text-gray-500">{metricExamples.growthExample}</p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-2 text-gray-200">
              <strong className="text-gray-100">Total acumulado na faixa:</strong> {formatReadableNumber(metrics.cumulativeValue)}
              <p className="mt-1 text-gray-400">
                Soma de todos os valores do level inicial ao final selecionado.
              </p>
              <p className="mt-1 text-gray-500">{metricExamples.cumulativeExample}</p>
            </div>
          </div>
          <div className="mb-3 grid gap-2 md:grid-cols-3 text-xs">
            <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-2 text-gray-200">
              <strong className="text-gray-100">Saltos bruscos (spikes):</strong> {metrics.spikeLevels.length ? metrics.spikeLevels.join(", ") : "Nenhum"}
              <p className="mt-1 text-gray-400">
                Muitos spikes = sensacao de parede de grind.
              </p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-2 text-gray-200">
              <strong className="text-gray-100">Trechos parados (platos):</strong> {metrics.plateauLevels.length ? metrics.plateauLevels.join(", ") : "Nenhum"}
              <p className="mt-1 text-gray-400">
                Platos no inicio podem ser bons para onboarding (levels faceis). Revise apenas se esses trechos se estenderem demais no meio/final do jogo.
              </p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-2 text-gray-200">
              <strong className="text-gray-100">Quedas de curva (regressoes):</strong> {metrics.regressionLevels.length ? metrics.regressionLevels.join(", ") : "Nenhuma"}
              <p className="mt-1 text-gray-400">
                Qualquer regressao em XP por level pede revisao da formula (a nao ser que seja proposital).
              </p>
            </div>
          </div>
          <SimpleLineChart points={points} simulation={simulation} simulationMode={simulationInput.mode} simulationInput={simulationInput} />
          <div className="mt-3 rounded-xl border border-gray-700 bg-gray-800/50 p-3">
            <h4 className="text-sm font-semibold text-gray-100 mb-2">{t("balanceAddon.simulation.title", "Simulacao de sessao")}</h4>
            <p className="mb-2 text-xs text-gray-400">
              Esta simulacao estima quanto tempo o jogador leva para evoluir, com base no ritmo medio de ganho de XP em partidas reais.
            </p>
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...addon,
                    simulationInput: { ...simulationInput, mode: "continuous" },
                  })
                }
                className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
                  (simulationInput.mode || "continuous") === "continuous"
                    ? "bg-cyan-600 text-white"
                    : "bg-gray-700 text-gray-200 hover:bg-gray-600"
                }`}
              >
                Simulacao continua
              </button>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...addon,
                    simulationInput: { ...simulationInput, mode: "sessionBased" },
                  })
                }
                className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
                  simulationInput.mode === "sessionBased"
                    ? "bg-cyan-600 text-white"
                    : "bg-gray-700 text-gray-200 hover:bg-gray-600"
                }`}
              >
                Simulacao por sessoes/dia
              </button>
            </div>
            <div className="mb-3 rounded-lg border border-gray-700 bg-gray-900/40 p-2">
              <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">Ritmo de ganho de XP</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...addon,
                      simulationInput: {
                        ...simulationInput,
                        xpRateMode: "fixed",
                      },
                    })
                  }
                  className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
                    (simulationInput.xpRateMode || "fixed") === "fixed"
                      ? "bg-cyan-600 text-white"
                      : "bg-gray-700 text-gray-200 hover:bg-gray-600"
                  }`}
                >
                  {t("balanceAddon.simulation.xpRateMode.fixed", "XP fixo")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...addon,
                      simulationInput: {
                        ...simulationInput,
                        xpRateMode: "byLevelRange",
                        xpRanges:
                          simulationInput.xpRanges && simulationInput.xpRanges.length > 0
                            ? simulationInput.xpRanges
                            : [
                                { fromLevel: addon.startLevel, toLevel: Math.min(addon.endLevel, addon.startLevel + 9), xpPerMinute: simulationInput.xpPerMinute },
                                { fromLevel: Math.min(addon.endLevel, addon.startLevel + 10), toLevel: addon.endLevel, xpPerMinute: Math.max(1, simulationInput.xpPerMinute * 0.75) },
                              ],
                      },
                    })
                  }
                  className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
                    simulationInput.xpRateMode === "byLevelRange"
                      ? "bg-cyan-600 text-white"
                      : "bg-gray-700 text-gray-200 hover:bg-gray-600"
                  }`}
                >
                  {t("balanceAddon.simulation.xpRateMode.byLevelRange", "XP por faixas de level")}
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Cada faixa representa o ritmo de farm de uma etapa do jogo (onboarding, midgame, endgame). Assim, a simulacao fica mais proxima da realidade.
              </p>
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              {(simulationInput.xpRateMode || "fixed") === "fixed" ? (
                <NumberInput
                  label="XP/min"
                  tooltip="Quantidade media de XP que o jogador ganha por minuto jogando."
                  expected="Maior XP/min reduz o tempo necessario para subir de level."
                  value={simulationInput.xpPerMinute}
                  onChange={(value) =>
                    onChange({ ...addon, simulationInput: { ...simulationInput, xpPerMinute: value } })
                  }
                />
              ) : (
                <div className="md:col-span-2 rounded-lg border border-gray-700 bg-gray-900/40 p-2">
                  <p className="mb-2 text-xs font-medium text-gray-200">Faixas de XP/min por level</p>
                  <div className="space-y-2">
                    {(simulationInput.xpRanges || []).map((range, index) => (
                      <div key={`${index}-${range.fromLevel}-${range.toLevel}`} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                        <NumberInput
                          label="De"
                          value={range.fromLevel}
                          onChange={(value) =>
                            onChange({
                              ...addon,
                              simulationInput: {
                                ...simulationInput,
                                xpRanges: (simulationInput.xpRanges || []).map((entry, entryIndex) =>
                                  entryIndex === index ? { ...entry, fromLevel: Math.max(1, Math.floor(value)) } : entry
                                ),
                              },
                            })
                          }
                        />
                        <NumberInput
                          label="Ate"
                          value={range.toLevel}
                          onChange={(value) =>
                            onChange({
                              ...addon,
                              simulationInput: {
                                ...simulationInput,
                                xpRanges: (simulationInput.xpRanges || []).map((entry, entryIndex) =>
                                  entryIndex === index ? { ...entry, toLevel: Math.max(1, Math.floor(value)) } : entry
                                ),
                              },
                            })
                          }
                        />
                        <NumberInput
                          label="XP/min"
                          value={range.xpPerMinute}
                          onChange={(value) =>
                            onChange({
                              ...addon,
                              simulationInput: {
                                ...simulationInput,
                                xpRanges: (simulationInput.xpRanges || []).map((entry, entryIndex) =>
                                  entryIndex === index ? { ...entry, xpPerMinute: Math.max(0.1, value) } : entry
                                ),
                              },
                            })
                          }
                        />
                        <button
                          type="button"
                          onClick={() =>
                            onChange({
                              ...addon,
                              simulationInput: {
                                ...simulationInput,
                                xpRanges: (simulationInput.xpRanges || []).filter((_, entryIndex) => entryIndex !== index),
                              },
                            })
                          }
                          className="h-10 rounded-lg border border-rose-700/60 bg-rose-900/20 px-2 text-xs text-rose-200 hover:bg-rose-900/40"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const ranges = simulationInput.xpRanges || [];
                      const last = ranges[ranges.length - 1];
                      const nextFrom = last ? Math.max(1, Math.floor(last.toLevel + 1)) : addon.startLevel;
                      const nextTo = Math.min(addon.endLevel, nextFrom + 9);
                      onChange({
                        ...addon,
                        simulationInput: {
                          ...simulationInput,
                          xpRanges: [
                            ...ranges,
                            {
                              fromLevel: nextFrom,
                              toLevel: Math.max(nextFrom, nextTo),
                              xpPerMinute: last?.xpPerMinute || simulationInput.xpPerMinute,
                            },
                          ],
                        },
                      });
                    }}
                    className="mt-2 rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs text-gray-100 hover:bg-gray-700"
                  >
                    + Adicionar faixa
                  </button>
                  {xpRangeWarnings.length > 0 && (
                    <div className="mt-2 rounded-lg border border-amber-700/60 bg-amber-900/20 p-2 text-xs text-amber-200">
                      {xpRangeWarnings.map((warning) => (
                        <p key={warning}>{warning}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {simulationInput.mode !== "sessionBased" && (
                <NumberInput
                  label="WinRate (0-1)"
                  tooltip="Taxa media de vitoria. Use 0.5 para 50%, 0.7 para 70%."
                  expected="WinRate maior acelera a progressao; menor deixa a progressao mais lenta."
                  value={simulationInput.winRate}
                  onChange={(value) =>
                    onChange({ ...addon, simulationInput: { ...simulationInput, winRate: value } })
                  }
                />
              )}
              <NumberInput
                label={simulationInput.mode === "sessionBased" ? "Min por sessao" : "Duracao partida (min)"}
                tooltip={
                  simulationInput.mode === "sessionBased"
                    ? "Tempo medio de uma sessao no jogo, em minutos. Ex.: 3 = 3 minutos."
                    : "Tempo medio de cada partida em minutos. Ex.: 8 = 8 minutos."
                }
                expected={
                  simulationInput.mode === "sessionBased"
                    ? "Define quanto tempo de tela o jogador realmente joga por retorno."
                    : "Partidas mais curtas permitem ciclos mais rapidos de ganho e ajuste."
                }
                value={simulationInput.matchDurationMinutes}
                onChange={(value) =>
                  onChange({ ...addon, simulationInput: { ...simulationInput, matchDurationMinutes: value } })
                }
              />
              {simulationInput.mode === "sessionBased" && (
                <NumberInput
                  label="Sessoes por dia"
                  tooltip="Quantas vezes, em media, o jogador retorna ao jogo no mesmo dia."
                  expected="Menos sessoes por dia aumenta o tempo em dias de progressao."
                  value={simulationInput.sessionsPerDay}
                  onChange={(value) =>
                    onChange({ ...addon, simulationInput: { ...simulationInput, sessionsPerDay: value } })
                  }
                />
              )}
              <NumberInput
                label="Bonus"
                tooltip="Multiplicador de bonus de XP (eventos, booster, passe, etc). 1 = sem bonus."
                expected="Bonus maior acelera a evolucao; 1.2 significa +20% de ganho."
                value={simulationInput.bonusMultiplier}
                onChange={(value) =>
                  onChange({ ...addon, simulationInput: { ...simulationInput, bonusMultiplier: value } })
                }
              />
            </div>
            <div className="mt-2 text-xs text-gray-300">
              {simulation.hoursToMilestones.map((milestone) => (
                <span key={milestone.level} className="mr-3">
                  {simulationInput.mode === "sessionBased" && milestone.calendarDays != null
                    ? `Lv ${milestone.level}: ${formatCalendarDaysHuman(milestone.calendarDays)} (calendario real) | ${formatHoursHuman(
                        milestone.hours
                      )} de jogo ativo`
                    : `Lv ${milestone.level}: ${formatHoursHuman(milestone.hours)}`}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-gray-700 bg-gray-800/50 p-3">
            <h4 className="text-sm font-semibold text-gray-100 mb-2">{t("balanceAddon.target.title", "Meta de progressao")}</h4>
            <p className="mb-2 text-xs text-gray-400">
              {targetUnit === "days"
                ? "A meta abaixo esta em dias reais de calendario (modo sessoes/dia)."
                : "A meta abaixo esta em horas de jogo ativo (modo continuo)."}
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              <NumberInput
                label="Level alvo"
                value={addon.target?.targetLevel}
                onChange={(value) =>
                  onChange({
                    ...addon,
                    target: {
                      targetLevel: value,
                      targetValue,
                      targetUnit,
                    },
                  })
                }
              />
              <NumberInput
                label={targetUnit === "days" ? "Dias alvo" : "Horas alvo"}
                value={targetValue}
                onChange={(value) =>
                  onChange({
                    ...addon,
                    target: {
                      targetLevel: addon.target?.targetLevel ?? 50,
                      targetValue: value,
                      targetUnit,
                    },
                  })
                }
              />
            </div>
            {targetSuggestion && (
              <div className="mt-2 space-y-2">
                {targetStatus && (
                  <div className={`rounded-lg border px-2.5 py-2 text-xs ${targetStatus.className}`}>
                    <strong>{targetStatus.label}</strong>
                    <p className="mt-1 opacity-90">{targetStatus.detail}</p>
                  </div>
                )}
                <p className="text-xs text-emerald-300">{targetSuggestion.message}</p>
                {suggestedAdjustments != null && adjustmentLabel !== "Sem ajuste necessario" && (
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...addon,
                        params: {
                          ...suggestedAdjustments,
                        },
                      })
                    }
                    className="rounded-lg border border-emerald-700/70 bg-emerald-900/30 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-900/50"
                  >
                    Aplicar ajuste sugerido ({adjustmentLabel})
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="mt-3 rounded-xl border border-gray-700 bg-gray-800/50 p-3">
            <h4 className="text-sm font-semibold text-gray-100 mb-1">Comparacao A/B (antes e depois)</h4>
            <p className="text-xs text-gray-400 mb-2">
              A baseline A e uma foto da curva atual. Depois de mudar parametros, a curva nova vira B e mostramos a diferenca.
            </p>
            {baselineStatus && (
              <div className="mb-2 rounded-lg border border-gray-700 bg-gray-900/60 p-2 text-xs text-gray-200">
                <strong className="text-gray-100">{baselineStatus.label}.</strong>
                <p className="mt-1 text-gray-400">{baselineStatus.detail}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...addon, comparisonBaseline: points })}
              className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs text-gray-100 hover:bg-gray-700"
            >
              Salvar baseline A (estado atual)
            </button>
            {addon.comparisonBaseline && addon.comparisonBaseline.length > 0 && (
              <button
                type="button"
                onClick={() => onChange({ ...addon, comparisonBaseline: [] })}
                className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs text-gray-100 hover:bg-gray-700"
              >
                Limpar comparacao A/B
              </button>
            )}
            </div>
          </div>
          {addon.comparisonBaseline && addon.comparisonBaseline.length > 0 && (
            <div className="mt-3 space-y-2">
              <BalanceComparisonPanel basePoints={addon.comparisonBaseline} candidatePoints={points} />
              {sensitivity && (
                <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-3 text-xs text-gray-200">
                  <strong className="text-gray-100">Sensibilidade de parametros:</strong>{" "}
                  ao ajustar <strong>{sensitivity.parameter}</strong> em {sensitivity.percentChange}%, os niveis mais sensiveis foram{" "}
                  {sensitivity.topAffectedLevels.map((entry) => `Lv ${entry.level} (${entry.impactPercent.toFixed(1)}%)`).join(", ")}.
                  <p className="mt-1 text-gray-400">
                    Leitura humana: niveis com impacto alto mudam muito com pequenos ajustes. Se o impacto estiver concentrado em poucos levels,
                    pode haver risco de pico ou vale na progressao.
                  </p>
                </div>
              )}
            </div>
          )}
          <div className="mt-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowTable((prev) => !prev)}
                className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs text-gray-100 hover:bg-gray-700"
              >
                {showTable ? "Ocultar tabela" : "Mostrar tabela"}
              </button>
              <button
                type="button"
                onClick={exportLevelXpJson}
                className="rounded-lg border border-emerald-700/70 bg-emerald-900/30 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-900/50"
              >
                Exportar Lv-&gt;XP (JSON)
              </button>
            </div>
          </div>
          {showTable && (
            <div className="mt-3 max-h-56 overflow-auto rounded-xl border border-gray-700">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-gray-900 text-gray-300">
                  <tr>
                    <th className="px-3 py-2">Level</th>
                    <th className="px-3 py-2">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((point) => (
                    <tr key={point.level} className="border-t border-gray-800 text-gray-200">
                      <td className="px-3 py-1.5">{point.level}</td>
                      <td className="px-3 py-1.5">{point.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function roundDisplay(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatHoursHuman(hours: number): string {
  const safeHours = Math.max(0, Number(hours) || 0);
  const totalMinutes = Math.round(safeHours * 60);

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (totalHours < 24) {
    return minutes > 0 ? `${totalHours}h ${minutes}min` : `${totalHours}h`;
  }

  const days = Math.floor(totalHours / 24);
  const hoursRemainder = totalHours % 24;

  if (hoursRemainder === 0 && minutes === 0) {
    return `${days}d`;
  }

  if (minutes === 0) {
    return `${days}d ${hoursRemainder}h`;
  }

  return `${days}d ${hoursRemainder}h ${minutes}min`;
}

function formatCalendarDaysHuman(daysValue: number): string {
  const safeDays = Math.max(0, Number(daysValue) || 0);
  const totalMinutes = Math.round(safeDays * 24 * 60);

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (totalHours < 24) {
    return minutes > 0 ? `${totalHours}h ${minutes}min` : `${totalHours}h`;
  }

  const days = Math.floor(totalHours / 24);
  const hoursRemainder = totalHours % 24;

  if (hoursRemainder === 0 && minutes === 0) return `${days}d`;
  if (minutes === 0) return `${days}d ${hoursRemainder}h`;
  return `${days}d ${hoursRemainder}h ${minutes}min`;
}

function NumberInput({
  label,
  tooltip,
  expected,
  value,
  onChange,
  allowEmpty = false,
}: {
  label: string;
  tooltip?: string;
  expected?: string;
  value: number | undefined;
  onChange: (value: number) => void;
  allowEmpty?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-xs uppercase tracking-wide text-gray-400">
        {label}
        {tooltip && (
          <span
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-600 text-[10px] text-gray-300 cursor-help"
            title={`${tooltip}${expected ? ` Resultado esperado: ${expected}` : ""}`}
            aria-label={`Ajuda sobre ${label}`}
          >
            ?
          </span>
        )}
      </span>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => {
          if (allowEmpty && e.target.value.trim() === "") {
            onChange(Number.NaN);
            return;
          }
          const parsed = Number(e.target.value);
          onChange(Number.isFinite(parsed) ? parsed : 0);
        }}
        className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
      />
      {expected && <span className="mt-1 block text-[11px] text-gray-500">{expected}</span>}
    </label>
  );
}

function SimpleLineChart({
  points,
  simulation,
  simulationMode,
  simulationInput,
}: {
  points: Array<{ level: number; value: number }>;
  simulation: { minutesPerLevel: Array<{ level: number; minutes: number }> };
  simulationMode: "continuous" | "sessionBased" | undefined;
  simulationInput: { matchDurationMinutes: number; sessionsPerDay?: number };
}) {
  if (points.length === 0) return null;

  const width = 900;
  const height = 340;
  const plot = { left: 80, right: 20, top: 24, bottom: 48 };
  const minY = Math.min(...points.map((point) => point.value));
  const maxY = Math.max(...points.map((point) => point.value));
  const yRange = maxY - minY || 1;
  const xRange = Math.max(1, points.length - 1);
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const xTicks = buildIndexTicks(points.length, 5);
  const yTicks = buildValueTicks(minY, maxY, 5);
  const rangeTiming = buildRangeTimingSegments({
    points,
    minutesPerLevel: simulation.minutesPerLevel,
    mode: simulationMode,
    matchDurationMinutes: simulationInput.matchDurationMinutes,
    sessionsPerDay: simulationInput.sessionsPerDay,
    tickCount: 5,
  });

  const path = points
    .map((point, index) => {
      const x = plot.left + (index / xRange) * plotWidth;
      const y = plot.top + (1 - (point.value - minY) / yRange) * plotHeight;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <div className="w-full rounded-xl border border-gray-700 bg-gray-950/70 p-2">
      <div className="mb-2 rounded-md border border-gray-700 bg-gray-900/70 px-2 py-1 text-[11px] text-gray-300">
        <strong className="text-gray-100">Legenda:</strong> linha ciano = XP por level.
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto"
        role="img"
        aria-label="Grafico de progressao por nivel"
      >
        {yTicks.map((tick) => {
          const y = plot.top + (1 - (tick - minY) / yRange) * plotHeight;
          return (
            <g key={`y-${tick}`}>
              <line x1={plot.left} y1={y} x2={width - plot.right} y2={y} stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
              <text x={plot.left - 6} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="10">
                {formatAxisNumber(tick)}
              </text>
            </g>
          );
        })}
        {xTicks.map((idx) => {
          const x = plot.left + (idx / xRange) * plotWidth;
          const levelLabel = points[idx]?.level ?? points[0].level;
          return (
            <g key={`x-${idx}`}>
              <line x1={x} y1={plot.top} x2={x} y2={height - plot.bottom} stroke="#1f2937" strokeWidth="1" />
              <text x={x} y={height - plot.bottom + 16} textAnchor="middle" fill="#94a3b8" fontSize="10">
                Lv {levelLabel}
              </text>
            </g>
          );
        })}
        <line x1={plot.left} y1={height - plot.bottom} x2={width - plot.right} y2={height - plot.bottom} stroke="#64748b" strokeWidth="1.2" />
        <line x1={plot.left} y1={plot.top} x2={plot.left} y2={height - plot.bottom} stroke="#64748b" strokeWidth="1.2" />
        <path d={path} fill="none" stroke="#06b6d4" strokeWidth="2.5" />
        {rangeTiming.map((entry, idx) => {
          const startX = plot.left + (entry.startIndex / xRange) * plotWidth;
          const endX = plot.left + (entry.endIndex / xRange) * plotWidth;
          const x = (startX + endX) / 2;
          const y = 10;
          const labelWidth = Math.max(42, entry.durationLabel.length * 6.2);
          return (
            <g key={`${entry.startLevel}-${entry.endLevel}`}>
              <rect
                x={x - labelWidth / 2}
                y={y - 10}
                width={labelWidth}
                height={14}
                rx={4}
                fill="#020617"
                fillOpacity={0.72}
                stroke="#334155"
                strokeWidth="1"
              />
              <text x={x} y={y} textAnchor="middle" fill="#e2e8f0" fontSize="9.5">
                {entry.durationLabel}
              </text>
            </g>
          );
        })}
        {points.map((point, index) => {
          const x = plot.left + (index / xRange) * plotWidth;
          const y = plot.top + (1 - (point.value - minY) / yRange) * plotHeight;
          return (
            <circle key={`p-${point.level}`} cx={x} cy={y} r={2.2} fill="#22d3ee">
              <title>{`Lv ${point.level}: ${point.value} XP`}</title>
            </circle>
          );
        })}
        {xTicks.map((idx) => {
          const point = points[idx];
          if (!point) return null;
          const x = plot.left + (idx / xRange) * plotWidth;
          const y = plot.top + (1 - (point.value - minY) / yRange) * plotHeight;
          const label = `${formatAxisNumber(point.value)} XP`;
          const labelWidth = Math.max(44, label.length * 6);
          const labelY = Math.max(plot.top + 30, y - 14);
          return (
            <g key={`xp-label-${point.level}`}>
              <rect
                x={x - labelWidth / 2}
                y={labelY - 9}
                width={labelWidth}
                height={13}
                rx={4}
                fill="#020617"
                fillOpacity={0.78}
                stroke="#334155"
                strokeWidth="1"
              />
              <text x={x} y={labelY} textAnchor="middle" fill="#e2e8f0" fontSize="9">
                {label}
              </text>
            </g>
          );
        })}
        <text x={width / 2} y={height - 6} textAnchor="middle" fill="#cbd5e1" fontSize="11">
          Eixo X: Level (Lv)
        </text>
        <text x={20} y={height / 2} transform={`rotate(-90 20 ${height / 2})`} textAnchor="middle" fill="#cbd5e1" fontSize="11">
          Eixo Y: XP por level
        </text>
      </svg>
    </div>
  );
}

function buildIndexTicks(length: number, tickCount: number): number[] {
  if (length <= 1) return [0];
  const last = length - 1;
  const out = new Set<number>([0, last]);
  for (let i = 1; i < tickCount - 1; i += 1) {
    out.add(Math.round((i / (tickCount - 1)) * last));
  }
  return [...out].sort((a, b) => a - b);
}

function buildValueTicks(min: number, max: number, tickCount: number): number[] {
  if (tickCount <= 1 || min === max) return [min, max];
  const step = (max - min) / (tickCount - 1);
  return Array.from({ length: tickCount }, (_, idx) => min + step * idx);
}

function formatAxisNumber(value: number): string {
  if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatReadableNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value);
}

function buildRangeTimingSegments({
  points,
  minutesPerLevel,
  mode,
  matchDurationMinutes,
  sessionsPerDay,
  tickCount,
}: {
  points: Array<{ level: number; value: number }>;
  minutesPerLevel: Array<{ level: number; minutes: number }>;
  mode: "continuous" | "sessionBased" | undefined;
  matchDurationMinutes: number;
  sessionsPerDay?: number;
  tickCount: number;
}): Array<{ startLevel: number; endLevel: number; startIndex: number; endIndex: number; durationLabel: string }> {
  if (points.length < 2 || minutesPerLevel.length === 0) return [];
  const ticks = buildIndexTicks(points.length, tickCount);
  if (ticks.length < 2) return [];

  const cumulativeByLevel = new Map<number, number>();
  let running = 0;
  for (const item of minutesPerLevel) {
    running += Math.max(0, Number(item.minutes) || 0);
    cumulativeByLevel.set(item.level, running);
  }

  const safePerDay = Math.max(1, Number(matchDurationMinutes || 1) * Math.max(1, Math.floor(Number(sessionsPerDay || 1))));

  const out: Array<{ startLevel: number; endLevel: number; startIndex: number; endIndex: number; durationLabel: string }> = [];
  for (let i = 1; i < ticks.length; i += 1) {
    const startIndex = ticks[i - 1];
    const endIndex = ticks[i];
    const startLevel = points[startIndex]?.level;
    const endLevel = points[endIndex]?.level;
    if (startLevel == null || endLevel == null) continue;
    const endCum = cumulativeByLevel.get(endLevel) ?? 0;
    const startCum = i === 1 ? 0 : cumulativeByLevel.get(startLevel) ?? 0;
    const segmentMinutes = Math.max(0, endCum - startCum);
    const activeHours = segmentMinutes / 60;
    const durationLabel =
      mode === "sessionBased"
        ? `${formatCalendarDaysHuman(segmentMinutes / safePerDay)} real | ${formatHoursHuman(activeHours)} ativo`
        : formatHoursHuman(activeHours);
    out.push({ startLevel, endLevel, startIndex, endIndex, durationLabel });
  }
  return out;
}
