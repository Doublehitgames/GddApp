"use client";

import { useProjectStore } from "@/store/projectStore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { convertReferencesToIds, convertReferencesToNames } from "@/utils/sectionReferences";
import { useMarkdownAutocomplete } from "@/hooks/useMarkdownAutocomplete";
import { useAIConfig } from "@/hooks/useAIConfig";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

interface Props {
  projectId: string;
  sectionId: string;
}

export default function SectionEditClient({ projectId, sectionId }: Props) {
  const { hasValidConfig, getAIHeaders } = useAIConfig();
  const getProject = useProjectStore((s) => s.getProject);
  const editSection = useProjectStore((s) => s.editSection);
  const hasDuplicateName = useProjectStore((s) => s.hasDuplicateName);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState("#3b82f6"); // Cor padrão azul
  const [hasCustomColor, setHasCustomColor] = useState(false); // Flag para saber se tem cor customizada
  const [parentId, setParentId] = useState<string | undefined>(undefined);
  const [nameError, setNameError] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [improveError, setImproveError] = useState<string>("");
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
      setColor(sec.color || "#3b82f6"); // Carregar cor salva ou usar padrão
      setHasCustomColor(!!sec.color); // Se tem cor salva, marcar como customizada
      setNotFound(false);
    } else {
      setNotFound(true);
    }
    setLoaded(true);
  }, [projectId, sectionId, getProject]);

  async function handleImproveWithAI() {
    setIsImproving(true);
    setImproveError("");

    try {
      const section = sections.find((s: any) => s.id === sectionId);
      if (!section) {
        setImproveError("Seção não encontrada");
        return;
      }

      // Coleta contexto para IA
      const subsections = sections.filter((s: any) => s.parentId === sectionId);
      const parentSection = section.parentId ? sections.find((s: any) => s.id === section.parentId) : null;
      const otherSections = sections
        .filter((s: any) => !s.parentId && s.id !== sectionId)
        .map((s: any) => ({ title: s.title }));

      const response = await fetch('/api/ai/improve-content', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAIHeaders(),
        },
        body: JSON.stringify({
          currentContent: content,
          sectionTitle: title,
          sectionContext: {
            parentTitle: parentSection?.title,
            subsections: subsections.map((s: any) => ({ title: s.title })),
            otherSections
          },
          projectTitle: project?.title || 'GDD',
          model: 'llama-3.1-8b-instant' // Usa modelo rápido para economizar
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setImproveError(data.error || 'Erro ao melhorar conteúdo');
        return;
      }

      // Atualiza conteúdo com versão melhorada
      setContent(data.improvedContent);

      // Avisa se alguns elementos não foram preservados
      if (data.validation && !data.validation.allPreserved) {
        setImproveError(`⚠️ Atenção: ${data.validation.warning}. Revise o conteúdo antes de salvar.`);
      }

    } catch (error) {
      console.error('Error improving content:', error);
      setImproveError('Erro ao conectar com API. Tente novamente.');
    } finally {
      setIsImproving(false);
    }
  }

  function handleSave() {
    if (!notFound && projectId && sectionId && !nameError) {
      // Convert name-based references to ID-based references before saving
      const project = getProject(projectId);
      const sections = project?.sections || [];
      const convertedContent = convertReferencesToIds(content, sections);
      
      console.log('Original content:', content);
      console.log('Converted content:', convertedContent);
      console.log('Available sections:', sections.map((s: any) => ({ id: s.id, title: s.title })));
      
      // Passar cor apenas se for customizada, senão passar undefined para usar padrão do nível
      editSection(projectId, sectionId, title, convertedContent, parentId ?? undefined, hasCustomColor ? color : undefined);
      router.push(`/projects/${projectId}/sections/${sectionId}`);
    }
  }

  if (!loaded) return <div className="p-6">Carregando...</div>;
  if (notFound) return <div className="p-6">Seção não encontrada. <button className="ml-2 px-3 py-1 bg-gray-700 text-white rounded" onClick={() => router.push(`/projects/${projectId}`)}>Voltar</button></div>;

  console.log('SectionEditClient renderizado - título:', title);

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
        
        {/* Cor da Seção */}
        <div className="border border-gray-700 rounded-lg p-4 bg-gray-800/50">
          <label className="block text-sm font-semibold mb-2 text-gray-300">
            🎨 Cor da Seção {hasCustomColor && <span className="text-amber-400">(customizada)</span>}
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={(e) => {
                setColor(e.target.value);
                setHasCustomColor(true);
              }}
              className="w-16 h-10 rounded cursor-pointer"
            />
            <input
              type="text"
              value={color}
              onChange={(e) => {
                setColor(e.target.value);
                setHasCustomColor(true);
              }}
              className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 font-mono text-sm"
              placeholder="#3b82f6"
            />
            <button
              onClick={() => {
                setColor("#3b82f6");
                setHasCustomColor(false);
              }}
              className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm transition-colors whitespace-nowrap"
              title="Resetar para cor padrão do nível"
            >
              🔄 Resetar
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {hasCustomColor 
              ? "✨ Cor personalizada ativa. Use 'Resetar' para voltar à cor padrão do nível de hierarquia."
              : "Usando cor padrão do nível. Clique no seletor ou digite um código para personalizar."
            }
          </p>
        </div>
        
        {/* Botão Melhorar com IA */}
        <div className="border-t border-gray-700 pt-4">
          <button
            onClick={handleImproveWithAI}
            disabled={isImproving || !title.trim() || !hasValidConfig}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-lg">{isImproving ? "⏳" : "✨"}</span>
            <span>{isImproving ? "Melhorando..." : "Melhorar com IA"}</span>
          </button>
          {!hasValidConfig && (
            <p className="text-sm text-yellow-400 mt-2">
              ⚠️ Configure sua API key em <a href="/settings/ai" className="underline">Configurações de IA</a> para usar este recurso
            </p>
          )}
          {hasValidConfig && (
            <p className="text-sm text-gray-400 mt-2">
              💡 A IA vai melhorar o conteúdo preservando <strong>imagens, links e referências</strong> existentes.
            </p>
          )}
          {improveError && (
            <div className="mt-2 p-3 bg-amber-900/50 border border-amber-600 rounded text-amber-200 text-sm">
              {improveError}
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-gray-700 pt-4">
          <button
            className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50 hover:bg-green-700 transition-colors"
            onClick={handleSave}
            disabled={!title.trim() || !!nameError}
          >Salvar</button>
          <button
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
            onClick={() => router.push(`/projects/${projectId}/sections/${sectionId}`)}
          >Cancelar</button>
        </div>
      </div>
      <AutocompleteDropdown />
    </div>
  );
}
