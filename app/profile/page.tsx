"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useProjectStore } from "@/store/projectStore";
import { useI18n } from "@/lib/i18n/provider";
import {
  FREE_MAX_PROJECTS,
  FREE_MAX_SECTIONS_PER_PROJECT,
  FREE_MAX_SECTIONS_TOTAL,
} from "@/lib/structuralLimits";

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const projects = useProjectStore((s) => s.projects);
  const lastQuotaStatus = useProjectStore((s) => s.lastQuotaStatus);
  const { t } = useI18n();

  const totalSections = projects.reduce((sum, p) => sum + (p.sections || []).length, 0);
  const projectsCount = projects.length;
  const maxSectionsInAProject = Math.max(
    0,
    ...projects.map((p) => (p.sections || []).length)
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-2xl mx-auto p-6">
        <button
          onClick={() => router.push("/")}
          className="text-blue-400 hover:text-blue-300 mb-6 flex items-center gap-2"
        >
          ← {t("common.back")}
        </button>

        <h1 className="text-3xl font-bold mb-2">{t("profile.title")}</h1>
        <p className="text-gray-400 mb-8">{t("profile.subtitle")}</p>

        {/* Dados do usuário */}
        <div className="bg-gray-800/70 border border-gray-700 rounded-xl p-4 mb-6">
          <p className="text-sm text-gray-400 mb-1">{t("profile.account")}</p>
          <p className="text-xl font-semibold text-white">
            {profile?.display_name || user?.email?.split("@")[0] || "—"}
          </p>
          {user?.email && (
            <p className="text-sm text-gray-500 mt-1">{user.email}</p>
          )}
        </div>

        {/* Plano atual */}
        <div className="bg-gray-800/70 border border-gray-700 rounded-xl p-4 mb-6">
          <p className="text-sm text-gray-400 mb-2">{t("profile.plan")}</p>
          <p className="text-2xl font-bold text-indigo-300">{t("profile.planFree")}</p>
        </div>

        {/* Limites do plano */}
        <div className="bg-gray-800/70 border border-gray-700 rounded-xl p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">
            {t("profile.limitsTitle")}
          </h2>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between items-center">
              <span className="text-gray-400">{t("profile.projectsLimit")}</span>
              <span className="font-mono text-white">{FREE_MAX_PROJECTS}</span>
            </li>
            <li className="flex justify-between items-center">
              <span className="text-gray-400">{t("profile.sectionsPerProjectLimit")}</span>
              <span className="font-mono text-white">{FREE_MAX_SECTIONS_PER_PROJECT}</span>
            </li>
            <li className="flex justify-between items-center">
              <span className="text-gray-400">{t("profile.sectionsTotalLimit")}</span>
              <span className="font-mono text-white">{FREE_MAX_SECTIONS_TOTAL}</span>
            </li>
            <li className="flex justify-between items-center">
              <span className="text-gray-400">{t("profile.creditsPerHour")}</span>
              <span className="font-mono text-white">30</span>
            </li>
          </ul>
        </div>

        {/* Seu uso atual */}
        <div className="bg-gray-800/70 border border-indigo-900/50 rounded-xl p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">
            {t("profile.usageTitle")}
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">{t("profile.projectsUsage")}</span>
              <span className="font-mono font-semibold text-white">
                {projectsCount}/{FREE_MAX_PROJECTS}
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all"
                style={{
                  width: `${Math.min(100, (projectsCount / FREE_MAX_PROJECTS) * 100)}%`,
                }}
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-gray-400">{t("profile.sectionsUsage")}</span>
              <span className="font-mono font-semibold text-white">
                {totalSections}/{FREE_MAX_SECTIONS_TOTAL}
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all"
                style={{
                  width: `${Math.min(100, (totalSections / FREE_MAX_SECTIONS_TOTAL) * 100)}%`,
                }}
              />
            </div>

            {maxSectionsInAProject > 0 && (
              <p className="text-xs text-gray-500 pt-1">
                {t("profile.maxInOneProject")}: {maxSectionsInAProject}/{FREE_MAX_SECTIONS_PER_PROJECT}
              </p>
            )}
          </div>
        </div>

        {/* Créditos de sync (se disponível) */}
        {lastQuotaStatus && (
          <div className="bg-gray-800/70 border border-gray-700 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-300 mb-2">
              {t("profile.creditsPerHour")}
            </h2>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">
                {lastQuotaStatus.usedInWindow}/{lastQuotaStatus.limitPerHour} usados
              </span>
              <span className="text-gray-400">
                {lastQuotaStatus.remainingInWindow} restantes
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-gray-700 overflow-hidden">
              <div
                className={`h-full transition-all ${
                  (lastQuotaStatus.usedInWindow / lastQuotaStatus.limitPerHour) * 100 >= 75
                    ? "bg-red-500"
                    : (lastQuotaStatus.usedInWindow / lastQuotaStatus.limitPerHour) * 100 >= 50
                      ? "bg-amber-500"
                      : "bg-indigo-500"
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    (lastQuotaStatus.usedInWindow / lastQuotaStatus.limitPerHour) * 100
                  )}%`,
                }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Reinicia às {new Date(lastQuotaStatus.windowEndsAt).toLocaleTimeString()}
            </p>
            <p className="text-xs text-gray-500 mt-2 border-t border-gray-700 pt-2">
              {t("settings.persistencePage.credits.howItWorks")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
