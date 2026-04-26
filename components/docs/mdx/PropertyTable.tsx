import type { ReactNode } from "react";

export type PropertyRow = {
  /** Field name as it appears in the schema. */
  name: string;
  /** TypeScript-ish type signature, e.g. `"add" | "mult" | "set"`. */
  type: string;
  /** "Yes" / "No" / contextual hint. Renders as muted text. */
  required?: string;
  /** Default value when the field is omitted (rendered in muted code). */
  defaultValue?: string;
  /** Free-form description, may include inline JSX. */
  description?: ReactNode;
};

interface PropertyTableProps {
  rows: PropertyRow[];
}

/**
 * Compact reference table for documenting addon/schema fields. Built as
 * a real <table> so screen-readers announce headers correctly. Used
 * inside MDX without needing an explicit import.
 */
export function PropertyTable({ rows }: PropertyTableProps) {
  return (
    <div className="my-5 overflow-x-auto rounded-lg border border-gray-800">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-gray-900/80 text-gray-300">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">Campo</th>
            <th className="px-3 py-2 text-left font-semibold">Tipo</th>
            <th className="px-3 py-2 text-left font-semibold">Padrão</th>
            <th className="px-3 py-2 text-left font-semibold">Descrição</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-t border-gray-800/60">
              <td className="px-3 py-2 align-top">
                <code className="rounded bg-gray-800 px-1.5 py-0.5 text-[12.5px] text-indigo-200">
                  {row.name}
                </code>
                {row.required && row.required !== "No" ? (
                  <span className="ml-1 text-[10px] uppercase tracking-wide text-amber-400">
                    {row.required}
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2 align-top text-gray-300">
                <code className="rounded bg-gray-900 px-1 text-[12.5px] text-emerald-200">{row.type}</code>
              </td>
              <td className="px-3 py-2 align-top text-gray-400">
                {row.defaultValue ? (
                  <code className="rounded bg-gray-900 px-1 text-[12.5px] text-gray-300">
                    {row.defaultValue}
                  </code>
                ) : (
                  <span aria-hidden="true">—</span>
                )}
              </td>
              <td className="px-3 py-2 align-top text-gray-300 leading-snug">
                {row.description ?? <span aria-hidden="true">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
