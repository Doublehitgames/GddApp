"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProjectStore } from "@/store/projectStore";
import { GDDTemplate } from "@/types/ai";

export default function AICreateProject() {
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
      setError("Por favor, preencha o tipo de jogo e a descrição.");
      return;
    }

    setError("");
    setStep("generating");

    try {
      const response = await fetch("/api/ai/generate-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameType: gameType.trim(),
          description: description.trim(),
          additionalInfo: additionalInfo.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || "Erro ao gerar template");
      }

      const data = await response.json();
      setTemplate(data.template);
      setStep("preview");
    } catch (err) {
      console.error("Generation error:", err);
      setError(err instanceof Error ? err.message : "Erro ao gerar template");
      setStep("input");
    }
  };

  const handleCreateProject = () => {
    if (!template) return;

    // Create project
    const projectId = addProject(template.projectTitle, template.projectDescription);

    // Create sections and subsections
    template.sections.forEach((section, index) => {
      addSection(projectId, section.title);
      
      // Get the section we just created
      const store = useProjectStore.getState();
      const project = store.getProject(projectId);
      const createdSection = project?.sections?.find(s => s.title === section.title);
      
      if (createdSection) {
        // Update content via editSection
        store.editSection(projectId, createdSection.id, section.title, section.content);
        
        // Add subsections if any
        if (section.subsections && section.subsections.length > 0) {
          section.subsections.forEach(subsection => {
            addSubsection(projectId, createdSection.id, subsection.title);
            
            // Get the subsection we just created and update its content
            const updatedProject = store.getProject(projectId);
            const createdSubsection = updatedProject?.sections?.find(
              s => s.parentId === createdSection.id && s.title === subsection.title
            );
            
            if (createdSubsection) {
              store.editSection(projectId, createdSubsection.id, subsection.title, subsection.content);
            }
          });
        }
      }
    });

    router.push(`/projects/${projectId}/view?new=true`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-3">
            <span className="text-5xl">🤖</span>
            Criar GDD com IA
          </h1>
          <p className="text-gray-600">
            Descreva seu jogo e deixe a IA criar a estrutura completa do seu GDD
          </p>
        </div>

        {/* Input Step */}
        {step === "input" && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  🎮 Tipo de Jogo *
                </label>
                <input
                  type="text"
                  value={gameType}
                  onChange={(e) => setGameType(e.target.value)}
                  placeholder="Ex: RPG 2D, Platformer, Roguelike, Puzzle, etc."
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📝 Descrição do Jogo *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva a ideia central do jogo: mecânicas principais, objetivo do jogador, ambientação, etc."
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-32"
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  ✨ Informações Adicionais (opcional)
                </label>
                <textarea
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  placeholder="Arte, narrativa, público-alvo, referências, etc."
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
                  Cancelar
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={!gameType.trim() || !description.trim()}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  ✨ Gerar GDD com IA
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Generating Step */}
        {step === "generating" && (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="animate-bounce text-6xl mb-4">🤖</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Gerando seu GDD...</h2>
            <p className="text-gray-600 mb-6">
              A IA está criando uma estrutura personalizada para seu projeto
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
                ✅ Template Gerado!
              </h2>
              <p className="text-gray-600">
                Revise a estrutura e clique em "Criar Projeto" para começar
              </p>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 mb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {template.projectTitle}
              </h3>
              <p className="text-gray-700">{template.projectDescription}</p>
            </div>

            <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
              <h4 className="font-semibold text-gray-900">📚 Seções ({template.sections.length}):</h4>
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
                ← Voltar
              </button>
              <button
                onClick={handleCreateProject}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-blue-700 transition-all"
              >
                📄 Ver GDD Completo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
