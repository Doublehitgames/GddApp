"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProjectStore } from "@/store/projectStore";
import { GDDTemplate } from "@/types/ai";

interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
  timestamp: Date;
  quickReplies?: string[];
}

export default function AICreateSimple() {
  const router = useRouter();
  const addProject = useProjectStore((s) => s.addProject);
  const addSection = useProjectStore((s) => s.addSection);
  const addSubsection = useProjectStore((s) => s.addSubsection);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "👋 E aí! Conta pra mim, que tipo de jogo você quer fazer?\n\nPode descrever do seu jeito mesmo! Vou te ajudar a refinar a ideia e depois a gente cria o GDD completo. 😊\n\nExemplos:\n• \"Quero fazer um roguelike 2D estilo medieval\"\n• \"Tô pensando num puzzle mobile com física\"\n• \"Uma fazendinha tipo Stardew Valley\"\n\nBora conversar sobre sua ideia? 🎮",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [template, setTemplate] = useState<GDDTemplate | null>(null);
  const [gameInfo, setGameInfo] = useState<{
    genre?: string;
    platform?: string;
    style?: string;
    target?: string;
    mechanics?: string[];
  }>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input.trim();
    setInput("");
    setIsGenerating(true);

    // Check if user is explicitly asking to generate GDD
    const lowerInput = currentInput.toLowerCase();
    const isGenerationRequest = !template && (
      lowerInput.includes("pode gerar") ||
      lowerInput.includes("gera o gdd") ||
      lowerInput.includes("cria o gdd") ||
      lowerInput.includes("gerar agora") ||
      lowerInput.includes("criar agora") ||
      lowerInput.includes("bora criar") ||
      lowerInput.includes("vamos criar") ||
      (lowerInput === "sim" && messages.length > 2) || // Only if already chatting
      (lowerInput === "bora" && messages.length > 2)
    );

    if (!isGenerationRequest) {
      // Just chat - don't generate
      await sendChatMessage(currentInput);
      return;
    }

    // Generate GDD
    const thinkingMessage: Message = {
      id: "thinking",
      role: "assistant",
      content: "🤖 Bora lá! Deixa eu criar esse GDD pra você...",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, thinkingMessage]);

    try {
      const response = await fetch("/api/ai/generate-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameType: "Jogo descrito pelo usuário",
          description: currentInput,
        }),
      });

      if (!response.ok) {
        throw new Error("Erro ao gerar template");
      }

      const data = await response.json();
      setTemplate(data.template);

      const successMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `✨ Pronto! Criei um GDD completo para **${data.template.projectTitle}**!\n\n📚 **${data.template.sections.length} seções criadas:**\n${data.template.sections.map((s: any) => `• ${s.title}`).join("\n")}\n\nE aí, o que achou? Se quiser mudar algo é só me falar! Quando estiver satisfeito, clica no botão verde aí embaixo pra criar o projeto! 👇`,
        timestamp: new Date(),
      };

      setMessages((prev) => prev.filter((m) => m.id !== "thinking").concat([successMessage]));
    } catch (error: any) {
      let errorContent = "❌ Eita, deu ruim aqui! 😅 Tenta descrever de novo?";
      
      // Try to get error details from API response
      const errorDetails = error?.response?.data?.details || error?.message || "";
      
      // Check for rate limit error
      if (errorDetails.includes("rate_limit") || errorDetails.includes("429") || errorDetails.includes("Rate limit")) {
        errorContent = "⏰ **Limite de uso diário atingido!**\n\nO Groq oferece 100.000 tokens grátis por dia e você já usou quase tudo hoje! 🎉\n\n**Opções:**\n• ⏳ Aguarde alguns minutos (~6min) e tente novamente\n• 📅 Volte amanhã com o limite resetado\n• 💎 Faça upgrade no Groq para mais tokens\n\n*Relaxa, você não fez nada errado! Limite diário é normal em APIs grátis.* 😊";
      } else if (errorDetails.includes("API key") || errorDetails.includes("401") || errorDetails.includes("Unauthorized")) {
        errorContent = "🔑 **Problema com a chave da API!**\n\nParece que a chave do Groq está inválida ou expirou.\n\nVerifique o arquivo `.env.local` e sua chave em: https://console.groq.com/keys";
      } else if (errorDetails.includes("network") || errorDetails.includes("fetch") || errorDetails.includes("ECONNREFUSED")) {
        errorContent = "🌐 **Problema de conexão!**\n\nNão consegui conectar com o servidor da IA. Verifica tua internet? 📡";
      }
      
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: errorContent,
        timestamp: new Date(),
      };
      setMessages((prev) => prev.filter((m) => m.id !== "thinking").concat([errorMessage]));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateProject = () => {
    if (!template) return;

    const projectId = addProject(template.projectTitle, template.projectDescription);

    template.sections.forEach((section) => {
      addSection(projectId, section.title);
      
      const store = useProjectStore.getState();
      const project = store.getProject(projectId);
      const createdSection = project?.sections?.find(s => s.title === section.title);
      
      if (createdSection) {
        store.editSection(projectId, createdSection.id, section.title, section.content);
        
        if (section.subsections && section.subsections.length > 0) {
          section.subsections.forEach(subsection => {
            addSubsection(projectId, createdSection.id, subsection.title);
            
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

    router.push(`/projects/${projectId}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickReply = (reply: string) => {
    if (isGenerating) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: reply,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsGenerating(true);

    sendChatMessage(reply);
  };

  const exportChatHistory = () => {
    const history = messages
      .filter(m => m.id !== "welcome")
      .map(m => `[${m.role.toUpperCase()}] ${m.content}`)
      .join("\n\n---\n\n");
    
    const blob = new Blob([history], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-gdd-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sendChatMessage = async (messageText: string) => {
    const thinkingMessage: Message = {
      id: "thinking",
      role: "assistant",
      content: "💭 Pensando...",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, thinkingMessage]);

    try {
      const contextPrompt = Object.keys(gameInfo).length > 0 
        ? `\n\nINFORMAÇÕES DO JOGO ATÉ AGORA:\n${JSON.stringify(gameInfo, null, 2)}\n\nUse essas informações para dar sugestões proativas e relevantes!`
        : "";

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages
            .filter((m) => m.id !== "welcome" && m.id !== "thinking")
            .map((m) => ({ role: m.role, content: m.content }))
            .concat([{ role: "user", content: messageText + contextPrompt }]),
        }),
      });

      if (!response.ok) throw new Error("Erro no chat");

      const data = await response.json();

      // Extract game info from user input AND AI response
      const lowerInput = messageText.toLowerCase();
      const lowerResponse = data.message.toLowerCase();
      const combinedText = lowerInput + " " + lowerResponse;
      const updatedInfo = { ...gameInfo };
      
      // Genre detection (mais abrangente)
      if (!updatedInfo.genre) {
        if (combinedText.includes("roguelike")) updatedInfo.genre = "Roguelike";
        else if (combinedText.includes("plataforma") || combinedText.includes("platformer")) updatedInfo.genre = "Platformer";
        else if (combinedText.includes("puzzle")) updatedInfo.genre = "Puzzle";
        else if (combinedText.includes("rpg")) updatedInfo.genre = "RPG";
        else if (combinedText.includes("fazenda") || combinedText.includes("farming") || combinedText.includes("colheita feliz") || combinedText.includes("stardew")) updatedInfo.genre = "Farming/Simulação";
        else if (combinedText.includes("ação")) updatedInfo.genre = "Ação";
        else if (combinedText.includes("aventura")) updatedInfo.genre = "Aventura";
        else if (combinedText.includes("estratégia")) updatedInfo.genre = "Estratégia";
      }
      
      // Platform
      if (!updatedInfo.platform) {
        if (combinedText.includes("mobile") || combinedText.includes("celular")) updatedInfo.platform = "Mobile";
        else if (combinedText.includes("pc") || combinedText.includes("computador")) updatedInfo.platform = "PC";
        else if (combinedText.includes("console")) updatedInfo.platform = "Console";
        else if (combinedText.includes("web") || combinedText.includes("browser")) updatedInfo.platform = "Web";
      }
      
      // Visual Style
      if (!updatedInfo.style) {
        if (combinedText.includes("pixel art") || combinedText.includes("pixelado") || combinedText.includes("8-bit")) updatedInfo.style = "Pixel Art";
        else if (combinedText.includes("3d")) updatedInfo.style = "3D";
        else if (combinedText.includes("cartoon") || combinedText.includes("colorido")) updatedInfo.style = "Cartoon";
        else if (combinedText.includes("2d simples") || combinedText.includes("minimalista")) updatedInfo.style = "2D Simples";
      }
      
      // Target audience
      if (!updatedInfo.target) {
        if (combinedText.includes("casual")) updatedInfo.target = "Casual";
        else if (combinedText.includes("hardcore") || combinedText.includes("difícil")) updatedInfo.target = "Hardcore";
        else if (combinedText.includes("infantil") || combinedText.includes("criança")) updatedInfo.target = "Infantil";
        else if (combinedText.includes("família")) updatedInfo.target = "Família";
      }

      setGameInfo(updatedInfo);

      const quickReplies = extractQuickReplies(data.message);

      const chatMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
        quickReplies: quickReplies.length > 0 ? quickReplies : undefined,
      };

      setMessages((prev) => prev.filter((m) => m.id !== "thinking").concat([chatMessage]));
    } catch (error: any) {
      let errorContent = "Desculpa, travei aqui! 😅 Pode repetir?";
      
      // Try to get error details from API response
      const errorDetails = error?.response?.data?.details || error?.message || "";
      
      // Check for rate limit error
      if (errorDetails.includes("rate_limit") || errorDetails.includes("429") || errorDetails.includes("Rate limit")) {
        errorContent = "⏰ **Limite de uso diário atingido!**\n\nO Groq oferece 100.000 tokens grátis por dia e você já usou quase tudo hoje! 🎉\n\n**Opções:**\n• ⏳ Aguarde alguns minutos (~6min) e tente novamente\n• 📅 Volte amanhã com o limite resetado\n• 💎 Faça upgrade no Groq para mais tokens\n\n*Relaxa, você não fez nada errado! Limite diário é normal em APIs grátis.* 😊";
      } else if (errorDetails.includes("API key") || errorDetails.includes("401") || errorDetails.includes("Unauthorized")) {
        errorContent = "🔑 **Problema com a chave da API!**\n\nParece que a chave do Groq está inválida ou expirou.\n\nVerifique o arquivo `.env.local` e sua chave em: https://console.groq.com/keys";
      } else if (errorDetails.includes("network") || errorDetails.includes("fetch") || errorDetails.includes("ECONNREFUSED")) {
        errorContent = "🌐 **Problema de conexão!**\n\nNão consegui conectar com o servidor da IA. Verifica tua internet? 📡";
      }
      
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: errorContent,
        timestamp: new Date(),
      };
      setMessages((prev) => prev.filter((m) => m.id !== "thinking").concat([errorMessage]));
    }
    setIsGenerating(false);
  };

  const extractQuickReplies = (message: string): string[] => {
    const lower = message.toLowerCase();
    
    // PRIORIDADE 1: Pode gerar GDD (sempre prioritário!)
    if (lower.includes("gerar") && (lower.includes("gdd") || lower.includes("documento"))) {
      return ["🚀 PODE GERAR!", "⏸️ Mais detalhes"];
    }
    
    // PRIORIDADE 2: Extrai opções entre aspas ("X" ou "Y" ou "Z")
    const quotedOptions = message.match(/"([^"]+)"/g);
    if (quotedOptions && quotedOptions.length >= 2) {
      const cleanOptions = quotedOptions
        .map(q => q.replace(/"/g, ''))
        .slice(0, 4); // Max 4 opções
      
      if (cleanOptions.length >= 2) {
        return cleanOptions;
      }
    }
    
    // PRIORIDADE 3: Detecção de lista "X, Y ou Z"
    // Ex: "combate, exploração ou sobrevivência"
    const listPattern = /(\w+(?:\s+\w+){0,2}),\s+(\w+(?:\s+\w+){0,2})\s+ou\s+(\w+(?:\s+\w+){0,2})/i;
    const listMatch = message.match(listPattern);
    
    if (listMatch && listMatch.length >= 4) {
      const options = [listMatch[1], listMatch[2], listMatch[3]]
        .map(opt => opt.trim().charAt(0).toUpperCase() + opt.trim().slice(1))
        .filter(opt => opt.length > 2 && opt.length < 30);
      
      if (options.length >= 3) {
        return [...options, "🔥 Mix de tudo"];
      }
    }
    
    // PRIORIDADE 4: Detecção GENÉRICA com ", ou"
    if (lower.includes(" ou ")) {
      // Padrão: "X, ou Y"
      const pattern1 = /([^.,!?\n]{10,80}),\s+ou\s+([^.,!?\n]{10,80})/i;
      const match1 = message.match(pattern1);
      
      if (match1) {
        const opt1 = match1[1].trim().replace(/^(manter|fazer|ter|usar|incluir|adicionar)\s+/i, '');
        const opt2 = match1[2].trim().replace(/^(manter|fazer|ter|usar|vai|para)\s+/i, '');
        
        if (opt1.length > 5 && opt2.length > 5 && opt1.length < 70 && opt2.length < 70) {
          return [
            opt1.charAt(0).toUpperCase() + opt1.slice(1),
            opt2.charAt(0).toUpperCase() + opt2.slice(1),
            "🔥 Mix dos dois"
          ];
        }
      }
    }
    
    // PRIORIDADE 3: Perguntas sobre ADICIONAR/INCLUIR features (sem "ou")
    if ((lower.includes("adicionar") || lower.includes("incluir") || lower.includes("opinião sobre")) && 
        !lower.includes(", ou")) {
      
      // Personagens/NPCs
      if (lower.includes("personagens") || lower.includes("npcs")) {
        return ["👥 Sim, com personagens!", "🌾 Não, só farming", "🤔 Talvez depois"];
      }
      
      // Variedade de plantas/culturas
      if (lower.includes("plantas") || lower.includes("culturas")) {
        return ["🌱 Muitas variedades!", "🌾 Poucas (simples)", "📊 Quantidade média"];
      }
      
      // Genérico para adicionar features
      return ["✅ Sim, adiciona!", "❌ Não precisa", "🤔 Talvez"];
    }
    
    // PRIORIDADE 4: Padrões específicos do jogo
    
    // Farming - plantio + animais
    if ((lower.includes("plantio") || lower.includes("culturas")) && 
        (lower.includes("bichinhos") || lower.includes("animais"))) {
      return ["🌱 Só plantio", "🐄 Plantio + animais", "🏡 Completo"];
    }
    
    // Casual vs Estratégia
    if ((lower.includes("casual") && lower.includes("estratégia")) || 
        (lower.includes("click") && lower.includes("gerenciar"))) {
      return ["🎮 Casual", "🧠 Estratégia", "🔥 Mix"];
    }
    
    // Estilo visual (APENAS se mencionar explicitamente visual/arte)
    if ((lower.includes("estilo visual") || lower.includes("arte") || lower.includes("gráfico")) && 
        (lower.includes("pixel") || lower.includes("cartoon") || lower.includes("3d"))) {
      return ["🎨 Pixel Art", "🌈 Cartoon", "📷 Realista"];
    }
    
    // Plataforma
    if (lower.includes("plataforma") || (lower.includes("mobile") && lower.includes("pc"))) {
      return ["📱 Mobile", "💻 PC", "🌐 Multi"];
    }
    
    // Progressão
    if (lower.includes("progressão") || lower.includes("níveis") || lower.includes("desbloquear")) {
      return ["📈 Com progressão", "🎯 Sandbox", "🔓 Misto"];
    }
    
    // Multiplayer
    if (lower.includes("multiplayer") || lower.includes("cooperativo") || lower.includes("online")) {
      return ["🤝 Multiplayer", "🧍 Solo", "👥 Opcional"];
    }
    
    return [];
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🤖</span>
            <div>
              <h1 className="text-xl font-bold text-white">Criar GDD com IA</h1>
              <p className="text-sm text-gray-400">Só descreva sua ideia, eu faço o resto!</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {messages.length > 2 && (
              <button
                onClick={exportChatHistory}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                title="Exportar histórico do chat"
              >
                💾 Exportar Chat
              </button>
            )}
            <button
              onClick={() => router.push("/")}
              className="text-gray-400 hover:text-white transition-colors text-xl"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Preview Box */}
          {Object.keys(gameInfo).length > 0 && !template && (
            <div className="bg-blue-900/30 border-2 border-blue-500/50 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">📋</span>
                <h3 className="font-bold text-blue-300">Resumo até agora:</h3>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {gameInfo.genre && (
                  <div className="bg-gray-800/50 rounded-lg px-3 py-2">
                    <span className="text-gray-400">Gênero:</span>
                    <span className="ml-2 text-white font-semibold">{gameInfo.genre}</span>
                  </div>
                )}
                {gameInfo.platform && (
                  <div className="bg-gray-800/50 rounded-lg px-3 py-2">
                    <span className="text-gray-400">Plataforma:</span>
                    <span className="ml-2 text-white font-semibold">{gameInfo.platform}</span>
                  </div>
                )}
                {gameInfo.style && (
                  <div className="bg-gray-800/50 rounded-lg px-3 py-2">
                    <span className="text-gray-400">Estilo:</span>
                    <span className="ml-2 text-white font-semibold">{gameInfo.style}</span>
                  </div>
                )}
                {gameInfo.target && (
                  <div className="bg-gray-800/50 rounded-lg px-3 py-2">
                    <span className="text-gray-400">Público:</span>
                    <span className="ml-2 text-white font-semibold">{gameInfo.target}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-6 py-4 ${
                  message.role === "user"
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                    : "bg-gray-800 text-gray-100 shadow-xl border border-gray-700"
                }`}
              >
                <div className="whitespace-pre-wrap leading-relaxed">
                  {message.content.split("\n").map((line, i) => {
                    const boldRegex = /\*\*(.*?)\*\*/g;
                    const parts = line.split(boldRegex);
                    return (
                      <p key={i} className="mb-2 last:mb-0">
                        {parts.map((part, j) =>
                          j % 2 === 1 ? (
                            <strong key={j} className={message.role === "user" ? "text-white" : "text-blue-400"}>
                              {part}
                            </strong>
                          ) : (
                            part
                          )
                        )}
                      </p>
                    );
                  })}
                </div>
                <p
                  className={`text-xs mt-2 ${
                    message.role === "user" ? "text-blue-200" : "text-gray-500"
                  }`}
                >
                  {message.timestamp.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>

                {/* Quick Reply Buttons */}
                {message.role === "assistant" && message.quickReplies && message.id === messages[messages.length - 1]?.id && !isGenerating && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {message.quickReplies.map((reply: string, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => handleQuickReply(reply)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-medium transition-all transform hover:scale-105 shadow-md hover:shadow-lg"
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {template && (
            <div className="flex justify-center">
              <button
                onClick={handleCreateProject}
                className="px-8 py-4 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-xl font-bold text-lg hover:from-green-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                🚀 Criar Projeto Agora!
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-gray-800 border-t border-gray-700 p-4 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Descreva seu jogo aqui... (ex: 'Quero fazer um RPG 2D com combate por turnos')"
              className="flex-1 resize-none rounded-xl border-2 border-gray-700 bg-gray-900 text-white placeholder-gray-500 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[60px] max-h-[200px]"
              rows={2}
              disabled={isGenerating}
            />
            <button
              onClick={handleSend}
              disabled={isGenerating || !input.trim()}
              className="px-6 py-3 h-[60px] bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold shadow-md hover:shadow-lg"
            >
              {isGenerating ? "🤖..." : "Enviar ✨"}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            💡 Dica: Quanto mais detalhes, melhor o resultado! Enter para enviar, Shift+Enter para nova linha.
          </p>
        </div>
      </div>
    </div>
  );
}
