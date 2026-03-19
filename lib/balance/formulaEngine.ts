import type {
  BalanceCurveInput,
  BalanceCurveResult,
  BalanceCurveMetrics,
  BalanceGenreProfileId,
  BalancePresetId,
  BalanceFormulaParams,
  BalancePoint,
  BalanceSimulationInput,
  BalanceSimulationResult,
  BalanceTargetInput,
  BalanceTargetSuggestion,
} from "@/lib/balance/types";

const MAX_LEVEL_POINTS = 500;

type TokenType = "number" | "identifier" | "operator" | "paren" | "comma";

interface Token {
  type: TokenType;
  value: string;
}

const OPERATOR_PRECEDENCE: Record<string, number> = {
  "+": 1,
  "-": 1,
  "*": 2,
  "/": 2,
  "^": 3,
};

const RIGHT_ASSOCIATIVE = new Set(["^"]);

const ALLOWED_FUNCTIONS: Record<string, (...args: number[]) => number> = {
  min: (...args) => Math.min(...args),
  max: (...args) => Math.max(...args),
  abs: (value) => Math.abs(value),
  floor: (value) => Math.floor(value),
  ceil: (value) => Math.ceil(value),
  round: (value) => Math.round(value),
  sqrt: (value) => Math.sqrt(value),
  log: (value) => Math.log(value),
  exp: (value) => Math.exp(value),
  pow: (a, b) => Math.pow(a, b),
};

export function createDefaultBalanceAddon(addonId: string) {
  return {
    id: addonId,
    name: "Balanceamento XP",
    mode: "preset" as const,
    preset: "exponential" as BalancePresetId,
    expression: "base * pow(level, growth) + offset",
    startLevel: 1,
    endLevel: 100,
    decimals: 0,
    clampMin: undefined,
    clampMax: undefined,
    params: {
      base: 100,
      growth: 1.15,
      offset: 0,
      tierStep: 10,
      tierMultiplier: 1.25,
      capValue: 5000,
      capStrength: 0.08,
      plateauStartLevel: 60,
      plateauFactor: 0.35,
    } as BalanceFormulaParams,
  };
}

export function createProfileDefaults(profileId: BalanceGenreProfileId): BalanceFormulaParams {
  if (profileId === "idle") {
    return {
      base: 120,
      growth: 1.22,
      offset: 0,
      tierStep: 10,
      tierMultiplier: 1.3,
      capValue: 12000,
      capStrength: 0.06,
      plateauStartLevel: 70,
      plateauFactor: 0.4,
    };
  }
  if (profileId === "roguelite") {
    return {
      base: 90,
      growth: 1.17,
      offset: 0,
      tierStep: 8,
      tierMultiplier: 1.22,
      capValue: 6500,
      capStrength: 0.09,
      plateauStartLevel: 55,
      plateauFactor: 0.45,
    };
  }
  if (profileId === "casual") {
    return {
      base: 70,
      growth: 1.08,
      offset: 0,
      tierStep: 12,
      tierMultiplier: 1.12,
      capValue: 3000,
      capStrength: 0.12,
      plateauStartLevel: 45,
      plateauFactor: 0.3,
    };
  }
  return {
    base: 100,
    growth: 1.15,
    offset: 0,
    tierStep: 10,
    tierMultiplier: 1.25,
    capValue: 8000,
    capStrength: 0.08,
    plateauStartLevel: 60,
    plateauFactor: 0.4,
  };
}

export function generateBalanceCurve(input: BalanceCurveInput): BalanceCurveResult {
  const startLevel = Math.max(1, Math.floor(input.startLevel || 1));
  const endLevel = Math.max(startLevel, Math.floor(input.endLevel || startLevel));
  const decimals = clamp(Math.floor(input.decimals || 0), 0, 6);
  const levelCount = endLevel - startLevel + 1;
  if (levelCount > MAX_LEVEL_POINTS) {
    throw new Error(`Faixa de níveis muito grande (máximo ${MAX_LEVEL_POINTS} pontos).`);
  }

  const points: Array<{ level: number; value: number }> = [];
  let minValue = Number.POSITIVE_INFINITY;
  let maxValue = Number.NEGATIVE_INFINITY;

  for (let level = startLevel; level <= endLevel; level += 1) {
    const rawValue =
      input.mode === "preset"
        ? evaluatePreset(input.preset, level, input.params)
        : evaluateAdvancedExpression(input.expression, level, input.params);

    const finiteValue = Number.isFinite(rawValue) ? rawValue : 0;
    const clamped = applyClamp(finiteValue, input.clampMin, input.clampMax);
    const rounded = roundTo(clamped, decimals);
    minValue = Math.min(minValue, rounded);
    maxValue = Math.max(maxValue, rounded);
    points.push({ level, value: rounded });
  }

  return { points, minValue, maxValue };
}

function evaluatePreset(preset: BalancePresetId, level: number, params: BalanceFormulaParams): number {
  const base = Number(params.base || 0);
  const growth = Number(params.growth || 0);
  const offset = Number(params.offset || 0);
  const tierStep = Math.max(1, Math.floor(Number(params.tierStep || 1)));
  const tierMultiplier = Number(params.tierMultiplier || 1);
  const capValue = Math.max(1, Number(params.capValue || 1));
  const capStrength = Math.max(0.0001, Number(params.capStrength || 0.0001));
  const plateauStartLevel = Math.max(1, Math.floor(Number(params.plateauStartLevel || 1)));
  const plateauFactor = clamp(Number(params.plateauFactor || 0.4), 0.01, 1);

  if (preset === "linear") {
    return base + growth * level + offset;
  }
  if (preset === "tiered") {
    const tier = Math.floor(Math.max(0, level - 1) / tierStep);
    return (base + growth * level) * Math.pow(Math.max(0.01, tierMultiplier), tier) + offset;
  }
  if (preset === "softCap") {
    const raw = base * Math.pow(Math.max(1, level), growth) + offset;
    return capValue * (1 - Math.exp((-capStrength * raw) / Math.max(1, capValue)));
  }
  if (preset === "hardCap") {
    const raw = base * Math.pow(Math.max(1, level), growth) + offset;
    return Math.min(capValue, raw);
  }
  if (preset === "diminishingReturns") {
    const x = Math.max(1, level);
    return offset + (capValue * x) / (x + Math.max(1, base + growth * 10));
  }
  if (preset === "piecewise") {
    const x = Math.max(1, level);
    if (x <= plateauStartLevel) {
      return base * Math.pow(x, growth) + offset;
    }
    const firstPart = base * Math.pow(plateauStartLevel, growth) + offset;
    const tail = base * Math.pow(x - plateauStartLevel + 1, Math.max(0.1, growth * plateauFactor));
    return firstPart + tail;
  }
  return base * Math.pow(Math.max(0, level), growth) + offset;
}

export function calculateCurveMetrics(points: BalancePoint[]): BalanceCurveMetrics {
  if (points.length < 2) {
    return {
      averageStep: 0,
      averageGrowthPercent: 0,
      cumulativeValue: points.reduce((sum, point) => sum + point.value, 0),
      spikeLevels: [],
      plateauLevels: [],
      regressionLevels: [],
      milestones: points.map((point) => ({ level: point.level, value: point.value })),
    };
  }

  const deltas = points.slice(1).map((point, idx) => point.value - points[idx].value);
  const avgStep = deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
  const growthPercents = points.slice(1).map((point, idx) => {
    const previous = points[idx].value;
    if (previous === 0) return 0;
    return ((point.value - previous) / Math.abs(previous)) * 100;
  });
  const avgGrowthPercent = growthPercents.reduce((sum, value) => sum + value, 0) / growthPercents.length;
  const spikeLevels = points
    .slice(1)
    .filter((point, idx) => Math.abs(deltas[idx]) > Math.abs(avgStep) * 2.4)
    .map((point) => point.level);
  const plateauLevels = points
    .slice(1)
    .filter((_point, idx) => Math.abs(deltas[idx]) <= Math.max(1, Math.abs(avgStep) * 0.2))
    .map((point) => point.level);
  const regressionLevels = points
    .slice(1)
    .filter((_point, idx) => deltas[idx] < 0)
    .map((point) => point.level);

  const markLevels = [10, 25, 50, 75, 100];
  const milestones = markLevels
    .map((level) => points.find((point) => point.level === level))
    .filter((point): point is BalancePoint => Boolean(point))
    .map((point) => ({ level: point.level, value: point.value }));

  return {
    averageStep: roundTo(avgStep, 2),
    averageGrowthPercent: roundTo(avgGrowthPercent, 2),
    cumulativeValue: roundTo(points.reduce((sum, point) => sum + point.value, 0), 2),
    spikeLevels,
    plateauLevels,
    regressionLevels,
    milestones,
  };
}

export function simulateProgressionBySession(
  points: BalancePoint[],
  input: BalanceSimulationInput
): BalanceSimulationResult {
  const mode = input.mode || "continuous";
  const safeXpPerMinute = Math.max(0.1, Number(input.xpPerMinute || 1));
  const safeWinRate = clamp(Number(input.winRate || 0.5), 0, 1);
  const safeDuration = Math.max(0.1, Number(input.matchDurationMinutes || 1));
  const safeSessionsPerDay = Math.max(1, Math.floor(Number(input.sessionsPerDay || 1)));
  const safeBonus = Math.max(0.1, Number(input.bonusMultiplier || 1));

  const minutesPerLevel = points.map((point) => {
    const levelXpPerMinute = getXpPerMinuteForLevel(point.level, input, safeXpPerMinute);
    const effectiveXpPerMinute = levelXpPerMinute * safeWinRate * safeBonus;
    const minutes = point.value / Math.max(0.1, effectiveXpPerMinute);
    return { level: point.level, minutes: roundTo(minutes, 2) };
  });
  const cumulativeMinutesByLevel = new Map<number, number>();
  let cumulative = 0;
  for (const entry of minutesPerLevel) {
    cumulative += entry.minutes;
    cumulativeMinutesByLevel.set(entry.level, cumulative);
  }

  const milestones = [10, 25, 50, 100];
  const hoursToMilestones = milestones
    .map((level) => {
      const cumulativeMinutes = cumulativeMinutesByLevel.get(level);
      if (cumulativeMinutes == null) return null;
      const hours = roundTo(cumulativeMinutes / 60, 2);
      if (mode === "sessionBased") {
        const activeMinutesPerDay = safeDuration * safeSessionsPerDay;
        const calendarDays = roundTo(cumulativeMinutes / activeMinutesPerDay, 2);
        return { level, hours, calendarDays };
      }
      return { level, hours };
    })
    .filter((entry): entry is { level: number; hours: number; calendarDays?: number } => Boolean(entry));

  return { minutesPerLevel, hoursToMilestones };
}

function getXpPerMinuteForLevel(level: number, input: BalanceSimulationInput, fallbackXpPerMinute: number): number {
  const mode = input.xpRateMode || "fixed";
  if (mode !== "byLevelRange") {
    return fallbackXpPerMinute;
  }

  const normalizedRanges = (input.xpRanges || [])
    .filter((range) => Number.isFinite(range.fromLevel) && Number.isFinite(range.toLevel) && Number.isFinite(range.xpPerMinute))
    .map((range) => ({
      fromLevel: Math.max(1, Math.floor(range.fromLevel)),
      toLevel: Math.max(1, Math.floor(range.toLevel)),
      xpPerMinute: Math.max(0.1, Number(range.xpPerMinute)),
    }))
    .sort((a, b) => a.fromLevel - b.fromLevel);

  if (normalizedRanges.length === 0) return fallbackXpPerMinute;

  const direct = normalizedRanges.find((range) => level >= range.fromLevel && level <= range.toLevel);
  if (direct) return direct.xpPerMinute;

  const previous = [...normalizedRanges].reverse().find((range) => range.toLevel < level);
  if (previous) return previous.xpPerMinute;

  return normalizedRanges[0].xpPerMinute;
}

export function suggestTargetTuning(
  points: BalancePoint[],
  target: BalanceTargetInput,
  simulationInput: BalanceSimulationInput,
  preset: BalancePresetId,
  params: BalanceFormulaParams
): BalanceTargetSuggestion {
  const simulation = simulateProgressionBySession(points, simulationInput);
  const mode = simulationInput.mode || "continuous";
  const targetUnit: "hours" | "days" = mode === "sessionBased" ? "days" : "hours";
  const rawTargetValue =
    target.targetValue ??
    target.targetHours ??
    (targetUnit === "days" ? 7 : 10);
  const targetValue = Math.max(0.1, Number(rawTargetValue || 0.1));
  const found = simulation.hoursToMilestones.find((entry) => entry.level === target.targetLevel);
  if (!found) {
    return {
      message: "Nao foi possivel calcular o marco alvo com a faixa de levels atual.",
      recommendedGrowthDeltaPercent: 0,
      recommendedAdjustments: {},
    };
  }
  const measuredValue = targetUnit === "days" ? found.calendarDays : found.hours;
  if (!Number.isFinite(measuredValue)) {
    return {
      message: "Nao foi possivel comparar com a meta na unidade selecionada.",
      recommendedGrowthDeltaPercent: 0,
      recommendedAdjustments: {},
    };
  }

  const errorPercent = (((measuredValue as number) - targetValue) / targetValue) * 100;
  // Zona de conforto: abaixo de 5% de diferença, já está aceitável.
  if (Math.abs(errorPercent) <= 5) {
    return {
      message: `Sua curva ja esta bem proxima da meta em ${targetUnit === "days" ? "dias reais" : "horas ativas"}. Ajuste fino opcional (no maximo 1-2%).`,
      recommendedGrowthDeltaPercent: 0,
      recommendedAdjustments: {},
    };
  }

  // Ajuste proporcional suave para evitar overshoot e efeito "ping-pong".
  const rawDelta = -0.35 * errorPercent;
  const recommendedGrowthDeltaPercent = roundTo(clamp(rawDelta, -20, 20), 2);
  const recommendedAdjustments = buildPresetAdjustments(preset, params, recommendedGrowthDeltaPercent);
  const summaryParts = Object.entries(recommendedAdjustments).map(([key, value]) => `${key}: ${roundTo(value as number, 4)}`);
  const magnitude = Math.abs(recommendedGrowthDeltaPercent);
  const rangeContext =
    simulationInput.xpRateMode === "byLevelRange"
      ? " O resultado considera XP/min variavel por faixas de level."
      : "";
  return {
    message:
      summaryParts.length > 0
        ? `Para aproximar do alvo em ${targetUnit === "days" ? "dias reais" : "horas ativas"}, ajuste em passos curtos (${magnitude}% de intensidade): ${summaryParts.join(", ")}.${rangeContext}`
        : "Nao foi possivel gerar ajuste automatico para o preset atual.",
    recommendedGrowthDeltaPercent,
    recommendedAdjustments,
  };
}

function buildPresetAdjustments(
  preset: BalancePresetId,
  params: BalanceFormulaParams,
  growthDeltaPercent: number
): Partial<BalanceFormulaParams> {
  const factor = 1 + growthDeltaPercent / 100;
  const nextGrowth = clamp(params.growth * factor, 0.1, 4);

  if (preset === "tiered") {
    return {
      growth: roundTo(nextGrowth, 4),
      tierMultiplier: roundTo(clamp(params.tierMultiplier * (1 + growthDeltaPercent / 180), 1.01, 3), 4),
    };
  }

  if (preset === "softCap") {
    return {
      growth: roundTo(nextGrowth, 4),
      capStrength: roundTo(clamp(params.capStrength * (1 - growthDeltaPercent / 220), 0.005, 0.6), 5),
    };
  }

  if (preset === "hardCap") {
    return {
      growth: roundTo(nextGrowth, 4),
      capValue: roundTo(clamp(params.capValue * (1 + growthDeltaPercent / 160), 100, 1000000), 2),
    };
  }

  if (preset === "diminishingReturns") {
    return {
      growth: roundTo(nextGrowth, 4),
      capValue: roundTo(clamp(params.capValue * (1 + growthDeltaPercent / 180), 100, 1000000), 2),
    };
  }

  if (preset === "piecewise") {
    return {
      growth: roundTo(nextGrowth, 4),
      plateauFactor: roundTo(clamp(params.plateauFactor * (1 - growthDeltaPercent / 200), 0.05, 1), 4),
    };
  }

  return { growth: roundTo(nextGrowth, 4) };
}

export function evaluateAdvancedExpression(expression: string, level: number, params: BalanceFormulaParams): number {
  const expr = expression.trim();
  if (!expr) {
    throw new Error("A fórmula avançada está vazia.");
  }

  const tokens = tokenizeExpression(expr);
  const variables = {
    level,
    base: Number(params.base || 0),
    growth: Number(params.growth || 0),
    offset: Number(params.offset || 0),
    tierStep: Number(params.tierStep || 0),
    tierMultiplier: Number(params.tierMultiplier || 0),
  };

  const parser = new ExpressionParser(tokens, variables);
  const value = parser.parseExpression();
  if (!parser.isAtEnd()) {
    throw new Error("Fórmula inválida: tokens extras no final da expressão.");
  }
  if (!Number.isFinite(value)) {
    throw new Error("A fórmula resultou em valor não numérico.");
  }
  return value;
}

class ExpressionParser {
  private tokens: Token[];

  private pos = 0;

  private variables: Record<string, number>;

  constructor(tokens: Token[], variables: Record<string, number>) {
    this.tokens = tokens;
    this.variables = variables;
  }

  isAtEnd(): boolean {
    return this.pos >= this.tokens.length;
  }

  parseExpression(minPrecedence = 0): number {
    let left = this.parsePrefix();

    while (!this.isAtEnd()) {
      const token = this.peek();
      if (!token || token.type !== "operator") break;
      const precedence = OPERATOR_PRECEDENCE[token.value];
      if (precedence == null || precedence < minPrecedence) break;

      this.advance();
      const nextMin = RIGHT_ASSOCIATIVE.has(token.value) ? precedence : precedence + 1;
      const right = this.parseExpression(nextMin);
      left = applyOperator(token.value, left, right);
    }

    return left;
  }

  private parsePrefix(): number {
    const token = this.peek();
    if (!token) {
      throw new Error("Fórmula inválida: fim inesperado.");
    }

    if (token.type === "operator" && (token.value === "+" || token.value === "-")) {
      this.advance();
      const value = this.parsePrefix();
      return token.value === "-" ? -value : value;
    }

    if (token.type === "number") {
      this.advance();
      return Number(token.value);
    }

    if (token.type === "identifier") {
      this.advance();
      const identifier = token.value;
      if (this.match("paren", "(")) {
        const args = this.parseFunctionArgs();
        const fn = ALLOWED_FUNCTIONS[identifier];
        if (!fn) {
          throw new Error(`Função não permitida: ${identifier}`);
        }
        const result = fn(...args);
        if (!Number.isFinite(result)) {
          throw new Error(`Resultado inválido na função ${identifier}.`);
        }
        return result;
      }

      const variable = this.variables[identifier];
      if (variable == null) {
        throw new Error(`Variável desconhecida: ${identifier}`);
      }
      return variable;
    }

    if (this.match("paren", "(")) {
      const value = this.parseExpression();
      this.expect("paren", ")");
      return value;
    }

    throw new Error(`Token inesperado: ${token.value}`);
  }

  private parseFunctionArgs(): number[] {
    const args: number[] = [];
    if (this.match("paren", ")")) return args;

    while (!this.isAtEnd()) {
      args.push(this.parseExpression());
      if (this.match("comma", ",")) continue;
      this.expect("paren", ")");
      break;
    }
    return args;
  }

  private expect(type: TokenType, value?: string): Token {
    const token = this.peek();
    if (!token || token.type !== type || (value != null && token.value !== value)) {
      throw new Error(value ? `Esperado '${value}' na fórmula.` : "Token esperado não encontrado.");
    }
    this.advance();
    return token;
  }

  private match(type: TokenType, value?: string): boolean {
    const token = this.peek();
    if (!token || token.type !== type) return false;
    if (value != null && token.value !== value) return false;
    this.advance();
    return true;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private advance(): void {
    this.pos += 1;
  }
}

function tokenizeExpression(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expression.length) {
    const char = expression[i];
    if (/\s/.test(char)) {
      i += 1;
      continue;
    }

    if (/[0-9.]/.test(char)) {
      let value = char;
      i += 1;
      while (i < expression.length && /[0-9.]/.test(expression[i])) {
        value += expression[i];
        i += 1;
      }
      if (!/^\d*\.?\d+$/.test(value)) {
        throw new Error(`Número inválido na fórmula: ${value}`);
      }
      tokens.push({ type: "number", value });
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      let value = char;
      i += 1;
      while (i < expression.length && /[A-Za-z0-9_]/.test(expression[i])) {
        value += expression[i];
        i += 1;
      }
      tokens.push({ type: "identifier", value });
      continue;
    }

    if ("+-*/^".includes(char)) {
      tokens.push({ type: "operator", value: char });
      i += 1;
      continue;
    }

    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char });
      i += 1;
      continue;
    }

    if (char === ",") {
      tokens.push({ type: "comma", value: char });
      i += 1;
      continue;
    }

    throw new Error(`Caractere inválido na fórmula: ${char}`);
  }

  return tokens;
}

function applyOperator(operator: string, left: number, right: number): number {
  if (operator === "+") return left + right;
  if (operator === "-") return left - right;
  if (operator === "*") return left * right;
  if (operator === "/") {
    if (right === 0) throw new Error("Divisão por zero na fórmula.");
    return left / right;
  }
  if (operator === "^") return Math.pow(left, right);
  throw new Error(`Operador não suportado: ${operator}`);
}

function applyClamp(value: number, clampMin?: number, clampMax?: number): number {
  let next = value;
  if (clampMin != null && Number.isFinite(clampMin)) {
    next = Math.max(next, clampMin);
  }
  if (clampMax != null && Number.isFinite(clampMax)) {
    next = Math.min(next, clampMax);
  }
  return next;
}

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
