"use client";

import { useEffect, useMemo, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useAuthStore } from "@/store/authStore";
import KpiMainTab from "@/components/kpi/KpiMainTab";
import KpiEvolutionTab from "@/components/kpi/KpiEvolutionTab";
import KpiFunnelTab from "@/components/kpi/KpiFunnelTab";
import KpiRoutineTab from "@/components/kpi/KpiRoutineTab";
import KpiQuestionsTab from "@/components/kpi/KpiQuestionsTab";
import type { GameGenre } from "@/lib/kpi/types";
import { useI18n } from "@/lib/i18n/provider";

interface Props { projectId: string; }

const TAB_IDS = ["main", "evolution", "funnel", "routine", "questions"] as const;
type TabId = typeof TAB_IDS[number];

export default function KpiClient({ projectId }: Props) {
  const { t } = useI18n();
  const getProjectBySlug = useProjectStore((s) => s.getProjectBySlug);
  const projects = useProjectStore((s) => s.projects);
  const kpiEntriesByProject = useProjectStore((s) => s.kpiEntriesByProject);
  const kpiConfigByProject = useProjectStore((s) => s.kpiConfigByProject);
  const setKpiGenre = useProjectStore((s) => s.setKpiGenre);
  const updateKpiConfig = useProjectStore((s) => s.updateKpiConfig);
  const addKpiEntry = useProjectStore((s) => s.addKpiEntry);
  const updateKpiEntry = useProjectStore((s) => s.updateKpiEntry);
  const deleteKpiEntry = useProjectStore((s) => s.deleteKpiEntry);
  const currentUser = useAuthStore((s) => s.user);

  const [activeTab, setActiveTab] = useState<TabId>("main");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const project = useMemo(() => getProjectBySlug(projectId), [getProjectBySlug, projectId, projects]);
  const realProjectId = project?.id ?? projectId;

  // Membro = não é o dono do projeto
  const isOwner = !project?.ownerId || project.ownerId === currentUser?.id;
  const readOnly = !isOwner;

  const config = kpiConfigByProject[realProjectId];
  const genre: GameGenre = config?.genre ?? "farm";
  const profile = config?.profile;
  const customBenchmarks = config?.customBenchmarks;
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
          <h1 className="text-base font-semibold text-white">{t("kpi.pageTitle")}</h1>
          {readOnly && (
            <span className="ml-auto flex items-center gap-1.5 rounded-full border border-gray-700 bg-gray-800/60 px-3 py-1 text-xs text-gray-400">
              <svg className="h-3 w-3 shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              {t("kpi.readOnly.badge")}
            </span>
          )}
        </div>
      </div>

      {/* Read-only banner */}
      {readOnly && (
        <div className="bg-gray-900/80 border-b border-gray-800 px-4 py-2 sm:px-6">
          <div className="mx-auto max-w-3xl flex items-center gap-2">
            <svg className="h-3.5 w-3.5 shrink-0 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-gray-400">{t("kpi.readOnly.banner")}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-800 bg-gray-950/70 px-4 sm:px-6">
        <div className="mx-auto max-w-3xl flex gap-1 overflow-x-auto">
          {TAB_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === id
                  ? "border-emerald-400 text-emerald-300"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {t("kpi.tabs." + id)}
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
            profile={profile}
            customBenchmarks={customBenchmarks}
            entries={entries}
            readOnly={readOnly}
            onSetGenre={(g) => setKpiGenre(realProjectId, g)}
            onUpdateConfig={(patch) => updateKpiConfig(realProjectId, patch)}
            onAddEntry={(entry) => addKpiEntry(realProjectId, entry)}
            onUpdateEntry={(id, patch) => updateKpiEntry(realProjectId, id, patch)}
            onDeleteEntry={(id) => deleteKpiEntry(realProjectId, id)}
          />
        )}
        {activeTab === "evolution" && <KpiEvolutionTab entries={entries} genre={genre} />}
        {activeTab === "funnel" && <KpiFunnelTab genre={genre} />}
        {activeTab === "routine" && <KpiRoutineTab />}
        {activeTab === "questions" && <KpiQuestionsTab />}
      </div>
    </div>
  );
}
