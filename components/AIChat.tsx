"use client";

import { useState, useRef, useEffect } from "react";
import { AIMessage, AIProvider } from "@/types/ai";
import { type Project, useProjectStore } from "@/store/projectStore";
import { useAIConfig } from "@/hooks/useAIConfig";
import AIConfigWarning from "@/components/AIConfigWarning";
import { useI18n } from "@/lib/i18n/provider";
import { assessThematicRelevance } from "@/utils/ai/thematicGuardrails";

interface AIChatProps {
  projectContext?: {
    projectId: string;
    projectTitle: string;
    projectDescription?: string;
    sections: Array<{
      id: string;
      title: string;
      content?: string;
      parentId?: string;
      domainTags?: string[];
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

type ValidationSeverity = "critical" | "warning" | "info";
type ValidationFilter = "all" | ValidationSeverity;
type ValidationWarning = {
  severity: ValidationSeverity;
  message: string;
};

interface PendingCommandExecution {
  commands: string[];
  cleanMessage: string;
  relevanceWarning: string | null;
  commandWarnings: ValidationWarning[];
}

type PlannedSectionCommand = {
  kind: "root" | "subsection";
  title: string;
  content: string;
  parentTitle?: string;
};

const DEFAULT_MODEL_BY_PROVIDER: Record<AIProvider, string> = {
  groq: "llama-3.3-70b-versatile",
  openai: "gpt-4o-mini",
  claude: "claude-3-5-sonnet-20241022",
};

const MODEL_OPTIONS_BY_PROVIDER: Record<AIProvider, Array<{ value: string; label: string }>> = {
  groq: [
    { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (Premium) - Melhor qualidade" },
    { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B (Rápido) - Mais econômico" },
  ],
  openai: [
    { value: "gpt-4o-mini", label: "GPT-4o mini (Rápido) - Mais econômico" },
    { value: "gpt-4o", label: "GPT-4o (Premium) - Melhor qualidade" },
    { value: "gpt-4.1-mini", label: "GPT-4.1 mini (Equilibrado)" },
    { value: "gpt-4.1", label: "GPT-4.1 (Premium) - Raciocínio avançado" },
  ],
  claude: [
    { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet - Melhor qualidade" },
    { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku - Mais econômico" },
  ],
};

export default function AIChat({ projectContext, onClose, isOpen = true }: AIChatProps) {
  const { config, hasValidConfig, getAIHeaders } = useAIConfig();
  const { locale, t } = useI18n();
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
  const [relationsLoading, setRelationsLoading] = useState(false);
  const [pendingExecution, setPendingExecution] = useState<PendingCommandExecution | null>(null);
  const [warningFilter, setWarningFilter] = useState<ValidationFilter>("all");
  const [criticalWarningsAcknowledged, setCriticalWarningsAcknowledged] = useState(false);
  const activeProvider: AIProvider = config?.provider || "groq";
  const modelOptions = MODEL_OPTIONS_BY_PROVIDER[activeProvider];
  const defaultModel = DEFAULT_MODEL_BY_PROVIDER[activeProvider];
  const [selectedModel, setSelectedModel] = useState<string>(defaultModel);
  const [autoSwitchedModel, setAutoSwitchedModel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Carrega modelo salvo por provider e valida opções disponíveis
  useEffect(() => {
    if (typeof window === "undefined") return;
    const providerKey = `ai-model-preference:${activeProvider}`;
    const savedModel =
      localStorage.getItem(providerKey) || localStorage.getItem("ai-model-preference");
    const isModelValid = !!savedModel && modelOptions.some((option) => option.value === savedModel);
    setSelectedModel(isModelValid ? savedModel! : defaultModel);
    setAutoSwitchedModel(false);
  }, [activeProvider, defaultModel, modelOptions]);

  // Garante consistência caso provider mude com modelo inválido
  useEffect(() => {
    const isValid = modelOptions.some((option) => option.value === selectedModel);
    if (!isValid) {
      setSelectedModel(defaultModel);
    }
  }, [selectedModel, modelOptions, defaultModel]);

  // Detecção automática inicial: testa se modelo premium está disponível
  useEffect(() => {
    const testModelAvailability = async () => {
      if (activeProvider !== "groq") return;
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

    testModelAvailability();
  }, [activeProvider, autoSwitchedModel, projectContext, selectedModel]);

  // Salva preferência de modelo
  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    setAutoSwitchedModel(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`ai-model-preference:${activeProvider}`, model);
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

  const parseExecutionCommands = (message: string): string[] => {
    const commandsMatch = message.match(/\[EXECUTAR\]([\s\S]*?)(?=\n\n|$)/);
    if (!commandsMatch) return [];
    return commandsMatch[1]
      .trim()
      .split("\n")
      .map((cmd) => cmd.trim())
      .filter(Boolean);
  };

  const splitCommandParts = (raw: string, prefixLength: number, expected: number): string[] | null => {
    const parts = raw
      .substring(prefixLength)
      .split("|")
      .map((part) => part.trim());
    return parts.length >= expected ? parts : null;
  };

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

  const parseJsonRecord = (rawJson: string): { data: Record<string, unknown> | null; error: string | null } => {
    try {
      const parsed = JSON.parse(rawJson) as unknown;
      if (!isRecord(parsed)) {
        return {
          data: null,
          error: t("projectDetail.aiChat.invalidJsonObject", "JSON inválido: esperado um objeto."),
        };
      }
      return { data: parsed, error: null };
    } catch {
      return {
        data: null,
        error: t("projectDetail.aiChat.invalidJsonSyntax", "JSON inválido: verifique aspas, vírgulas e chaves."),
      };
    }
  };

  const asString = (value: unknown, fallback = ""): string =>
    typeof value === "string" ? value : fallback;

  const asBoolean = (value: unknown, fallback: boolean): boolean =>
    typeof value === "boolean" ? value : fallback;

  const asFiniteNumber = (value: unknown, fallback: number): number => {
    const num = typeof value === "number" ? value : Number.NaN;
    return Number.isFinite(num) ? num : fallback;
  };

  const asPositiveInt = (value: unknown, fallback: number, min = 0): number =>
    Math.max(min, Math.floor(asFiniteNumber(value, fallback)));

  const classifyValidationSeverity = (message: string): ValidationSeverity => {
    const lower = message.toLowerCase();
    if (lower.includes("formato inválido") || lower.includes("json inválido")) return "critical";
    if (lower.includes("sugestão") || lower.includes("sem moeda válida")) return "critical";
    if (lower.includes("inválido removido") || lower.includes("foram removidos")) return "warning";
    return "info";
  };

  const toValidationWarning = (message: string, severity?: ValidationSeverity): ValidationWarning => ({
    severity: severity || classifyValidationSeverity(message),
    message,
  });

  const normalizeText = (value: string): string =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const isCurrencyLikeTitle = (title: string): boolean => {
    const normalized = normalizeText(title);
    return /\b(moeda|moedas|coin|coins|currency|currencies|diamante|diamond|gem|gems|ouro|gold|silver|prata)\b/i.test(
      normalized
    );
  };

  const isCurrencyContainerTitle = (title: string): boolean => {
    const normalized = normalizeText(title);
    return /\b(moedas|moeda|currency|currencies|coins|economia)\b/i.test(normalized);
  };

  const isInventoryLikeTitle = (title: string): boolean => {
    const normalized = normalizeText(title);
    return /\b(item|itens|seed|semente|sementes|arma|armas|weapon|weapons|equip|equipment|equipamento|equipamentos|recurso|recursos|loot|pet|pets|animal|animais|espada|espadas)\b/i.test(
      normalized
    );
  };

  const isPetLikeTitle = (title: string): boolean => {
    const normalized = normalizeText(title);
    return /\b(pet|pets|animal|animais|estimacao|estimação)\b/i.test(normalized);
  };

  const hasEconomyIntent = (text: string): boolean => {
    const normalized = normalizeText(text);
    return /\b(compra|compravel|comprável|comprar|venda|vendavel|vendável|vender|preco|preço|custo|loja|shop|buy|sell|price)\b/i.test(
      normalized
    );
  };

  const hasProductionIntent = (text: string): boolean => {
    const normalized = normalizeText(text);
    return /\b(producao|produção|produzir|produz|passiv|recipe|receita|craft|crafting|ingrediente|ingredientes|output|outputs)\b/i.test(
      normalized
    );
  };

  const hasProgressionIntent = (text: string): boolean => {
    const normalized = normalizeText(text);
    return /\b(xp|nivel|nível|level|levels|progressao|progressão|desbloqueio|unlock)\b/i.test(normalized);
  };

  const validateExecutionCommands = (commands: string[]): ValidationWarning[] => {
    if (!projectContext) return [];
    const warnings: ValidationWarning[] = [];
    const project = getProject(projectContext.projectId);
    if (!project) return warnings;

    for (const command of commands) {
      const trimmed = command.trim();
      if (trimmed.startsWith("EDITAR:") || trimmed.startsWith("REMOVER:")) {
        const prefixLength = trimmed.startsWith("EDITAR:") ? 7 : 8;
        const sectionId = trimmed.substring(prefixLength).split("|")[0]?.trim();
        if (sectionId && !(project.sections || []).some((s) => s.id === sectionId)) {
          warnings.push(
            toValidationWarning(
              `${t("projectDetail.aiChat.sectionNotFound", "Seção não encontrada")}: ${sectionId}`,
              "critical"
            )
          );
        }
      }
    }

    return warnings;
  };

  const executeCommands = (commands: string[]) => {
    if (!projectContext) return;

    const results: string[] = [];
    let successCount = 0;
    const createdSections: Map<string, string> = new Map();

    for (const command of commands) {
      const trimmed = command.trim();

      try {
        if (trimmed.startsWith("CRIAR:")) {
          const parts = trimmed.substring(6).split("|").map((p: string) => p.trim());
          if (parts.length >= 2) {
            const [title, content] = parts;
            const newId = addSection(projectContext.projectId, title, content);
            createdSections.set(title, newId);
            results.push(`✅ Criou: ${title}`);
            successCount++;
          }
        } else if (trimmed.startsWith("SUBSECAO:")) {
          const parts = trimmed.substring(9).split("|").map((p: string) => p.trim());
          if (parts.length >= 3) {
            const [title, parentTitle, content] = parts;
            const parentId =
              createdSections.get(parentTitle) ||
              projectContext.sections.find((s) => s.title === parentTitle)?.id;

            if (parentId) {
              const newId = addSubsection(projectContext.projectId, parentId, title, content);
              createdSections.set(title, newId);
              results.push(`✅ Criou subseção: ${title} em ${parentTitle}`);
              successCount++;
            } else {
              results.push(`❌ Não encontrou seção pai: ${parentTitle}`);
            }
          }
        } else if (trimmed.startsWith("EDITAR:")) {
          const parts = trimmed.substring(7).split("|").map((p: string) => p.trim());
          if (parts.length >= 2) {
            const [sectionId, newContent] = parts;
            const section = projectContext.sections.find((s) => s.id === sectionId);
            if (section) {
              editSection(projectContext.projectId, sectionId, section.title, newContent);
              results.push(`✅ Editou: ${section.title}`);
              successCount++;
            } else {
              results.push(`❌ Seção não encontrada: ${sectionId}`);
            }
          }
        } else if (trimmed.startsWith("REMOVER:")) {
          const sectionId = trimmed.substring(8).trim();
          const section = projectContext.sections.find((s) => s.id === sectionId);
          if (section) {
            removeSection(projectContext.projectId, sectionId);
            results.push(`✅ Removeu: ${section.title}`);
            successCount++;
          } else {
            results.push(`❌ Seção não encontrada: ${sectionId}`);
          }
        }
      } catch (err) {
        console.error("Error executing command:", trimmed, err);
        results.push(`❌ Erro ao executar: ${trimmed}`);
      }
    }

    const updatedProject = getProject(projectContext.projectId);
    if (updatedProject) {
      projectContext.sections = updatedProject.sections || [];
    }

    const summaryMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "assistant",
      content: `${results.join("\n")}\n\n**${successCount} ${t(
        "projectDetail.aiChat.actionsExecuted",
        "de"
      )} ${commands.length} ${t("projectDetail.aiChat.actionsExecutedSuffix", "ações executadas")}!**`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, summaryMessage]);
  };

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
    setPendingExecution(null);

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
        headers: { 
          "Content-Type": "application/json",
          ...getAIHeaders(),
        },
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
          if (activeProvider === "groq" && selectedModel === 'llama-3.3-70b-versatile' && !autoSwitchedModel && isPerDay) {
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
      const commands = parseExecutionCommands(message);

      if (commands.length > 0 && projectContext) {
        const cleanMessage = message.replace(/\[EXECUTAR\][\s\S]*?(?=\n\n|$)/, "").trim();
        const commandWarnings = validateExecutionCommands(commands);
        const relevanceFromApi = data?.meta?.thematicRelevance as
          | { needsReview?: boolean; conflictHits?: string[]; score?: number }
          | undefined;
        const localRelevance = assessThematicRelevance(message, {
          projectTitle: projectContext.projectTitle,
          projectDescription: projectContext.projectDescription,
          sections: projectContext.sections,
        });
        const needsReview = Boolean(relevanceFromApi?.needsReview || localRelevance.needsReview);
        const conflicts = relevanceFromApi?.conflictHits?.length
          ? relevanceFromApi.conflictHits
          : localRelevance.conflictHits;

        setPendingExecution({
          commands,
          cleanMessage,
          relevanceWarning: needsReview
            ? `⚠️ As ações propostas parecem pouco alinhadas ao tema do projeto${conflicts.length ? ` (${conflicts.join(", ")})` : ""}. Revise antes de confirmar.`
            : null,
          commandWarnings,
        });
        setWarningFilter("all");
        setCriticalWarningsAcknowledged(false);

        const assistantMessage: ChatMessage = {
          id: Date.now().toString(),
          role: "assistant",
          content: `${cleanMessage}\n\n**${t(
            "projectDetail.aiChat.actionsReadyPrefix",
            "Ações prontas para execução"
          )}:** ${commands.length}. ${t(
            "projectDetail.aiChat.confirmOrCancelHint",
            "Use os botões abaixo para confirmar ou cancelar."
          )}`,
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

  const handleConfirmPendingExecution = () => {
    if (!pendingExecution) return;
    executeCommands(pendingExecution.commands);
    setPendingExecution(null);
    setWarningFilter("all");
    setCriticalWarningsAcknowledged(false);
  };

  const handleCancelPendingExecution = () => {
    if (!pendingExecution) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `cancel-${Date.now()}`,
        role: "assistant",
        content: t(
          "projectDetail.aiChat.executionCancelled",
          "Execução cancelada. Posso ajustar a proposta para ficar mais alinhada ao seu projeto."
        ),
        timestamp: new Date(),
      },
    ]);
    setPendingExecution(null);
    setWarningFilter("all");
    setCriticalWarningsAcknowledged(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSuggestRelations = async () => {
    if (!projectContext || relationsLoading) return;
    setRelationsLoading(true);
    try {
      const res = await fetch("/api/ai/suggest-relations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAIHeaders() },
        body: JSON.stringify({
          projectTitle: projectContext.projectTitle,
          projectDescription: projectContext.projectDescription,
          sections: projectContext.sections.map((s) => ({
            id: s.id,
            title: s.title,
            parentId: s.parentId,
            domainTags: s.domainTags,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: `relations-err-${Date.now()}`,
            role: "assistant",
            content: `❌ ${data.error || "Erro ao sugerir relações."}`,
            timestamp: new Date(),
          },
        ]);
        return;
      }
      const suggestions = data.suggestions || [];
      const text =
        suggestions.length > 0
          ? "**🔗 Sugestões de relações entre sistemas:**\n\n" +
            suggestions
              .map((s: { type?: string; suggestion?: string }, i: number) => `${i + 1}. ${s.suggestion || ""}`)
              .join("\n\n")
          : "Nenhuma sugestão no momento. Marque as seções com tags (Combate, Economia, Itens, etc.) na página de cada seção para receber sugestões mais precisas.";
      setMessages((prev) => [
        ...prev,
        {
          id: `relations-${Date.now()}`,
          role: "assistant",
          content: text,
          timestamp: new Date(),
        },
      ]);
    } catch (e) {
      console.error("Suggest relations:", e);
      setMessages((prev) => [
        ...prev,
        {
          id: `relations-err-${Date.now()}`,
          role: "assistant",
          content: "❌ Erro ao conectar. Tente novamente.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setRelationsLoading(false);
    }
  };

  const warningCounts = pendingExecution
    ? pendingExecution.commandWarnings.reduce(
        (acc, warning) => {
          acc.all += 1;
          acc[warning.severity] += 1;
          return acc;
        },
        { all: 0, critical: 0, warning: 0, info: 0 }
      )
    : { all: 0, critical: 0, warning: 0, info: 0 };

  const filteredWarnings = pendingExecution
    ? pendingExecution.commandWarnings
        .filter((warning) => warningFilter === "all" || warning.severity === warningFilter)
        .sort((a, b) => {
          if (warningFilter !== "all") return 0;
          const rank: Record<ValidationSeverity, number> = {
            critical: 0,
            warning: 1,
            info: 2,
          };
          return rank[a.severity] - rank[b.severity];
        })
    : [];
  const hasCriticalWarnings = pendingExecution
    ? pendingExecution.commandWarnings.some((warning) => warning.severity === "critical")
    : false;

  if (!isOpen) return null;

  // Verificar se tem configuração de IA válida
  if (!hasValidConfig) {
    return (
      <div className="flex flex-col h-full bg-white border-l border-gray-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🤖</span>
            <div>
              <h3 className="font-semibold text-gray-900">Assistente AI</h3>
              <p className="text-xs text-gray-500">Configuração necessária</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            >
              ×
            </button>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <AIConfigWarning />
        </div>
      </div>
    );
  }

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
                {message.timestamp.toLocaleTimeString(locale, {
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
              {modelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {activeProvider === "groq" && autoSwitchedModel && (
              <span className="text-xs text-amber-600 flex items-center gap-1">
                ⚡ Mudado automaticamente
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            ⚠️ Cada modelo tem limites: <strong>por minuto</strong> e <strong>por dia</strong>. Se atingir, aguarde alguns segundos/minutos.
          </p>
        </div>

        {projectContext && (
          <div className="mb-3">
            <button
              type="button"
              onClick={handleSuggestRelations}
              disabled={relationsLoading || isLoading}
              className="text-sm px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-800 hover:bg-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {relationsLoading ? `⏳ ${t("projectDetail.relationsSuggesting")}` : `🔗 ${t("projectDetail.relationsSuggestButton")}`}
            </button>
            <p className="text-xs text-gray-500 mt-1">
              {t("projectDetail.relationsSuggestHint")}
            </p>
          </div>
        )}

        {pendingExecution && (
          <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
            <p className="text-sm font-medium text-amber-900">
              {t("projectDetail.aiChat.confirmExecute", "Confirma executar")} {pendingExecution.commands.length}{" "}
              {t("projectDetail.aiChat.actionsCount", "ação(ões)")}?
            </p>
            {pendingExecution.relevanceWarning && (
              <p className="mt-1 text-xs text-amber-800">{pendingExecution.relevanceWarning}</p>
            )}
            {pendingExecution.commandWarnings.length > 0 && (
              <div className="mt-2 rounded-md border border-amber-400/60 bg-amber-100 px-2 py-1.5 text-xs text-amber-900">
                <p className="font-semibold">
                  {t(
                    "projectDetail.aiChat.commandWarningsTitle",
                    "Avisos de validação encontrados. Você ainda pode confirmar:"
                  )}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setWarningFilter("all")}
                    className={`rounded-full border px-2 py-0.5 text-[10px] ${
                      warningFilter === "all"
                        ? "border-gray-700 bg-gray-800 text-white"
                        : "border-gray-400 bg-white text-gray-800"
                    }`}
                  >
                    {t("projectDetail.aiChat.filterAll", "Todos")} ({warningCounts.all})
                  </button>
                  <button
                    type="button"
                    onClick={() => setWarningFilter("critical")}
                    className={`rounded-full border px-2 py-0.5 text-[10px] ${
                      warningFilter === "critical"
                        ? "border-rose-700 bg-rose-700 text-white"
                        : "border-rose-300 bg-rose-50 text-rose-800"
                    }`}
                  >
                    {t("projectDetail.aiChat.filterCritical", "Críticos")} ({warningCounts.critical})
                  </button>
                  <button
                    type="button"
                    onClick={() => setWarningFilter("warning")}
                    className={`rounded-full border px-2 py-0.5 text-[10px] ${
                      warningFilter === "warning"
                        ? "border-amber-700 bg-amber-700 text-white"
                        : "border-amber-300 bg-amber-50 text-amber-900"
                    }`}
                  >
                    {t("projectDetail.aiChat.filterWarning", "Warnings")} ({warningCounts.warning})
                  </button>
                  <button
                    type="button"
                    onClick={() => setWarningFilter("info")}
                    className={`rounded-full border px-2 py-0.5 text-[10px] ${
                      warningFilter === "info"
                        ? "border-slate-700 bg-slate-700 text-white"
                        : "border-slate-300 bg-slate-50 text-slate-800"
                    }`}
                  >
                    {t("projectDetail.aiChat.filterInfo", "Infos")} ({warningCounts.info})
                  </button>
                </div>
                {filteredWarnings.map((warning, index) => (
                  <p
                    key={`${warning.message}-${index}`}
                    className={
                      warning.severity === "critical"
                        ? "text-rose-800"
                        : warning.severity === "warning"
                        ? "text-amber-900"
                        : "text-slate-800"
                    }
                  >
                    - [{warning.severity.toUpperCase()}] {warning.message}
                  </p>
                ))}
                {filteredWarnings.length === 0 && (
                  <p className="text-[11px] text-gray-700">
                    {t("projectDetail.aiChat.noWarningsForFilter", "Nenhum aviso neste filtro.")}
                  </p>
                )}
              </div>
            )}
            {hasCriticalWarnings && (
              <label className="mt-2 flex items-start gap-2 text-xs text-rose-900">
                <input
                  type="checkbox"
                  checked={criticalWarningsAcknowledged}
                  onChange={(event) => setCriticalWarningsAcknowledged(event.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  {t(
                    "projectDetail.aiChat.criticalAcknowledgeLabel",
                    "Entendi os avisos críticos e quero continuar mesmo assim."
                  )}
                </span>
              </label>
            )}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={handleConfirmPendingExecution}
                disabled={hasCriticalWarnings && !criticalWarningsAcknowledged}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("projectDetail.aiChat.confirmButton", "Confirmar")}
              </button>
              <button
                type="button"
                onClick={handleCancelPendingExecution}
                className="rounded-lg bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-300 transition-colors"
              >
                {t("projectDetail.aiChat.cancelButton", "Cancelar")}
              </button>
            </div>
          </div>
        )}
        
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
