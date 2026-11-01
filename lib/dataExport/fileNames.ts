/**
 * Nomes de arquivo e pasta para o que sai do "Exportar os dados".
 *
 * Mantém acento e emoji (é o título que a pessoa escreveu e é assim que ela
 * vai procurar a pasta), tira só o que Windows, macOS e o zip recusam.
 */

const FORBIDDEN = /[<>:"/\\|?*\u0000-\u001f\u007f]/g;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i;
const MAX_LENGTH = 80;

export function safeFileName(raw: string | null | undefined, fallback = "sem-titulo"): string {
  let name = String(raw ?? "")
    .replace(FORBIDDEN, " ")
    .replace(/\s+/g, " ")
    .trim()
    // Windows não aceita nome terminado em ponto ou espaço.
    .replace(/[. ]+$/, "")
    .replace(/^\.+/, "");
  if (Array.from(name).length > MAX_LENGTH) {
    name = Array.from(name).slice(0, MAX_LENGTH).join("").trim();
  }
  if (!name || WINDOWS_RESERVED.test(name)) return fallback;
  return name;
}

/**
 * Devolve um gerador que nunca repete nome no mesmo nível: "Fazenda",
 * "Fazenda (2)", "Fazenda (3)". A comparação ignora caixa, como o Windows.
 */
export function uniqueNamer(): (name: string) => string {
  const used = new Set<string>();
  return (name: string) => {
    let candidate = name;
    let n = 2;
    while (used.has(candidate.toLowerCase())) {
      candidate = `${name} (${n})`;
      n += 1;
    }
    used.add(candidate.toLowerCase());
    return candidate;
  };
}

/** "2026-11-01" — data do arquivo, no fuso de quem baixa. */
export function exportDateStamp(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
