"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  children: string;
  /** "dark" for editor popovers (dark bg), "light" for doc-view modals (white bg) */
  theme?: "dark" | "light";
  className?: string;
}

const DARK_PROSE =
  "[&_p]:text-gray-300 [&_p]:text-xs [&_p]:leading-relaxed [&_p]:mb-2 last:[&_p]:mb-0 " +
  "[&_h1]:text-white [&_h1]:font-bold [&_h1]:text-sm [&_h1]:mb-1.5 " +
  "[&_h2]:text-white [&_h2]:font-semibold [&_h2]:text-xs [&_h2]:mb-1 " +
  "[&_h3]:text-gray-200 [&_h3]:font-semibold [&_h3]:text-xs [&_h3]:mb-1 " +
  "[&_ul]:list-disc [&_ul]:pl-4 [&_ul]:text-gray-300 [&_ul]:text-xs [&_ul]:mb-2 [&_ul]:space-y-0.5 " +
  "[&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:text-gray-300 [&_ol]:text-xs [&_ol]:mb-2 [&_ol]:space-y-0.5 " +
  "[&_li]:leading-snug " +
  "[&_code]:bg-gray-800 [&_code]:text-emerald-300 [&_code]:text-[11px] [&_code]:rounded [&_code]:px-1 [&_code]:py-px " +
  "[&_pre]:bg-gray-800 [&_pre]:rounded-lg [&_pre]:p-2.5 [&_pre]:mb-2 [&_pre]:overflow-x-auto " +
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 " +
  "[&_blockquote]:border-l-2 [&_blockquote]:border-gray-600 [&_blockquote]:pl-2.5 [&_blockquote]:text-gray-400 [&_blockquote]:italic [&_blockquote]:mb-2 " +
  "[&_a]:text-sky-400 [&_a]:underline " +
  "[&_strong]:text-gray-100 [&_strong]:font-semibold " +
  "[&_em]:text-gray-300 [&_em]:italic " +
  "[&_hr]:border-gray-700 [&_hr]:my-2 " +
  "[&_table]:text-xs [&_table]:w-full [&_table]:mb-2 " +
  "[&_th]:text-gray-300 [&_th]:font-semibold [&_th]:border [&_th]:border-gray-700 [&_th]:px-2 [&_th]:py-1 [&_th]:bg-gray-800 " +
  "[&_td]:text-gray-400 [&_td]:border [&_td]:border-gray-700 [&_td]:px-2 [&_td]:py-1";

const LIGHT_PROSE =
  "[&_p]:text-gray-600 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:mb-2 last:[&_p]:mb-0 " +
  "[&_h1]:text-gray-800 [&_h1]:font-bold [&_h1]:text-base [&_h1]:mb-1.5 " +
  "[&_h2]:text-gray-700 [&_h2]:font-semibold [&_h2]:text-sm [&_h2]:mb-1 " +
  "[&_h3]:text-gray-700 [&_h3]:font-semibold [&_h3]:text-sm [&_h3]:mb-1 " +
  "[&_ul]:list-disc [&_ul]:pl-4 [&_ul]:text-gray-600 [&_ul]:text-sm [&_ul]:mb-2 [&_ul]:space-y-0.5 " +
  "[&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:text-gray-600 [&_ol]:text-sm [&_ol]:mb-2 [&_ol]:space-y-0.5 " +
  "[&_li]:leading-snug " +
  "[&_code]:bg-gray-100 [&_code]:text-emerald-700 [&_code]:text-xs [&_code]:rounded [&_code]:px-1 [&_code]:py-px " +
  "[&_pre]:bg-gray-100 [&_pre]:rounded-lg [&_pre]:p-2.5 [&_pre]:mb-2 [&_pre]:overflow-x-auto " +
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 " +
  "[&_blockquote]:border-l-2 [&_blockquote]:border-gray-300 [&_blockquote]:pl-2.5 [&_blockquote]:text-gray-500 [&_blockquote]:italic [&_blockquote]:mb-2 " +
  "[&_a]:text-sky-600 [&_a]:underline " +
  "[&_strong]:text-gray-800 [&_strong]:font-semibold " +
  "[&_em]:text-gray-600 [&_em]:italic " +
  "[&_hr]:border-gray-200 [&_hr]:my-2 " +
  "[&_table]:text-sm [&_table]:w-full [&_table]:mb-2 " +
  "[&_th]:text-gray-700 [&_th]:font-semibold [&_th]:border [&_th]:border-gray-200 [&_th]:px-2 [&_th]:py-1 [&_th]:bg-gray-50 " +
  "[&_td]:text-gray-600 [&_td]:border [&_td]:border-gray-200 [&_td]:px-2 [&_td]:py-1";

export function MarkdownContent({ children, theme = "dark", className = "" }: Props) {
  return (
    <div className={`${theme === "dark" ? DARK_PROSE : LIGHT_PROSE} ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
