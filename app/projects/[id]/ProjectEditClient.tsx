"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useProjectStore } from "@/store/projectStore";

interface Props {
  projectId: string;
}

export default function ProjectEditClient({ projectId }: Props) {
  const router = useRouter();
  const getProject = useProjectStore((s) => s.getProject);
  const editProject = useProjectStore((s) => s.editProject);

  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const p = getProject(projectId);
    if (p) {
      setName(p.title);
      setDescription(p.description || "");
      setNotFound(false);
    } else {
      setNotFound(true);
    }
    setLoaded(true);
  }, [projectId, getProject]);

  function handleSave() {
    if (!notFound && projectId) {
      editProject(projectId, name, description);
      router.push(`/projects/${projectId}`);
    }
  }

  if (!loaded) return <div className="p-6">Carregando...</div>;
  if (notFound) return <div className="p-6">Projeto não encontrado. <button className="ml-2 px-3 py-1 bg-gray-700 text-white rounded" onClick={() => router.push("/")}>Voltar para Home</button></div>;

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-4">Editar Projeto</h1>
      <div className="flex flex-col gap-4">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          className="border px-2 py-1"
          placeholder="Nome do projeto"
        />
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="border px-2 py-1"
          placeholder="Descrição do projeto"
        />
        <div className="flex gap-2">
          <button
            className="bg-green-600 text-white px-4 py-2 rounded"
            onClick={handleSave}
          >Salvar</button>
          <button
            className="bg-gray-500 text-white px-4 py-2 rounded"
            onClick={() => projectId ? router.push(`/projects/${projectId}`) : router.push("/")}
          >Cancelar</button>
        </div>
      </div>
    </div>
  );
}
