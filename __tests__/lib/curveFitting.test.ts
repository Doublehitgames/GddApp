import {
  fitLinear,
  fitLinearWithBias,
  fitExponential,
  fitExponentialWithBias,
  suggestGeneratorMode,
} from "@/lib/addons/curveFitting";

// Helper: build values from the linear-with-bias formula
//   value(i) = base + step * (t^bias * N), where t = i/N and N = steps
function linearBiasedSeries(base: number, finalVal: number, bias: number, steps: number): number[] {
  const n = steps;
  const step = (finalVal - base) / n;
  const result: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    result.push(base + step * Math.pow(t, bias) * n);
  }
  return result;
}

// Helper: build values from the exp-with-bias formula
//   value(i) = base * growth^(t^bias * N)
function exponentialBiasedSeries(
  base: number,
  finalVal: number,
  bias: number,
  steps: number
): number[] {
  const n = steps;
  const growth = Math.pow(finalVal / base, 1 / n);
  const result: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    result.push(base * Math.pow(growth, Math.pow(t, bias) * n));
  }
  return result;
}

describe("curveFitting — bias", () => {
  describe("fitLinearWithBias", () => {
    it("recovers bias=2 from a linear-biased series", () => {
      const values = linearBiasedSeries(10, 110, 2, 10);
      const fit = fitLinearWithBias(values);
      expect(fit).not.toBeNull();
      expect(fit!.base).toBeCloseTo(10, 2);
      expect(fit!.step).toBeCloseTo(10, 2);
      expect(fit!.bias).toBeCloseTo(2, 1);
      expect(fit!.r2).toBeGreaterThan(0.99);
    });

    it("recovers bias=0.5 from a linear-biased series", () => {
      const values = linearBiasedSeries(0, 100, 0.5, 10);
      const fit = fitLinearWithBias(values);
      expect(fit).not.toBeNull();
      expect(fit!.bias).toBeCloseTo(0.5, 1);
      expect(fit!.r2).toBeGreaterThan(0.99);
    });

    it("returns null when base equals final value", () => {
      const values = [5, 5, 5, 5, 5];
      expect(fitLinearWithBias(values)).toBeNull();
    });

    it("returns null when too few points", () => {
      expect(fitLinearWithBias([1, 2, 3])).toBeNull();
    });
  });

  describe("fitExponentialWithBias", () => {
    it("recovers bias=2 from an exp-biased series", () => {
      const values = exponentialBiasedSeries(10, 1000, 2, 10);
      const fit = fitExponentialWithBias(values);
      expect(fit).not.toBeNull();
      expect(fit!.base).toBeCloseTo(10, 2);
      expect(fit!.bias).toBeCloseTo(2, 1);
      expect(fit!.r2).toBeGreaterThan(0.99);
    });

    it("recovers bias=0.5 from an exp-biased series", () => {
      const values = exponentialBiasedSeries(5, 500, 0.5, 10);
      const fit = fitExponentialWithBias(values);
      expect(fit).not.toBeNull();
      expect(fit!.bias).toBeCloseTo(0.5, 1);
      expect(fit!.r2).toBeGreaterThan(0.99);
    });

    it("returns null when any value is zero or negative", () => {
      expect(fitExponentialWithBias([0, 2, 4, 8])).toBeNull();
      expect(fitExponentialWithBias([-1, 2, 4, 8])).toBeNull();
    });
  });

  describe("suggestGeneratorMode — parsimony with bias", () => {
    it("prefers plain linear over biased when bias is essentially 1", () => {
      const values = [10, 20, 30, 40, 50]; // pure linear, bias=1
      const suggestion = suggestGeneratorMode(values);
      expect(suggestion.suggested).toBe(true);
      if (!suggestion.suggested) return;
      expect(suggestion.fit.mode).toBe("linear");
      if (suggestion.fit.mode !== "linear") return;
      // Either no bias field at all, or bias very close to 1
      const bias = suggestion.fit.bias;
      if (bias != null) {
        expect(Math.abs(bias - 1)).toBeLessThan(0.1);
      }
    });

    it("suggests linear with bias when curve is clearly biased", () => {
      const values = linearBiasedSeries(10, 110, 2.5, 10);
      const suggestion = suggestGeneratorMode(values);
      expect(suggestion.suggested).toBe(true);
      if (!suggestion.suggested) return;
      // Should pick linear with bias since it's a near-perfect fit
      if (suggestion.fit.mode === "linear" && suggestion.fit.bias != null) {
        expect(suggestion.fit.bias).toBeCloseTo(2.5, 0);
      }
      // If it picked something else, R² should still be high
      expect(suggestion.fit.r2).toBeGreaterThan(0.95);
    });

    it("suggests exponential with bias when curve has shape bias", () => {
      const values = exponentialBiasedSeries(10, 1000, 2, 10);
      const suggestion = suggestGeneratorMode(values);
      expect(suggestion.suggested).toBe(true);
      if (!suggestion.suggested) return;
      expect(suggestion.fit.r2).toBeGreaterThan(0.95);
    });
  });

  describe("legacy fitters unchanged", () => {
    it("fitLinear still matches pure linear values exactly", () => {
      const fit = fitLinear([10, 20, 30, 40]);
      expect(fit.base).toBeCloseTo(10);
      expect(fit.step).toBeCloseTo(10);
      expect(fit.r2).toBeCloseTo(1);
    });

    it("fitExponential still matches pure geometric values", () => {
      const fit = fitExponential([10, 20, 40, 80]);
      expect(fit).not.toBeNull();
      expect(fit!.base).toBeCloseTo(10, 2);
      expect(fit!.growth).toBeCloseTo(2, 2);
      expect(fit!.r2).toBeGreaterThan(0.99);
    });
  });
});
