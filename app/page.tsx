// src/app/page.tsx
"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useProjectStore } from "@/store/projectStore";

export default function Home() {
  const projects = useProjectStore((s) => s.projects);
  const loadFromStorage = useProjectStore((s) => s.loadFromStorage);
  const removeProject = useProjectStore((s) => s.removeProject);

  useEffect(() => {
    // Hydrate store from localStorage on client
    loadFromStorage();
  }, [loadFromStorage]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-start bg-gray-900 text-white p-10">
      <h1 className="text-4xl font-bold mb-6">GDD App</h1>

      <div className="flex flex-col gap-4 mb-10">
        <Link href="/ai-create-simple">
          <button className="w-full px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all font-bold text-lg flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:scale-105">
            <span className="text-2xl">🤖</span>
            <span>Criar GDD com IA</span>
          </button>
        </Link>
        <Link href="/projects">
          <button className="w-full px-6 py-3 bg-gray-700 rounded-lg hover:bg-gray-800 transition-colors">
            Criar manualmente
          </button>
        </Link>
      </div>

      <div className="w-full max-w-2xl flex flex-col gap-4">
        {projects.map((p) => {
          const sections = p.sections || [];
          const totalSections = sections.length;
          const rootSections = sections.filter(s => !s.parentId).length;
          const subsections = totalSections - rootSections;
          
          return (
            <div key={p.id} className="block p-4 bg-gray-800 rounded hover:bg-gray-700 transition flex items-center justify-between">
              <Link href={`/projects/${p.id}`} className="flex-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold">{p.title}</h2>
                  <div className="flex gap-2 text-xs">
                    <span className="bg-blue-600 px-2 py-1 rounded" title="Seções raiz">
                      📑 {rootSections}
                    </span>
                    {subsections > 0 && (
                      <span className="bg-purple-600 px-2 py-1 rounded" title="Subseções">
                        📄 {subsections}
                      </span>
                    )}
                    <span className="bg-gray-600 px-2 py-1 rounded" title="Total">
                      ∑ {totalSections}
                    </span>
                  </div>
                </div>
              </Link>
              <button
                className="ml-4 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                onClick={() => {
                  if (window.confirm(`Tem certeza que deseja remover o projeto "${p.title}"?`)) {
                    removeProject(p.id);
                  }
                }}
              >
                Remover
              </button>
            </div>
          );
        })}

        {projects.length === 0 && (
          <p className="text-gray-500">Nenhum projeto criado ainda.</p>
        )}
      </div>
    </main>
  );
}
