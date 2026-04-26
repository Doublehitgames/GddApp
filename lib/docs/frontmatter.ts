import "server-only";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

/**
 * Frontmatter shape every `.mdx` page in `content/docs/` should follow.
 * All fields optional — sensible defaults make stub pages cheap to write
 * and lets the sidebar/TOC degrade gracefully.
 */
export type DocFrontmatter = {
  title?: string;
  description?: string;
  emoji?: string;
  /** Sort order inside the parent folder. Lower comes first; default 100. */
  order?: number;
  /** Keywords for the (future) search index. */
  keywords?: string[];
};

export type DocFile = {
  /** URL slug segments, e.g. ["referencia", "addons", "skills"] for /docs/referencia/addons/skills. */
  slugSegments: string[];
  /** Absolute path to the .mdx file. */
  filePath: string;
  /** Parsed frontmatter (may have all defaults). */
  frontmatter: DocFrontmatter;
};

/** Root of the documentation content tree. */
export const DOCS_ROOT = path.join(process.cwd(), "content", "docs");

/** Reads frontmatter from one .mdx file (no body parsing). */
export function readFrontmatter(filePath: string): DocFrontmatter {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = matter(raw);
    return parsed.data as DocFrontmatter;
  } catch {
    return {};
  }
}

/** Walks `content/docs/` and yields every .mdx file with parsed frontmatter. */
export function listAllDocs(): DocFile[] {
  if (!fs.existsSync(DOCS_ROOT)) return [];
  const out: DocFile[] = [];
  const walk = (dir: string, segs: string[]) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, [...segs, entry.name]);
        continue;
      }
      if (!entry.name.endsWith(".mdx")) continue;
      // index.mdx maps to the parent folder slug, not "<folder>/index".
      const baseName = entry.name.replace(/\.mdx$/, "");
      const slugSegments = baseName === "index" ? segs : [...segs, baseName];
      out.push({ slugSegments, filePath: full, frontmatter: readFrontmatter(full) });
    }
  };
  walk(DOCS_ROOT, []);
  return out;
}

/** Resolves URL slug segments back to a doc file (or null if missing). */
export function findDocBySlug(slugSegments: string[]): DocFile | null {
  const all = listAllDocs();
  return (
    all.find((doc) => doc.slugSegments.join("/") === slugSegments.join("/")) ?? null
  );
}
