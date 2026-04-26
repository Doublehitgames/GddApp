"use client";

import { useEffect, useState } from "react";

type Heading = {
  id: string;
  text: string;
  level: 2 | 3;
};

/**
 * "Nesta página" floating TOC, rendered only on lg+ screens. Walks the
 * `<article>` after mount to harvest h2/h3 ids (set by mdx-components),
 * then highlights the heading nearest the top of the viewport via an
 * IntersectionObserver. Plain anchor links handle scroll smoothly.
 */
export function DocsTOC() {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const article = document.querySelector("article[data-docs-content]");
    if (!article) return;
    const nodes = Array.from(article.querySelectorAll<HTMLHeadingElement>("h2, h3"));
    const harvested: Heading[] = nodes
      .filter((n) => n.id)
      .map((n) => ({
        id: n.id,
        // strip the trailing "#" anchor we add inside makeHeading()
        text: (n.textContent ?? "").replace(/#\s*$/, "").trim(),
        level: n.tagName === "H2" ? 2 : 3,
      }));
    setHeadings(harvested);

    if (harvested.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the topmost intersecting heading; fallback to keeping the
        // last active one when the user scrolls past everything.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  if (headings.length === 0) return null;

  return (
    <nav aria-label="Nesta página" className="text-xs">
      <p className="mb-2 text-[10px] uppercase tracking-wide text-gray-500">Nesta página</p>
      <ul className="space-y-1.5 border-l border-gray-800 pl-3">
        {headings.map((h) => {
          const isActive = h.id === activeId;
          return (
            <li
              key={h.id}
              style={{ paddingLeft: h.level === 3 ? 12 : 0 }}
            >
              <a
                href={`#${h.id}`}
                className={`block transition-colors ${
                  isActive
                    ? "text-indigo-300 font-medium"
                    : "text-gray-500 hover:text-gray-200"
                }`}
              >
                {h.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
