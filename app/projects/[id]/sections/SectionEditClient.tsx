"use client";

import { useProjectStore } from "@/store/projectStore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { convertReferencesToIds, convertReferencesToNames } from "@/utils/sectionReferences";
import { useMarkdownAutocomplete } from "@/hooks/useMarkdownAutocomplete";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

interface Props {
  projectId: string;
  sectionId: string;
}

export default function SectionEditClient({ projectId, sectionId }: Props) {
  const getProject = useProjectStore((s) => s.getProject);
  const editSection = useProjectStore((s) => s.editSection);
  const hasDuplicateName = useProjectStore((s) => s.hasDuplicateName);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [parentId, setParentId] = useState<string | undefined>(undefined);
  const [nameError, setNameError] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const router = useRouter();

  const project = getProject(projectId);
  const sections = project?.sections || [];
  const { AutocompleteDropdown } = useMarkdownAutocomplete({ sections });

  useEffect(() => {
    const project = getProject(projectId);
    const sec = project?.sections?.find((s: any) => s.id === sectionId);
    if (sec) {
      setTitle(sec.title);
      // Convert IDs back to names for user-friendly editing
      const sections = project?.sections || [];
      const editableContent = convertReferencesToNames(sec.content || "", sections);
      setContent(editableContent);
      setParentId(sec.parentId);
      setNotFound(false);
    } else {
      setNotFound(true);
    }
    setLoaded(true);
  }, [projectId, sectionId, getProject]);

  function handleSave() {
    if (!notFound && projectId && sectionId && !nameError) {
      // Convert name-based references to ID-based references before saving
      const project = getProject(projectId);
      const sections = project?.sections || [];
      const convertedContent = convertReferencesToIds(content, sections);
      
      console.log('Original content:', content);
      console.log('Converted content:', convertedContent);
      console.log('Available sections:', sections.map((s: any) => ({ id: s.id, title: s.title })));
      
      editSection(projectId, sectionId, title, convertedContent);
      router.push(`/projects/${projectId}/sections/${sectionId}`);
    }
  }

  if (!loaded) return <div className="p-6">Carregando...</div>;
  if (notFound) return <div className="p-6">Seção não encontrada. <button className="ml-2 px-3 py-1 bg-gray-700 text-white rounded" onClick={() => router.push(`/projects/${projectId}`)}>Voltar</button></div>;

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-4">Editar Seção</h1>
      <div className="flex flex-col gap-4">
        <div>
          <input
            value={title}
            onChange={e => {
              const val = e.target.value;
              setTitle(val);
              if (val.trim() && hasDuplicateName(projectId, val.trim(), parentId, sectionId)) {
                setNameError("Já existe uma seção com este nome no mesmo nível.");
              } else {
                setNameError("");
              }
            }}
            className={`border px-2 py-1 w-full ${nameError ? "border-red-500" : ""}`}
            placeholder="Título da seção"
          />
          {nameError && (
            <span className="text-red-500 text-sm mt-1 block">{nameError}</span>
          )}
        </div>
        <div data-color-mode="dark">
          <MDEditor
            value={content}
            onChange={(val) => setContent(val || "")}
            previewOptions={{
              disallowedElements: ["img"],
            }}
          />
        </div>
        <div className="flex gap-2">
          <button
            className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
            onClick={handleSave}
            disabled={!title.trim() || !!nameError}
          >Salvar</button>
          <button
            className="bg-gray-500 text-white px-4 py-2 rounded"
            onClick={() => router.push(`/projects/${projectId}/sections/${sectionId}`)}
          >Cancelar</button>
        </div>
      </div>
      <AutocompleteDropdown />
    </div>
  );
}
