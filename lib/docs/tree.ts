import "server-only";
import fs from "node:fs";
import path from "node:path";
import { getDocsRoot, listAllDocs, readFrontmatter, type DocFrontmatter } from "./frontmatter";

export type SidebarNode = {
  href: string | null;
  label: string;
  emoji?: string;
  order: number;
  isFolder: boolean;
  slugSegments: string[];
  children?: SidebarNode[];
};

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

function humanise(slug: string): string {
  if (!slug) return "";
  const spaced = slug.replace(/[-_]+/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function nodeFromDoc(
  fm: DocFrontmatter,
  slugSegments: string[],
  locale: string
): SidebarNode {
  const last = slugSegments[slugSegments.length - 1] ?? "";
  const href =
    slugSegments.length > 0
      ? `/docs/${locale}/${slugSegments.join("/")}`
      : `/docs/${locale}`;
  return {
    href,
    label: fm.sidebarLabel ?? fm.title ?? humanise(last) ?? "Documentação",
    emoji: fm.emoji,
    order: typeof fm.order === "number" ? fm.order : 100,
    isFolder: false,
    slugSegments,
  };
}

export function buildSidebarTree(locale: string): SidebarNode[] {
  const DOCS_ROOT = getDocsRoot(locale);
  if (!fs.existsSync(DOCS_ROOT)) return [];

  const docs = listAllDocs(locale);

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
      root.indexDoc = { fm: doc.frontmatter, slugSegments: [] };
      continue;
    }
    const segs = doc.slugSegments;
    if (isIndex) {
      const parent = ensureFolder(segs);
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

    if (entry === root && root.indexDoc) {
      out.push({
        ...nodeFromDoc(root.indexDoc.fm, root.indexDoc.slugSegments, locale),
        order: -Infinity,
      });
    }

    for (const leaf of entry.leafDocs) {
      out.push(nodeFromDoc(leaf.fm, leaf.slugSegments, locale));
    }

    for (const [name, child] of entry.childFolders.entries()) {
      const childSegs = [...segs, name];
      const childMeta = child.meta;
      const indexFm = child.indexDoc?.fm;
      const folderNode: SidebarNode = {
        href: child.indexDoc ? `/docs/${locale}/${childSegs.join("/")}` : null,
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

export type Crumb = {
  label: string;
  href: string | null;
  current: boolean;
};

export function buildBreadcrumbs(slugSegments: string[], locale: string): Crumb[] {
  if (slugSegments.length === 0) return [];
  const DOCS_ROOT = getDocsRoot(locale);
  if (!fs.existsSync(DOCS_ROOT)) return [];

  const crumbs: Crumb[] = [];
  let absDir = DOCS_ROOT;
  for (let i = 0; i < slugSegments.length; i += 1) {
    const seg = slugSegments[i];
    absDir = path.join(absDir, seg);
    const isLeaf = i === slugSegments.length - 1;
    const slugPath = slugSegments.slice(0, i + 1).join("/");

    let label = humanise(seg);
    let href: string | null = `/docs/${locale}/${slugPath}`;

    if (isLeaf) {
      const mdxPath = `${absDir}.mdx`;
      if (fs.existsSync(mdxPath)) {
        const fm = readFrontmatter(mdxPath);
        label = fm.sidebarLabel ?? fm.title ?? label;
      }
    } else {
      const metaPath = path.join(absDir, "_meta.json");
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as { label?: string };
          if (meta.label) label = meta.label;
        } catch {
          /* ignore */
        }
      }
      const idxPath = path.join(absDir, "index.mdx");
      if (fs.existsSync(idxPath)) {
        const fm = readFrontmatter(idxPath);
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
