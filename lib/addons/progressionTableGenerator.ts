import type { ProgressionColumnGenerator, ProgressionTableColumn, ProgressionTableRow } from "@/lib/addons/types";

const MAX_DECIMALS = 6;
const ALLOWED_FORMULA_VARIABLES = new Set(["base", "level", "delta"]);
const ALLOWED_FORMULA_FUNCTIONS = new Set(["min", "max", "round", "floor", "ceil", "abs", "pow"]);

type FormulaToken =
  | { type: "number"; value: number }
  | { type: "identifier"; value: string }
  | { type: "operator"; value: "+" | "-" | "*" | "/" }
  | { type: "paren"; value: "(" | ")" }
  | { type: "comma"; value: "," };

function normalizeClampBounds(min?: number, max?: number): { min?: number; max?: number } {
  const safeMin = Number.isFinite(min) ? Number(min) : undefined;
  const safeMax = Number.isFinite(max) ? Number(max) : undefined;
  if (safeMin == null || safeMax == null) return { min: safeMin, max: safeMax };
  if (safeMin <= safeMax) return { min: safeMin, max: safeMax };
  return { min: safeMax, max: safeMin };
}

export function clampValueWithBounds(value: number, min?: number, max?: number): number {
  if (!Number.isFinite(value)) return 0;
  const normalized = normalizeClampBounds(min, max);
  let next = value;
  if (normalized.min != null) next = Math.max(next, normalized.min);
  if (normalized.max != null) next = Math.min(next, normalized.max);
  return next;
}

function normalizeDecimals(decimals?: number): number {
  if (!Number.isFinite(decimals)) return 0;
  return Math.max(0, Math.min(MAX_DECIMALS, Math.floor(Number(decimals))));
}

export function roundValueWithDecimals(value: number, decimals?: number): number {
  if (!Number.isFinite(value)) return 0;
  const safeDecimals = normalizeDecimals(decimals);
  const factor = Math.pow(10, safeDecimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function evaluateFormulaExpression(
  expression: string,
  context: { base: number; level: number; delta: number }
): number {
  const trimmedExpression = expression.trim();
  if (!trimmedExpression) return 0;
  const tokens: FormulaToken[] = [];
  const tokenPattern = /\s*([A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|\.\d+|[(),+\-*/])\s*/y;
  let cursorPosition = 0;
  while (cursorPosition < trimmedExpression.length) {
    tokenPattern.lastIndex = cursorPosition;
    const match = tokenPattern.exec(trimmedExpression);
    if (!match) return 0;
    const tokenValue = match[1];
    if (tokenValue === "(" || tokenValue === ")") {
      tokens.push({ type: "paren", value: tokenValue });
    } else if (tokenValue === ",") {
      tokens.push({ type: "comma", value: "," });
    } else if (tokenValue === "+" || tokenValue === "-" || tokenValue === "*" || tokenValue === "/") {
      tokens.push({ type: "operator", value: tokenValue });
    } else if (/^\d+(\.\d+)?$|^\.\d+$/.test(tokenValue)) {
      const parsed = Number(tokenValue);
      if (!Number.isFinite(parsed)) return 0;
      tokens.push({ type: "number", value: parsed });
    } else {
      tokens.push({ type: "identifier", value: tokenValue });
    }
    cursorPosition = tokenPattern.lastIndex;
  }

  let cursor = 0;

  const parseExpression = (): number | null => {
    const first = parseTerm();
    if (first == null) return null;
    let value = first;

    while (true) {
      const token = tokens[cursor];
      if (!token || token.type !== "operator" || (token.value !== "+" && token.value !== "-")) break;
      cursor += 1;
      const right = parseTerm();
      if (right == null) return null;
      value = token.value === "+" ? value + right : value - right;
    }

    return Number.isFinite(value) ? value : null;
  };

  const parseTerm = (): number | null => {
    const first = parseFactor();
    if (first == null) return null;
    let value = first;

    while (true) {
      const token = tokens[cursor];
      if (!token || token.type !== "operator" || (token.value !== "*" && token.value !== "/")) break;
      cursor += 1;
      const right = parseFactor();
      if (right == null) return null;
      value = token.value === "*" ? value * right : value / right;
      if (!Number.isFinite(value)) return null;
    }

    return value;
  };

  const parseFactor = (): number | null => {
    const token = tokens[cursor];
    if (!token) return null;

    if (token.type === "operator" && (token.value === "+" || token.value === "-")) {
      cursor += 1;
      const factor = parseFactor();
      if (factor == null) return null;
      return token.value === "-" ? -factor : factor;
    }

    if (token.type === "number") {
      cursor += 1;
      return token.value;
    }

    if (token.type === "identifier") {
      const identifier = token.value;
      cursor += 1;
      const next = tokens[cursor];
      if (next?.type === "paren" && next.value === "(") {
        return parseFunctionCall(identifier);
      }
      if (identifier === "base") return context.base;
      if (identifier === "level") return context.level;
      if (identifier === "delta") return context.delta;
      return null;
    }

    if (token.type === "paren" && token.value === "(") {
      cursor += 1;
      const nested = parseExpression();
      const closeParen = tokens[cursor];
      if (nested == null || !closeParen || closeParen.type !== "paren" || closeParen.value !== ")") {
        return null;
      }
      cursor += 1;
      return nested;
    }

    return null;
  };

  const parseFunctionCall = (functionName: string): number | null => {
    if (!ALLOWED_FORMULA_FUNCTIONS.has(functionName)) return null;

    const openParen = tokens[cursor];
    if (!openParen || openParen.type !== "paren" || openParen.value !== "(") return null;
    cursor += 1;

    const args: number[] = [];
    const closeDirect = tokens[cursor];
    if (closeDirect && closeDirect.type === "paren" && closeDirect.value === ")") {
      cursor += 1;
    } else {
      while (true) {
        const argumentValue = parseExpression();
        if (argumentValue == null) return null;
        args.push(argumentValue);

        const separator = tokens[cursor];
        if (separator?.type === "comma") {
          cursor += 1;
          continue;
        }
        if (separator?.type === "paren" && separator.value === ")") {
          cursor += 1;
          break;
        }
        return null;
      }
    }

    if (args.some((arg) => !Number.isFinite(arg))) return null;

    let result: number | null = null;
    switch (functionName) {
      case "min":
        result = args.length > 0 ? Math.min(...args) : null;
        break;
      case "max":
        result = args.length > 0 ? Math.max(...args) : null;
        break;
      case "round": {
        if (args.length < 1 || args.length > 2) return null;
        if (args.length === 1) {
          result = Math.round(args[0]);
          break;
        }
        const decimals = Math.max(0, Math.min(MAX_DECIMALS, Math.floor(args[1])));
        const factor = Math.pow(10, decimals);
        result = Math.round((args[0] + Number.EPSILON) * factor) / factor;
        break;
      }
      case "floor":
        result = args.length === 1 ? Math.floor(args[0]) : null;
        break;
      case "ceil":
        result = args.length === 1 ? Math.ceil(args[0]) : null;
        break;
      case "abs":
        result = args.length === 1 ? Math.abs(args[0]) : null;
        break;
      case "pow":
        result = args.length === 2 ? Math.pow(args[0], args[1]) : null;
        break;
      default:
        result = null;
    }

    return result != null && Number.isFinite(result) ? result : null;
  };

  const result = parseExpression();
  if (result == null || cursor !== tokens.length || !Number.isFinite(result)) return 0;
  return result;
}

function computeGeneratedValue(params: {
  row: ProgressionTableRow;
  startLevel: number;
  generator: ProgressionColumnGenerator;
}): number {
  const { row, startLevel, generator } = params;
  const level = row.level;
  const deltaLevel = Math.max(0, level - startLevel);
  if (generator.mode === "linear") {
    return generator.base + generator.step * deltaLevel;
  }
  if (generator.mode === "exponential") {
    return generator.base * Math.pow(generator.growth, deltaLevel);
  }
  if (generator.mode === "formula") {
    const baseValue = Number(row.values[generator.baseColumnId]);
    const normalizedBaseValue = Number.isFinite(baseValue) ? baseValue : 0;
    return evaluateFormulaExpression(generator.expression, {
      base: normalizedBaseValue,
      level,
      delta: deltaLevel,
    });
  }
  return 0;
}

export function generateProgressionColumnValues(params: {
  rows: ProgressionTableRow[];
  columnId: string;
  startLevel: number;
  generator: ProgressionColumnGenerator;
  decimals?: number;
  min?: number;
  max?: number;
}): ProgressionTableRow[] {
  const { rows, columnId, startLevel, generator, decimals, min, max } = params;
  if (generator.mode === "manual") return rows;
  return rows.map((row) => ({
    ...row,
    values: {
      ...row.values,
      [columnId]: clampValueWithBounds(
        roundValueWithDecimals(
          computeGeneratedValue({
            row,
            startLevel,
            generator,
          }),
          decimals
        ),
        min,
        max
      ),
    },
  }));
}

export function applyColumnDecimals(params: {
  rows: ProgressionTableRow[];
  columnId: string;
  decimals?: number;
  min?: number;
  max?: number;
}): ProgressionTableRow[] {
  const { rows, columnId, decimals, min, max } = params;
  return rows.map((row) => {
    const current = Number(row.values[columnId]);
    if (!Number.isFinite(current)) return row;
    return {
      ...row,
      values: {
        ...row.values,
        [columnId]: clampValueWithBounds(roundValueWithDecimals(current, decimals), min, max),
      },
    };
  });
}

export function applyColumnClamp(params: {
  rows: ProgressionTableRow[];
  columnId: string;
  min?: number;
  max?: number;
}): ProgressionTableRow[] {
  const { rows, columnId, min, max } = params;
  return rows.map((row) => {
    const current = Number(row.values[columnId]);
    if (!Number.isFinite(current)) return row;
    return {
      ...row,
      values: {
        ...row.values,
        [columnId]: clampValueWithBounds(current, min, max),
      },
    };
  });
}

export function generateAllProgressionColumnValues(params: {
  rows: ProgressionTableRow[];
  columns: ProgressionTableColumn[];
  startLevel: number;
}): ProgressionTableRow[] {
  const { rows, columns, startLevel } = params;
  let nextRows = rows;
  for (const column of columns) {
    const generator = column.generator ?? { mode: "manual" as const };
    nextRows = generateProgressionColumnValues({
      rows: nextRows,
      columnId: column.id,
      startLevel,
      generator,
      decimals: column.decimals,
      min: column.min,
      max: column.max,
    });
  }
  return nextRows;
}
