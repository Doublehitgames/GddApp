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
  model?: string;
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
  const [selectedModel, setSelectedModel] = useState<string>("llama-3.3-70b-versatile");
  const [isCheckingModel, setIsCheckingModel] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasCheckedModel = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Check if premium model is available on mount
  useEffect(() => {
    const checkModelAvailability = async () => {
      if (hasCheckedModel.current) return; // Prevent duplicate checks (React Strict Mode)
      hasCheckedModel.current = true;
      
      try {
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              { role: "system", content: "Test" },
              { role: "user", content: "Hi" }
            ],
            model: "llama-3.3-70b-versatile",
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg = errorData.details || errorData.error || "";
          
          // If rate limit, switch to 8B automatically
          if (errorMsg.includes("429") || errorMsg.includes("rate_limit") || errorMsg.includes("Rate limit")) {
            setSelectedModel("llama-3.1-8b-instant");
            
            // Add notification message BEFORE welcome message
            const notificationMessage: Message = {
              id: "model-fallback-init",
              role: "assistant",
              content: "⚡ **Modo Econômico Ativado**\n\nDetectei que o modelo potente atingiu o limite de tokens. Estou usando o modelo econômico que tem mais tokens disponíveis!\n\nA qualidade é um pouco menor, mas você pode continuar criando seu GDD sem problemas. 😊",
              timestamp: new Date(),
            };
            // Insert notification BEFORE welcome message (index 0)
            setMessages((prev) => [notificationMessage, ...prev]);
          }
        }
      } catch (error) {
        console.log("Model check failed, keeping default");
      } finally {
        setIsCheckingModel(false);
      }
    };

    checkModelAvailability();
  }, []);

  const generateGDD = async (triggerMessage: string) => {
    const thinkingMessage: Message = {
      id: "thinking",
      role: "assistant",
      content: "🤖 Bora lá! Deixa eu criar esse GDD pra você...",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, thinkingMessage]);

    // Build complete conversation context
    const conversationContext = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}`)
      .join('\n\n');
    
    const fullDescription = conversationContext + '\n\nÚltima mensagem: ' + triggerMessage;

    try {
      const response = await fetch("/api/ai/generate-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameType: "Jogo descrito pelo usuário",
          description: fullDescription,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ details: 'Unknown error' }));
        throw new Error(errorData.details || errorData.error || 'Erro ao gerar template');
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
      // Try to get error details - check response body first, then error message
      let errorDetails = "";
      if (error instanceof Error) {
        errorDetails = error.message;
      }
      
      console.error('❌ Generate error:', error);
      console.error('❌ Error details extracted:', errorDetails);
      
      // Check for rate limit error
      const isRateLimit = errorDetails.includes("rate_limit") || errorDetails.includes("429") || errorDetails.includes("Rate limit");
      
      if (isRateLimit && selectedModel === "llama-3.3-70b-versatile") {
        // FALLBACK AUTOMÁTICO: Troca pro 8B e tenta novamente
        console.log("🔄 Rate limit detected on generation! Switching to 8B model and retrying...");
        
        setSelectedModel("llama-3.1-8b-instant");
        
        // Add notification message
        const notificationMessage: Message = {
          id: Date.now().toString() + "-fallback-gen",
          role: "assistant",
          content: "⚡ **Trocando para Modo Econômico**\n\nO modelo potente atingiu o limite. Vou gerar seu GDD com o modelo econômico agora! Um momento... 🤖",
          timestamp: new Date(),
        };
        setMessages((prev) => prev.filter((m) => m.id !== "thinking").concat([notificationMessage]));
        
        // Retry with 8B model
        try {
          const retryResponse = await fetch("/api/ai/generate-template", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              gameType: "Jogo descrito pelo usuário",
              description: fullDescription,
              model: "llama-3.1-8b-instant",
            }),
          });

          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            setTemplate(retryData.template);

            const successMessage: Message = {
              id: Date.now().toString(),
              role: "assistant",
              content: `✨ Pronto! Criei um GDD completo para **${retryData.template.projectTitle}**!\n\n📚 **${retryData.template.sections.length} seções criadas:**\n${retryData.template.sections.map((s: any) => `• ${s.title}`).join("\n")}\n\nE aí, o que achou? Se quiser mudar algo é só me falar! Quando estiver satisfeito, clica no botão verde aí embaixo pra criar o projeto! 👇`,
              timestamp: new Date(),
            };

            setMessages((prev) => prev.filter((m) => m.id !== "thinking").concat([successMessage]));
            setIsGenerating(false);
            return; // Success! Exit early
          }
        } catch (retryError) {
          console.error("Retry generation with 8B also failed:", retryError);
        }
      }
      
      // If not rate limit or retry failed, show error message
      let errorContent = "❌ Eita, deu ruim aqui! 😅 Tenta descrever de novo?";
      
      if (isRateLimit) {
        errorContent = "⏰ **Limite de uso diário atingido!**\n\nAmbos os modelos (potente e econômico) atingiram o limite de tokens.\n\n**Opções:**\n• ⏳ Aguarde alguns minutos e tente novamente\n• 📅 Volte amanhã com o limite resetado\n• 💎 Faça upgrade no Groq para mais tokens";
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

    // Always send to chat first - let AI decide if it's a generation request
    await sendChatMessage(currentInput);
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
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages
            .filter((m) => m.id !== "welcome" && m.id !== "thinking")
            .map((m) => ({ role: m.role, content: m.content }))
            .concat([{ role: "user", content: messageText }]),
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ details: 'Unknown error' }));
        throw new Error(errorData.details || errorData.error || 'Erro no chat');
      }

      const data = await response.json();

      // Check if AI wants to generate GDD
      const shouldGenerate = data.message.includes("[GENERATE_GDD]");
      const cleanMessage = data.message.replace("[GENERATE_GDD]", "").trim();

      const quickReplies = extractQuickReplies(cleanMessage);

      const chatMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: cleanMessage,
        timestamp: new Date(),
        quickReplies: quickReplies.length > 0 ? quickReplies : undefined,
        model: selectedModel,
      };

      setMessages((prev) => prev.filter((m) => m.id !== "thinking").concat([chatMessage]));
      
      // If AI decided to generate, trigger generation
      if (shouldGenerate && !template) {
        setIsGenerating(true);
        await generateGDD(messageText);
      }
    } catch (error: any) {
      // Try to get error details - check response body first, then error message
      let errorDetails = "";
      if (error instanceof Error) {
        errorDetails = error.message;
      }
      
      console.error('❌ Chat error:', error);
      console.error('❌ Error details extracted:', errorDetails);
      
      // Check for rate limit error
      const isRateLimit = errorDetails.includes("rate_limit") || errorDetails.includes("429") || errorDetails.includes("Rate limit");
      
      if (isRateLimit && selectedModel === "llama-3.3-70b-versatile") {
        // FALLBACK AUTOMÁTICO: Troca pro 8B e tenta novamente
        console.log("🔄 Rate limit detected! Switching to 8B model and retrying...");
        
        setSelectedModel("llama-3.1-8b-instant");
        
        // Add notification message
        const notificationMessage: Message = {
          id: Date.now().toString() + "-fallback",
          role: "assistant",
          content: "⚡ **Trocando para Modo Econômico**\n\nO modelo potente atingiu o limite de tokens. Estou trocando automaticamente para o modelo econômico e vou responder sua pergunta agora! 😊",
          timestamp: new Date(),
        };
        setMessages((prev) => prev.filter((m) => m.id !== "thinking").concat([notificationMessage]));
        
        // Retry with 8B model
        try {
          const retryResponse = await fetch("/api/ai/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: messages
                .filter((m) => m.id !== "welcome" && m.id !== "thinking")
                .map((m) => ({ role: m.role, content: m.content }))
                .concat([{ role: "user", content: messageText }]),
              model: "llama-3.1-8b-instant",
            }),
          });

          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            const quickReplies = extractQuickReplies(retryData.message);

            const retryMessage: Message = {
              id: Date.now().toString(),
              role: "assistant",
              content: retryData.message,
              timestamp: new Date(),
              quickReplies: quickReplies.length > 0 ? quickReplies : undefined,
              model: "llama-3.1-8b-instant",
            };

            setMessages((prev) => [...prev, retryMessage]);
            setIsGenerating(false);
            return; // Success! Exit early
          }
        } catch (retryError) {
          console.error("Retry with 8B also failed:", retryError);
        }
      }
      
      // If not rate limit or retry failed, show error message
      let errorContent = "Desculpa, travei aqui! 😅 Pode repetir?";
      
      if (isRateLimit) {
        errorContent = "⏰ **Limite de uso diário atingido!**\n\nAmbos os modelos (potente e econômico) atingiram o limite de tokens por hoje.\n\n**Opções:**\n• ⏳ Aguarde alguns minutos e tente novamente\n• 📅 Volte amanhã com o limite resetado\n• 💎 Faça upgrade no Groq para mais tokens\n\n*Limite diário é normal em APIs grátis.* 😊";
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
            {/* Model Selector */}
            <div className="relative group">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className={`px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                  selectedModel === "llama-3.3-70b-versatile"
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-green-600 hover:bg-green-700 text-white"
                }`}
                title="Troca de modelo automaticamente se acabar os tokens"
              >
                <option value="llama-3.3-70b-versatile">🧠 Qualidade (70B)</option>
                <option value="llama-3.1-8b-instant">⚡ Rápido + Tokens (8B)</option>
              </select>
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-10">
                {selectedModel === "llama-3.3-70b-versatile" 
                  ? "🧠 Modelo potente (melhor qualidade). Se acabar os tokens, troco automaticamente pro econômico."
                  : "⚡ Modelo econômico (mais tokens disponíveis). Ótimo quando o potente atinge o limite."}
              </div>
            </div>
            
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
                <div className="flex items-center justify-between mt-2">
                  <p
                    className={`text-xs ${
                      message.role === "user" ? "text-blue-200" : "text-gray-500"
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {message.role === "assistant" && message.model && (
                    <span className="text-xs text-gray-600 bg-gray-700/50 px-2 py-0.5 rounded">
                      {message.model.includes("70b") ? "🧠 70B" : "⚡ 8B"}
                    </span>
                  )}
                </div>

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
