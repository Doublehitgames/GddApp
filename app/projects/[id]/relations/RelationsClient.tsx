"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useProjectStore, type LastRelationsAnalysis } from "@/store/projectStore";
import { useAIConfig } from "@/hooks/useAIConfig";
import { useI18n } from "@/lib/i18n/provider";

interface Props {
  projectId: string;
}

export default function RelationsClient({ projectId }: Props) {
  const { t } = useI18n();
  const { hasValidConfig, getAIHeaders } = useAIConfig();
  const getProject = useProjectStore((s) => s.getProject);
  const lastRelationsAnalysisByProject = useProjectStore((s) => s.lastRelationsAnalysisByProject);
  const setLastRelationsAnalysis = useProjectStore((s) => s.setLastRelationsAnalysis);

  const [mounted, setMounted] = useState(false);
  const project = getProject(projectId as import("@/store/projectStore").UUID);
  const lastAnalysis = lastRelationsAnalysisByProject[projectId];

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

  const sections = (project.sections || []).map((s: any) => ({
    id: s.id,
    title: s.title,
    parentId: s.parentId,
    domainTags: s.domainTags,
  }));

  const runAnalysis = async () => {
    if (!hasValidConfig) {
      setError(t("projectDetail.aiMenu.configRequired"));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/suggest-relations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAIHeaders() },
        body: JSON.stringify({
          projectTitle: project.title,
          sections,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("projectDetail.aiMenu.errorGeneric"));
        return;
      }
      const payload: LastRelationsAnalysis = {
        suggestions: data.suggestions || [],
        runAt: new Date().toISOString(),
      };
      setLastRelationsAnalysis(projectId, payload);
    } catch (e) {
      console.error("Suggest relations:", e);
      setError(t("projectDetail.aiMenu.errorGeneric"));
    } finally {
      setLoading(false);
    }
  };

  const hasResult = lastAnalysis && lastAnalysis.suggestions.length > 0;
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
              {t("projectDetail.aiMenu.relationsModalTitle")}
            </h1>
          </div>
          <button
            type="button"
            onClick={runAnalysis}
            disabled={loading || !hasValidConfig}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? t("projectDetail.aiMenu.relationsLoading") : t("projectDetail.relations.runAnalysis")}
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
            {t("projectDetail.relations.lastRun")}: {runAtLabel}
          </div>
        )}

        {!hasResult && !loading && (
          <div className="rounded-xl border border-gray-600 bg-gray-800/50 p-6 text-center text-gray-400">
            <p className="mb-4">{t("projectDetail.aiMenu.relationsEmpty")}</p>
            <p className="text-sm">{t("projectDetail.relations.runHint")}</p>
          </div>
        )}

        {hasResult && lastAnalysis && lastAnalysis.suggestions.length > 0 && (
          <ul className="space-y-2 list-decimal list-inside text-gray-200 text-sm">
            {lastAnalysis.suggestions.map((s, i) => (
              <li key={i} className="rounded-lg p-3 bg-gray-800/50 border border-gray-600/50">
                {s.suggestion || ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
