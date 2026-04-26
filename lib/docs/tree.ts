import "server-only";
import fs from "node:fs";
import path from "node:path";
import { DOCS_ROOT, listAllDocs, type DocFrontmatter } from "./frontmatter";

/**
 * Sidebar node — each is either a leaf (an .mdx page) or a folder
 * with children. Trees are sorted by `order` ascending; ties broken by
 * label A→Z so the layout is deterministic across builds.
 */
export type SidebarNode = {
  /** URL the node links to (folders link to their index.mdx if present, else null). */
  href: string | null;
  /** Display label — frontmatter.title || derived from filename/folder. */
  label: string;
  /** Optional emoji prefix (frontmatter.emoji || _meta.json.emoji). */
  emoji?: string;
  /** Sort key. Lower comes first. */
  order: number;
  /** True for folders that contain children. */
  isFolder: boolean;
  /** Slug segments — useful for active-state matching in the sidebar. */
  slugSegments: string[];
  /** Children (folders only). */
  children?: SidebarNode[];
};

/**
 * Optional `_meta.json` per folder lets you override label/order/emoji
 * for the folder itself (frontmatter only describes the leaf .mdx).
 */
type FolderMeta = {
  label?: string;
  emoji?: string;
  order?: number;
};

function readFolderMeta(dirAbsPath: string): FolderMeta {
  const metaPath = path.join(dirAbsPath, "_meta.json");
  if (!fs.existsSync(metaPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(metaPath, "utf8")) as FolderMeta;
  } catch {
    return {};
  }
}

/** Humanises a folder/file slug, e.g. "atribute-modifiers" → "Atribute modifiers". */
function humanise(slug: string): string {
  if (!slug) return "";
  const spaced = slug.replace(/[-_]+/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function nodeFromDoc(
  fm: DocFrontmatter,
  slugSegments: string[]
): SidebarNode {
  const last = slugSegments[slugSegments.length - 1] ?? "";
  return {
    href: `/docs${slugSegments.length > 0 ? "/" + slugSegments.join("/") : ""}`,
    label: fm.title ?? humanise(last) ?? "Documentação",
    emoji: fm.emoji,
    order: typeof fm.order === "number" ? fm.order : 100,
    isFolder: false,
    slugSegments,
  };
}

/**
 * Builds the full sidebar tree by re-reading the filesystem at request
 * time. In dev this picks up file changes immediately; at build it runs
 * once during static generation.
 */
export function buildSidebarTree(): SidebarNode[] {
  if (!fs.existsSync(DOCS_ROOT)) return [];

  // Group docs by their containing folder for fast O(n) tree assembly.
  const docs = listAllDocs();

  type FolderEntry = {
    indexDoc?: { fm: DocFrontmatter; slugSegments: string[] };
    leafDocs: Array<{ fm: DocFrontmatter; slugSegments: string[] }>;
    childFolders: Map<string, FolderEntry>;
    meta: FolderMeta;
  };
  const root: FolderEntry = { leafDocs: [], childFolders: new Map(), meta: readFolderMeta(DOCS_ROOT) };

  const ensureFolder = (segs: string[]): FolderEntry => {
    let node = root;
    let absPath = DOCS_ROOT;
    for (const seg of segs) {
      absPath = path.join(absPath, seg);
      let next = node.childFolders.get(seg);
      if (!next) {
        next = { leafDocs: [], childFolders: new Map(), meta: readFolderMeta(absPath) };
        node.childFolders.set(seg, next);
      }
      node = next;
    }
    return node;
  };

  for (const doc of docs) {
    const isIndex = doc.filePath.endsWith(`${path.sep}index.mdx`);
    if (doc.slugSegments.length === 0) {
      // index.mdx at the root maps to /docs landing
      root.indexDoc = { fm: doc.frontmatter, slugSegments: [] };
      continue;
    }
    const segs = doc.slugSegments;
    if (isIndex) {
      const parentSegs = segs;
      const parent = ensureFolder(parentSegs);
      parent.indexDoc = { fm: doc.frontmatter, slugSegments: segs };
    } else {
      const parent = ensureFolder(segs.slice(0, -1));
      parent.leafDocs.push({ fm: doc.frontmatter, slugSegments: segs });
    }
  }

  const sortNodes = (nodes: SidebarNode[]): SidebarNode[] =>
    nodes.sort((a, b) => (a.order - b.order) || a.label.localeCompare(b.label));

  const buildSubtree = (entry: FolderEntry, segs: string[]): SidebarNode[] => {
    const out: SidebarNode[] = [];

    // Each leaf .mdx in this folder
    for (const leaf of entry.leafDocs) {
      out.push(nodeFromDoc(leaf.fm, leaf.slugSegments));
    }

    // Each child folder collapses to a SidebarNode that wraps its children
    for (const [name, child] of entry.childFolders.entries()) {
      const childSegs = [...segs, name];
      const childMeta = child.meta;
      const indexFm = child.indexDoc?.fm;
      const folderNode: SidebarNode = {
        href: child.indexDoc ? `/docs/${childSegs.join("/")}` : null,
        label: indexFm?.title ?? childMeta.label ?? humanise(name),
        emoji: indexFm?.emoji ?? childMeta.emoji,
        order:
          typeof indexFm?.order === "number"
            ? indexFm.order
            : typeof childMeta.order === "number"
            ? childMeta.order
            : 100,
        isFolder: true,
        slugSegments: childSegs,
        children: sortNodes(buildSubtree(child, childSegs)),
      };
      out.push(folderNode);
    }

    return sortNodes(out);
  };

  return buildSubtree(root, []);
}
