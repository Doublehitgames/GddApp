import fs from "node:fs";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MDXRemote } from "next-mdx-remote/rsc";
import matter from "gray-matter";
import { findDocBySlug, listAllDocs } from "@/lib/docs/frontmatter";
import { useMDXComponents } from "@/mdx-components";

type RouteParams = { slug?: string[] };

/**
 * Pre-renders every MDX page at build time. The dynamic catch-all only
 * matches paths that exist on disk, and each one becomes a static HTML
 * file the same way the rest of the app does.
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

  // Read the raw .mdx and split frontmatter from body. We render the body
  // with MDXRemote and use frontmatter (title/description) above the content.
  const raw = fs.readFileSync(doc.filePath, "utf8");
  const { content, data } = matter(raw);
  // mdx-components provides the global element mappings + custom components
  // (Callout, FeatureCard, PropertyTable). Cast is safe — both signatures
  // describe the same MDXComponents shape.
  const components = useMDXComponents({});

  return (
    <article
      data-docs-content
      className="prose prose-invert max-w-none"
    >
      {data.emoji || data.title ? (
        <header className="mb-6">
          {data.emoji ? (
            <span className="text-4xl block mb-2" aria-hidden="true">
              {data.emoji}
            </span>
          ) : null}
          {data.description ? (
            <p className="text-base text-gray-400 mt-2">{data.description}</p>
          ) : null}
        </header>
      ) : null}
      <MDXRemote source={content} components={components} />
    </article>
  );
}
