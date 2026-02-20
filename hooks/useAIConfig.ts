import { useState, useEffect } from 'react';
import { AIProvider } from '@/types/ai';

interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model?: string;
}

const STORAGE_KEY = 'gdd_ai_config';

export function useAIConfig() {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Carregar configuração do localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setConfig(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Erro ao carregar configuração de IA:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Salvar configuração
  const saveConfig = (newConfig: AIConfig) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
      setConfig(newConfig);
    } catch (error) {
      console.error('Erro ao salvar configuração de IA:', error);
      throw error;
    }
  };

  // Limpar configuração
  const clearConfig = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setConfig(null);
    } catch (error) {
      console.error('Erro ao limpar configuração de IA:', error);
      throw error;
    }
  };

  // Verificar se tem configuração válida
  const hasValidConfig = Boolean(config?.apiKey && config?.provider);

  // Função helper para adicionar headers de IA nas requisições
  const getAIHeaders = (): Record<string, string> => {
    if (!config) return {};
    
    return {
      'x-ai-provider': config.provider,
      'x-ai-key': config.apiKey,
      ...(config.model && { 'x-ai-model': config.model }),
    };
  };

  return {
    config,
    isLoading,
    hasValidConfig,
    saveConfig,
    clearConfig,
    getAIHeaders,
  };
}
