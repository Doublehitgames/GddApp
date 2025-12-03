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

      <Link href="/projects">
        <button className="px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-700 mb-10">
          Criar novo projeto
        </button>
      </Link>

      <div className="w-full max-w-xl flex flex-col gap-4">
        {projects.map((p) => (
          <div key={p.id} className="block p-4 bg-gray-800 rounded hover:bg-gray-700 transition flex items-center justify-between">
            <Link href={`/projects/${p.id}`} className="flex-1">
              <h2 className="text-xl font-semibold">{p.title}</h2>
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
        ))}

        {projects.length === 0 && (
          <p className="text-gray-500">Nenhum projeto criado ainda.</p>
        )}
      </div>
    </main>
  );
}
