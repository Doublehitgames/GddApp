import fs from "node:fs";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import matter from "gray-matter";
import { evaluate } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";
import * as runtime from "react/jsx-runtime";
import { findDocBySlug, listAllDocs } from "@/lib/docs/frontmatter";
import { buildBreadcrumbs } from "@/lib/docs/tree";
import { DocsBreadcrumbs } from "@/components/docs/DocsBreadcrumbs";
import { useMDXComponents } from "@/mdx-components";

type RouteParams = { slug?: string[] };

/**
 * Pre-renders every MDX page at build time. The dynamic catch-all only
 * matches paths that exist on disk; each one becomes a static HTML file
 * the same way the rest of the app does.
 */
export function generateStaticParams(): RouteParams[] {
  return listAllDocs().map((doc) => ({ slug: doc.slugSegments }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { slug = [] } = await params;
  const doc = findDocBySlug(slug);
  if (!doc) return { title: "Documentação · GDD Manager" };
  const title = doc.frontmatter.title
    ? `${doc.frontmatter.title} · GDD Manager Docs`
    : "Documentação · GDD Manager";
  return {
    title,
    description: doc.frontmatter.description,
  };
}

export default async function DocPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug = [] } = await params;
  const doc = findDocBySlug(slug);
  if (!doc) notFound();

  // Compile MDX server-side with @mdx-js/mdx. We avoided two earlier
  // approaches because of compatibility issues:
  //   - next-mdx-remote/rsc uses `new Function()` to eval compiled MDX,
  //     which breaks under React 19 + RSC at request time.
  //   - @next/mdx loader needs serialisable plugin options, which Turbopack
  //     refuses (function-typed remark plugins throw "not serializable"
  //     during build).
  // `evaluate()` from @mdx-js/mdx is async, returns a real React component,
  // and uses the standard JSX runtime — safe across React 19, RSC, and
  // both bundlers.
  const raw = fs.readFileSync(doc.filePath, "utf8");
  const { content } = matter(raw); // strips the YAML frontmatter block
  // `evaluate()` expects a no-arg `useMDXComponents`; ours takes the parent
  // components map (MDX v2 convention) and merges. Wrap it here.
  // `remark-gfm` adds the GitHub-flavoured Markdown extras most authors
  // expect — pipe tables, task lists, strikethrough, autolinks. Without
  // it, `| col | col |` renders as literal pipes.
  const { default: MdxContent } = await evaluate(content, {
    ...runtime,
    remarkPlugins: [remarkGfm],
    useMDXComponents: () => useMDXComponents({}),
  });
  const fm = doc.frontmatter;
  const crumbs = buildBreadcrumbs(doc.slugSegments);

  return (
    <article
      data-docs-content
      className="prose prose-invert max-w-none"
    >
      <DocsBreadcrumbs crumbs={crumbs} />
      {fm.emoji || fm.description ? (
        <header className="mb-6">
          {fm.emoji ? (
            <span className="text-4xl block mb-2" aria-hidden="true">
              {fm.emoji}
            </span>
          ) : null}
          {fm.description ? (
            <p className="text-base text-gray-400 mt-2">{fm.description}</p>
          ) : null}
        </header>
      ) : null}
      <MdxContent />
    </article>
  );
}
