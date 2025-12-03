"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useProjectStore } from "@/store/projectStore";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  const [editorMode, setEditorMode] = useState<"wysiwyg" | "markdown">("wysiwyg");
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const editorRef = useRef<any>(null);

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

  // Inicializa/destroi o editor WYSIWYG
  useEffect(() => {
    let instance: any;
    let cancelled = false;
    async function mountEditor() {
      if (!containerEl || !loaded) return;
      const mod: any = await import("@toast-ui/editor");
      if (cancelled) return;
      const ToastEditor = mod.default || mod;
      instance = new ToastEditor({
        el: containerEl,
        initialEditType: editorMode,
        previewStyle: "vertical",
        height: "400px",
        initialValue: description || "",
        usageStatistics: false,
        toolbarItems: [
          ["heading", "bold", "italic", "strike"],
          ["hr", "quote"],
          ["ul", "ol", "task"],
          ["table", "link", "image"],
          ["code", "codeblock"],
        ],
        hooks: {
          addImageBlobHook: async (blob: Blob, callback: (url: string, altText: string) => void) => {
            try {
              const formData = new FormData();
              formData.append('image', blob);
              formData.append('projectId', projectId);

              const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
              });

              if (!response.ok) {
                const error = await response.json();
                alert(`Erro ao fazer upload: ${error.error || 'Erro desconhecido'}`);
                return;
              }

              const data = await response.json();
              callback(data.url, 'Uploaded image');
            } catch (error) {
              console.error('Upload error:', error);
              alert('Erro ao fazer upload da imagem');
            }
          },
        },
      });
      editorRef.current = instance;
    }
    mountEditor();
    return () => {
      cancelled = true;
      if (instance && instance.destroy) {
        instance.destroy();
      }
      editorRef.current = null;
    };
  }, [containerEl, loaded, editorMode, projectId, description]);

  function handleSave() {
    if (!notFound && projectId) {
      const md = editorRef.current?.getMarkdown?.() || description;
      editProject(projectId, name, md);
      router.push(`/projects/${projectId}`);
    }
  }

  if (!loaded) return <div className="p-6">Carregando...</div>;
  if (notFound) return <div className="p-6">Projeto não encontrado. <button className="ml-2 px-3 py-1 bg-gray-700 text-white rounded" onClick={() => router.push("/")}>Voltar para Home</button></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Editar Projeto</h1>
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-semibold mb-1">Nome do Projeto</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Nome do projeto"
          />
        </div>
        
        <div>
          <label className="block text-sm font-semibold mb-1">Descrição do Projeto</label>
          <div ref={setContainerEl as any} />
        </div>

        <div className="flex gap-2 items-center">
          <button
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            onClick={handleSave}
          >Salvar</button>
          <button
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            onClick={() => projectId ? router.push(`/projects/${projectId}`) : router.push("/")}
          >Cancelar</button>
          <button
            className="bg-gray-700 text-white px-3 py-2 rounded text-sm hover:bg-gray-800 ml-auto"
            onClick={() => {
              const next = editorMode === "wysiwyg" ? "markdown" : "wysiwyg";
              setEditorMode(next);
              if (editorRef.current?.changeMode) {
                editorRef.current.changeMode(next, true);
              }
            }}
          >Modo: {editorMode === "wysiwyg" ? "WYSIWYG" : "Markdown"}</button>
        </div>
      </div>
    </div>
  );
}
