import "server-only";
import fs from "node:fs";
import path from "node:path";
import { DOCS_ROOT, listAllDocs, readFrontmatter, type DocFrontmatter } from "./frontmatter";

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
    // Sidebar prefers a short `sidebarLabel` over the page title — the
    // title becomes the page H1, which often reads naturally as a phrase
    // ("Documentação do GDD Manager") but feels heavy in nav.
    label: fm.sidebarLabel ?? fm.title ?? humanise(last) ?? "Documentação",
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

    // Surface the root index.mdx as a "Home" entry at the top of the
    // sidebar. Without this the landing is reachable only via the brand
    // logo in the header — the sidebar wouldn't show "you are here" when
    // the user is on /docs. Force `order: -Infinity` so Home always wins
    // the sort tiebreaker against folders that also resolve to order 0.
    if (entry === root && root.indexDoc) {
      out.push({
        ...nodeFromDoc(root.indexDoc.fm, root.indexDoc.slugSegments),
        order: -Infinity,
      });
    }

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
        // Prefer the folder-level _meta.json values for label/emoji/order —
        // they describe the FOLDER's slot in its parent's sidebar. The
        // index.mdx frontmatter describes the INDEX page itself (its title
        // becomes the page H1, its `order` would only matter if the index
        // showed up as a sibling row, which it doesn't). When _meta is
        // absent, we fall back to the index frontmatter, then to a derived
        // humanised name.
        label: childMeta.label ?? indexFm?.title ?? humanise(name),
        emoji: childMeta.emoji ?? indexFm?.emoji,
        order:
          typeof childMeta.order === "number"
            ? childMeta.order
            : typeof indexFm?.order === "number"
            ? indexFm.order
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

/** A single segment of the breadcrumb trail above a doc page. */
export type Crumb = {
  label: string;
  /**
   * Target URL. Null when the folder has no `index.mdx` — clicking would
   * 404. The renderer should fall back to plain text in that case.
   */
  href: string | null;
  /** When true, this is the current page (rendered as plain text, not link). */
  current: boolean;
};

/**
 * Walks the slug segments and produces a breadcrumb trail. For each
 * intermediate segment it reads the folder's `_meta.json` (preferred)
 * or its `index.mdx` frontmatter for the label. The final crumb is the
 * doc's own title and is flagged `current` so the renderer can disable
 * the link.
 *
 * Returns an empty array for the root `/docs` (which has no parent path
 * to walk back through).
 */
export function buildBreadcrumbs(slugSegments: string[]): Crumb[] {
  if (slugSegments.length === 0) return [];
  if (!fs.existsSync(DOCS_ROOT)) return [];

  const crumbs: Crumb[] = [];
  let absDir = DOCS_ROOT;
  for (let i = 0; i < slugSegments.length; i += 1) {
    const seg = slugSegments[i];
    absDir = path.join(absDir, seg);
    const isLeaf = i === slugSegments.length - 1;
    const slugPath = slugSegments.slice(0, i + 1).join("/");

    let label = humanise(seg);
    let href: string | null = `/docs/${slugPath}`;

    if (isLeaf) {
      // Final crumb = the leaf .mdx itself. Always has a route.
      const mdxPath = `${absDir}.mdx`;
      if (fs.existsSync(mdxPath)) {
        const fm = readFrontmatter(mdxPath);
        label = fm.sidebarLabel ?? fm.title ?? label;
      }
    } else {
      // Intermediate crumb = folder. Label preference: _meta.json then
      // index.mdx then humanised folder name. Href is only set when the
      // folder has an `index.mdx`; without it, /docs/<folder> would 404
      // and the crumb falls back to plain text in the renderer.
      const metaPath = path.join(absDir, "_meta.json");
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as { label?: string };
          if (meta.label) label = meta.label;
        } catch {
          /* ignore malformed _meta.json */
        }
      }
      const idxPath = path.join(absDir, "index.mdx");
      if (fs.existsSync(idxPath)) {
        const fm = readFrontmatter(idxPath);
        // index.mdx label only used when _meta.json didn't already set one
        if (label === humanise(seg) && (fm.sidebarLabel || fm.title)) {
          label = (fm.sidebarLabel ?? fm.title)!;
        }
      } else {
        href = null;
      }
    }

    crumbs.push({ label, href, current: isLeaf });
  }
  return crumbs;
}
