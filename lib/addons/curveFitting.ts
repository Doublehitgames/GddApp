/**
 * Curve fitting utilities for Progression Table columns.
 *
 * Analyzes pasted values and suggests the best generator mode
 * (linear, exponential, or formula/polynomial) with fitted parameters.
 */

export type LinearFitResult = {
  mode: "linear";
  base: number;
  step: number;
  bias?: number;
  r2: number;
};

export type ExponentialFitResult = {
  mode: "exponential";
  base: number;
  growth: number;
  bias?: number;
  r2: number;
};

export type FormulaFitResult = {
  mode: "formula";
  expression: string;
  r2: number;
};

export type SuggestionResult =
  | { suggested: true; fit: LinearFitResult | ExponentialFitResult | FormulaFitResult }
  | { suggested: false };

const MIN_POINTS = 3;
const R2_THRESHOLD = 0.90;

/**
 * Ordinary least-squares linear regression: y = a + b * x
 * Returns { a (intercept), b (slope), r2 }.
 */
function ols(xs: number[], ys: number[]): { a: number; b: number; r2: number } {
  const n = xs.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i];
    sumY += ys[i];
    sumXY += xs[i] * ys[i];
    sumX2 += xs[i] * xs[i];
  }
  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-12) return { a: sumY / n, b: 0, r2: 0 };

  const b = (n * sumXY - sumX * sumY) / denom;
  const a = (sumY - b * sumX) / n;

  const meanY = sumY / n;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const predicted = a + b * xs[i];
    ssRes += (ys[i] - predicted) ** 2;
    ssTot += (ys[i] - meanY) ** 2;
  }
  const r2 = ssTot < 1e-12 ? 1 : 1 - ssRes / ssTot;

  return { a, b, r2 };
}

/**
 * Fit values to: value = base + step * deltaLevel
 */
export function fitLinear(values: number[]): LinearFitResult {
  const xs = values.map((_, i) => i);
  const { a, b, r2 } = ols(xs, values);
  return { mode: "linear", base: round4(a), step: round4(b), r2 };
}

/**
 * Fit values to: value = base * growth^deltaLevel
 *
 * Uses log-transform: ln(y) = ln(base) + deltaLevel * ln(growth)
 * Only works when all values are positive.
 */
export function fitExponential(values: number[]): ExponentialFitResult | null {
  if (values.some((v) => v <= 0)) return null;

  const xs = values.map((_, i) => i);
  const logYs = values.map((v) => Math.log(v));
  const { a, b } = ols(xs, logYs);

  const base = Math.exp(a);
  const growth = Math.exp(b);

  // Recompute R² in original space (log-space R² can be misleading)
  const meanY = values.reduce((s, v) => s + v, 0) / values.length;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < values.length; i++) {
    const predicted = base * Math.pow(growth, i);
    ssRes += (values[i] - predicted) ** 2;
    ssTot += (values[i] - meanY) ** 2;
  }
  const r2 = ssTot < 1e-12 ? 1 : Math.max(0, 1 - ssRes / ssTot);

  if (!Number.isFinite(base) || !Number.isFinite(growth)) return null;

  return { mode: "exponential", base: round4(base), growth: round6(growth), r2 };
}

/**
 * Fit bias for endpoint-preserving curves.
 *
 * Given a function y_i = t_i^bias (where t_i is normalized 0..1 and y_i is the
 * normalized value), solves for bias using OLS with zero intercept in log-space:
 *   ln(y_i) = bias * ln(t_i)
 * so bias = sum(ln(t) * ln(y)) / sum(ln(t)^2)
 *
 * Used by both the linear and exponential bias fitters — they only differ in how
 * values are normalized into y_i ∈ (0, 1).
 */
function fitBias(
  values: number[],
  normalize: (v: number, base: number, finalVal: number) => number | null
): number | null {
  const n = values.length - 1;
  if (n < 2) return null; // need at least 3 points to have 1+ intermediate
  const base = values[0];
  const finalVal = values[n];
  if (!Number.isFinite(base) || !Number.isFinite(finalVal)) return null;
  if (base === finalVal) return null;

  let sumLogTSq = 0;
  let sumLogTLogY = 0;
  let count = 0;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const y = normalize(values[i], base, finalVal);
    if (y == null || !Number.isFinite(y) || y <= 0 || y >= 1) continue;
    if (t <= 0 || t >= 1) continue;
    const logT = Math.log(t);
    const logY = Math.log(y);
    sumLogTSq += logT * logT;
    sumLogTLogY += logT * logY;
    count += 1;
  }
  if (count < 2 || sumLogTSq < 1e-12) return null;

  const bias = sumLogTLogY / sumLogTSq;
  if (!Number.isFinite(bias) || bias <= 0) return null;
  return bias;
}

/**
 * Fit values to: value = base + step * (t^bias * N),
 * where t = delta / N and N = values.length - 1.
 * Endpoints are fixed at values[0] and values[N]; bias is fit to minimize error
 * on intermediate points.
 */
export function fitLinearWithBias(values: number[]): LinearFitResult | null {
  if (values.length < 4) return null; // need intermediates for bias to be meaningful
  const n = values.length - 1;
  const base = values[0];
  const finalVal = values[n];
  if (!Number.isFinite(base) || !Number.isFinite(finalVal) || base === finalVal) return null;

  const bias = fitBias(values, (v, b, f) => (v - b) / (f - b));
  if (bias == null) return null;

  const step = (finalVal - base) / n;

  // Compute R² in original space against biased prediction
  const meanY = values.reduce((s, v) => s + v, 0) / values.length;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < values.length; i++) {
    const t = i / n;
    const predicted = base + step * Math.pow(t, bias) * n;
    ssRes += (values[i] - predicted) ** 2;
    ssTot += (values[i] - meanY) ** 2;
  }
  const r2 = ssTot < 1e-12 ? 1 : Math.max(0, 1 - ssRes / ssTot);

  return {
    mode: "linear",
    base: round4(base),
    step: round4(step),
    bias: round4(bias),
    r2,
  };
}

/**
 * Fit values to: value = base * growth^(t^bias * N),
 * where t = delta / N and N = values.length - 1.
 * Endpoints are fixed at values[0] and values[N]; bias is fit to minimize error
 * on intermediate points. Requires all values > 0 (log-space fit).
 */
export function fitExponentialWithBias(values: number[]): ExponentialFitResult | null {
  if (values.length < 4) return null;
  if (values.some((v) => v <= 0)) return null;

  const n = values.length - 1;
  const base = values[0];
  const finalVal = values[n];
  if (!Number.isFinite(base) || !Number.isFinite(finalVal) || base === finalVal) return null;
  if (base <= 0 || finalVal <= 0) return null;
  const ratio = finalVal / base;
  if (ratio <= 0) return null;

  const bias = fitBias(values, (v, b, f) => {
    const ratioLog = Math.log(f / b);
    if (!Number.isFinite(ratioLog) || Math.abs(ratioLog) < 1e-12) return null;
    return Math.log(v / b) / ratioLog;
  });
  if (bias == null) return null;

  const growth = Math.pow(ratio, 1 / n);
  if (!Number.isFinite(growth) || growth <= 0) return null;

  const meanY = values.reduce((s, v) => s + v, 0) / values.length;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < values.length; i++) {
    const t = i / n;
    const predicted = base * Math.pow(growth, Math.pow(t, bias) * n);
    ssRes += (values[i] - predicted) ** 2;
    ssTot += (values[i] - meanY) ** 2;
  }
  const r2 = ssTot < 1e-12 ? 1 : Math.max(0, 1 - ssRes / ssTot);

  return {
    mode: "exponential",
    base: round4(base),
    growth: round6(growth),
    bias: round4(bias),
    r2,
  };
}

/**
 * Fit values to a quadratic polynomial: y = a + b * delta + c * delta²
 *
 * Uses normal equations for degree-2 polynomial regression.
 */
export function fitPolynomial(values: number[]): FormulaFitResult | null {
  const n = values.length;
  if (n < 4) return null; // need at least 4 points for meaningful quadratic

  // Build normal equations for y = a + b*x + c*x²
  // where x = deltaLevel = 0, 1, 2, ...
  let s0 = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0;
  let t0 = 0, t1 = 0, t2 = 0;
  for (let i = 0; i < n; i++) {
    const x = i;
    const x2 = x * x;
    s0 += 1;
    s1 += x;
    s2 += x2;
    s3 += x * x2;
    s4 += x2 * x2;
    t0 += values[i];
    t1 += x * values[i];
    t2 += x2 * values[i];
  }

  // Solve 3x3 system: [s0 s1 s2; s1 s2 s3; s2 s3 s4] * [a; b; c] = [t0; t1; t2]
  const coeffs = solve3x3(
    [s0, s1, s2, t0],
    [s1, s2, s3, t1],
    [s2, s3, s4, t2],
  );
  if (!coeffs) return null;

  const [a, b, c] = coeffs;

  // Compute R²
  const meanY = t0 / n;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const predicted = a + b * i + c * i * i;
    ssRes += (values[i] - predicted) ** 2;
    ssTot += (values[i] - meanY) ** 2;
  }
  const r2 = ssTot < 1e-12 ? 1 : Math.max(0, 1 - ssRes / ssTot);

  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) return null;
  // Only suggest if the quadratic term is meaningful (otherwise linear is better)
  if (Math.abs(c) < 1e-6) return null;

  const ra = round4(a);
  const rb = round4(b);
  const rc = round4(c);

  // Build expression using the formula evaluator's supported syntax
  const parts: string[] = [];
  if (ra !== 0) parts.push(String(ra));
  if (rb !== 0) parts.push(`${rb} * delta`);
  if (rc !== 0) parts.push(`${rc} * pow(delta, 2)`);
  const expression = parts.join(" + ").replace(/\+ -/g, "- ");

  return { mode: "formula", expression, r2 };
}

/**
 * Solve a 3x3 linear system using Gaussian elimination.
 * Each row is [a, b, c, rhs].
 */
function solve3x3(
  r0: [number, number, number, number],
  r1: [number, number, number, number],
  r2: [number, number, number, number],
): [number, number, number] | null {
  const m = [r0.slice(), r1.slice(), r2.slice()];

  for (let col = 0; col < 3; col++) {
    // Partial pivoting
    let maxRow = col;
    for (let row = col + 1; row < 3; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[maxRow][col])) maxRow = row;
    }
    [m[col], m[maxRow]] = [m[maxRow], m[col]];

    const pivot = m[col][col];
    if (Math.abs(pivot) < 1e-12) return null;

    // Eliminate below
    for (let row = col + 1; row < 3; row++) {
      const factor = m[row][col] / pivot;
      for (let j = col; j < 4; j++) {
        m[row][j] -= factor * m[col][j];
      }
    }
  }

  // Back substitution
  const result = [0, 0, 0];
  for (let i = 2; i >= 0; i--) {
    let sum = m[i][3];
    for (let j = i + 1; j < 3; j++) {
      sum -= m[i][j] * result[j];
    }
    result[i] = sum / m[i][i];
    if (!Number.isFinite(result[i])) return null;
  }

  return result as [number, number, number];
}

/**
 * Analyze pasted values and suggest the best generator mode.
 *
 * Priority: Linear > Exponential > Formula (quadratic).
 * Only suggests if R² ≥ 0.90.
 */
export function suggestGeneratorMode(values: number[]): SuggestionResult {
  if (values.length < MIN_POINTS) return { suggested: false };

  // Check if all values are identical (constant) — linear with step=0
  const allSame = values.every((v) => v === values[0]);
  if (allSame) {
    return {
      suggested: true,
      fit: { mode: "linear", base: values[0], step: 0, r2: 1 },
    };
  }

  const linear = fitLinear(values);
  const exponential = fitExponential(values);
  const polynomial = fitPolynomial(values);
  const linearBiased = fitLinearWithBias(values);
  const expBiased = fitExponentialWithBias(values);

  // Within each mode, prefer the simpler fit (no bias) unless the biased version
  // meaningfully improves the fit AND the fitted bias is actually non-trivial.
  const bestLinear = pickBestWithinMode(linear, linearBiased);
  const bestExponential = pickBestWithinMode(exponential, expBiased);

  const linearOk = bestLinear != null && bestLinear.r2 >= R2_THRESHOLD;
  const expOk = bestExponential != null && bestExponential.r2 >= R2_THRESHOLD;
  const polyOk = polynomial != null && polynomial.r2 >= R2_THRESHOLD;

  // Collect valid candidates, pick best R² with priority tiebreak
  type Candidate = { fit: LinearFitResult | ExponentialFitResult | FormulaFitResult; priority: number };
  const candidates: Candidate[] = [];
  if (linearOk) candidates.push({ fit: bestLinear!, priority: 0 });
  if (expOk) candidates.push({ fit: bestExponential!, priority: 1 });
  if (polyOk) candidates.push({ fit: polynomial!, priority: 2 });

  if (candidates.length === 0) return { suggested: false };

  // Sort: highest R² first, then lowest priority (linear preferred)
  candidates.sort((a, b) => {
    const r2Diff = b.fit.r2 - a.fit.r2;
    if (Math.abs(r2Diff) > 0.005) return r2Diff; // >0.5% difference: pick better R²
    return a.priority - b.priority; // within 0.5%: prefer simpler mode
  });

  return { suggested: true, fit: candidates[0].fit };
}

/**
 * Pick between a plain fit and its biased counterpart, preferring the plain one
 * unless the biased version meaningfully improves R² AND the fitted bias is not
 * trivially close to 1.
 */
function pickBestWithinMode<T extends LinearFitResult | ExponentialFitResult>(
  plain: T | null,
  biased: T | null
): T | null {
  if (!plain && !biased) return null;
  if (!plain) return biased;
  if (!biased || biased.bias == null) return plain;

  // If bias is ~1, the biased fit is just a noisy version of the plain one
  if (Math.abs(biased.bias - 1) < 0.1) return plain;

  // Require a meaningful R² gain over the plain fit to justify the extra parameter
  const R2_GAIN_THRESHOLD = 0.02;
  if (biased.r2 - plain.r2 < R2_GAIN_THRESHOLD) return plain;

  return biased;
}

// ── Segment analysis ──────────────────────────────────────────────────

export type CurveSegment = {
  fromLevel: number;
  toLevel: number;
  fromValue: number;
  toValue: number;
  avgDelta: number;
  trend: "up" | "down" | "flat";
};

const SEGMENT_TOLERANCE = 0.25; // 25% tolerance for grouping similar deltas

/**
 * Analyze values and detect segments with similar growth patterns.
 * Returns human-readable segments like "Lv 10→50: grows ~1200/level".
 *
 * Compares each new delta against the segment's running average
 * to prevent "chain drift" (800→900→1000→1200 slowly drifting apart).
 */
export function analyzeSegments(values: number[], startLevel: number): CurveSegment[] {
  if (values.length < 2) return [];

  // Compute deltas
  const deltas: number[] = [];
  for (let i = 1; i < values.length; i++) {
    deltas.push(values[i] - values[i - 1]);
  }

  // Group consecutive deltas with similar magnitude into segments
  const segments: CurveSegment[] = [];
  let segStart = 0;
  let segSum = deltas[0];
  let segCount = 1;

  for (let i = 1; i <= deltas.length; i++) {
    const segAvg = segSum / segCount;
    const shouldSplit = i === deltas.length || !isDeltaSimilarToAvg(deltas[i], segAvg);

    if (shouldSplit) {
      const avgDelta = segSum / segCount;
      const fromIdx = segStart;
      const toIdx = i;

      // Flat: avgDelta is tiny relative to the segment's average value
      const avgValue = (Math.abs(values[fromIdx]) + Math.abs(values[toIdx])) / 2;
      const isFlat = avgValue > 0 ? Math.abs(avgDelta) / avgValue < 0.005 : Math.abs(avgDelta) < 1;

      let trend: "up" | "down" | "flat";
      if (isFlat) trend = "flat";
      else if (avgDelta > 0) trend = "up";
      else trend = "down";

      segments.push({
        fromLevel: startLevel + fromIdx,
        toLevel: startLevel + toIdx,
        fromValue: values[fromIdx],
        toValue: values[toIdx],
        avgDelta: Math.abs(avgDelta) >= 1 ? Math.round(avgDelta) : Math.round(avgDelta * 100) / 100,
        trend,
      });

      segStart = i;
      if (i < deltas.length) {
        segSum = deltas[i];
        segCount = 1;
      }
    } else {
      segSum += deltas[i];
      segCount += 1;
    }
  }

  return segments;
}

function isDeltaSimilarToAvg(delta: number, avg: number): boolean {
  // Both near zero
  if (Math.abs(avg) < 1 && Math.abs(delta) < 1) return true;
  // Different signs
  if ((avg > 0 && delta < 0) || (avg < 0 && delta > 0)) return false;
  // Compare delta to segment average
  const ref = Math.max(Math.abs(avg), Math.abs(delta));
  if (ref < 1e-9) return true;
  return Math.abs(delta - avg) / ref <= SEGMENT_TOLERANCE;
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

function round6(v: number): number {
  return Math.round(v * 1000000) / 1000000;
}
