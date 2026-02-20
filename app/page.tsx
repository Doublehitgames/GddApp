// src/app/page.tsx
"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useProjectStore } from "@/store/projectStore";

export default function Home() {
  const projects = useProjectStore((s) => s.projects);
  const loadFromStorage = useProjectStore((s) => s.loadFromStorage);
  const removeProject = useProjectStore((s) => s.removeProject);

  const downloadProjectBackup = (project: (typeof projects)[number]) => {
    const backupData = {
      project,
      exportDate: new Date().toISOString(),
      version: "1.0",
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.title.replace(/[^a-z0-9]/gi, "_")}_backup_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    // Hydrate store from localStorage on client
    loadFromStorage();
  }, [loadFromStorage]);

  return (
    <main className="min-h-screen bg-gray-900 text-white px-4 py-8 md:px-8 md:py-10 lg:px-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-indigo-300/90 font-medium">Game Design Workspace</p>
            <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">GDD App</h1>
            <p className="mt-2 text-gray-300 max-w-2xl">Organize seus projetos de forma rápida com IA e edição manual.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/settings/ai">
              <button className="px-4 py-2.5 bg-gray-800 border border-gray-700 hover:bg-gray-700 hover:border-gray-600 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium">
                ⚙️ Configurações de IA
              </button>
            </Link>
            <a
              href="https://discord.gg/cqPsj7DhEr"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-indigo-700 hover:bg-indigo-600 rounded-lg transition-colors text-sm font-medium"
            >
              💬 Discord
            </a>
          </div>
        </header>

        <div className="p-4 md:p-5 rounded-xl border border-yellow-600/70 bg-yellow-950/30 text-yellow-100 shadow-lg shadow-black/10">
          <p className="text-sm leading-relaxed">
            Esta versão está persistindo os dados no navegador (armazenamento local). Ela é uma versão de teste para coletar feedbacks e melhorar o sistema.
          </p>
          <p className="text-sm leading-relaxed mt-2">
            Para suporte, dúvidas e sugestões, entre no nosso Discord:{" "}
            <a
              href="https://discord.gg/cqPsj7DhEr"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-yellow-200"
            >
              discord.gg/cqPsj7DhEr
            </a>
          </p>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="bg-gray-800/70 border border-gray-700/80 rounded-2xl p-4 md:p-6 shadow-xl shadow-black/10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-semibold tracking-tight">Seus Projetos</h2>
              <span className="text-sm text-gray-400">{projects.length} projeto(s)</span>
            </div>

            <div className="flex flex-col gap-3.5">
              {projects.map((p) => {
                const sections = p.sections || [];
                const totalSections = sections.length;
                const rootSections = sections.filter((s) => !s.parentId).length;
                const subsections = totalSections - rootSections;

                return (
                  <div
                    key={p.id}
                    className="p-4 bg-gray-800/80 border border-gray-700 rounded-xl hover:border-gray-500 hover:bg-gray-800 transition-all flex items-center justify-between gap-3"
                  >
                    <Link href={`/projects/${p.id}`} className="flex-1 min-w-0">
                      <div className="flex flex-col gap-2.5">
                        <h3 className="text-base md:text-lg font-semibold truncate leading-tight">{p.title}</h3>
                        <div className="flex flex-wrap gap-2 text-xs font-medium">
                          <span className="bg-blue-600/90 px-2.5 py-1 rounded-md" title="Seções raiz">
                            📑 {rootSections}
                          </span>
                          {subsections > 0 && (
                            <span className="bg-purple-600/90 px-2.5 py-1 rounded-md" title="Subseções">
                              📄 {subsections}
                            </span>
                          )}
                          <span className="bg-gray-600/90 px-2.5 py-1 rounded-md" title="Total">
                            ∑ {totalSections}
                          </span>
                        </div>
                      </div>
                    </Link>

                    <button
                      className="px-3 py-1.5 bg-red-700/80 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                      onClick={() => {
                        const shouldRemove = window.confirm(
                          `Tem certeza que deseja remover o projeto "${p.title}"?`
                        );

                        if (!shouldRemove) {
                          return;
                        }

                        const shouldBackup = window.confirm(
                          `Deseja fazer um backup local de "${p.title}" antes de excluir?`
                        );

                        if (shouldBackup) {
                          try {
                            downloadProjectBackup(p);
                          } catch (error) {
                            console.error("Erro ao gerar backup antes da exclusão:", error);
                            const continueWithoutBackup = window.confirm(
                              "Não foi possível gerar o backup. Deseja excluir mesmo assim?"
                            );
                            if (!continueWithoutBackup) {
                              return;
                            }
                          }
                        }

                        removeProject(p.id);
                      }}
                    >
                      Remover
                    </button>
                  </div>
                );
              })}

              {projects.length === 0 && (
                <p className="text-gray-400 bg-gray-800/80 border border-dashed border-gray-600 rounded-xl p-6 text-center text-sm">
                  Nenhum projeto criado ainda.
                </p>
              )}
            </div>
          </div>

          <aside className="bg-gray-800/70 border border-gray-700/80 rounded-2xl p-4 md:p-6 h-fit shadow-xl shadow-black/10">
            <h2 className="text-xl font-semibold tracking-tight mb-4">Ações Rápidas</h2>

            <div className="flex flex-col gap-3">
              <Link href="/ai-create-simple">
                <button className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all font-semibold text-base flex items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                  <span className="text-xl">🤖</span>
                  <span>Criar GDD com IA</span>
                </button>
              </Link>

              <Link href="/import">
                <button className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all font-semibold text-base flex items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                  <span className="text-xl">✨</span>
                  <span>Importar Documento com IA</span>
                </button>
              </Link>

              <Link href="/backup">
                <button className="w-full px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all font-semibold text-base flex items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                  <span className="text-xl">💾</span>
                  <span>Backup & Restaurar</span>
                </button>
              </Link>

              <Link href="/projects">
                <button className="w-full px-6 py-3 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600 transition-colors font-medium">
                  Criar manualmente
                </button>
              </Link>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
