"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useProjectStore } from "@/store/projectStore";
import { convertReferencesToIds, convertReferencesToNames } from "@/utils/sectionReferences";
import { useMarkdownAutocomplete } from "@/hooks/useMarkdownAutocomplete";
import { addColorButtonToToolbar } from "@/utils/toastui-color-plugin";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [editorHeight, setEditorHeight] = useState("400px");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const project = getProject(projectId);
  const sections = project?.sections || [];
  const { AutocompleteDropdown } = useMarkdownAutocomplete({ sections, containerRef });

  useEffect(() => {
    const p = getProject(projectId);
    if (p) {
      setName(p.title);
      // Convert IDs back to names for user-friendly editing
      const sections = p.sections || [];
      const editableDescription = convertReferencesToNames(p.description || "", sections);
      setDescription(editableDescription);
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
        height: editorHeight,
        initialValue: description || "",
        usageStatistics: false,
        customHTMLRenderer: {
          htmlInline: {
            span(node: any) {
              return [
                { type: 'openTag', tagName: 'span', attributes: node.attrs },
                { type: 'html', content: node.literal || '' },
                { type: 'closeTag', tagName: 'span' }
              ];
            }
          }
        },
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
      
      // Adiciona botão de cor
      addColorButtonToToolbar(instance);
    }
    mountEditor();
    return () => {
      cancelled = true;
      if (instance && instance.destroy) {
        instance.destroy();
      }
      editorRef.current = null;
    };
  }, [containerEl, loaded, editorMode, projectId, description, editorHeight]);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.setHeight(editorHeight);
    }
  }, [editorHeight]);

  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  function handleSave() {
    if (!notFound && projectId) {
      const md = editorRef.current?.getMarkdown?.() || description;
      const project = getProject(projectId);
      const sections = project?.sections || [];
      const convertedMd = convertReferencesToIds(md, sections);
      editProject(projectId, name, convertedMd);
      router.push(`/projects/${projectId}`);
    }
  }

  if (!loaded) return <div className="p-6">Carregando...</div>;
  if (notFound) return <div className="p-6">Projeto não encontrado. <button className="ml-2 px-3 py-1 bg-gray-700 text-white rounded" onClick={() => router.push("/")}>Voltar para Home</button></div>;

  return (
    <div className={isFullscreen ? "fixed inset-0 z-50 bg-white overflow-auto p-6" : "p-6 max-w-4xl mx-auto"}>
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
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-semibold">Descrição do Projeto</label>
            <div className="flex items-center gap-2">
              {!isFullscreen && (
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1">
                  <button
                    onClick={() => setEditorHeight(prev => {
                      const current = parseInt(prev);
                      return `${Math.max(200, current - 100)}px`;
                    })}
                    className="text-gray-600 hover:text-gray-900 font-bold"
                    title="Diminuir altura"
                  >
                    −
                  </button>
                  <span className="text-sm text-gray-600 min-w-[60px] text-center">
                    {editorHeight}
                  </span>
                  <button
                    onClick={() => setEditorHeight(prev => {
                      const current = parseInt(prev);
                      return `${current + 100}px`;
                    })}
                    className="text-gray-600 hover:text-gray-900 font-bold"
                    title="Aumentar altura"
                  >
                    +
                  </button>
                </div>
              )}
              <button
                onClick={() => {
                  setIsFullscreen(!isFullscreen);
                  if (!isFullscreen) {
                    setEditorHeight('calc(100vh - 200px)');
                  } else {
                    setEditorHeight('400px');
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-1"
                title={isFullscreen ? "Sair do fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? "⤓ Sair" : "⤢ Fullscreen"}
              </button>
            </div>
          </div>
          <div ref={(el) => {
            setContainerEl(el);
            if (el && containerRef) {
              (containerRef as any).current = el;
            }
          }} />
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
      <AutocompleteDropdown />
    </div>
  );
}
