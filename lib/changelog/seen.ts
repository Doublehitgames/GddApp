/**
 * Marcador de "até onde eu já li" do changelog, por projeto.
 *
 * Mora no localStorage de propósito: é uma informação do aparelho, não do
 * projeto. Ler o changelog no notebook não deve apagar o selo de novidade do
 * celular, e muito menos o dos outros membros do time.
 */

const KEY = "gdd_changelog_seen_v1";

type SeenMap = Record<string, string>;

function readAll(): SeenMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SeenMap) : {};
  } catch {
    return {};
  }
}

/** ISO da última leitura, ou null se o projeto nunca foi lido neste aparelho. */
export function readChangelogSeen(projectId: string): string | null {
  if (!projectId) return null;
  return readAll()[projectId] ?? null;
}

export function writeChangelogSeen(projectId: string, iso = new Date().toISOString()): void {
  if (typeof window === "undefined" || !projectId) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [projectId]: iso }));
  } catch {}
}
