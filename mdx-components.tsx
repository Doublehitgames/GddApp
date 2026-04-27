import type { MDXComponents } from "mdx/types";
import type { ReactNode, AnchorHTMLAttributes, ImgHTMLAttributes } from "react";
import Link from "next/link";
import { Callout } from "@/components/docs/mdx/Callout";
import { FeatureCard } from "@/components/docs/mdx/FeatureCard";
import { PropertyTable } from "@/components/docs/mdx/PropertyTable";

function slugify(value: string): string {
  return value
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function extractText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return extractText((node as { props?: { children?: ReactNode } }).props?.children);
  }
  return "";
}

function makeHeading(level: 1 | 2 | 3 | 4) {
  const Tag = (`h${level}` as const);
  const sizes: Record<number, string> = {
    1: "text-4xl md:text-5xl font-bold tracking-tight mt-2 mb-4 text-gray-100",
    2: "text-2xl md:text-3xl font-semibold tracking-tight mt-10 mb-3 text-gray-100 border-b border-gray-800/80 pb-2",
    3: "text-xl font-semibold tracking-tight mt-8 mb-2 text-gray-100",
    4: "text-lg font-semibold mt-6 mb-2 text-gray-200",
  };

  function Heading({ children }: { children?: ReactNode }) {
    const id = slugify(extractText(children));
    return (
      <Tag id={id} className={`group scroll-mt-24 ${sizes[level]}`}>
        {children}
        <a
          href={`#${id}`}
          aria-label="Link para esta seção"
          className="ml-2 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity hover:text-indigo-400"
        >
          #
        </a>
      </Tag>
    );
  }
  return Heading;
}

/** Rewrites `/docs/foo` → `/docs/[locale]/foo` for internal doc links. */
function prefixLocale(href: string, locale: string): string {
  if (href.startsWith("/docs/") && !href.startsWith(`/docs/${locale}/`)) {
    return `/docs/${locale}/${href.slice("/docs/".length)}`;
  }
  return href;
}

function makeMdxAnchor(locale: string) {
  return function MdxAnchor({ href = "#", children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
    const resolved = prefixLocale(href, locale);
    const isInternal = resolved.startsWith("/") || resolved.startsWith("#");
    if (isInternal) {
      return (
        <Link
          href={resolved}
          className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 decoration-indigo-400/40 hover:decoration-indigo-300"
        >
          {children}
        </Link>
      );
    }
    return (
      <a
        href={resolved}
        target="_blank"
        rel="noopener noreferrer"
        className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 decoration-indigo-400/40 hover:decoration-indigo-300"
        {...rest}
      >
        {children}
        <span aria-hidden="true" className="ml-0.5 text-[0.85em] opacity-70">↗</span>
      </a>
    );
  };
}

function makeLocaleFeatureCard(locale: string) {
  return function LocaleFeatureCard(props: Parameters<typeof FeatureCard>[0]) {
    return <FeatureCard {...props} href={prefixLocale(props.href, locale)} />;
  };
}

function MdxAnchorDefault({ href = "#", children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const isInternal = href.startsWith("/") || href.startsWith("#");
  if (isInternal) {
    return (
      <Link
        href={href}
        className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 decoration-indigo-400/40 hover:decoration-indigo-300"
      >
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 decoration-indigo-400/40 hover:decoration-indigo-300"
      {...rest}
    >
      {children}
      <span aria-hidden="true" className="ml-0.5 text-[0.85em] opacity-70">↗</span>
    </a>
  );
}

function MdxImage({ src, alt = "", ...rest }: ImgHTMLAttributes<HTMLImageElement>) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="rounded-lg border border-gray-800 my-4" {...rest} />;
}

export function useMDXComponents(components: MDXComponents, locale?: string): MDXComponents {
  const AnchorComponent = locale ? makeMdxAnchor(locale) : MdxAnchorDefault;
  const FeatureCardComponent = locale ? makeLocaleFeatureCard(locale) : FeatureCard;

  return {
    h1: makeHeading(1),
    h2: makeHeading(2),
    h3: makeHeading(3),
    h4: makeHeading(4),
    p: ({ children }) => (
      <p className="text-gray-300 leading-relaxed my-4">{children}</p>
    ),
    a: AnchorComponent as MDXComponents["a"],
    ul: ({ children }) => (
      <ul className="list-disc list-outside pl-6 my-4 space-y-1.5 text-gray-300">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-outside pl-6 my-4 space-y-1.5 text-gray-300">{children}</ol>
    ),
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    strong: ({ children }) => <strong className="text-gray-100 font-semibold">{children}</strong>,
    em: ({ children }) => <em className="text-gray-200">{children}</em>,
    code: ({ children, ...rest }) => (
      <code
        className="rounded bg-gray-800 border border-gray-700/60 px-1.5 py-0.5 text-[0.875em] font-mono text-indigo-200"
        {...rest}
      >
        {children}
      </code>
    ),
    pre: ({ children }) => (
      <pre className="my-4 overflow-x-auto rounded-xl border border-gray-800 bg-gray-950 p-4 text-sm text-gray-200">
        {children}
      </pre>
    ),
    blockquote: ({ children }) => (
      <blockquote className="my-4 border-l-4 border-indigo-500/60 bg-indigo-500/5 pl-4 pr-3 py-2 text-gray-300 italic">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="my-8 border-gray-800" />,
    table: ({ children }) => (
      <div className="my-4 overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-sm border-collapse">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-gray-900/80">{children}</thead>,
    th: ({ children }) => (
      <th className="border-b border-gray-800 px-3 py-2 text-left font-semibold text-gray-100">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border-b border-gray-800/60 px-3 py-2 text-gray-300 align-top">{children}</td>
    ),
    img: MdxImage as MDXComponents["img"],
    Callout,
    FeatureCard: FeatureCardComponent as MDXComponents[string],
    PropertyTable,
    ...components,
  };
}
