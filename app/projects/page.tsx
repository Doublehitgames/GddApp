"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProjectStore } from "@/store/projectStore";

export default function ProjectsPage() {
  const router = useRouter();
  const addProject = useProjectStore((state) => state.addProject);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState<string>("");

  function save() {
    if (!name.trim()) {
      setNameError("O nome do projeto é obrigatório.");
      return;
    }
    if (name.trim().length < 3) {
      setNameError("O nome do projeto deve ter pelo menos 3 caracteres.");
      return;
    }
    setNameError("");
    const id = addProject(name, description);
    router.push(`/projects/${id}`); // ir para detalhes do projeto
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-4">Criar Projeto</h1>

      <div className="flex flex-col gap-4 w-80">
        <div className="flex flex-col gap-1">
          <input
            type="text"
            placeholder="Nome do projeto"
            className={`p-3 rounded bg-gray-800 text-white border ${nameError ? "border-red-500" : "border-transparent"}`}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!e.target.value.trim()) {
                setNameError("O nome do projeto é obrigatório.");
              } else if (e.target.value.trim().length < 3) {
                setNameError("O nome do projeto deve ter pelo menos 3 caracteres.");
              } else {
                setNameError("");
              }
            }}
          />
          {nameError && (
            <span className="text-red-400 text-sm">{nameError}</span>
          )}
        </div>

        <textarea
          placeholder="Descrição"
          className="p-3 rounded bg-gray-800 text-white"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <button
          onClick={save}
          className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
          disabled={!!nameError}
        >
          Salvar Projeto
        </button>
      </div>
    </main>
  );
}
