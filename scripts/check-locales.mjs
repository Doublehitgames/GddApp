import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readdirSync } from "node:fs";

const LOCALES_DIR = join(process.cwd(), "locales");
const BASE_LOCALE = "pt-BR";

function detectLocales() {
  return readdirSync(LOCALES_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.replace(/\.json$/, ""));
}

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

function validateLocaleMeta(localeName, localeJson) {
  const issues = [];
  const meta = localeJson?.meta;

  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    issues.push(`[${localeName}] Campo obrigatório ausente: meta`);
    return issues;
  }

  if (typeof meta.languageName !== "string" || meta.languageName.trim().length === 0) {
    issues.push(`[${localeName}] meta.languageName deve ser uma string não vazia`);
  }

  if (typeof meta.locale !== "string" || meta.locale.trim().length === 0) {
    issues.push(`[${localeName}] meta.locale deve ser uma string não vazia`);
  } else if (meta.locale !== localeName) {
    issues.push(`[${localeName}] meta.locale (${meta.locale}) deve ser igual ao nome do arquivo (${localeName})`);
  }

  return issues;
}

function run() {
  const allLocales = detectLocales();
  const otherLocales = allLocales.filter((locale) => locale !== BASE_LOCALE);

  if (!allLocales.includes(BASE_LOCALE)) {
    console.error(`❌ Locale base '${BASE_LOCALE}' não encontrado em /locales.`);
    process.exit(1);
  }

  const base = readLocale(BASE_LOCALE);
  const baseKeys = new Set(flattenKeys(base));

  const failures = [];

  failures.push(...validateLocaleMeta(BASE_LOCALE, base));

  const baseEmpty = collectEmptyStrings(base);
  if (baseEmpty.length) {
    failures.push(`[${BASE_LOCALE}] Traduções vazias no idioma base: ${baseEmpty.join(", ")}`);
  }

  for (const locale of otherLocales) {
    const current = readLocale(locale);
    const currentKeys = new Set(flattenKeys(current));

    failures.push(...validateLocaleMeta(locale, current));

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
