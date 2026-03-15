"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProjectStore } from "@/store/projectStore";
import { GDDTemplate } from "@/types/ai";
import { useAIConfig } from "@/hooks/useAIConfig";
import AIConfigWarning from "@/components/AIConfigWarning";
import { useI18n } from "@/lib/i18n/provider";

export default function AICreateSimple() {
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

  // Form fields
  const [gameName, setGameName] = useState("");
  const [genre, setGenre] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [visualStyle, setVisualStyle] = useState("");
  const [description, setDescription] = useState("");
  const [mechanics, setMechanics] = useState("");
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isGeneratingMechanics, setIsGeneratingMechanics] = useState(false);
  const [template, setTemplate] = useState<GDDTemplate | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("llama-3.3-70b-versatile");
  const [error, setError] = useState<string>("");
  const [adjustments, setAdjustments] = useState<string>("");

  const getErrorMessage = (errorValue: unknown) =>
    errorValue instanceof Error ? errorValue.message : "";

  const genres = [
    "Roguelike/Roguelite",
    "Platformer",
    "RPG",
    "Puzzle",
    "Farming/Simulação",
    "Ação",
    "Aventura",
    "Estratégia",
    "Terror/Horror",
    "Visual Novel",
    "Metroidvania",
    "Outro"
  ];

  const visualStyles = [
    "Pixel Art",
    "2D Cartoon",
    "2D Realista",
    "3D Low Poly",
    "3D Realista",
    "Minimalista",
    "Voxel",
    "Hand-drawn",
    "Outro"
  ];

  const platformOptions = ["PC", "Mobile", "Web", "Console"];

  // Character limits
  const MAX_DESCRIPTION = 1000;
  const MAX_MECHANICS = 500;

  const fillExample = () => {
    setGameName("Cavernas de Valhalla");
    setGenre("Roguelike/Roguelite");
    setPlatforms(["PC", "Mobile"]);
    setVisualStyle("Pixel Art");
    setDescription("Um roguelike medieval em pixel art onde você explora dungeons procedurais repletas de perigos e tesouros. O jogador controla um guerreiro viking em busca de artefatos lendários nas profundezas, enfrentando morte permanente mas mantendo conhecimento entre as runs.");
    setMechanics("• Combate estratégico por turnos\n• Dungeons procedurais infinitas\n• Sistema de loot com raridades\n• Morte permanente (permadeath)\n• Progressão meta através de upgrades\n• Boss fights épicos");
  };

  const togglePlatform = (platform: string) => {
    setPlatforms(prev => 
      prev.includes(platform) 
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const handleEnhanceDescription = async () => {
    if (!description.trim()) {
      setError(tr("Escreva pelo menos uma frase básica antes de melhorar!", "Write at least one basic sentence before improving!", "¡Escribe al menos una frase básica antes de mejorar!"));
      return;
    }

    setIsEnhancing(true);
    setError("");

    try {
      // Build context from filled fields
      const context = [];
      if (gameName) context.push(`Nome do jogo: ${gameName}`);
      if (genre) context.push(`Gênero: ${genre}`);
      if (platforms.length > 0) context.push(`Plataformas: ${platforms.join(", ")}`);
      if (visualStyle) context.push(`Estilo visual: ${visualStyle}`);

      const prompt = `${context.join("\n")}

Descrição atual do usuário:
${description}

Por favor, reescreva e expanda essa descrição de jogo para ficar mais profissional e detalhada, mantendo a essência da ideia original. A descrição deve:
- Ter 3-5 frases bem estruturadas
- Incluir o conceito principal do gameplay
- Mencionar o que torna o jogo interessante
- Usar uma linguagem clara e envolvente
- Ser adequada para um Game Design Document

Retorne APENAS a descrição melhorada, sem aspas ou formatação markdown.`;

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...getAIHeaders(),
        },
        body: JSON.stringify({
          messages: [
            { role: "user", content: prompt }
          ],
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        throw new Error(tr("Erro ao melhorar descrição", "Failed to improve description", "Error al mejorar la descripción"));
      }

      const data = await response.json();
      const enhancedDescription = data.message.trim();
      
      setDescription(enhancedDescription);
      
    } catch (error: unknown) {
      console.error("Enhance error:", error);
      
      // Try fallback to 8B if rate limit
      const errorMsg = getErrorMessage(error);
      if ((errorMsg.includes("rate_limit") || errorMsg.includes("429")) && selectedModel === "llama-3.3-70b-versatile") {
        setSelectedModel("llama-3.1-8b-instant");
        setError(tr("⚡ Tentando com modelo econômico...", "⚡ Trying budget model...", "⚡ Probando con modelo económico..."));
        
        // Retry once with 8B
        try {
          const context = [];
          if (gameName) context.push(`Nome do jogo: ${gameName}`);
          if (genre) context.push(`Gênero: ${genre}`);
          if (platforms.length > 0) context.push(`Plataformas: ${platforms.join(", ")}`);
          if (visualStyle) context.push(`Estilo visual: ${visualStyle}`);

          const prompt = `${context.join("\n")}

Descrição atual: ${description}

Reescreva essa descrição de jogo de forma profissional e detalhada (3-5 frases). Retorne APENAS a descrição melhorada.`;

          const retryResponse = await fetch("/api/ai/chat", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              ...getAIHeaders(),
            },
            body: JSON.stringify({
              messages: [{ role: "user", content: prompt }],
              model: "llama-3.1-8b-instant",
            }),
          });

          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            setDescription(retryData.message.trim());
            setError("");
          } else {
            setError(tr("❌ Não foi possível melhorar a descrição. Tente novamente!", "❌ Could not improve the description. Try again!", "❌ No se pudo mejorar la descripción. ¡Inténtalo nuevamente!"));
          }
        } catch {
          setError(tr("❌ Não foi possível melhorar a descrição. Tente novamente!", "❌ Could not improve the description. Try again!", "❌ No se pudo mejorar la descripción. ¡Inténtalo nuevamente!"));
        }
      } else {
        setError(tr("❌ Não foi possível melhorar a descrição. Tente novamente!", "❌ Could not improve the description. Try again!", "❌ No se pudo mejorar la descripción. ¡Inténtalo nuevamente!"));
      }
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleGenerateMechanics = async () => {
    if (!description.trim()) {
      setError(tr("Preencha a descrição do jogo primeiro!", "Fill in the game description first!", "¡Completa primero la descripción del juego!"));
      return;
    }

    setIsGeneratingMechanics(true);
    setError("");

    try {
      // Build context from filled fields
      const context = [];
      if (gameName) context.push(`Nome do jogo: ${gameName}`);
      if (genre) context.push(`Gênero: ${genre}`);
      if (platforms.length > 0) context.push(`Plataformas: ${platforms.join(", ")}`);
      if (visualStyle) context.push(`Estilo visual: ${visualStyle}`);
      context.push(`\nDescrição do jogo:\n${description}`);

      const prompt = `${context.join("\n")}

Com base nessas informações, liste as principais mecânicas de gameplay que esse jogo deveria ter.

Retorne uma lista de 5-8 mecânicas em bullet points (usando "•"), sendo específico e relevante ao gênero.
Cada mecânica deve ser uma frase curta e clara.

Exemplo de formato:
• Sistema de combate por turnos
• Progressão de personagem com skill tree
• Exploração de mundo aberto

Retorne APENAS a lista de mecânicas, sem introdução ou explicações adicionais.`;

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...getAIHeaders(),
        },
        body: JSON.stringify({
          messages: [
            { role: "user", content: prompt }
          ],
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        throw new Error(tr("Erro ao gerar mecânicas", "Failed to generate mechanics", "Error al generar mecánicas"));
      }

      const data = await response.json();
      const generatedMechanics = data.message.trim();
      
      setMechanics(generatedMechanics);
      
    } catch (error: unknown) {
      console.error("Generate mechanics error:", error);
      
      // Try fallback to 8B if rate limit
      const errorMsg = getErrorMessage(error);
      if ((errorMsg.includes("rate_limit") || errorMsg.includes("429")) && selectedModel === "llama-3.3-70b-versatile") {
        setSelectedModel("llama-3.1-8b-instant");
        setError(tr("⚡ Tentando com modelo econômico...", "⚡ Trying budget model...", "⚡ Probando con modelo económico..."));
        
        // Retry once with 8B
        try {
          const context = [];
          if (genre) context.push(`Gênero: ${genre}`);
          context.push(`Descrição: ${description}`);

          const prompt = `${context.join("\n")}

Liste 5-8 mecânicas de gameplay para este jogo em bullet points (•). Seja específico e relevante ao gênero.`;

          const retryResponse = await fetch("/api/ai/chat", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              ...getAIHeaders(),
            },
            body: JSON.stringify({
              messages: [{ role: "user", content: prompt }],
              model: "llama-3.1-8b-instant",
            }),
          });

          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            setMechanics(retryData.message.trim());
            setError("");
          } else {
            setError(tr("❌ Não foi possível gerar mecânicas. Tente novamente!", "❌ Could not generate mechanics. Try again!", "❌ No se pudieron generar las mecánicas. ¡Inténtalo nuevamente!"));
          }
        } catch {
          setError(tr("❌ Não foi possível gerar mecânicas. Tente novamente!", "❌ Could not generate mechanics. Try again!", "❌ No se pudieron generar las mecánicas. ¡Inténtalo nuevamente!"));
        }
      } else {
        setError(tr("❌ Não foi possível gerar mecânicas. Tente novamente!", "❌ Could not generate mechanics. Try again!", "❌ No se pudieron generar las mecánicas. ¡Inténtalo nuevamente!"));
      }
    } finally {
      setIsGeneratingMechanics(false);
    }
  };

  const handleGenerate = async (withAdjustments: boolean = false) => {
    // Validation
    if (!gameName.trim()) {
      setError(tr("Por favor, dê um nome para o seu jogo!", "Please give your game a name!", "¡Por favor, ponle un nombre a tu juego!"));
      return;
    }
    if (!genre) {
      setError(tr("Escolha um gênero para o jogo!", "Choose a genre for the game!", "¡Elige un género para el juego!"));
      return;
    }
    if (!description.trim()) {
      setError(tr("Adicione uma breve descrição do jogo!", "Add a short game description!", "¡Agrega una breve descripción del juego!"));
      return;
    }

    setError("");
    setIsGenerating(true);

    // Build description for AI
    const platformText = platforms.length > 0 ? `Plataformas: ${platforms.join(", ")}` : "";
    const styleText = visualStyle ? `Estilo visual: ${visualStyle}` : "";
    const mechanicsText = mechanics.trim() ? `Mecânicas principais: ${mechanics}` : "";
    
    let fullDescription = `
${description}

${platformText}
${styleText}
${mechanicsText}
    `.trim();

    // Add adjustments if regenerating
    if (withAdjustments && adjustments.trim()) {
      fullDescription += `\n\n**AJUSTES SOLICITADOS:**\n${adjustments.trim()}`;
    }

    try {
      const response = await fetch("/api/ai/generate-template", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...getAIHeaders(),
        },
        body: JSON.stringify({
          gameType: genre,
          description: fullDescription,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ details: 'Unknown error' }));
        throw new Error(errorData.details || errorData.error || tr('Erro ao gerar template', 'Failed to generate template', 'Error al generar la plantilla'));
      }

      const data = await response.json();
      
      // Override project title with user's game name
      data.template.projectTitle = gameName;
      
      setTemplate(data.template);

    } catch (error: unknown) {
      let errorDetails = "";
      if (error instanceof Error) {
        errorDetails = error.message;
      }
      
      console.error('❌ Generate error:', error);
      
      // Check for rate limit error
      const isRateLimit = errorDetails.includes("rate_limit") || errorDetails.includes("429") || errorDetails.includes("Rate limit");
      
      if (isRateLimit && selectedModel === "llama-3.3-70b-versatile") {
        // FALLBACK: Try with 8B model
        console.log("🔄 Rate limit detected! Switching to 8B model and retrying...");
        
        setSelectedModel("llama-3.1-8b-instant");
        setError(tr("⚡ Modelo potente em limite. Tentando com modelo econômico...", "⚡ Powerful model is rate-limited. Trying budget model...", "⚡ El modelo potente alcanzó el límite. Probando con modelo económico..."));
        
        try {
          const retryResponse = await fetch("/api/ai/generate-template", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              ...getAIHeaders(),
            },
            body: JSON.stringify({
              gameType: genre,
              description: fullDescription,
              model: "llama-3.1-8b-instant",
            }),
          });

          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            retryData.template.projectTitle = gameName;
            setTemplate(retryData.template);
            setError("");
            setIsGenerating(false);
            return;
          }
        } catch (retryError) {
          console.error("Retry with 8B failed:", retryError);
        }
      }
      
      // Show error message
      if (isRateLimit) {
        setError(tr("⏰ Ambos os modelos atingiram o limite. Tente novamente em alguns minutos ou amanhã.", "⏰ Both models hit the limit. Try again in a few minutes or tomorrow.", "⏰ Ambos modelos alcanzaron el límite. Inténtalo de nuevo en unos minutos o mañana."));
      } else if (errorDetails.includes("API key") || errorDetails.includes("401")) {
        setError(tr("🔑 Problema com a chave da API. Verifique a configuração.", "🔑 API key issue. Check your configuration.", "🔑 Problema con la API key. Revisa la configuración."));
      } else {
        setError(tr("❌ Erro ao gerar GDD. Tente novamente!", "❌ Failed to generate GDD. Try again!", "❌ Error al generar el GDD. ¡Inténtalo nuevamente!"));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateProject = () => {
    if (!template) return;

    try {
      const projectId = addProject(template.projectTitle, template.projectDescription);

      template.sections.forEach((section) => {
        addSection(projectId, section.title);

        const store = useProjectStore.getState();
        const project = store.getProject(projectId);
        const createdSection = project?.sections?.find((s) => s.title === section.title);

        if (createdSection) {
          store.editSection(projectId, createdSection.id, section.title, section.content);

          if (section.subsections && section.subsections.length > 0) {
            section.subsections.forEach((subsection) => {
              addSubsection(projectId, createdSection.id, subsection.title);

              const updatedProject = store.getProject(projectId);
              const createdSubsection = updatedProject?.sections?.find(
                (s) => s.parentId === createdSection.id && s.title === subsection.title
              );

              if (createdSubsection) {
                store.editSection(projectId, createdSubsection.id, subsection.title, subsection.content);
              }
            });
          }
        }
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            🎮 {tr("Criar Novo GDD", "Create New GDD", "Crear nuevo GDD")}
          </h1>
          <p className="text-gray-300">
            {tr("Preencha as informações e gere seu Game Design Document completo!", "Fill in the information and generate your complete Game Design Document!", "¡Completa la información y genera tu Game Design Document completo!")}
          </p>
          {!template && (
            <button
              onClick={fillExample}
              className="mt-4 bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition-all inline-flex items-center gap-2"
            >
              💡 {tr("Preencher Exemplo", "Fill Example", "Completar ejemplo")}
            </button>
          )}
        </div>

        {/* Verificar configuração de IA */}
        {!hasValidConfig && !template && (
          <div className="mb-8">
            <AIConfigWarning />
          </div>
        )}

        {!template ? (
          /* Form */
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-purple-500/30">
            
            {/* Game Name */}
            <div className="mb-6">
              <label className="block text-white font-semibold mb-2">
                {tr("Nome do Jogo", "Game Name", "Nombre del juego")} *
              </label>
              <input
                type="text"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                placeholder="Ex: Cavernas de Valhalla"
                className="w-full bg-gray-700/50 text-white rounded-lg px-4 py-3 border border-gray-600 focus:border-purple-500 focus:outline-none"
              />
            </div>

            {/* Genre */}
            <div className="mb-6">
              <label className="block text-white font-semibold mb-2">
                {tr("Gênero", "Genre", "Género")} *
              </label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full bg-gray-700/50 text-white rounded-lg px-4 py-3 border border-gray-600 focus:border-purple-500 focus:outline-none"
              >
                <option value="">{tr("Selecione um gênero", "Select a genre", "Selecciona un género")}</option>
                {genres.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            {/* Platforms */}
            <div className="mb-6">
              <label className="block text-white font-semibold mb-2">
                {tr("Plataformas", "Platforms", "Plataformas")}
              </label>
              <div className="flex flex-wrap gap-3">
                {platformOptions.map(platform => (
                  <button
                    key={platform}
                    onClick={() => togglePlatform(platform)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      platforms.includes(platform)
                        ? "bg-purple-600 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    {platform}
                  </button>
                ))}
              </div>
            </div>

            {/* Visual Style */}
            <div className="mb-6">
              <label className="block text-white font-semibold mb-2">
                {tr("Estilo Visual", "Visual Style", "Estilo visual")}
              </label>
              <select
                value={visualStyle}
                onChange={(e) => setVisualStyle(e.target.value)}
                className="w-full bg-gray-700/50 text-white rounded-lg px-4 py-3 border border-gray-600 focus:border-purple-500 focus:outline-none"
              >
                <option value="">{tr("Selecione um estilo", "Select a style", "Selecciona un estilo")}</option>
                {visualStyles.map(style => (
                  <option key={style} value={style}>{style}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-white font-semibold">
                  {tr("Descrição do Jogo", "Game Description", "Descripción del juego")} *
                </label>
                <span className={`text-sm ${
                  description.length > MAX_DESCRIPTION 
                    ? 'text-red-400 font-bold' 
                    : description.length > MAX_DESCRIPTION * 0.8 
                    ? 'text-yellow-400' 
                    : 'text-gray-400'
                }`}>
                  {description.length}/{MAX_DESCRIPTION}
                </span>
              </div>
              <textarea
                value={description}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_DESCRIPTION) {
                    setDescription(e.target.value);
                  }
                }}
                placeholder={tr(
                  "Ex: jogo de fazenda pixel art onde você planta e cuida de animais",
                  "Ex: pixel art farming game where you plant crops and take care of animals",
                  "Ej: juego de granja pixel art donde plantas cultivos y cuidas animales"
                )}
                rows={4}
                className="w-full bg-gray-700/50 text-white rounded-lg px-4 py-3 border border-gray-600 focus:border-purple-500 focus:outline-none resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-gray-400 text-sm">
                  {tr("Pode ser simples! Use o botão ao lado para melhorar →", "It can be simple! Use the button to improve it →", "¡Puede ser simple! Usa el botón de al lado para mejorarla →")}
                </p>
                <button
                  onClick={handleEnhanceDescription}
                  disabled={isEnhancing || !description.trim() || !hasValidConfig}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-medium px-4 py-2 rounded-lg transition-all disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isEnhancing ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {tr("Melhorando...", "Improving...", "Mejorando...")}
                    </>
                  ) : (
                    <>
                      ✨ {tr("Melhorar com IA", "Improve with AI", "Mejorar con IA")}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Mechanics */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-white font-semibold">
                  {tr("Mecânicas Principais", "Core Mechanics", "Mecánicas principales")} <span className="text-gray-400 font-normal">({tr("opcional", "optional", "opcional")})</span>
                </label>
                <span className={`text-sm ${
                  mechanics.length > MAX_MECHANICS 
                    ? 'text-red-400 font-bold' 
                    : mechanics.length > MAX_MECHANICS * 0.8 
                    ? 'text-yellow-400' 
                    : 'text-gray-400'
                }`}>
                  {mechanics.length}/{MAX_MECHANICS}
                </span>
              </div>
              <textarea
                value={mechanics}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_MECHANICS) {
                    setMechanics(e.target.value);
                  }
                }}
                placeholder="Ex: • Combate por turnos&#10;• Sistema de loot procedural&#10;• Upgrades permanentes"
                rows={5}
                className="w-full bg-gray-700/50 text-white rounded-lg px-4 py-3 border border-gray-600 focus:border-purple-500 focus:outline-none resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-gray-400 text-sm">
                  {tr("Deixe a IA sugerir mecânicas baseadas na descrição →", "Let AI suggest mechanics based on the description →", "Deja que la IA sugiera mecánicas basadas en la descripción →")}
                </p>
                <button
                  onClick={handleGenerateMechanics}
                  disabled={isGeneratingMechanics || !description.trim() || !hasValidConfig}
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-medium px-4 py-2 rounded-lg transition-all disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isGeneratingMechanics ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {tr("Gerando...", "Generating...", "Generando...")}
                    </>
                  ) : (
                    <>
                      📝 {tr("Criar da descrição", "Create from description", "Crear desde la descripción")}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Model Selection */}
            <div className="mb-6">
              <label className="block text-white font-semibold mb-2">
                {tr("Modelo de IA", "AI Model", "Modelo de IA")}
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-gray-700/50 text-white rounded-lg px-4 py-3 border border-gray-600 focus:border-purple-500 focus:outline-none"
              >
                <option value="llama-3.3-70b-versatile">{tr("⚡ 70B - Potente (melhor qualidade)", "⚡ 70B - Powerful (best quality)", "⚡ 70B - Potente (mejor calidad)")}</option>
                <option value="llama-3.1-8b-instant">{tr("💨 8B - Econômico (mais rápido)", "💨 8B - Budget (faster)", "💨 8B - Económico (más rápido)")}</option>
              </select>
              <p className="text-gray-400 text-sm mt-1">
                {tr("O modelo potente gera GDDs mais detalhados, mas tem limite de uso diário", "The powerful model generates more detailed GDDs, but has a daily usage limit", "El modelo potente genera GDDs más detallados, pero tiene límite de uso diario")}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 bg-red-900/30 border border-red-500/50 rounded-lg p-4">
                <p className="text-red-300">{error}</p>
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={() => handleGenerate()}
              disabled={isGenerating || !hasValidConfig}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 rounded-lg transition-all transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {tr("Gerando GDD...", "Generating GDD...", "Generando GDD...")}
                </span>
              ) : (
                (tr("🚀 Gerar GDD Completo", "🚀 Generate Full GDD", "🚀 Generar GDD completo"))
              )}
            </button>

            <p className="text-gray-400 text-sm text-center mt-4">
              * {tr("Campos obrigatórios", "Required fields", "Campos obligatorios")}
            </p>
          </div>
        ) : (
          /* Preview */
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-green-500/30">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">✨</div>
              <h2 className="text-3xl font-bold text-white mb-2">
                {tr("GDD Criado com Sucesso!", "GDD Created Successfully!", "¡GDD creado con éxito!")}
              </h2>
              <p className="text-gray-300">
                {template.projectTitle}
              </p>
            </div>

            <div className="bg-gray-700/50 rounded-lg p-6 mb-6">
              <h3 className="text-xl font-bold text-white mb-3">📋 {tr("Seções Criadas:", "Created Sections:", "Secciones creadas:")}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {template.sections.map((section, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-gray-300">
                    <span className="text-green-400">✓</span>
                    <span>{section.title}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4 mb-6">
              <p className="text-blue-200 text-sm">
                <span>
                  💡 <strong>{tr("Dica", "Tip", "Consejo")}:</strong>{" "}
                  {tr(
                    "Depois de criar o projeto, você pode usar o chat IA dentro do projeto para refinar cada seção!",
                    "After creating the project, you can use the AI chat inside the project to refine each section!",
                    "Después de crear el proyecto, puedes usar el chat de IA dentro del proyecto para refinar cada sección!"
                  )}
                </span>
              </p>
            </div>

            {/* Adjustments Field */}
            <div className="bg-gray-700/50 rounded-lg p-6 mb-6">
              <label className="block text-white font-semibold mb-2">
                ✏️ {tr("Quer ajustar algo?", "Want to tweak something?", "¿Quieres ajustar algo?")} ({tr("opcional", "optional", "opcional")})
              </label>
              <textarea
                value={adjustments}
                onChange={(e) => setAdjustments(e.target.value)}
                placeholder={tr(
                  "Ex: Adicionar seção sobre economia do jogo&#10;Incluir mais detalhes sobre multiplayer&#10;Faltou falar sobre tutorial",
                  "Ex: Add a section about game economy&#10;Include more details about multiplayer&#10;Add content about the tutorial",
                  "Ej: Agregar sección sobre economía del juego&#10;Incluir más detalles sobre multijugador&#10;Falta hablar sobre el tutorial"
                )}
                rows={3}
                className="w-full bg-gray-600/50 text-white rounded-lg px-4 py-3 border border-gray-500 focus:border-purple-500 focus:outline-none resize-none"
              />
              <p className="text-gray-400 text-sm mt-2">
                {tr("Descreva o que gostaria de adicionar, remover ou modificar no GDD", "Describe what you want to add, remove, or modify in the GDD", "Describe lo que quieres añadir, eliminar o modificar en el GDD")}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 bg-red-900/30 border border-red-500/50 rounded-lg p-4">
                <p className="text-red-300">{error}</p>
              </div>
            )}

            <div className="flex flex-col gap-4">
              <button
                onClick={handleCreateProject}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-4 rounded-lg transition-all transform hover:scale-105"
              >
                📄 {tr("Ver GDD Completo", "View Full GDD", "Ver GDD completo")}
              </button>
              <p className="text-center text-gray-400 text-sm -mt-2">
                {tr("Veja seu documento formatado antes de editar", "See your formatted document before editing", "Mira tu documento formateado antes de editar")}
              </p>
              
              <div className="flex gap-4">
                <button
                  onClick={() => handleGenerate(true)}
                  disabled={isGenerating || !adjustments.trim() || !hasValidConfig}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 rounded-lg transition-all disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isGenerating ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {tr("Regenerando...", "Regenerating...", "Regenerando...")}
                    </span>
                  ) : (
                    (tr("🔄 Regenerar com Ajustes", "🔄 Regenerate with Adjustments", "🔄 Regenerar con ajustes"))
                  )}
                </button>
                <button
                  onClick={() => {
                    setTemplate(null);
                    setError("");
                    setAdjustments("");
                  }}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 rounded-lg transition-all"
                >
                  ↩️ {tr("Voltar ao Formulário", "Back to Form", "Volver al formulario")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Back button */}
        <div className="text-center mt-6">
          <button
            onClick={() => router.push("/")}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ← {tr("Voltar para Home", "Back to Home", "Volver al inicio")}
          </button>
        </div>
      </div>
    </div>
  );
}
