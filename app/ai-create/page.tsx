"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProjectStore } from "@/store/projectStore";
import { GDDTemplate } from "@/types/ai";
import { useAIConfig } from "@/hooks/useAIConfig";
import AIConfigWarning from "@/components/AIConfigWarning";
import { useI18n } from "@/lib/i18n/provider";
import { createProjectFromTemplate } from "@/lib/projects/createProjectFromTemplate";
import { adaptAIGeneratedTemplate } from "@/lib/projects/adaptAIGeneratedTemplate";

export default function AICreateProject() {
  const { hasValidConfig, getAIHeaders } = useAIConfig();
  const { locale, t } = useI18n();
  const tr = (pt: string, en: string, es: string) => {
    switch (locale) {
      case "es":
        return es;
      case "en":
        return en;
      default:
        return pt;
    }
  };
  const router = useRouter();
  const addProject = useProjectStore((s) => s.addProject);
  const addSection = useProjectStore((s) => s.addSection);
  const addSubsection = useProjectStore((s) => s.addSubsection);

  const [step, setStep] = useState<"input" | "generating" | "preview">("input");
  const [gameType, setGameType] = useState("");
  const [description, setDescription] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [template, setTemplate] = useState<GDDTemplate | null>(null);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!gameType.trim() || !description.trim()) {
      setError(tr("Por favor, preencha o tipo de jogo e a descrição.", "Please fill in the game type and description.", "Por favor, completa el tipo de juego y la descripción."));
      return;
    }

    setError("");
    setStep("generating");

    try {
      const response = await fetch("/api/ai/generate-template", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...getAIHeaders(),
        },
        body: JSON.stringify({
          gameType: gameType.trim(),
          description: description.trim(),
          additionalInfo: additionalInfo.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || tr("Erro ao gerar template", "Failed to generate template", "Error al generar plantilla"));
      }

      const data = await response.json();
      setTemplate(data.template);
      setStep("preview");
    } catch (err) {
      console.error("Generation error:", err);
      setError(err instanceof Error ? err.message : tr("Erro ao gerar template", "Failed to generate template", "Error al generar plantilla"));
      setStep("input");
    }
  };

  const handleCreateProject = () => {
    if (!template) return;

    try {
      // Adapt the AI output to the shared ResolvedTemplate shape so we can
      // reuse the same path that manual templates use — which handles
      // pageType + seeded addons + richDocBlocks + hierarchy.
      const resolved = adaptAIGeneratedTemplate(template);
      const projectId = createProjectFromTemplate({
        template: resolved,
        addProject,
        addSection,
        addSubsection,
        t,
      });

      router.push(`/projects/${projectId}/view?new=true`);
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("structural_limit")) {
        const msg =
          e.message === "structural_limit_projects"
            ? t("limits.projects")
            : e.message === "structural_limit_sections_per_project"
              ? t("limits.sectionsPerProject")
              : t("limits.sectionsTotal");
        setError(msg);
      } else {
        throw e;
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-3">
            <span className="text-5xl">🤖</span>
            {tr("Criar GDD com IA", "Create GDD with AI", "Crear GDD con IA")}
          </h1>
          <p className="text-gray-600">
            {tr(
              "Descreva seu jogo e deixe a IA criar a estrutura completa do seu GDD",
              "Describe your game and let AI create the full structure of your GDD",
              "Describe tu juego y deja que la IA cree la estructura completa de tu GDD"
            )}
          </p>
        </div>

        {/* Verificar configuração de IA */}
        {!hasValidConfig && step === "input" && (
          <div className="mb-8">
            <AIConfigWarning />
          </div>
        )}

        {/* Input Step */}
        {step === "input" && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  🎮 {tr("Tipo de Jogo", "Game Type", "Tipo de juego")} *
                </label>
                <input
                  type="text"
                  value={gameType}
                  onChange={(e) => setGameType(e.target.value)}
                  placeholder={tr("Ex: RPG 2D, Platformer, Roguelike, Puzzle, etc.", "Ex: 2D RPG, Platformer, Roguelike, Puzzle, etc.", "Ej: RPG 2D, Platformer, Roguelike, Puzzle, etc.")}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📝 {tr("Descrição do Jogo", "Game Description", "Descripción del juego")} *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={tr(
                    "Descreva a ideia central do jogo: mecânicas principais, objetivo do jogador, ambientação, etc.",
                    "Describe the core idea of the game: main mechanics, player objective, setting, etc.",
                    "Describe la idea central del juego: mecánicas principales, objetivo del jugador, ambientación, etc."
                  )}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-32"
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  ✨ {tr("Informações Adicionais", "Additional Information", "Información adicional")} ({tr("opcional", "optional", "opcional")})
                </label>
                <textarea
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  placeholder={tr("Arte, narrativa, público-alvo, referências, etc.", "Art, narrative, target audience, references, etc.", "Arte, narrativa, público objetivo, referencias, etc.")}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-24"
                  rows={3}
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={() => router.push("/")}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {tr("Cancelar", "Cancel", "Cancelar")}
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={!gameType.trim() || !description.trim() || !hasValidConfig}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  ✨ {tr("Gerar GDD com IA", "Generate GDD with AI", "Generar GDD con IA")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Generating Step */}
        {step === "generating" && (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="animate-bounce text-6xl mb-4">🤖</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{tr("Gerando seu GDD...", "Generating your GDD...", "Generando tu GDD...")}</h2>
            <p className="text-gray-600 mb-6">
              {tr("A IA está criando uma estrutura personalizada para seu projeto", "AI is creating a custom structure for your project", "La IA está creando una estructura personalizada para tu proyecto")}
            </p>
            <div className="flex justify-center gap-2">
              <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse"></div>
              <div className="w-3 h-3 bg-purple-600 rounded-full animate-pulse delay-75"></div>
              <div className="w-3 h-3 bg-pink-600 rounded-full animate-pulse delay-150"></div>
            </div>
          </div>
        )}

        {/* Preview Step */}
        {step === "preview" && template && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                ✅ {tr("Template Gerado!", "Template Generated!", "¡Plantilla generada!")}
              </h2>
              <p className="text-gray-600">
                {tr("Revise a estrutura e clique em \"Criar Projeto\" para começar", "Review the structure and click \"Create Project\" to begin", "Revisa la estructura y haz clic en \"Crear proyecto\" para comenzar")}
              </p>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 mb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {template.projectTitle}
              </h3>
              <p className="text-gray-700">{template.projectDescription}</p>
            </div>

            <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
              <h4 className="font-semibold text-gray-900">📚 {tr("Seções", "Sections", "Secciones")} ({template.sections.length}):</h4>
              {template.sections.map((section, index) => (
                <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                  <h5 className="font-semibold text-gray-900">{section.title}</h5>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {section.content.substring(0, 100)}...
                  </p>
                  {section.subsections && section.subsections.length > 0 && (
                    <div className="mt-2 ml-4 space-y-1">
                      {section.subsections.map((sub, subIndex) => (
                        <div key={subIndex} className="text-sm text-gray-600">
                          └─ {sub.title}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setStep("input");
                  setTemplate(null);
                }}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                ← {tr("Voltar", "Back", "Volver")}
              </button>
              <button
                onClick={handleCreateProject}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-blue-700 transition-all"
              >
                📄 {tr("Ver GDD Completo", "View Full GDD", "Ver GDD completo")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
