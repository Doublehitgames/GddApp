"use client";

import { compareCurves } from "@/lib/balance/simulationEngine";
import type { BalancePoint } from "@/lib/balance/types";

interface BalanceComparisonPanelProps {
  basePoints: BalancePoint[];
  candidatePoints: BalancePoint[];
}

export function BalanceComparisonPanel({ basePoints, candidatePoints }: BalanceComparisonPanelProps) {
  const rows = compareCurves(basePoints, candidatePoints);
  if (rows.length === 0) return null;
  const changedRows = rows.filter((row) => Math.abs(row.absoluteDelta) > 0.0001);
  const gotHeavier = changedRows.filter((row) => row.absoluteDelta > 0).length;
  const gotLighter = changedRows.filter((row) => row.absoluteDelta < 0).length;

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-3">
      <h4 className="text-sm font-semibold text-gray-100 mb-1">Comparacao A/B de curva</h4>
      <p className="text-xs text-gray-400 mb-2">
        A = curva salva (antes). B = curva atual (depois). Use a coluna Impacto para entender se ficou mais leve ou mais pesado.
      </p>
      <div className="mb-2 grid gap-2 md:grid-cols-3 text-xs">
        <div className="rounded-lg border border-gray-700 bg-gray-950/70 p-2 text-gray-200">
          <strong className="text-gray-100">Niveis alterados:</strong> {changedRows.length}
        </div>
        <div className="rounded-lg border border-gray-700 bg-gray-950/70 p-2 text-gray-200">
          <strong className="text-gray-100">Mais pesados:</strong> {gotHeavier}
        </div>
        <div className="rounded-lg border border-gray-700 bg-gray-950/70 p-2 text-gray-200">
          <strong className="text-gray-100">Mais leves:</strong> {gotLighter}
        </div>
      </div>
      <div className="max-h-44 overflow-auto rounded-lg border border-gray-700">
        <table className="w-full text-xs text-left">
          <thead className="sticky top-0 bg-gray-900 text-gray-300">
            <tr>
              <th className="px-2 py-1.5">Lvl</th>
              <th className="px-2 py-1.5">A (antes)</th>
              <th className="px-2 py-1.5">B (agora)</th>
              <th className="px-2 py-1.5">Delta</th>
              <th className="px-2 py-1.5">Delta %</th>
              <th className="px-2 py-1.5">Impacto</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.level} className="border-t border-gray-800 text-gray-200">
                <td className="px-2 py-1">{row.level}</td>
                <td className="px-2 py-1">{row.baseValue}</td>
                <td className="px-2 py-1">{row.candidateValue}</td>
                <td className="px-2 py-1">{row.absoluteDelta.toFixed(2)}</td>
                <td className="px-2 py-1">{row.percentDelta.toFixed(2)}%</td>
                <td className="px-2 py-1">
                  {row.absoluteDelta > 0
                    ? "Mais pesado"
                    : row.absoluteDelta < 0
                    ? "Mais leve"
                    : "Sem mudanca"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
