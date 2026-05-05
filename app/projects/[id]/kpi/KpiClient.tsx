"use client";

import { useEffect, useMemo, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import KpiMainTab from "@/components/kpi/KpiMainTab";
import KpiFunnelTab from "@/components/kpi/KpiFunnelTab";
import KpiRoutineTab from "@/components/kpi/KpiRoutineTab";
import KpiQuestionsTab from "@/components/kpi/KpiQuestionsTab";
import type { GameGenre } from "@/lib/kpi/types";

interface Props { projectId: string; }

const TABS = [
  { id: "main", label: "KPIs principais" },
  { id: "funnel", label: "Funil de saída" },
  { id: "routine", label: "Rotina semanal" },
  { id: "questions", label: "Perguntas-guia" },
] as const;

type TabId = typeof TABS[number]["id"];

export default function KpiClient({ projectId }: Props) {
  const getProjectBySlug = useProjectStore((s) => s.getProjectBySlug);
  const projects = useProjectStore((s) => s.projects);
  const kpiEntriesByProject = useProjectStore((s) => s.kpiEntriesByProject);
  const kpiConfigByProject = useProjectStore((s) => s.kpiConfigByProject);
  const setKpiGenre = useProjectStore((s) => s.setKpiGenre);
  const addKpiEntry = useProjectStore((s) => s.addKpiEntry);
  const updateKpiEntry = useProjectStore((s) => s.updateKpiEntry);
  const deleteKpiEntry = useProjectStore((s) => s.deleteKpiEntry);

  const [activeTab, setActiveTab] = useState<TabId>("main");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const project = useMemo(() => getProjectBySlug(projectId), [getProjectBySlug, projectId, projects]);
  const realProjectId = project?.id ?? projectId;

  const genre: GameGenre = kpiConfigByProject[realProjectId]?.genre ?? "farm";
  const entries = kpiEntriesByProject[realProjectId] ?? [];

  if (!mounted) {
    return <div className="min-h-screen bg-gray-950" />;
  }

  return (
    <div className="relative flex h-full min-h-screen flex-col bg-gray-950">
      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b border-gray-800 bg-gray-950/90 backdrop-blur-sm px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-3xl flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-base font-semibold text-white">Análise do Jogo</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800 bg-gray-950/70 px-4 sm:px-6">
        <div className="mx-auto max-w-3xl flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-emerald-400 text-emerald-300"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        {activeTab === "main" && (
          <KpiMainTab
            projectId={realProjectId}
            genre={genre}
            entries={entries}
            onSetGenre={(g) => setKpiGenre(realProjectId, g)}
            onAddEntry={(entry) => addKpiEntry(realProjectId, entry)}
            onUpdateEntry={(id, patch) => updateKpiEntry(realProjectId, id, patch)}
            onDeleteEntry={(id) => deleteKpiEntry(realProjectId, id)}
          />
        )}
        {activeTab === "funnel" && <KpiFunnelTab genre={genre} />}
        {activeTab === "routine" && <KpiRoutineTab />}
        {activeTab === "questions" && <KpiQuestionsTab />}
      </div>
    </div>
  );
}
