export type DiffEntry = {
  path: string;
  valueA: unknown;
  valueB: unknown;
  percentChange?: number;
};

function computePercent(a: unknown, b: unknown): number | undefined {
  if (typeof a !== "number" || typeof b !== "number") return undefined;
  if (a === 0) return b === 0 ? undefined : undefined;
  return ((b - a) / Math.abs(a)) * 100;
}

function formatPath(parent: string, key: string | number): string {
  if (typeof key === "number") return `${parent}[${key}]`;
  if (!parent) return key;
  return `${parent}.${key}`;
}

export function diffJson(
  a: unknown,
  b: unknown,
  path = ""
): DiffEntry[] {
  // Both null/undefined
  if (a == null && b == null) return [];

  // Primitives or type mismatch
  if (typeof a !== typeof b || a === null || b === null) {
    if (a === b) return [];
    return [{ path: path || "(root)", valueA: a, valueB: b, percentChange: computePercent(a, b) }];
  }

  // Numbers / strings / booleans
  if (typeof a !== "object") {
    if (a === b) return [];
    return [{ path: path || "(root)", valueA: a, valueB: b, percentChange: computePercent(a, b) }];
  }

  // Arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    const entries: DiffEntry[] = [];
    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < maxLen; i++) {
      entries.push(...diffJson(a[i], b[i], formatPath(path, i)));
    }
    return entries;
  }

  // Objects
  if (typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(objA), ...Object.keys(objB)]);
    const entries: DiffEntry[] = [];
    for (const key of allKeys) {
      entries.push(...diffJson(objA[key], objB[key], formatPath(path, key)));
    }
    return entries;
  }

  return [];
}
