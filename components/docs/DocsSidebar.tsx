"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import type { SidebarNode } from "@/lib/docs/tree";

interface DocsSidebarProps {
  tree: SidebarNode[];
}

/**
 * Hierarchical sidebar nav for the docs site. Folder rows toggle
 * collapse; leaf rows are <Link>s that highlight when their slug matches
 * the current pathname. Tree comes pre-sorted from `buildSidebarTree()`.
 */
export function DocsSidebar({ tree }: DocsSidebarProps) {
  return (
    <nav className="text-sm text-gray-300" aria-label="Navegação da documentação">
      <ul className="space-y-0.5">
        {tree.map((node) => (
          <SidebarItem key={node.slugSegments.join("/") || "_root"} node={node} depth={0} />
        ))}
      </ul>
    </nav>
  );
}

function SidebarItem({ node, depth }: { node: SidebarNode; depth: number }) {
  const pathname = usePathname() ?? "";
  const isActive = node.href === pathname;
  // A folder is "active-trail" when the current path lives inside it —
  // useful for keeping it auto-expanded.
  const isActiveTrail = useMemo(() => {
    const prefix = `/docs/${node.slugSegments.join("/")}`;
    return pathname === prefix || pathname.startsWith(prefix + "/");
  }, [pathname, node.slugSegments]);

  // Folders default to expanded if they contain the active page; otherwise
  // collapsed at depth ≥1 to keep the sidebar scannable.
  const [expanded, setExpanded] = useState(isActiveTrail || depth === 0);

  if (!node.isFolder) {
    return (
      <li>
        <Link
          href={node.href ?? "#"}
          className={`flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors ${
            isActive
              ? "bg-indigo-500/15 text-indigo-200 font-medium"
              : "text-gray-300 hover:bg-gray-800/60 hover:text-white"
          }`}
          style={{ paddingLeft: 8 + depth * 12 }}
        >
          {node.emoji ? (
            <span aria-hidden="true" className="text-xs">
              {node.emoji}
            </span>
          ) : null}
          <span>{node.label}</span>
        </Link>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
          isActiveTrail ? "text-gray-100" : "text-gray-400 hover:text-white"
        }`}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        <span
          aria-hidden="true"
          className="text-[10px] text-gray-500 transition-transform"
          style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          ▶
        </span>
        {node.emoji ? (
          <span aria-hidden="true" className="text-xs">
            {node.emoji}
          </span>
        ) : null}
        <span className="text-xs uppercase tracking-wide font-semibold">{node.label}</span>
      </button>
      {expanded && node.children && node.children.length > 0 ? (
        <ul className="space-y-0.5">
          {node.href ? (
            <li>
              <Link
                href={node.href}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors ${
                  pathname === node.href
                    ? "bg-indigo-500/15 text-indigo-200 font-medium"
                    : "text-gray-400 hover:bg-gray-800/60 hover:text-white"
                }`}
                style={{ paddingLeft: 8 + (depth + 1) * 12 }}
              >
                Visão geral
              </Link>
            </li>
          ) : null}
          {node.children.map((child) => (
            <SidebarItem
              key={child.slugSegments.join("/")}
              node={child}
              depth={depth + 1}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
