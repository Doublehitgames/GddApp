"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useProjectStore } from "@/store/projectStore";
import { useI18n } from "@/lib/i18n/provider";
import { projectsOwnedBy } from "@/store/slices/limits";

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const projects = useProjectStore((s) => s.projects);
  const lastQuotaStatus = useProjectStore((s) => s.lastQuotaStatus);
  // Limites efetivos do usuário logado (já com overrides individuais), não as constantes do plano.
  const { FREE_MAX_PROJECTS, FREE_MAX_SECTIONS_PER_PROJECT } = useProjectStore(
    (s) => s.appLimits
  );
  const { t } = useI18n();

  // Só os projetos do próprio usuário usam o plano dele — projetos
  // compartilhados são medidos no plano de quem os possui, como no servidor.
  const userId = user?.id ?? null;
  const myProjects = projectsOwnedBy(projects, userId ?? "local", userId);
  const projectsCount = myProjects.length;

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

            {/* Cada projeto tem o próprio teto de páginas — não há cota somada. */}
            {myProjects.length > 0 && (
              <div className="pt-3 space-y-3">
                <p className="text-gray-400">{t("profile.sectionsUsage")}</p>
                {myProjects.map((p) => {
                  const used = (p.sections || []).length;
                  const left = FREE_MAX_SECTIONS_PER_PROJECT - used;
                  return (
                    <div key={p.id}>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 truncate pr-3">{p.title}</span>
                        <span
                          className={`font-mono font-semibold shrink-0 ${
                            left <= 0
                              ? "text-red-400"
                              : left <= 10
                                ? "text-amber-400"
                                : "text-white"
                          }`}
                        >
                          {used}/{FREE_MAX_SECTIONS_PER_PROJECT}
                        </span>
                      </div>
                      <div className="h-2 mt-1 rounded-full bg-gray-700 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            left <= 0
                              ? "bg-red-500"
                              : left <= 10
                                ? "bg-amber-500"
                                : "bg-indigo-500"
                          }`}
                          style={{
                            width: `${Math.min(100, (used / FREE_MAX_SECTIONS_PER_PROJECT) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
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
