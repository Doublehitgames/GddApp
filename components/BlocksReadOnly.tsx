"use client";

/**
 * Lightweight read-only renderer for BlockNote block JSON.
 * Zero editor dependency — converts blocks directly to React JSX.
 * Renders instantly without any dynamic imports or editor initialization.
 */

import React from "react";
import { toEmbedUrl } from "@/lib/richDoc/embedBlock";
import { CALLOUT_VARIANTS, type CalloutVariantId } from "@/lib/richDoc/calloutBlock";

// ─── Types (minimal subset of what BlockNote persists) ────────────────────────

interface TextStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  textColor?: string;
  backgroundColor?: string;
  code?: boolean;
}

interface StyledText {
  type: "text";
  text: string;
  styles?: TextStyle;
}

interface LinkNode {
  type: "link";
  href: string;
  content: StyledText[];
}

type InlineNode = StyledText | LinkNode;

interface TableRow {
  cells: Array<InlineNode[] | { content?: InlineNode[] }>;
}

interface TableContent {
  type: "tableContent";
  rows: TableRow[];
}

export interface Block {
  id?: string;
  type: string;
  props?: Record<string, unknown>;
  content?: InlineNode[] | TableContent;
  children?: Block[];
}

// ─── Color maps ───────────────────────────────────────────────────────────────

const TEXT_COLORS: Record<string, string> = {
  gray: "#9ca3af",
  brown: "#a16207",
  orange: "#f97316",
  yellow: "#ca8a04",
  green: "#16a34a",
  blue: "#3b82f6",
  purple: "#9333ea",
  pink: "#ec4899",
  red: "#ef4444",
};

const BG_COLORS: Record<string, string> = {
  gray: "rgba(156,163,175,.18)",
  brown: "rgba(161,98,7,.18)",
  orange: "rgba(249,115,22,.18)",
  yellow: "rgba(234,179,8,.18)",
  green: "rgba(34,197,94,.18)",
  blue: "rgba(59,130,246,.18)",
  purple: "rgba(168,85,247,.18)",
  pink: "rgba(236,72,153,.18)",
  red: "rgba(239,68,68,.18)",
};

// ─── Inline renderer ──────────────────────────────────────────────────────────

function Inline({ nodes, dark }: { nodes: InlineNode[]; dark: boolean }) {
  if (!nodes?.length) return null;
  return (
    <>
      {nodes.map((node, i) => {
        if (node.type === "link") {
          return (
            <a
              key={i}
              href={node.href}
              className={dark ? "text-blue-400 hover:text-blue-300 underline" : "text-blue-600 hover:text-blue-500 underline"}
            >
              <Inline nodes={node.content || []} dark={dark} />
            </a>
          );
        }
        const s = node.styles || {};
        const style: React.CSSProperties = {};
        if (s.textColor && s.textColor !== "default") style.color = TEXT_COLORS[s.textColor] ?? s.textColor;
        if (s.backgroundColor && s.backgroundColor !== "default") style.backgroundColor = BG_COLORS[s.backgroundColor] ?? s.backgroundColor;

        if (s.code) {
          return (
            <code key={i} className={`px-1 py-0.5 rounded text-[0.85em] font-mono ${dark ? "bg-gray-800 text-gray-200" : "bg-gray-100 text-gray-800"}`}>
              {node.text}
            </code>
          );
        }

        let el: React.ReactNode = node.text;
        if (s.bold) el = <strong>{el}</strong>;
        if (s.italic) el = <em>{el}</em>;
        if (s.underline) el = <u>{el}</u>;
        if (s.strikethrough) el = <s>{el}</s>;
        return Object.keys(style).length > 0
          ? <span key={i} style={style}>{el}</span>
          : <React.Fragment key={i}>{el}</React.Fragment>;
      })}
    </>
  );
}

// ─── List grouping ────────────────────────────────────────────────────────────

type Grouped =
  | { k: "block"; b: Block }
  | { k: "ul"; items: Block[] }
  | { k: "ol"; items: Block[] }
  | { k: "check"; items: Block[] };

function group(blocks: Block[]): Grouped[] {
  const out: Grouped[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (b.type === "bulletListItem") {
      const items: Block[] = [];
      while (i < blocks.length && blocks[i].type === "bulletListItem") items.push(blocks[i++]);
      out.push({ k: "ul", items });
    } else if (b.type === "numberedListItem") {
      const items: Block[] = [];
      while (i < blocks.length && blocks[i].type === "numberedListItem") items.push(blocks[i++]);
      out.push({ k: "ol", items });
    } else if (b.type === "checkListItem") {
      const items: Block[] = [];
      while (i < blocks.length && blocks[i].type === "checkListItem") items.push(blocks[i++]);
      out.push({ k: "check", items });
    } else {
      out.push({ k: "block", b });
      i++;
    }
  }
  return out;
}

// ─── Block renderer ───────────────────────────────────────────────────────────

function alignClass(p?: Record<string, unknown>): string {
  if (p?.textAlignment === "center") return "text-center";
  if (p?.textAlignment === "right") return "text-right";
  if (p?.textAlignment === "justify") return "text-justify";
  return "";
}

function blockStyle(p?: Record<string, unknown>): React.CSSProperties {
  const s: React.CSSProperties = {};
  const bg = p?.backgroundColor as string | undefined;
  if (bg && bg !== "default") s.backgroundColor = BG_COLORS[bg] ?? bg;
  const tc = p?.textColor as string | undefined;
  if (tc && tc !== "default") s.color = TEXT_COLORS[tc] ?? tc;
  return s;
}

function inlineOf(b: Block): InlineNode[] {
  return Array.isArray(b.content) ? (b.content as InlineNode[]) : [];
}

function Block({ b, dark }: { b: Block; dark: boolean }) {
  const p = b.props;
  const nodes = inlineOf(b);
  const ac = alignClass(p);
  const bs = blockStyle(p);
  const kids = b.children?.length ? <Blocks blocks={b.children} dark={dark} /> : null;

  switch (b.type) {
    case "paragraph":
      return (
        <p className={`mb-2 leading-relaxed ${ac}`} style={bs}>
          <Inline nodes={nodes} dark={dark} />{kids}
        </p>
      );

    case "heading": {
      const lv = (p?.level as number) ?? 1;
      const hcls = lv === 1 ? "text-2xl font-bold mt-5 mb-2" : lv === 2 ? "text-xl font-semibold mt-4 mb-1.5" : "text-lg font-semibold mt-3 mb-1";
      const inner = <><Inline nodes={nodes} dark={dark} />{kids}</>;
      if (lv === 1) return <h1 className={`${hcls} ${ac}`} style={bs}>{inner}</h1>;
      if (lv === 2) return <h2 className={`${hcls} ${ac}`} style={bs}>{inner}</h2>;
      return <h3 className={`${hcls} ${ac}`} style={bs}>{inner}</h3>;
    }

    case "quote":
      return (
        <blockquote className={`border-l-4 pl-4 my-2 italic ${dark ? "border-gray-500 text-gray-300" : "border-gray-300 text-gray-600"} ${ac}`} style={bs}>
          <Inline nodes={nodes} dark={dark} />{kids}
        </blockquote>
      );

    case "codeBlock": {
      const code = nodes.map((n) => (n as StyledText).text ?? "").join("");
      return (
        <pre className={`rounded-lg px-4 py-3 my-2 text-sm font-mono overflow-x-auto ${dark ? "bg-gray-900 text-gray-200" : "bg-gray-100 text-gray-800"}`}>
          <code>{code}</code>
        </pre>
      );
    }

    case "image": {
      const url = p?.url as string | undefined;
      if (!url) return null;
      const caption = p?.caption as string | undefined;
      return (
        <figure className={`my-3 ${ac}`}>
          <img src={url} alt={caption || ""} className="max-w-full rounded-lg" loading="lazy" />
          {caption && <figcaption className={`text-xs mt-1 ${dark ? "text-gray-400" : "text-gray-500"}`}>{caption}</figcaption>}
        </figure>
      );
    }

    case "embed": {
      const url = p?.url as string | undefined;
      if (!url) return null;
      const embed = toEmbedUrl(url);
      if (!embed) return null;
      return (
        <div className="my-3 w-full relative" style={{ paddingBottom: "56.25%" }}>
          <iframe
            src={embed.src}
            title={`Embedded ${embed.provider}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, borderRadius: 6, background: "#000" }}
          />
        </div>
      );
    }

    case "callout": {
      const vid = (p?.variant as CalloutVariantId) || "note";
      const variant = CALLOUT_VARIANTS.find((v) => v.id === vid) ?? CALLOUT_VARIANTS[0];
      const darkCls: Record<CalloutVariantId, string> = {
        note: "bg-blue-900/20 border-blue-700/40",
        warning: "bg-yellow-900/20 border-yellow-700/40",
        "design-decision": "bg-purple-900/20 border-purple-700/40",
        "balance-note": "bg-green-900/20 border-green-700/40",
      };
      const lightCls: Record<CalloutVariantId, string> = {
        note: "bg-blue-50 border-blue-200",
        warning: "bg-yellow-50 border-yellow-200",
        "design-decision": "bg-purple-50 border-purple-200",
        "balance-note": "bg-green-50 border-green-200",
      };
      return (
        <div className={`flex gap-2 rounded-lg border p-3 my-2 ${dark ? darkCls[vid] : lightCls[vid]}`} style={bs}>
          <span className="shrink-0 mt-0.5" aria-hidden="true">{variant.icon}</span>
          <div className={`flex-1 text-sm leading-relaxed ${ac}`}>
            <Inline nodes={nodes} dark={dark} />{kids}
          </div>
        </div>
      );
    }

    case "table": {
      const tc = b.content as TableContent | undefined;
      if (!tc?.rows) return null;
      const borderCls = dark ? "border-gray-700" : "border-gray-300";
      return (
        <div className="my-3 overflow-x-auto">
          <table className={`w-full text-sm border-collapse border ${borderCls}`}>
            <tbody>
              {tc.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.cells.map((cell, ci) => {
                    const cellNodes: InlineNode[] = Array.isArray(cell) ? cell as InlineNode[] : Array.isArray((cell as { content?: InlineNode[] }).content) ? (cell as { content: InlineNode[] }).content : [];
                    return (
                      <td key={ci} className={`px-3 py-2 border ${borderCls}`}>
                        <Inline nodes={cellNodes} dark={dark} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    default:
      if (nodes.length > 0) return <p className={`mb-2 leading-relaxed ${ac}`} style={bs}><Inline nodes={nodes} dark={dark} /></p>;
      return null;
  }
}

function ListItem({ b, dark }: { b: Block; dark: boolean }) {
  const nodes = inlineOf(b);
  const kids = b.children?.length ? <Blocks blocks={b.children} dark={dark} /> : null;
  return <li className="mb-0.5"><Inline nodes={nodes} dark={dark} />{kids}</li>;
}

function Blocks({ blocks, dark }: { blocks: Block[]; dark: boolean }) {
  return (
    <>
      {group(blocks).map((item, i) => {
        if (item.k === "ul") return (
          <ul key={i} className="list-disc mb-2 space-y-0.5 pl-5">
            {item.items.map((b, j) => <ListItem key={j} b={b} dark={dark} />)}
          </ul>
        );
        if (item.k === "ol") return (
          <ol key={i} className="list-decimal mb-2 space-y-0.5 pl-5">
            {item.items.map((b, j) => <ListItem key={j} b={b} dark={dark} />)}
          </ol>
        );
        if (item.k === "check") return (
          <ul key={i} className="mb-2 space-y-0.5 pl-1">
            {item.items.map((b, j) => {
              const checked = !!(b.props?.checked);
              const nodes = inlineOf(b);
              const kids = b.children?.length ? <Blocks blocks={b.children} dark={dark} /> : null;
              return (
                <li key={j} className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 select-none">{checked ? "☑" : "☐"}</span>
                  <span className={checked ? "line-through opacity-60" : ""}><Inline nodes={nodes} dark={dark} />{kids}</span>
                </li>
              );
            })}
          </ul>
        );
        return <Block key={i} b={item.b} dark={dark} />;
      })}
    </>
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

interface BlocksReadOnlyProps {
  blocks: Block[];
  theme?: "dark" | "light";
}

export default function BlocksReadOnly({ blocks, theme = "dark" }: BlocksReadOnlyProps) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null;
  return (
    <div className="blocks-readonly">
      <Blocks blocks={blocks} dark={theme === "dark"} />
    </div>
  );
}
