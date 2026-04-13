"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useProjectStore } from "@/store/projectStore";
import { convertReferencesToIds, convertReferencesToNames } from "@/utils/sectionReferences";
import { useMarkdownAutocomplete } from "@/hooks/useMarkdownAutocomplete";
import { addColorButtonToToolbar, addImageUrlButtonToToolbar, addEmojiButtonToToolbar, addYouTubeButtonToToolbar } from "@/utils/toastui-color-plugin";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useI18n } from "@/lib/i18n/provider";
import EmojiQuickPicker from "@/components/EmojiQuickPicker";
import { appendEmojiWithSpacing } from "@/lib/emojiPresets";
import SpecialTokensHelp from "@/components/SpecialTokensHelp";
import { normalizeSpecialTokenSyntax } from "@/lib/addons/projectSpecialTokens";
import {
  convertYouTubeEmbedsToEditorPlaceholders,
  convertYouTubeEditorPlaceholdersToEmbeds,
} from "@/utils/youtubeEmbeds";

interface Props {
  projectId: string;
}

export default function ProjectEditClient({ projectId }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const getProject = useProjectStore((s) => s.getProject);
  const editProject = useProjectStore((s) => s.editProject);

  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [aiInstructions, setAiInstructions] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [editorMode, setEditorMode] = useState<"wysiwyg" | "markdown">("wysiwyg");
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const editorRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
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
      setAiInstructions(p.aiInstructions || "");
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
        initialValue: convertYouTubeEmbedsToEditorPlaceholders(description || ""),
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
        // "table" removido: plugin de tabelas do Toast UI causa erros (CellSelection/removeRow) em certas interações
        toolbarItems: [
          ["heading", "bold", "italic", "strike"],
          ["hr", "quote"],
          ["ul", "ol", "task"],
          ["link"],
          ["code", "codeblock"],
        ],
      });
      editorRef.current = instance;
      
      // Adiciona botão de cor
      addColorButtonToToolbar(instance);

      // Adiciona botão de imagem por URL
      addImageUrlButtonToToolbar(instance);
      addYouTubeButtonToToolbar(instance);
      addEmojiButtonToToolbar(instance);
    }
    mountEditor();
    return () => {
      cancelled = true;
      if (instance && instance.destroy) {
        instance.destroy();
      }
      editorRef.current = null;
    };
  }, [containerEl, loaded, editorMode, projectId, editorHeight]); // description removed: it caused the editor to remount on every keystroke (memory leak)

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
      const restoredMd = convertYouTubeEditorPlaceholdersToEmbeds(md);
      const normalizedMd = normalizeSpecialTokenSyntax(restoredMd);
      const project = getProject(projectId);
      const sections = project?.sections || [];
      const convertedMd = convertReferencesToIds(normalizedMd, sections);
      editProject(projectId, name, convertedMd, aiInstructions);
      router.push(`/projects/${projectId}`);
    }
  }

  function insertSpecialToken(token: string) {
    const editor = editorRef.current;
    if (editor?.insertText) {
      editor.insertText(token);
      return;
    }
    const current = editor?.getMarkdown?.() || description || "";
    const next = `${current}${current.endsWith("\n") || current.length === 0 ? "" : "\n"}${token}`;
    editor?.setMarkdown?.(next);
    setDescription(next);
  }

  if (!loaded) return <div className="p-6">{t('common.loading')}</div>;
  if (notFound) return <div className="p-6">{t('projectDetail.notFound')} <button className="ml-2 px-3 py-1 bg-gray-700 text-white rounded" onClick={() => router.push("/")}>{t('projectDetail.backHome')}</button></div>;

  return (
    <div className={isFullscreen ? "fixed inset-0 z-50 bg-white overflow-auto p-6" : "p-6 max-w-4xl mx-auto"}>
      <h1 className="text-2xl font-bold mb-4">{t('projectEdit.title')}</h1>
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-semibold mb-1">{t('projectEdit.projectNameLabel')}</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t('projectEdit.projectNamePlaceholder')}
          />
          <div className="mt-2">
            <EmojiQuickPicker onSelect={(emoji) => setName((prev) => appendEmojiWithSpacing(prev, emoji))} />
          </div>
        </div>
        
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-semibold">{t('projectEdit.projectDescriptionLabel')}</label>
            <div className="flex items-center gap-2">
              {!isFullscreen && (
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1">
                  <button
                    onClick={() => setEditorHeight(prev => {
                      const current = parseInt(prev);
                      return `${Math.max(200, current - 100)}px`;
                    })}
                    className="text-gray-600 hover:text-gray-900 font-bold"
                    title={t('projectEdit.decreaseHeight')}
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
                    title={t('projectEdit.increaseHeight')}
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
                title={isFullscreen ? t('sectionDetail.actions.exitFullscreen') : t('sectionDetail.actions.fullscreen')}
              >
                {isFullscreen ? `⤓ ${t('projectEdit.exit')}` : `⤢ ${t('sectionDetail.actions.fullscreen')}`}
              </button>
            </div>
          </div>
          <div ref={(el) => {
            setContainerEl(el);
            if (el && containerRef) {
              (containerRef as any).current = el;
            }
          }} />
          <div className="mt-3">
            <SpecialTokensHelp
              title={t("projectEdit.specialTokens.title", "Chaves especiais de addons")}
              theme="light"
              onInsertToken={insertSpecialToken}
            />
          </div>
        </div>

        {/* AI Instructions */}
        <div>
          <label className="block text-sm font-semibold mb-1">
            Instruções para IA
            <span className="text-xs text-gray-400 font-normal ml-2">(opcional)</span>
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Ensine o Claude como estruturar os dados deste projeto. Ex: quais addons usar para cada tipo de entidade, convenções de colunas em tabelas de progressão, etc.
          </p>
          <textarea
            value={aiInstructions}
            onChange={(e) => setAiInstructions(e.target.value)}
            rows={6}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            placeholder={"Ex:\n- Animais usam Data Schema com: unlock_level (int), base_production (int), production_time (int)\n- Progression Tables têm colunas: cost, extra_production, speed_percent\n- O dataId da seção deve ser o remote config key (ex: DONKEY_V2)"}
          />
        </div>

        <div className="flex gap-2 items-center">
          <button
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            onClick={handleSave}
          >{t('common.save')}</button>
          <button
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            onClick={() => projectId ? router.push(`/projects/${projectId}`) : router.push("/")}
          >{t('common.cancel')}</button>
          <button
            className="bg-gray-700 text-white px-3 py-2 rounded text-sm hover:bg-gray-800 ml-auto"
            onClick={() => {
              const next = editorMode === "wysiwyg" ? "markdown" : "wysiwyg";
              setEditorMode(next);
              if (editorRef.current?.changeMode) {
                editorRef.current.changeMode(next, true);
              }
            }}
          >{t('projectEdit.modeLabel')}: {editorMode === "wysiwyg" ? "WYSIWYG" : "Markdown"}</button>
        </div>
      </div>
      <AutocompleteDropdown />
    </div>
  );
}
