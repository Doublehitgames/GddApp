import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, extname, relative } from "node:path";

const ROOT = process.cwd();
const TARGET_DIRS = ["app", "components", "hooks", "lib", "store", "utils"];
const TARGET_EXTENSIONS = new Set([".ts", ".tsx"]);
const BASELINE_FILE = join(ROOT, "scripts", "i18n-hardcode-baseline.json");

const PATTERNS = [
  {
    id: "binary-locale-check",
    regex: /locale\s*===\s*["']pt-BR["']/g,
    message: "Comparação direta com pt-BR encontrada",
  },
  {
    id: "binary-isPt-ternary",
    regex: /isPt\s*\?/g,
    message: "Ternário baseado em isPt encontrado",
  },
  {
    id: "ptbr-date-format",
    regex: /toLocale(?:Date|Time)String\(\s*["']pt-BR["']/g,
    message: "Formatação de data/hora fixada em pt-BR",
  },
  {
    id: "pt-en-helper-signature",
    regex: /\(\s*pt\s*:\s*string\s*,\s*en\s*:\s*string\s*\)/g,
    message: "Helper local com assinatura pt/en detectado",
  },
];

function walkDir(dirPath) {
  const entries = readdirSync(dirPath);
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...walkDir(fullPath));
      continue;
    }

    if (!TARGET_EXTENSIONS.has(extname(fullPath))) continue;
    files.push(fullPath);
  }

  return files;
}

function findMatches(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/);
  const matches = [];

  for (const pattern of PATTERNS) {
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      if (!pattern.regex.test(line)) continue;

      matches.push({
        filePath,
        line: lineIndex + 1,
        patternId: pattern.id,
        message: pattern.message,
        snippet: line.trim(),
      });
    }
  }

  return matches;
}

function run() {
  const shouldUpdateBaseline = process.argv.includes("--update-baseline");

  const files = TARGET_DIRS
    .map((dirName) => join(ROOT, dirName))
    .filter((dirPath) => {
      try {
        return statSync(dirPath).isDirectory();
      } catch {
        return false;
      }
    })
    .flatMap((dirPath) => walkDir(dirPath));

  const allMatches = files.flatMap((filePath) => findMatches(filePath));

  const groupedCounts = allMatches.reduce((acc, current) => {
    const relativePath = relative(ROOT, current.filePath).replace(/\\/g, "/");
    const key = `${current.patternId}::${relativePath}`;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  if (shouldUpdateBaseline) {
    writeFileSync(
      BASELINE_FILE,
      `${JSON.stringify(
        {
          updatedAt: new Date().toISOString(),
          counts: groupedCounts,
        },
        null,
        2
      )}\n`
    );
    console.log(`✅ Baseline i18n atualizada em ${relative(ROOT, BASELINE_FILE).replace(/\\/g, "/")}`);
    return;
  }

  if (!existsSync(BASELINE_FILE)) {
    if (allMatches.length === 0) {
      console.log("✅ i18n hardcode audit: nenhum padrão bloqueado encontrado.");
      return;
    }

    console.error("\n❌ i18n hardcode audit falhou (baseline ausente):\n");
    console.error("Crie a baseline inicial com:\n");
    console.error("npm run i18n:audit:update-baseline\n");
    process.exit(1);
  }

  const baseline = JSON.parse(readFileSync(BASELINE_FILE, "utf-8"));
  const baselineCounts = baseline?.counts ?? {};

  const regressions = [];

  for (const [key, count] of Object.entries(groupedCounts)) {
    const baselineCount = baselineCounts[key] ?? 0;
    if (count > baselineCount) {
      regressions.push({ key, baselineCount, currentCount: count });
    }
  }

  const newKeys = Object.keys(groupedCounts).filter((key) => !(key in baselineCounts));

  if (regressions.length === 0 && newKeys.length === 0) {
    const debtCount = Object.values(groupedCounts).reduce((sum, current) => sum + current, 0);
    console.log(`✅ i18n hardcode audit: sem regressões. Dívida atual monitorada: ${debtCount} ocorrência(s).`);
    return;
  }

  console.error("\n❌ i18n hardcode audit falhou por regressão:\n");

  if (newKeys.length) {
    console.error("Novos padrões detectados (não existem na baseline):");
    for (const key of newKeys) {
      const [patternId, filePath] = key.split("::");
      console.error(`- [${patternId}] ${filePath} (ocorrências: ${groupedCounts[key]})`);
    }
    console.error("");
  }

  if (regressions.length) {
    console.error("Padrões com aumento acima da baseline:");
    for (const item of regressions) {
      const [patternId, filePath] = item.key.split("::");
      console.error(`- [${patternId}] ${filePath} (baseline: ${item.baselineCount}, atual: ${item.currentCount})`);
    }
  }

  console.error("\nSe a mudança for intencional, atualize a baseline com:");
  console.error("npm run i18n:audit:update-baseline");
  process.exit(1);
}

run();
