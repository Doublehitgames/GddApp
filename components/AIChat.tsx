"use client";

import { useState, useRef, useEffect } from "react";
import { AIMessage } from "@/types/ai";
import { type Project, useProjectStore } from "@/store/projectStore";
import { useAIConfig } from "@/hooks/useAIConfig";
import AIConfigWarning from "@/components/AIConfigWarning";
import { useI18n } from "@/lib/i18n/provider";
import { assessThematicRelevance } from "@/utils/ai/thematicGuardrails";
import {
  balanceDraftToSectionAddon,
  createDefaultCurrencyAddon,
  createDefaultEconomyLinkAddon,
  createDefaultGlobalVariableAddon,
  createDefaultInventoryAddon,
  createDefaultProductionAddon,
  createDefaultProgressionTableAddon,
  type SectionAddon,
} from "@/lib/addons/types";
import { createDefaultBalanceAddon } from "@/lib/balance/formulaEngine";

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
      addonTypes?: string[];
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

const SUPPORTED_ADDON_TYPES = new Set([
  "currency",
  "globalVariable",
  "economyLink",
  "xpBalance",
  "progressionTable",
  "inventory",
  "production",
]);
type EconomyRefSnapshot = {
  currencyRefs: Set<string>;
  globalVariableRefs: Set<string>;
  xpRefs: Set<string>;
  inventoryRefs: Set<string>;
  xpLevelBoundsByRef: Map<string, { minLevel: number; maxLevel: number }>;
  progressionColumnsBySectionId: Map<string, Map<string, Set<string>>>;
};
type PlannedSectionCommand = {
  kind: "root" | "subsection";
  title: string;
  content: string;
  parentTitle?: string;
};

export default function AIChat({ projectContext, onClose, isOpen = true }: AIChatProps) {
  const { hasValidConfig, getAIHeaders } = useAIConfig();
  const { locale, t } = useI18n();
  const addSection = useProjectStore((state) => state.addSection);
  const addSubsection = useProjectStore((state) => state.addSubsection);
  const editSection = useProjectStore((state) => state.editSection);
  const removeSection = useProjectStore((state) => state.removeSection);
  const addSectionAddon = useProjectStore((state) => state.addSectionAddon);
  const updateSectionAddon = useProjectStore((state) => state.updateSectionAddon);
  const removeSectionAddon = useProjectStore((state) => state.removeSectionAddon);
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

  const resolveSectionIdByToken = (
    token: string,
    project: Project,
    createdSections?: Map<string, string>
  ): string | null => {
    const projectSections = project.sections || [];
    const trimmed = token.trim();
    if (!trimmed) return null;
    const byId = projectSections.find((section) => section.id === trimmed);
    if (byId) return byId.id;
    const createdByTitle = createdSections?.get(trimmed);
    if (createdByTitle) return createdByTitle;
    const normalized = normalizeText(trimmed);
    const byTitle = projectSections.find((section) => normalizeText(section.title || "") === normalized);
    if (byTitle) return byTitle.id;
    return null;
  };

  const sanitizeRefArray = (value: unknown): Array<{ refId: string }> => {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => (isRecord(item) ? asString(item.refId).trim() : ""))
      .filter(Boolean)
      .map((refId) => ({ refId }));
  };

  const sanitizeAddonData = (
    addonType: string,
    baseData: Record<string, unknown>,
    rawPatch: Record<string, unknown>
  ): Record<string, unknown> => {
    const merged: Record<string, unknown> = { ...baseData, ...rawPatch };

    if (addonType === "currency") {
      const allowedKinds = new Set(["soft", "premium", "event", "other"]);
      const decimals = asPositiveInt(merged.decimals, asPositiveInt(baseData.decimals, 0), 0);
      return {
        ...merged,
        code: asString(merged.code, asString(baseData.code, "")),
        displayName: asString(merged.displayName, asString(baseData.displayName, "")),
        kind: allowedKinds.has(asString(merged.kind)) ? asString(merged.kind) : asString(baseData.kind, "soft"),
        decimals: Math.min(6, decimals),
      };
    }

    if (addonType === "globalVariable") {
      const allowedValueTypes = new Set(["percent", "multiplier", "flat", "boolean"]);
      const allowedScopes = new Set(["global", "mode", "event", "season"]);
      const valueType = allowedValueTypes.has(asString(merged.valueType))
        ? asString(merged.valueType)
        : asString(baseData.valueType, "percent");
      const defaultValue =
        valueType === "boolean"
          ? asBoolean(merged.defaultValue, asBoolean(baseData.defaultValue, false))
          : asFiniteNumber(merged.defaultValue, asFiniteNumber(baseData.defaultValue, 0));
      return {
        ...merged,
        key: asString(merged.key, asString(baseData.key, "")),
        displayName: asString(merged.displayName, asString(baseData.displayName, "")),
        valueType,
        scope: allowedScopes.has(asString(merged.scope)) ? asString(merged.scope) : asString(baseData.scope, "global"),
        defaultValue,
      };
    }

    if (addonType === "economyLink") {
      const buyModifiers = sanitizeRefArray(merged.buyModifiers);
      const sellModifiers = sanitizeRefArray(merged.sellModifiers);
      return {
        ...merged,
        hasBuyConfig: asBoolean(merged.hasBuyConfig, Boolean(baseData.hasBuyConfig)),
        hasSellConfig: asBoolean(merged.hasSellConfig, Boolean(baseData.hasSellConfig)),
        hasUnlockConfig: asBoolean(merged.hasUnlockConfig, Boolean(baseData.hasUnlockConfig)),
        buyCurrencyRef: asString(merged.buyCurrencyRef, asString(baseData.buyCurrencyRef, "")) || undefined,
        sellCurrencyRef: asString(merged.sellCurrencyRef, asString(baseData.sellCurrencyRef, "")) || undefined,
        unlockRef: asString(merged.unlockRef, asString(baseData.unlockRef, "")) || undefined,
        buyValue: asPositiveInt(merged.buyValue, asPositiveInt(baseData.buyValue, 0), 0),
        minBuyValue: asPositiveInt(merged.minBuyValue, asPositiveInt(baseData.minBuyValue, 0), 0),
        sellValue: asPositiveInt(merged.sellValue, asPositiveInt(baseData.sellValue, 0), 0),
        maxSellValue: asPositiveInt(merged.maxSellValue, asPositiveInt(baseData.maxSellValue, 0), 0),
        unlockValue: asPositiveInt(merged.unlockValue, asPositiveInt(baseData.unlockValue, 0), 0),
        buyModifiers,
        sellModifiers,
      };
    }

    if (addonType === "inventory") {
      const allowedBindType = new Set(["none", "onPickup", "onEquip"]);
      return {
        ...merged,
        weight: Math.max(0, asFiniteNumber(merged.weight, asFiniteNumber(baseData.weight, 0))),
        stackable: asBoolean(merged.stackable, asBoolean(baseData.stackable, true)),
        maxStack: asPositiveInt(merged.maxStack, asPositiveInt(baseData.maxStack, 1), 1),
        slotSize: asPositiveInt(merged.slotSize, asPositiveInt(baseData.slotSize, 1), 1),
        bindType: allowedBindType.has(asString(merged.bindType))
          ? asString(merged.bindType)
          : asString(baseData.bindType, "none"),
      };
    }

    if (addonType === "production") {
      const allowedMode = new Set(["passive", "recipe"]);
      const sanitizeItemList = (value: unknown): Array<{ itemRef: string; quantity: number }> => {
        if (!Array.isArray(value)) return [];
        return value
          .map((item) => (isRecord(item) ? { itemRef: asString(item.itemRef).trim(), quantity: asPositiveInt(item.quantity, 1, 1) } : null))
          .filter((item): item is { itemRef: string; quantity: number } => Boolean(item && item.itemRef));
      };
      return {
        ...merged,
        mode: allowedMode.has(asString(merged.mode)) ? asString(merged.mode) : asString(baseData.mode, "passive"),
        minOutput: asPositiveInt(merged.minOutput, asPositiveInt(baseData.minOutput, 0), 0),
        maxOutput: asPositiveInt(merged.maxOutput, asPositiveInt(baseData.maxOutput, 0), 0),
        intervalSeconds: asPositiveInt(merged.intervalSeconds, asPositiveInt(baseData.intervalSeconds, 0), 0),
        craftTimeSeconds: asPositiveInt(merged.craftTimeSeconds, asPositiveInt(baseData.craftTimeSeconds, 0), 0),
        ingredients: sanitizeItemList(merged.ingredients),
        outputs: sanitizeItemList(merged.outputs),
      };
    }

    if (addonType === "progressionTable") {
      const startLevel = asPositiveInt(merged.startLevel, asPositiveInt(baseData.startLevel, 1), 1);
      const endLevel = Math.max(startLevel, asPositiveInt(merged.endLevel, asPositiveInt(baseData.endLevel, startLevel), 1));
      return {
        ...merged,
        startLevel,
        endLevel,
      };
    }

    if (addonType === "xpBalance") {
      const startLevel = asPositiveInt(merged.startLevel, asPositiveInt(baseData.startLevel, 1), 1);
      const endLevel = Math.max(startLevel, asPositiveInt(merged.endLevel, asPositiveInt(baseData.endLevel, startLevel), 1));
      const decimals = Math.min(6, asPositiveInt(merged.decimals, asPositiveInt(baseData.decimals, 0), 0));
      return {
        ...merged,
        startLevel,
        endLevel,
        decimals,
      };
    }

    return merged;
  };

  const buildEconomyRefSnapshot = (project: Project): EconomyRefSnapshot => {
    const currencyRefs = new Set<string>();
    const globalVariableRefs = new Set<string>();
    const xpRefs = new Set<string>();
    const inventoryRefs = new Set<string>();
    const xpLevelBoundsByRef = new Map<string, { minLevel: number; maxLevel: number }>();
    const progressionColumnsBySectionId = new Map<string, Map<string, Set<string>>>();

    for (const section of project.sections || []) {
      const progressionForSection = new Map<string, Set<string>>();
      for (const addon of section.addons || []) {
        if (addon.type === "currency") currencyRefs.add(section.id);
        if (addon.type === "globalVariable") globalVariableRefs.add(section.id);
        if (addon.type === "inventory") inventoryRefs.add(section.id);
        if (addon.type === "xpBalance") {
          xpRefs.add(section.id);
          const minLevel = asPositiveInt(addon.data.startLevel, 1, 1);
          const maxLevel = Math.max(minLevel, asPositiveInt(addon.data.endLevel, minLevel, 1));
          xpLevelBoundsByRef.set(section.id, { minLevel, maxLevel });
        }
        if (addon.type === "progressionTable") {
          const columnIds = new Set<string>();
          for (const column of addon.data.columns || []) {
            const columnId = asString(column.id).trim();
            if (columnId) columnIds.add(columnId);
          }
          progressionForSection.set(addon.id, columnIds);
        }
      }
      progressionColumnsBySectionId.set(section.id, progressionForSection);
    }
    return { currencyRefs, globalVariableRefs, xpRefs, inventoryRefs, xpLevelBoundsByRef, progressionColumnsBySectionId };
  };

  const sanitizeEconomyLinkRefs = (
    inputData: Record<string, unknown>,
    snapshot: EconomyRefSnapshot
  ): { data: Record<string, unknown>; warnings: string[] } => {
    const warnings: string[] = [];
    const data: Record<string, unknown> = { ...inputData };

    const buyCurrencyRef = asString(data.buyCurrencyRef).trim();
    if (buyCurrencyRef && !snapshot.currencyRefs.has(buyCurrencyRef)) {
      data.buyCurrencyRef = undefined;
      warnings.push(`EconomyLink: buyCurrencyRef inválido removido (${buyCurrencyRef}).`);
    }

    const sellCurrencyRef = asString(data.sellCurrencyRef).trim();
    if (sellCurrencyRef && !snapshot.currencyRefs.has(sellCurrencyRef)) {
      data.sellCurrencyRef = undefined;
      warnings.push(`EconomyLink: sellCurrencyRef inválido removido (${sellCurrencyRef}).`);
    }

    const beforeBuyModifiers = Array.isArray(data.buyModifiers) ? data.buyModifiers.length : 0;
    const buyModifiers = sanitizeRefArray(data.buyModifiers).filter((item) => snapshot.globalVariableRefs.has(item.refId));
    if (beforeBuyModifiers > buyModifiers.length) {
      warnings.push("EconomyLink: buyModifiers com referência inválida foram removidos.");
    }
    data.buyModifiers = buyModifiers;

    const beforeSellModifiers = Array.isArray(data.sellModifiers) ? data.sellModifiers.length : 0;
    const sellModifiers = sanitizeRefArray(data.sellModifiers).filter((item) => snapshot.globalVariableRefs.has(item.refId));
    if (beforeSellModifiers > sellModifiers.length) {
      warnings.push("EconomyLink: sellModifiers com referência inválida foram removidos.");
    }
    data.sellModifiers = sellModifiers;

    const unlockRef = asString(data.unlockRef).trim();
    if (unlockRef && !snapshot.xpRefs.has(unlockRef)) {
      data.unlockRef = undefined;
      data.unlockValue = undefined;
      warnings.push(`EconomyLink: unlockRef inválido removido (${unlockRef}).`);
    } else if (unlockRef) {
      const bounds = snapshot.xpLevelBoundsByRef.get(unlockRef);
      if (bounds) {
        const currentUnlock = asPositiveInt(data.unlockValue, bounds.minLevel, bounds.minLevel);
        const clampedUnlock = Math.max(bounds.minLevel, Math.min(bounds.maxLevel, currentUnlock));
        if (clampedUnlock !== currentUnlock) {
          warnings.push(
            `EconomyLink: unlockValue ajustado para o intervalo ${bounds.minLevel}-${bounds.maxLevel}.`
          );
        }
        data.unlockValue = clampedUnlock;
      }
    }

    const hasBuyConfig = asBoolean(data.hasBuyConfig, false);
    if (!hasBuyConfig) {
      data.buyCurrencyRef = undefined;
      data.buyValue = undefined;
      data.minBuyValue = undefined;
      data.buyModifiers = [];
    } else {
      const buyValue = asPositiveInt(data.buyValue, 0, 0);
      const buyCurrencyRefAfter = asString(data.buyCurrencyRef).trim();
      if (buyValue > 0 && !buyCurrencyRefAfter) {
        warnings.push(
          "EconomyLink: compra ativa com valor > 0 sem moeda válida. Sugestão: informe buyCurrencyRef válido ou desative hasBuyConfig."
        );
      }
    }

    const hasSellConfig = asBoolean(data.hasSellConfig, false);
    if (!hasSellConfig) {
      data.sellCurrencyRef = undefined;
      data.sellValue = undefined;
      data.maxSellValue = undefined;
      data.sellModifiers = [];
    } else {
      const sellValue = asPositiveInt(data.sellValue, 0, 0);
      const sellCurrencyRefAfter = asString(data.sellCurrencyRef).trim();
      if (sellValue > 0 && !sellCurrencyRefAfter) {
        warnings.push(
          "EconomyLink: venda ativa com valor > 0 sem moeda válida. Sugestão: informe sellCurrencyRef válido ou desative hasSellConfig."
        );
      }
    }

    const hasUnlockConfig = asBoolean(data.hasUnlockConfig, false);
    if (!hasUnlockConfig) {
      data.unlockRef = undefined;
      data.unlockValue = undefined;
    } else {
      const unlockRefAfter = asString(data.unlockRef).trim();
      const unlockValueAfter = asPositiveInt(data.unlockValue, 0, 0);
      if (!unlockRefAfter && unlockValueAfter > 0) {
        data.unlockValue = undefined;
        warnings.push(
          "EconomyLink: unlockValue sem unlockRef válido foi removido. Sugestão: selecione unlockRef de XP ou desative hasUnlockConfig."
        );
      }
    }

    return { data, warnings };
  };

  const sanitizeProductionRefs = (
    inputData: Record<string, unknown>,
    snapshot: EconomyRefSnapshot,
    sectionId: string
  ): { data: Record<string, unknown>; warnings: string[] } => {
    const warnings: string[] = [];
    const data: Record<string, unknown> = { ...inputData };

    const outputRef = asString(data.outputRef).trim();
    if (outputRef && !snapshot.inventoryRefs.has(outputRef)) {
      data.outputRef = undefined;
      warnings.push(`Production: outputRef inválido removido (${outputRef}).`);
    }

    const sanitizeItemArray = (
      listValue: unknown,
      label: "ingredients" | "outputs"
    ): Array<{ itemRef: string; quantity: number }> => {
      if (!Array.isArray(listValue)) return [];
      const list = listValue
        .map((item) =>
          isRecord(item)
            ? {
                itemRef: asString(item.itemRef).trim(),
                quantity: asPositiveInt(item.quantity, 1, 1),
              }
            : null
        )
        .filter((item): item is { itemRef: string; quantity: number } => Boolean(item && item.itemRef));
      const validList = list.filter((item) => snapshot.inventoryRefs.has(item.itemRef));
      if (validList.length < list.length) {
        warnings.push(`Production: ${label} com itemRef inválido foram removidos.`);
      }
      return validList;
    };

    data.ingredients = sanitizeItemArray(data.ingredients, "ingredients");
    data.outputs = sanitizeItemArray(data.outputs, "outputs");

    const sectionProgression = snapshot.progressionColumnsBySectionId.get(sectionId) || new Map<string, Set<string>>();
    const sanitizeProgressionLink = (
      field:
        | "minOutputProgressionLink"
        | "maxOutputProgressionLink"
        | "intervalSecondsProgressionLink"
        | "craftTimeSecondsProgressionLink"
    ) => {
      const link = data[field];
      if (!isRecord(link)) {
        data[field] = undefined;
        return;
      }
      const progressionAddonId = asString(link.progressionAddonId).trim();
      const columnId = asString(link.columnId).trim();
      const columns = sectionProgression.get(progressionAddonId);
      if (!progressionAddonId || !columnId || !columns || !columns.has(columnId)) {
        data[field] = undefined;
        warnings.push(`Production: ${field} inválido removido.`);
        return;
      }
      data[field] = {
        progressionAddonId,
        columnId,
        columnName: asString(link.columnName, columnId),
      };
    };

    sanitizeProgressionLink("minOutputProgressionLink");
    sanitizeProgressionLink("maxOutputProgressionLink");
    sanitizeProgressionLink("intervalSecondsProgressionLink");
    sanitizeProgressionLink("craftTimeSecondsProgressionLink");

    return { data, warnings };
  };

  const buildAddonFromCommand = (addonType: string, payload: Record<string, unknown>): SectionAddon | null => {
    const addonId = `${addonType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let addon: SectionAddon | null = null;

    if (addonType === "currency") addon = createDefaultCurrencyAddon(addonId);
    if (addonType === "globalVariable") addon = createDefaultGlobalVariableAddon(addonId);
    if (addonType === "economyLink") addon = createDefaultEconomyLinkAddon(addonId);
    if (addonType === "xpBalance") addon = balanceDraftToSectionAddon(createDefaultBalanceAddon(addonId));
    if (addonType === "progressionTable") addon = createDefaultProgressionTableAddon(addonId);
    if (addonType === "inventory") addon = createDefaultInventoryAddon(addonId);
    if (addonType === "production") addon = createDefaultProductionAddon(addonId);
    if (!addon) return null;

    const payloadName = typeof payload.name === "string" ? payload.name.trim() : "";
    const rawDataPatch = isRecord(payload.data)
      ? payload.data
      : Object.fromEntries(Object.entries(payload).filter(([key]) => !["id", "type", "name", "data"].includes(key)));
    const dataPatch = isRecord(rawDataPatch) ? rawDataPatch : {};
    const baseData = isRecord(addon.data) ? addon.data : {};
    const nextData = sanitizeAddonData(addon.type, baseData, dataPatch);
    const nextName = payloadName || (typeof nextData.name === "string" ? nextData.name : addon.name);

    return {
      ...addon,
      name: nextName || addon.name,
      data: {
        ...nextData,
        name: nextName || addon.name,
      },
    } as SectionAddon;
  };

  const patchAddonFromCommand = (addon: SectionAddon, patch: Record<string, unknown>): SectionAddon => {
    const patchName = typeof patch.name === "string" ? patch.name.trim() : "";
    const rawDataPatch = isRecord(patch.data)
      ? patch.data
      : Object.fromEntries(Object.entries(patch).filter(([key]) => !["id", "type", "name", "data"].includes(key)));
    const baseData = isRecord(addon.data) ? addon.data : {};
    const nextData = sanitizeAddonData(addon.type, baseData, isRecord(rawDataPatch) ? rawDataPatch : {});
    const nextName = patchName || (typeof nextData.name === "string" ? nextData.name : addon.name);
    return {
      ...addon,
      name: nextName || addon.name,
      data: {
        ...nextData,
        name: nextName || addon.name,
      },
    } as SectionAddon;
  };

  const validateExecutionCommands = (commands: string[]): ValidationWarning[] => {
    if (!projectContext) return [];
    const warnings: ValidationWarning[] = [];
    const warningMessages = new Set<string>();
    const project = getProject(projectContext.projectId);
    if (!project) return warnings;
    const projectSections = project.sections || [];
    const plannedSections: PlannedSectionCommand[] = [];
    const addonTargetsByType: Record<string, Set<string>> = {
      currency: new Set<string>(),
      globalVariable: new Set<string>(),
      economyLink: new Set<string>(),
      xpBalance: new Set<string>(),
      progressionTable: new Set<string>(),
      inventory: new Set<string>(),
      production: new Set<string>(),
    };

    const pushUniqueWarning = (message: string, severity: ValidationSeverity) => {
      if (warningMessages.has(message)) return;
      warningMessages.add(message);
      warnings.push(toValidationWarning(message, severity));
    };

    const hasPlannedAddonForTitle = (addonType: keyof typeof addonTargetsByType, title: string): boolean =>
      addonTargetsByType[addonType].has(normalizeText(title));

    for (const command of commands) {
      const trimmed = command.trim();

      if (trimmed.startsWith("CRIAR:")) {
        const parts = splitCommandParts(trimmed, 6, 2);
        if (parts) {
          plannedSections.push({ kind: "root", title: parts[0], content: parts[1] });
        }
      }

      if (trimmed.startsWith("SUBSECAO:")) {
        const parts = splitCommandParts(trimmed, 9, 3);
        if (parts) {
          plannedSections.push({ kind: "subsection", title: parts[0], parentTitle: parts[1], content: parts[2] });
        }
      }

      if (trimmed.startsWith("ADDON_CRIAR:")) {
        const parts = splitCommandParts(trimmed, 12, 3);
        if (!parts) {
          warnings.push(toValidationWarning(
            t(
              "projectDetail.aiChat.commandFormatAddonCreate",
              "Formato inválido em ADDON_CRIAR. Use: ADDON_CRIAR: sectionId | addonType | jsonData"
            )
          , "critical"));
          continue;
        }
        const [sectionId, addonType, rawJson] = parts;
        if (addonTargetsByType[addonType]) {
          addonTargetsByType[addonType].add(normalizeText(sectionId));
        }
        const section = projectSections.find((s) => s.id === sectionId);
        if (!section) {
          const byTitle = projectSections.find((s) => normalizeText(s.title || "") === normalizeText(sectionId));
          const plannedByTitle = plannedSections.find((s) => normalizeText(s.title) === normalizeText(sectionId));
          if (!byTitle && !plannedByTitle) {
            warnings.push(toValidationWarning(`ADDON_CRIAR: ${t("projectDetail.aiChat.sectionNotFound", "Seção não encontrada")}: ${sectionId}`));
          }
        }
        if (!SUPPORTED_ADDON_TYPES.has(addonType)) {
          warnings.push(toValidationWarning(`${t("projectDetail.aiChat.addonTypeNotSupported", "Tipo de addon não suportado nesta versão")}: ${addonType}`));
        }
        const parsed = parseJsonRecord(rawJson);
        if (parsed.error) warnings.push(toValidationWarning(`ADDON_CRIAR: ${parsed.error}`, "critical"));
        if (!parsed.error && addonType === "economyLink" && section) {
          const base = createDefaultEconomyLinkAddon("tmp").data as unknown as Record<string, unknown>;
          const normalized = sanitizeAddonData("economyLink", base, parsed.data || {});
          const snapshot = buildEconomyRefSnapshot(project);
          const refValidation = sanitizeEconomyLinkRefs(normalized, snapshot);
          refValidation.warnings.forEach((warning) => warnings.push(toValidationWarning(`ADDON_CRIAR: ${warning}`)));
        }
        if (!parsed.error && addonType === "production" && section) {
          const base = createDefaultProductionAddon("tmp").data as unknown as Record<string, unknown>;
          const normalized = sanitizeAddonData("production", base, parsed.data || {});
          const snapshot = buildEconomyRefSnapshot(project);
          const refValidation = sanitizeProductionRefs(normalized, snapshot, section.id);
          refValidation.warnings.forEach((warning) => warnings.push(toValidationWarning(`ADDON_CRIAR: ${warning}`)));
        }
      }

      if (trimmed.startsWith("ADDON_EDITAR:")) {
        const parts = splitCommandParts(trimmed, 13, 3);
        if (!parts) {
          warnings.push(toValidationWarning(
            t(
              "projectDetail.aiChat.commandFormatAddonEdit",
              "Formato inválido em ADDON_EDITAR. Use: ADDON_EDITAR: sectionId | addonId | jsonPatch"
            )
          , "critical"));
          continue;
        }
        const [sectionId, addonId, rawJson] = parts;
        const section = projectSections.find((s) => s.id === sectionId);
        if (!section) {
          warnings.push(toValidationWarning(`ADDON_EDITAR: ${t("projectDetail.aiChat.sectionNotFound", "Seção não encontrada")}: ${sectionId}`));
          continue;
        }
        const addon = (section.addons || []).find((item) => item.id === addonId);
        if (!addon) warnings.push(toValidationWarning(`ADDON_EDITAR: ${t("projectDetail.aiChat.addonNotFound", "Addon não encontrado")}: ${addonId}`));
        const parsed = parseJsonRecord(rawJson);
        if (parsed.error) warnings.push(toValidationWarning(`ADDON_EDITAR: ${parsed.error}`, "critical"));
        if (!parsed.error && addon?.type === "economyLink") {
          const base = isRecord(addon.data) ? addon.data : {};
          const normalized = sanitizeAddonData("economyLink", base, parsed.data || {});
          const snapshot = buildEconomyRefSnapshot(project);
          const refValidation = sanitizeEconomyLinkRefs(normalized, snapshot);
          refValidation.warnings.forEach((warning) => warnings.push(toValidationWarning(`ADDON_EDITAR: ${warning}`)));
        }
        if (!parsed.error && addon?.type === "production") {
          const base = isRecord(addon.data) ? addon.data : {};
          const normalized = sanitizeAddonData("production", base, parsed.data || {});
          const snapshot = buildEconomyRefSnapshot(project);
          const refValidation = sanitizeProductionRefs(normalized, snapshot, section.id);
          refValidation.warnings.forEach((warning) => warnings.push(toValidationWarning(`ADDON_EDITAR: ${warning}`)));
        }
      }

      if (trimmed.startsWith("ADDON_REMOVER:")) {
        const parts = splitCommandParts(trimmed, 14, 2);
        if (!parts) {
          warnings.push(toValidationWarning(
            t(
              "projectDetail.aiChat.commandFormatAddonRemove",
              "Formato inválido em ADDON_REMOVER. Use: ADDON_REMOVER: sectionId | addonId"
            )
          , "critical"));
          continue;
        }
        const [sectionId, addonId] = parts;
        const section = projectSections.find((s) => s.id === sectionId);
        if (!section) {
          warnings.push(toValidationWarning(`ADDON_REMOVER: ${t("projectDetail.aiChat.sectionNotFound", "Seção não encontrada")}: ${sectionId}`));
          continue;
        }
        const addon = (section.addons || []).find((item) => item.id === addonId);
        if (!addon) warnings.push(toValidationWarning(`ADDON_REMOVER: ${t("projectDetail.aiChat.addonNotFound", "Addon não encontrado")}: ${addonId}`));
      }
    }

    const existingCurrencyContainer = projectSections.find((section) => isCurrencyContainerTitle(section.title || ""));
    for (const plannedSection of plannedSections) {
      const sectionSignalText = `${plannedSection.title} ${plannedSection.parentTitle || ""} ${plannedSection.content || ""}`;
      const isCurrency = isCurrencyLikeTitle(plannedSection.title);
      const hasCurrency = hasPlannedAddonForTitle("currency", plannedSection.title);
      const hasInventory = hasPlannedAddonForTitle("inventory", plannedSection.title);
      const hasEconomyLink = hasPlannedAddonForTitle("economyLink", plannedSection.title);
      const hasProduction = hasPlannedAddonForTitle("production", plannedSection.title);
      const hasXpBalance = hasPlannedAddonForTitle("xpBalance", plannedSection.title);
      const hasProgression = hasPlannedAddonForTitle("progressionTable", plannedSection.title);
      const hasAnyProgressionAddon = hasXpBalance || hasProgression;
      const isInventoryEntity = isInventoryLikeTitle(plannedSection.title);
      const isPet = isPetLikeTitle(plannedSection.title);
      const hasEconomySignal = hasEconomyIntent(sectionSignalText);
      const hasProductionSignal = hasProductionIntent(sectionSignalText);
      const hasProgressionSignal = hasProgressionIntent(sectionSignalText);

      if (isCurrency) {
        if (plannedSection.kind === "root" && existingCurrencyContainer) {
          pushUniqueWarning(
            `HIERARQUIA: "${plannedSection.title}" parece moeda e foi planejada na raiz. Sugestão: criar como SUBSECAO em "${existingCurrencyContainer.title}".`,
            "critical"
          );
        }

        if (!hasCurrency) {
          pushUniqueWarning(
            `ADDON: "${plannedSection.title}" parece moeda, mas não há ADDON_CRIAR currency no plano. Sugestão: adicionar addon currency para essa seção.`,
            "critical"
          );
        }
        continue;
      }

      if (isInventoryEntity && !hasInventory) {
        pushUniqueWarning(
          t(
            "projectDetail.aiChat.opportunityInventoryMissing",
            `ADDON_OPORTUNIDADE: "${plannedSection.title}" parece item/entidade de inventário, mas não há ADDON_CRIAR inventory no plano.`
          ).replace("{{title}}", plannedSection.title),
          "warning"
        );
      }

      if (hasEconomySignal && !hasEconomyLink) {
        pushUniqueWarning(
          t(
            "projectDetail.aiChat.opportunityEconomyLinkMissing",
            `ADDON_OPORTUNIDADE: "${plannedSection.title}" menciona compra/venda/preço, mas não há ADDON_CRIAR economyLink no plano.`
          ).replace("{{title}}", plannedSection.title),
          "warning"
        );
      }

      if (hasProductionSignal && !hasProduction) {
        pushUniqueWarning(
          t(
            "projectDetail.aiChat.opportunityProductionMissing",
            `ADDON_OPORTUNIDADE: "${plannedSection.title}" sugere produção/receita/passivo, mas não há ADDON_CRIAR production no plano.`
          ).replace("{{title}}", plannedSection.title),
          "warning"
        );
      }

      if (hasProgressionSignal && !hasAnyProgressionAddon) {
        pushUniqueWarning(
          t(
            "projectDetail.aiChat.opportunityProgressionMissing",
            `ADDON_OPORTUNIDADE: "${plannedSection.title}" sugere progressão por nível/XP, mas não há ADDON_CRIAR xpBalance ou progressionTable no plano.`
          ).replace("{{title}}", plannedSection.title),
          "info"
        );
      }

      if (isPet && !hasInventory && !hasEconomyLink && !hasProduction) {
        pushUniqueWarning(
          t(
            "projectDetail.aiChat.opportunityPetAddonMissing",
            `ADDON_OPORTUNIDADE: "${plannedSection.title}" parece pet/animal; avalie inventory (armazenamento), economyLink (compra/venda) e production (geração passiva).`
          ).replace("{{title}}", plannedSection.title),
          "warning"
        );
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
        } else if (trimmed.startsWith("ADDON_CRIAR:")) {
          const parts = splitCommandParts(trimmed, 12, 3);
          if (!parts) {
            results.push(
              `❌ ${t(
                "projectDetail.aiChat.commandFormatAddonCreate",
                "Formato inválido em ADDON_CRIAR. Use: ADDON_CRIAR: sectionId | addonType | jsonData"
              )}`
            );
            continue;
          }
          const [sectionToken, addonType, rawJson] = parts;
          const project = getProject(projectContext.projectId);
          const resolvedSectionId = project ? resolveSectionIdByToken(sectionToken, project, createdSections) : null;
          const section = project?.sections?.find((s) => s.id === resolvedSectionId);
          if (!section || !resolvedSectionId) {
            results.push(`❌ ${t("projectDetail.aiChat.sectionNotFound", "Seção não encontrada")}: ${sectionToken}`);
            continue;
          }
          const parsed = parseJsonRecord(rawJson);
          if (!parsed.data) {
            results.push(`❌ ADDON_CRIAR: ${parsed.error}`);
            continue;
          }
          const nextAddon = buildAddonFromCommand(addonType, parsed.data);
          if (!nextAddon) {
            results.push(
              `❌ ${t("projectDetail.aiChat.addonTypeNotSupported", "Tipo de addon não suportado nesta versão")}: ${addonType}`
            );
            continue;
          }
          let finalAddon = nextAddon;
          if (finalAddon.type === "economyLink" && project) {
            const snapshot = buildEconomyRefSnapshot(project);
            const sanitized = sanitizeEconomyLinkRefs(
              isRecord(finalAddon.data) ? finalAddon.data : {},
              snapshot
            );
            finalAddon = { ...finalAddon, data: sanitized.data as typeof finalAddon.data };
            sanitized.warnings.forEach((warning) => results.push(`⚠️ ${warning}`));
          }
          if (finalAddon.type === "production" && project) {
            const snapshot = buildEconomyRefSnapshot(project);
            const sanitized = sanitizeProductionRefs(
              isRecord(finalAddon.data) ? finalAddon.data : {},
              snapshot,
              resolvedSectionId
            );
            finalAddon = { ...finalAddon, data: sanitized.data as typeof finalAddon.data };
            sanitized.warnings.forEach((warning) => results.push(`⚠️ ${warning}`));
          }
          addSectionAddon(projectContext.projectId, resolvedSectionId, finalAddon);
          results.push(`✅ ${t("projectDetail.aiChat.addonCreated", "Addon criado")}: ${finalAddon.name}`);
          successCount++;
        } else if (trimmed.startsWith("ADDON_EDITAR:")) {
          const parts = splitCommandParts(trimmed, 13, 3);
          if (!parts) {
            results.push(
              `❌ ${t(
                "projectDetail.aiChat.commandFormatAddonEdit",
                "Formato inválido em ADDON_EDITAR. Use: ADDON_EDITAR: sectionId | addonId | jsonPatch"
              )}`
            );
            continue;
          }
          const [sectionId, addonId, rawJson] = parts;
          const project = getProject(projectContext.projectId);
          const section = project?.sections?.find((s) => s.id === sectionId);
          if (!section) {
            results.push(`❌ ${t("projectDetail.aiChat.sectionNotFound", "Seção não encontrada")}: ${sectionId}`);
            continue;
          }
          const currentAddon = (section.addons || []).find((addon) => addon.id === addonId);
          if (!currentAddon) {
            results.push(`❌ ${t("projectDetail.aiChat.addonNotFound", "Addon não encontrado")}: ${addonId}`);
            continue;
          }
          const parsed = parseJsonRecord(rawJson);
          if (!parsed.data) {
            results.push(`❌ ADDON_EDITAR: ${parsed.error}`);
            continue;
          }
          const nextAddon = patchAddonFromCommand(currentAddon, parsed.data);
          let finalAddon = nextAddon;
          if (finalAddon.type === "economyLink" && project) {
            const snapshot = buildEconomyRefSnapshot(project);
            const sanitized = sanitizeEconomyLinkRefs(
              isRecord(finalAddon.data) ? finalAddon.data : {},
              snapshot
            );
            finalAddon = { ...finalAddon, data: sanitized.data as typeof finalAddon.data };
            sanitized.warnings.forEach((warning) => results.push(`⚠️ ${warning}`));
          }
          if (finalAddon.type === "production" && project) {
            const snapshot = buildEconomyRefSnapshot(project);
            const sanitized = sanitizeProductionRefs(
              isRecord(finalAddon.data) ? finalAddon.data : {},
              snapshot,
              sectionId
            );
            finalAddon = { ...finalAddon, data: sanitized.data as typeof finalAddon.data };
            sanitized.warnings.forEach((warning) => results.push(`⚠️ ${warning}`));
          }
          updateSectionAddon(projectContext.projectId, sectionId, addonId, finalAddon);
          results.push(`✅ ${t("projectDetail.aiChat.addonUpdated", "Addon atualizado")}: ${finalAddon.name}`);
          successCount++;
        } else if (trimmed.startsWith("ADDON_REMOVER:")) {
          const parts = splitCommandParts(trimmed, 14, 2);
          if (!parts) {
            results.push(
              `❌ ${t(
                "projectDetail.aiChat.commandFormatAddonRemove",
                "Formato inválido em ADDON_REMOVER. Use: ADDON_REMOVER: sectionId | addonId"
              )}`
            );
            continue;
          }
          const [sectionId, addonId] = parts;
          const project = getProject(projectContext.projectId);
          const section = project?.sections?.find((s) => s.id === sectionId);
          if (!section) {
            results.push(`❌ ${t("projectDetail.aiChat.sectionNotFound", "Seção não encontrada")}: ${sectionId}`);
            continue;
          }
          const currentAddon = (section.addons || []).find((addon) => addon.id === addonId);
          if (!currentAddon) {
            results.push(`❌ ${t("projectDetail.aiChat.addonNotFound", "Addon não encontrado")}: ${addonId}`);
            continue;
          }
          removeSectionAddon(projectContext.projectId, sectionId, addonId);
          results.push(`✅ ${t("projectDetail.aiChat.addonRemoved", "Addon removido")}: ${currentAddon.name}`);
          successCount++;
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
