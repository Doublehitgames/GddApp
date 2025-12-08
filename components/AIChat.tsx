"use client";

import { useState, useRef, useEffect } from "react";
import { AIMessage } from "@/types/ai";
import { useProjectStore } from "@/store/projectStore";

interface AIChatProps {
  projectContext?: {
    projectId: string;
    projectTitle: string;
    sections: Array<{
      id: string;
      title: string;
      content?: string;
    }>;
  };
  onClose?: () => void;
  isOpen?: boolean;
}

interface ChatMessage extends AIMessage {
  id: string;
  timestamp: Date;
  isLoading?: boolean;
}

export default function AIChat({ projectContext, onClose, isOpen = true }: AIChatProps) {
  const addSection = useProjectStore((state) => state.addSection);
  const addSubsection = useProjectStore((state) => state.addSubsection);
  const editSection = useProjectStore((state) => state.editSection);
  const removeSection = useProjectStore((state) => state.removeSection);
  const getProject = useProjectStore((state) => state.getProject);
  
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: projectContext 
        ? `Olá! Estou aqui para ajudar com o projeto **${projectContext.projectTitle}**. Posso:\n\n- ✨ Criar novas seções e subseções\n- ✏️ Editar conteúdo existente\n- 🗑️ Remover seções\n- 💡 Responder dúvidas sobre GDD\n\n**Dica:** Vou sempre explicar o que vou fazer e pedir sua confirmação antes de modificar o projeto! 😊\n\nComo posso ajudar?`
        : "Olá! Sou seu assistente de GDD. Descreva o tipo de jogo que quer criar e vou gerar uma estrutura completa para você!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('llama-3.3-70b-versatile');
  const [autoSwitchedModel, setAutoSwitchedModel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Carrega modelo salvo do localStorage na inicialização
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedModel = localStorage.getItem('ai-model-preference');
      if (savedModel) {
        setSelectedModel(savedModel);
      }
    }
  }, []);

  // Detecção automática inicial: testa se modelo premium está disponível
  useEffect(() => {
    const testModelAvailability = async () => {
      // Só testa se ainda não trocamos manualmente e estamos no modelo premium
      if (autoSwitchedModel || selectedModel !== 'llama-3.3-70b-versatile') return;
      
      try {
        const endpoint = projectContext ? "/api/ai/chat-with-tools" : "/api/ai/chat";
        const testResponse = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: "test" }],
            projectContext,
            model: 'llama-3.3-70b-versatile',
          }),
        });

        // Se der rate limit, troca automaticamente
        if (!testResponse.ok) {
          const errorText = await testResponse.text();
          if (testResponse.status === 429 && errorText.includes('rate_limit_exceeded')) {
            console.log('Modelo premium indisponível, usando modelo rápido...');
            setSelectedModel('llama-3.1-8b-instant');
            setAutoSwitchedModel(true);
            
            // Atualiza mensagem de boas-vindas
            setMessages([{
              id: "welcome",
              role: "assistant",
              content: projectContext 
                ? `⚡ Modelo premium atingiu limite diário. Usando **Llama 3.1 8B** (rápido e funcional)!\n\nOlá! Estou aqui para ajudar com o projeto **${projectContext.projectTitle}**. Posso:\n\n- ✨ Criar novas seções e subseções\n- ✏️ Editar conteúdo existente\n- 🗑️ Remover seções\n- 💡 Responder dúvidas sobre GDD\n\n**Dica:** Vou sempre explicar o que vou fazer e pedir sua confirmação antes de modificar o projeto! 😊\n\nComo posso ajudar?`
                : "⚡ Modelo premium atingiu limite. Usando Llama 3.1 8B (rápido)!\n\nOlá! Sou seu assistente de GDD. Descreva o tipo de jogo que quer criar!",
              timestamp: new Date(),
            }]);
          }
        }
      } catch (error) {
        // Ignora erros de teste - não queremos bloquear a UI
        console.log('Erro ao testar modelo, mantendo seleção atual:', error);
      }
    };

    // Executa teste apenas uma vez ao montar
    testModelAvailability();
  }, []); // Dependências vazias = executa só na montagem

  // Salva preferência de modelo
  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    setAutoSwitchedModel(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai-model-preference', model);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Add loading message
    const loadingMessage: ChatMessage = {
      id: "loading",
      role: "assistant",
      content: "Pensando...",
      timestamp: new Date(),
      isLoading: true,
    };
    setMessages((prev) => [...prev, loadingMessage]);

    try {
      // Usa a nova API com tools se tiver projectContext
      const endpoint = projectContext ? "/api/ai/chat-with-tools" : "/api/ai/chat";
      
      // Otimização: limita histórico a últimas 10 mensagens para economizar tokens
      const recentMessages = messages
        .filter((m) => !m.isLoading)
        .slice(-10) // Apenas últimas 10 mensagens
        .map((m) => ({ role: m.role, content: m.content }))
        .concat([{ role: "user", content: input.trim() }]);
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: recentMessages,
          projectContext,
          model: selectedModel, // Envia modelo selecionado
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        
        // Tenta parsear erro JSON
        let errorData: any = {};
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        
        // Rate limit específico para Groq - tenta fallback automático
        // Detecta tanto 429 quanto 500 com rate_limit (backend às vezes retorna 500)
        const isRateLimit = 
          response.status === 429 || 
          errorData.errorType === 'rate_limit' ||
          errorText.includes('rate_limit_exceeded') ||
          errorText.includes('Limite de uso');
        
        if (isRateLimit) {
          // Detecta tipo de limite
          const isPerMinute = errorData.limitType === 'per_minute' || errorText.includes('per minute');
          const isPerDay = errorData.limitType === 'per_day' || errorText.includes('per day');
          const waitTime = errorData.waitTime || 'alguns instantes';
          
          // Se estamos no modelo premium e é limite diário, tenta fallback
          if (selectedModel === 'llama-3.3-70b-versatile' && !autoSwitchedModel && isPerDay) {
            console.log('Rate limit diário no modelo premium, tentando modelo rápido...');
            setSelectedModel('llama-3.1-8b-instant');
            setAutoSwitchedModel(true);
            
            // Adiciona mensagem informativa
            const switchMessage: ChatMessage = {
              id: `switch-${Date.now()}`,
              role: 'assistant',
              content: '⚡ Modelo premium atingiu limite diário. Mudando automaticamente para **Llama 3.1 8B** (mais rápido). Você pode mudar manualmente depois.',
              timestamp: new Date(),
            };
            setMessages((prev) => prev.filter((m) => !m.isLoading).concat([switchMessage]));
            
            // Aguarda um momento e tenta novamente com novo modelo
            await new Promise(resolve => setTimeout(resolve, 500));
            setIsLoading(false);
            return; // Usuário precisará enviar novamente
          }
          
          // Se é limite por minuto, apenas informa para aguardar (não faz fallback)
          if (isPerMinute) {
            throw new Error(`⏱️ Limite de requisições por minuto atingido. Aguarde ${waitTime} e tente novamente.\n\n💡 Dica: O modelo está processando muitas mensagens rapidamente. Dê um tempo!`);
          }
          
          // Limite diário sem fallback disponível
          throw new Error(errorData.error || `⏱️ Limite de uso da API atingido. Por favor, aguarde ${waitTime} ou troque manualmente para outro modelo.`);
        }
        
        throw new Error(`API Error ${response.status}: ${errorText.substring(0, 200)}`);
      }

      const data = await response.json();

      // Remove loading message
      setMessages((prev) => prev.filter((m) => !m.isLoading));

      const message = data.message || data.content || "Desculpe, não entendi.";

      // Sistema de comandos simples - muito mais confiável que JSON
      const commandsMatch = message.match(/\[EXECUTAR\]([\s\S]*?)(?=\n\n|$)/);
      
      if (commandsMatch && projectContext) {
        const commands = commandsMatch[1].trim().split('\n').filter(cmd => cmd.trim());
        const results: string[] = [];
        let successCount = 0;
        const createdSections: Map<string, string> = new Map(); // title -> id
        
        for (const command of commands) {
          const trimmed = command.trim();
          
          try {
            // CRIAR: título | conteúdo
            if (trimmed.startsWith('CRIAR:')) {
              const parts = trimmed.substring(6).split('|').map(p => p.trim());
              if (parts.length >= 2) {
                const [title, content] = parts;
                const newId = addSection(projectContext.projectId, title, content);
                createdSections.set(title, newId);
                results.push(`✅ Criou: ${title}`);
                successCount++;
              }
            }
            // SUBSECAO: título | pai | conteúdo
            else if (trimmed.startsWith('SUBSECAO:')) {
              const parts = trimmed.substring(9).split('|').map(p => p.trim());
              if (parts.length >= 3) {
                const [title, parentTitle, content] = parts;
                const parentId = createdSections.get(parentTitle) || 
                  projectContext.sections.find(s => s.title === parentTitle)?.id;
                
                if (parentId) {
                  addSubsection(projectContext.projectId, parentId, title, content);
                  results.push(`✅ Criou subseção: ${title} em ${parentTitle}`);
                  successCount++;
                } else {
                  results.push(`❌ Não encontrou seção pai: ${parentTitle}`);
                }
              }
            }
            // EDITAR: id | novo conteúdo
            else if (trimmed.startsWith('EDITAR:')) {
              const parts = trimmed.substring(7).split('|').map(p => p.trim());
              if (parts.length >= 2) {
                const [sectionId, newContent] = parts;
                const section = projectContext.sections.find(s => s.id === sectionId);
                if (section) {
                  editSection(projectContext.projectId, sectionId, section.title, newContent);
                  results.push(`✅ Editou: ${section.title}`);
                  successCount++;
                } else {
                  results.push(`❌ Seção não encontrada: ${sectionId}`);
                }
              }
            }
            // REMOVER: id
            else if (trimmed.startsWith('REMOVER:')) {
              const sectionId = trimmed.substring(8).trim();
              const section = projectContext.sections.find(s => s.id === sectionId);
              if (section) {
                removeSection(projectContext.projectId, sectionId);
                results.push(`✅ Removeu: ${section.title}`);
                successCount++;
              } else {
                results.push(`❌ Seção não encontrada: ${sectionId}`);
              }
            }
          } catch (err) {
            console.error('Error executing command:', trimmed, err);
            results.push(`❌ Erro ao executar: ${trimmed}`);
          }
        }

        // Atualiza o contexto
        const updatedProject = getProject(projectContext.projectId);
        if (updatedProject) {
          projectContext.sections = updatedProject.sections || [];
        }

        // Mostra resultado
        const cleanMessage = message.replace(/\[EXECUTAR\][\s\S]*?(?=\n\n|$)/, '').trim();
        const resultSummary = results.join('\n');
        
        const assistantMessage: ChatMessage = {
          id: Date.now().toString(),
          role: "assistant",
          content: `${resultSummary}\n\n**${successCount} de ${commands.length} ações executadas!**\n\n${cleanMessage}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        
      } else {
        // Resposta normal sem comandos
        const assistantMessage: ChatMessage = {
          id: Date.now().toString(),
          role: "assistant",
          content: message,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      
      // Mensagem de erro formatada
      const errorText = error instanceof Error ? error.message : 'Erro desconhecido';
      const isRateLimit = errorText.includes('Limite') || errorText.includes('⏱️');
      
      let content = '';
      if (isRateLimit) {
        // Formatação especial para rate limits
        content = `## ⏱️ Rate Limit Atingido\n\n${errorText}\n\n---\n\n**O que fazer?**\n- ⏰ Aguarde o tempo indicado\n- 🔄 Troque de modelo no dropdown acima\n- 💡 Modelos têm limites separados por minuto e por dia`;
      } else {
        // Erro genérico
        content = `❌ Desculpe, ocorreu um erro ao processar sua mensagem.\n\n${errorText}\n\nTente reformular ou pergunte de outra forma.`;
      }
      
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content,
        timestamp: new Date(),
      };
      setMessages((prev) => prev.filter((m) => !m.isLoading).concat([errorMessage]));
    } finally {
      setIsLoading(false);
    }
  };

  const executeToolCall = async (toolCall: any) => {
    const { name, arguments: args } = toolCall;

    if (!projectContext) {
      return {
        success: false,
        message: "❌ Contexto do projeto não disponível.",
      };
    }

    try {
      // Valida a ação com a API
      const response = await fetch("/api/ai/execute-tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolName: name,
          arguments: args,
          projectContext,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to execute tool");
      }

      const result = await response.json();
      
      if (!result.success) {
        return result;
      }

      // Executa a ação no Zustand store
      switch (result.action) {
        case 'add_section':
          if (result.data.parentId && result.data.parentId !== null && result.data.parentId !== 'null') {
            addSubsection(
              projectContext.projectId, 
              result.data.parentId, 
              result.data.title,
              result.data.content
            );
          } else {
            addSection(
              projectContext.projectId, 
              result.data.title,
              result.data.content
            );
          }
          break;

        case 'edit_section':
          editSection(
            projectContext.projectId,
            result.data.sectionId,
            result.data.title,
            result.data.content
          );
          break;

        case 'remove_section':
          removeSection(projectContext.projectId, result.data.sectionId);
          break;

        case 'list_sections':
          // Não faz nada no store, apenas retorna a mensagem
          break;
      }

      return result;
    } catch (error) {
      console.error("Tool execution error:", error);
      return {
        success: false,
        message: "❌ Erro ao executar a ferramenta. Tente novamente.",
      };
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🤖</span>
          <div>
            <h3 className="font-semibold text-gray-900">Assistente AI</h3>
            <p className="text-xs text-gray-500">Powered by IA</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Fechar chat"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-4 py-2 ${
                message.role === "user"
                  ? "bg-blue-600 text-white"
                  : message.isLoading
                  ? "bg-gray-100 text-gray-500 animate-pulse"
                  : "bg-gray-100 text-gray-900"
              }`}
            >
              {message.role === "assistant" && !message.isLoading ? (
                <div className="prose prose-sm max-w-none">
                  {message.content.split("\n").map((line, i) => {
                    // Simple markdown parsing
                    const boldRegex = /\*\*(.*?)\*\*/g;
                    const parts = line.split(boldRegex);
                    return (
                      <p key={i} className="mb-1 last:mb-0">
                        {parts.map((part, j) =>
                          j % 2 === 1 ? <strong key={j}>{part}</strong> : part
                        )}
                      </p>
                    );
                  })}
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{message.content}</p>
              )}
              <p
                className={`text-xs mt-1 ${
                  message.role === "user" ? "text-blue-200" : "text-gray-400"
                }`}
              >
                {message.timestamp.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        {/* Seletor de Modelo */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1">
            <label htmlFor="model-select" className="text-sm font-medium text-gray-700">
              🤖 Modelo:
            </label>
            <select
              id="model-select"
              value={selectedModel}
              onChange={(e) => handleModelChange(e.target.value)}
              disabled={isLoading}
              className="text-sm rounded-md border border-gray-300 bg-white px-3 py-1.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="llama-3.3-70b-versatile">
                Llama 3.3 70B (Premium) - Melhor qualidade
              </option>
              <option value="llama-3.1-8b-instant">
                Llama 3.1 8B (Rápido) - Mais econômico
              </option>
            </select>
            {autoSwitchedModel && (
              <span className="text-xs text-amber-600 flex items-center gap-1">
                ⚡ Mudado automaticamente
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            ⚠️ Cada modelo tem limites: <strong>por minuto</strong> e <strong>por dia</strong>. Se atingir, aguarde alguns segundos/minutos.
          </p>
        </div>
        
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem... (Enter para enviar)"
            className="flex-1 resize-none rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={2}
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isLoading ? "..." : "Enviar"}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          💡 Dica: Shift+Enter para nova linha | Modelo é salvo automaticamente
        </p>
      </div>
    </div>
  );
}
