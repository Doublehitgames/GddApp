"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useProjectStore } from "@/store/projectStore";
import { useAIConfig } from "@/hooks/useAIConfig";
import { useI18n } from "@/lib/i18n/provider";
import { getSectionAiContent } from "@/utils/sectionAiContent";

const BULK_CHUNK_SIZE = 25;

interface Props {
  projectId: string;
}

export default function AssignTagsClient({ projectId }: Props) {
  const { t } = useI18n();
  const { hasValidConfig, getAIHeaders } = useAIConfig();
  const getProjectBySlug = useProjectStore((s) => s.getProjectBySlug);
  const editSection = useProjectStore((s) => s.editSection);

  const [mounted, setMounted] = useState(false);
  const project = getProjectBySlug(projectId);
  const realProjectId = project?.id ?? "";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedCount, setUpdatedCount] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const sections = project?.sections ?? [];
  const sectionsWithoutTags = sections.filter((s) => !s.domainTags?.length);
  const countWithout = sectionsWithoutTags.length;

  const runAssignTags = async () => {
    if (!hasValidConfig || !project) {
      setError(t("projectDetail.aiMenu.configRequired"));
      return;
    }
    const toProcess = sectionsWithoutTags.length > 0 ? sectionsWithoutTags : sections;
    if (toProcess.length === 0) {
      setError(t("projectDetail.assignTags.allHaveTags"));
      return;
    }
    setError(null);
    setUpdatedCount(null);
    setLoading(true);
    let totalUpdated = 0;
    try {
      const chunks: typeof toProcess[] = [];
      for (let i = 0; i < toProcess.length; i += BULK_CHUNK_SIZE) {
        chunks.push(toProcess.slice(i, i + BULK_CHUNK_SIZE));
      }
      for (const chunk of chunks) {
        const res = await fetch("/api/ai/suggest-domain-tags-bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAIHeaders() },
          body: JSON.stringify({
            projectTitle: project.title,
            sections: chunk.map((s) => ({
              id: s.id,
              title: s.title,
              content: getSectionAiContent(s).slice(0, 2000),
            })),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || t("projectDetail.aiMenu.errorGeneric"));
          return;
        }
        const suggestions = data.suggestions || [];
        for (const { sectionId, tags } of suggestions) {
          if (tags.length === 0) continue;
          const section = project.sections?.find((sec) => sec.id === sectionId);
          if (!section) continue;
          editSection(
            realProjectId,
            sectionId as import("@/store/projectStore").UUID,
            section.title,
            section.content ?? "",
            section.parentId ?? undefined,
            undefined,
            undefined,
            tags
          );
          totalUpdated++;
        }
      }
      setUpdatedCount(totalUpdated);
    } catch (e) {
      console.error("Assign tags:", e);
      setError(t("projectDetail.aiMenu.errorGeneric"));
    } finally {
      setLoading(false);
    }
  };

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
              {t("projectDetail.assignTags.title")}
            </h1>
          </div>
        </header>

        {!hasValidConfig && (
          <p className="mb-4 text-amber-400 text-sm">{t("projectDetail.aiMenu.configRequired")}</p>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}

        {updatedCount != null && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-sm">
            {updatedCount} {t("projectDetail.assignTags.doneLabel")}
          </div>
        )}

        <div className="rounded-xl border border-gray-600 bg-gray-800/50 p-6">
          <p className="text-gray-300 mb-2">
            {countWithout > 0
              ? t("projectDetail.assignTags.withoutTags").replace("{{count}}", String(countWithout)).replace("{{total}}", String(sections.length))
              : t("projectDetail.assignTags.allTagged").replace("{{total}}", String(sections.length))}
          </p>
          <p className="text-gray-400 text-sm mb-4">
            {t("projectDetail.assignTags.hint")}
          </p>
          <button
            type="button"
            onClick={runAssignTags}
            disabled={loading || !hasValidConfig || countWithout === 0}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? t("projectDetail.assignTags.running") : t("projectDetail.assignTags.runButton")}
          </button>
        </div>
      </div>
    </div>
  );
}
