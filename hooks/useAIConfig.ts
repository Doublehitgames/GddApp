import { useState, useEffect } from 'react';
import { AIProvider } from '@/types/ai';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';

interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model?: string;
}

const STORAGE_KEY = 'gdd_ai_config';

export function useAIConfig() {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();

  // Carregar configuração — Supabase tem prioridade, localStorage é fallback
  useEffect(() => {
    const load = async () => {
      try {
        if (user) {
          const supabase = createClient();
          const { data } = await supabase
            .from('profiles')
            .select('ai_config')
            .eq('id', user.id)
            .single();

          if (data?.ai_config) {
            setConfig(data.ai_config as AIConfig);
            // Sincroniza localStorage também
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data.ai_config));
            return;
          }
        }

        // Fallback: localStorage (usuário offline ou sem config na nuvem)
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as AIConfig;
          setConfig(parsed);
          // Se tem user mas não tinha config na nuvem, sobe o local para a nuvem
          if (user) {
            const supabase = createClient();
            await supabase
              .from('profiles')
              .update({ ai_config: parsed })
              .eq('id', user.id);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar configuração de IA:', error);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Salvar configuração (localStorage + Supabase)
  const saveConfig = async (newConfig: AIConfig) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
      setConfig(newConfig);

      if (user) {
        const supabase = createClient();
        await supabase
          .from('profiles')
          .update({ ai_config: newConfig })
          .eq('id', user.id);
      }
    } catch (error) {
      console.error('Erro ao salvar configuração de IA:', error);
      throw error;
    }
  };

  // Limpar configuração
  const clearConfig = async () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setConfig(null);

      if (user) {
        const supabase = createClient();
        await supabase
          .from('profiles')
          .update({ ai_config: null })
          .eq('id', user.id);
      }
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
