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
import { SUPPORTED_LOCALES, type AppLocale } from "@/lib/i18n/config";

type RouteParams = { locale: string; slug?: string[] };

export function generateStaticParams(): RouteParams[] {
  return SUPPORTED_LOCALES.flatMap((locale) =>
    listAllDocs(locale).map((doc) => ({
      locale,
      slug: doc.slugSegments,
    }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { locale, slug = [] } = await params;
  const doc = findDocBySlug(slug, locale);
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
  const { locale, slug = [] } = await params;

  if (!SUPPORTED_LOCALES.includes(locale as AppLocale)) notFound();

  const doc = findDocBySlug(slug, locale);
  if (!doc) notFound();

  const raw = fs.readFileSync(doc.filePath, "utf8");
  const { content } = matter(raw);
  const { default: MdxContent } = await evaluate(content, {
    ...runtime,
    remarkPlugins: [remarkGfm],
    useMDXComponents: () => useMDXComponents({}, locale),
  });
  const fm = doc.frontmatter;
  const crumbs = buildBreadcrumbs(doc.slugSegments, locale);

  return (
    <article data-docs-content className="prose prose-invert max-w-none">
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
