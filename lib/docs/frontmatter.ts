import "server-only";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export type DocFrontmatter = {
  title?: string;
  sidebarLabel?: string;
  description?: string;
  emoji?: string;
  order?: number;
  keywords?: string[];
};

export type DocFile = {
  slugSegments: string[];
  filePath: string;
  frontmatter: DocFrontmatter;
};

/** Root of the documentation content tree for a given locale. */
export function getDocsRoot(locale: string): string {
  return path.join(process.cwd(), "content", "docs", locale);
}

export function readFrontmatter(filePath: string): DocFrontmatter {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = matter(raw);
    return parsed.data as DocFrontmatter;
  } catch {
    return {};
  }
}

/** Walks `content/docs/[locale]/` and yields every .mdx file with parsed frontmatter. */
export function listAllDocs(locale: string): DocFile[] {
  const root = getDocsRoot(locale);
  if (!fs.existsSync(root)) return [];
  const out: DocFile[] = [];
  const walk = (dir: string, segs: string[]) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, [...segs, entry.name]);
        continue;
      }
      if (!entry.name.endsWith(".mdx")) continue;
      const baseName = entry.name.replace(/\.mdx$/, "");
      const slugSegments = baseName === "index" ? segs : [...segs, baseName];
      out.push({ slugSegments, filePath: full, frontmatter: readFrontmatter(full) });
    }
  };
  walk(root, []);
  return out;
}

/** Resolves URL slug segments back to a doc file for the given locale. */
export function findDocBySlug(slugSegments: string[], locale: string): DocFile | null {
  const all = listAllDocs(locale);
  return (
    all.find((doc) => doc.slugSegments.join("/") === slugSegments.join("/")) ?? null
  );
}
