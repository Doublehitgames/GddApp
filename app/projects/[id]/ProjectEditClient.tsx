"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useProjectStore } from "@/store/projectStore";
import {
  convertReferencesToIds,
  convertReferencesToNames,
  convertBlockRefsToNames,
} from "@/utils/sectionReferences";
import { useI18n } from "@/lib/i18n/provider";
import EmojiQuickPicker from "@/components/EmojiQuickPicker";
import { appendEmojiWithSpacing } from "@/lib/emojiPresets";
import SpecialTokensHelp from "@/components/SpecialTokensHelp";
import { normalizeSpecialTokenSyntax } from "@/lib/sections/specialTokens";
import { toSlug, projectPath } from "@/lib/utils/slug";
import SectionDescriptionEditor, {
  type SectionDescriptionEditorApi,
} from "@/components/SectionDescriptionEditor";
import type { RichDocBlock } from "@/lib/richDoc/types";

interface Props {
  projectId: string;
}

export default function ProjectEditClient({ projectId }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const editProject = useProjectStore((s) => s.editProject);
  // Selecionar o projeto direto da lista (em vez de chamar getProjectBySlug, que
  // é um método estável) é o que re-renderiza esta tela quando ele chega do
  // Supabase. Sem essa assinatura, abrir a URL direto trava em "não encontrado".
  const project = useProjectStore((s) => s.projects.find((p) => toSlug(p.title) === projectId));

  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [initialBlocks, setInitialBlocks] = useState<RichDocBlock[] | undefined>(undefined);
  const [aiInstructions, setAiInstructions] = useState<string>("");
  /** O editor só monta depois da semente, senão ele nasce vazio e assim fica. */
  const [seeded, setSeeded] = useState(false);
  const [saveError, setSaveError] = useState<string>("");
  const editorRef = useRef<SectionDescriptionEditorApi | null>(null);
  const [editorHeight, setEditorHeight] = useState("400px");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const realProjectId = project?.id ?? "";

  // Semeia o formulário uma única vez por projeto: um sync que chegue no meio da
  // edição não pode sobrescrever o que está sendo digitado.
  const seededForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!project || seededForRef.current === projectId) return;
    seededForRef.current = projectId;
    setName(project.title);
    // Refs viajam como `$[#uuid]` no banco e como `$[Título]` na edição, para
    // que o texto continue legível enquanto se escreve.
    const sections = project.sections || [];
    setDescription(convertReferencesToNames(project.description || "", sections));
    setInitialBlocks(convertBlockRefsToNames(project.contentBlocks, sections));
    setAiInstructions(project.aiInstructions || "");
    setSeeded(true);
  }, [projectId, project]);

  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

  function handleSave() {
    if (!realProjectId) return;
    try {
      // Blocks são a fonte de verdade; o markdown sai do mesmo editor vivo, então
      // os dois não podem discordar. Vazio é permitido — significa que o usuário
      // realmente apagou a descrição.
      const api = editorRef.current;
      const blocks = api?.getBlocks?.() ?? [];
      const md = api?.getMarkdown?.() ?? description;
      const sections = project?.sections || [];
      const convertedMd = convertReferencesToIds(normalizeSpecialTokenSyntax(md), sections);
      editProject(realProjectId, name, convertedMd, { aiInstructions, contentBlocks: blocks });
      setSaveError("");
      router.push(`/projects/${toSlug(name)}`);
    } catch (e) {
      if (e instanceof Error && e.message === "duplicate_project_name") {
        setSaveError(
          t("projectEdit.duplicateNameError", "Já existe um projeto com esse nome. Escolha um nome diferente.")
        );
      } else {
        throw e;
      }
    }
  }

  function insertSpecialToken(token: string) {
    editorRef.current?.insertText?.(token);
  }

  if (!project)
    return (
      <div className="p-6">
        {t("projectDetail.notFound")}{" "}
        <button className="ml-2 px-3 py-1 bg-gray-700 text-white rounded" onClick={() => router.push("/")}>
          {t("projectDetail.backHome")}
        </button>
      </div>
    );

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-50 bg-gray-900 text-white overflow-auto p-6"
          : "p-6 max-w-4xl mx-auto"
      }
    >
      <h1 className="text-2xl font-bold mb-4">{t("projectEdit.title")}</h1>
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-semibold mb-1">{t("projectEdit.projectNameLabel")}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t("projectEdit.projectNamePlaceholder")}
          />
          <div className="mt-2">
            <EmojiQuickPicker onSelect={(emoji) => setName((prev) => appendEmojiWithSpacing(prev, emoji))} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-semibold">{t("projectEdit.projectDescriptionLabel")}</label>
            <div className="flex items-center gap-2">
              {!isFullscreen && (
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1">
                  <button
                    onClick={() =>
                      setEditorHeight((prev) => `${Math.max(200, parseInt(prev) - 100)}px`)
                    }
                    className="text-gray-600 hover:text-gray-900 font-bold"
                    title={t("projectEdit.decreaseHeight")}
                  >
                    −
                  </button>
                  <span className="text-sm text-gray-600 min-w-[60px] text-center">{editorHeight}</span>
                  <button
                    onClick={() => setEditorHeight((prev) => `${parseInt(prev) + 100}px`)}
                    className="text-gray-600 hover:text-gray-900 font-bold"
                    title={t("projectEdit.increaseHeight")}
                  >
                    +
                  </button>
                </div>
              )}
              <button
                onClick={() => {
                  setIsFullscreen(!isFullscreen);
                  setEditorHeight(!isFullscreen ? "calc(100vh - 200px)" : "400px");
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-1"
                title={
                  isFullscreen
                    ? t("sectionDetail.actions.exitFullscreen")
                    : t("sectionDetail.actions.fullscreen")
                }
              >
                {isFullscreen
                  ? `⤓ ${t("projectEdit.exit")}`
                  : `⤢ ${t("sectionDetail.actions.fullscreen")}`}
              </button>
            </div>
          </div>
          {seeded && (
            <SectionDescriptionEditor
              initialBlocks={initialBlocks}
              markdown={description}
              minHeight={editorHeight}
              apiRef={editorRef}
              sections={project.sections?.map((s) => ({ id: s.id, title: s.title }))}
            />
          )}
          <div className="mt-3">
            <SpecialTokensHelp
              title={t("projectEdit.specialTokens.title", "Chaves especiais")}
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
            Ensine o Claude como escrever neste projeto. Ex: tom das descrições, convenções de nomes de página, o que sempre citar por referência cruzada.
          </p>
          <textarea
            value={aiInstructions}
            onChange={(e) => setAiInstructions(e.target.value)}
            rows={6}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            placeholder={"Ex:\n- Animais usam Data Schema com: unlock_level (int), base_production (int), production_time (int)\n- Progression Tables têm colunas: cost, extra_production, speed_percent\n- O dataId da seção deve ser o remote config key (ex: DONKEY_V2)"}
          />
        </div>

        {saveError && (
          <p className="text-sm text-red-600 font-medium" role="alert">
            {saveError}
          </p>
        )}

        <div className="flex gap-2 items-center">
          <button
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            onClick={handleSave}
          >
            {t("common.save")}
          </button>
          <button
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            onClick={() => (project ? router.push(projectPath(project)) : router.push("/"))}
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
