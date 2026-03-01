import { readFileSync } from "node:fs";
import { join } from "node:path";

const LOCALES_DIR = join(process.cwd(), "locales");
const BASE_LOCALE = "pt-BR";
const OTHER_LOCALES = ["en"];

function readLocale(fileName) {
  const fullPath = join(LOCALES_DIR, `${fileName}.json`);
  return JSON.parse(readFileSync(fullPath, "utf-8"));
}

function flattenKeys(input, prefix = "") {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(input).flatMap(([key, value]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    return flattenKeys(value, next);
  });
}

function collectEmptyStrings(input, prefix = "") {
  if (typeof input === "string") {
    return input.trim().length === 0 ? [prefix] : [];
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return [];
  }

  return Object.entries(input).flatMap(([key, value]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    return collectEmptyStrings(value, next);
  });
}

function run() {
  const base = readLocale(BASE_LOCALE);
  const baseKeys = new Set(flattenKeys(base));

  const failures = [];

  for (const locale of OTHER_LOCALES) {
    const current = readLocale(locale);
    const currentKeys = new Set(flattenKeys(current));

    const missing = [...baseKeys].filter((key) => !currentKeys.has(key));
    const extra = [...currentKeys].filter((key) => !baseKeys.has(key));
    const empty = collectEmptyStrings(current);

    if (missing.length) {
      failures.push(`[${locale}] Chaves ausentes: ${missing.join(", ")}`);
    }

    if (extra.length) {
      failures.push(`[${locale}] Chaves extras: ${extra.join(", ")}`);
    }

    if (empty.length) {
      failures.push(`[${locale}] Traduções vazias: ${empty.join(", ")}`);
    }
  }

  if (failures.length) {
    console.error("\n❌ Falha na validação de localizações:\n");
    failures.forEach((line) => console.error(`- ${line}`));
    process.exit(1);
  }

  console.log("✅ Localizações válidas: estrutura e chaves consistentes.");
}

run();
