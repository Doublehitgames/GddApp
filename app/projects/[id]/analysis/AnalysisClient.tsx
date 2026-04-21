"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProjectStore, type LastConsistencyAnalysis } from "@/store/projectStore";
import { useAIConfig } from "@/hooks/useAIConfig";
import { useI18n } from "@/lib/i18n/provider";
import { getSectionAiContent } from "@/utils/sectionAiContent";

interface Props {
  projectId: string;
}

export default function AnalysisClient({ projectId }: Props) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { hasValidConfig, getAIHeaders } = useAIConfig();
  const getProject = useProjectStore((s) => s.getProject);
  const lastConsistencyAnalysisByProject = useProjectStore((s) => s.lastConsistencyAnalysisByProject);
  const setLastConsistencyAnalysis = useProjectStore((s) => s.setLastConsistencyAnalysis);

  const [mounted, setMounted] = useState(false);
  const project = getProject(projectId as import("@/store/projectStore").UUID);
  const lastAnalysis = lastConsistencyAnalysisByProject[projectId];

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p>{t("common.loading")}</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-red-400">{t("projectDetail.notFound")} "{projectId}"</p>
          <Link href="/" className="mt-4 inline-block text-blue-400 hover:underline">
            {t("projectDetail.backHome")}
          </Link>
        </div>
      </div>
    );
  }

  const projectContext = {
    projectId: project.id,
    projectTitle: project.title,
    sections: (project.sections || []).map((s: any) => ({
      id: s.id,
      title: s.title,
      content: getSectionAiContent(s),
      parentId: s.parentId,
      domainTags: s.domainTags,
    })),
  };

  const runAnalysis = async () => {
    if (!hasValidConfig) {
      setError(t("projectDetail.aiMenu.configRequired"));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/analyze-consistency", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAIHeaders() },
        body: JSON.stringify({
          projectTitle: projectContext.projectTitle,
          locale,
          sections: projectContext.sections.map((s) => ({
            id: s.id,
            title: s.title,
            content: s.content,
            parentId: s.parentId,
            domainTags: s.domainTags,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("projectDetail.aiMenu.errorGeneric"));
        return;
      }
      const payload: LastConsistencyAnalysis = {
        alerts: data.alerts || [],
        simulation: data.simulation || null,
        runAt: new Date().toISOString(),
      };
      setLastConsistencyAnalysis(projectId, payload);
    } catch (e) {
      console.error("Analyze consistency:", e);
      setError(t("projectDetail.aiMenu.errorGeneric"));
    } finally {
      setLoading(false);
    }
  };

  const hasResult = lastAnalysis && (lastAnalysis.alerts.length > 0 || lastAnalysis.simulation?.combat);
  const runAtLabel = lastAnalysis?.runAt
    ? new Date(lastAnalysis.runAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
    : "";

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={`/projects/${projectId}`}
              className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              {t("projectDetail.backHome")}
            </Link>
            <span className="text-gray-500 hidden sm:inline">/</span>
            <h1 className="text-xl font-semibold text-white truncate">
              {t("projectDetail.aiMenu.consistencyModalTitle")}
            </h1>
          </div>
          <button
            type="button"
            onClick={runAnalysis}
            disabled={loading || !hasValidConfig}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? t("projectDetail.aiMenu.consistencyLoading") : t("projectDetail.analysis.runAnalysis")}
          </button>
        </header>

        {!hasValidConfig && (
          <p className="mb-4 text-amber-400 text-sm">{t("projectDetail.aiMenu.configRequired")}</p>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}

        {hasResult && lastAnalysis && (
          <div className="mb-4 text-gray-400 text-sm">
            {t("projectDetail.analysis.lastRun")}: {runAtLabel}
          </div>
        )}

        {!hasResult && !loading && (
          <div className="rounded-xl border border-gray-600 bg-gray-800/50 p-6 text-center text-gray-400">
            <p className="mb-4">{t("projectDetail.aiMenu.consistencyEmpty")}</p>
            <p className="text-sm">{t("projectDetail.analysis.runHint")}</p>
          </div>
        )}

        {hasResult && lastAnalysis && (
          <div className="space-y-4">
            {lastAnalysis.simulation?.combat && (
              <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
                <h2 className="font-semibold mb-3 text-lg">{t("projectDetail.aiMenu.simulationCombatTitle")}</h2>
                <ul className="space-y-1 text-sm">
                  <li>{t("projectDetail.aiMenu.simulationPlayerHP")}: {lastAnalysis.simulation.combat.playerHP}</li>
                  <li>{t("projectDetail.aiMenu.simulationEnemyDamage")}: {lastAnalysis.simulation.combat.enemyDamage}</li>
                  {lastAnalysis.simulation.combat.healPerPotion != null && (
                    <li>{t("projectDetail.aiMenu.simulationHeal")}: {lastAnalysis.simulation.combat.healPerPotion}</li>
                  )}
                  <li className="font-medium mt-2">{t("projectDetail.aiMenu.simulationHitsToDie")}: {lastAnalysis.simulation.combat.hitsToDie}</li>
                  {lastAnalysis.simulation.combat.healsToOffsetOneHit != null && (
                    <li>{t("projectDetail.aiMenu.simulationHealsToOffset")}: {lastAnalysis.simulation.combat.healsToOffsetOneHit}</li>
                  )}
                </ul>
              </section>
            )}

            {lastAnalysis.alerts.length > 0 && (
              <section>
                <h2 className="font-semibold text-white mb-3 text-lg">{t("projectDetail.analysis.alertsTitle")}</h2>
                <ul className="space-y-3">
                  {lastAnalysis.alerts.map((a, i) => (
                    <li
                      key={i}
                      className={`rounded-lg p-3 text-sm ${
                        a.severity === "warning"
                          ? "bg-amber-500/10 border border-amber-500/30 text-amber-200"
                          : "bg-blue-500/10 border border-blue-500/30 text-blue-200"
                      }`}
                    >
                      <span className="font-medium block mb-1">{a.title || ""}</span>
                      <span>{a.message || ""}</span>
                      {a.relatedSections?.length ? (
                        <p className="mt-1 text-xs opacity-80">
                          {t("projectDetail.aiMenu.consistencyRelated")}: {a.relatedSections.join(", ")}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
