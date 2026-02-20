"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAIConfig } from "@/hooks/useAIConfig";
import { AIProvider } from "@/types/ai";

export default function AISettingsPage() {
  const router = useRouter();
  const { config, isLoading, hasValidConfig, saveConfig, clearConfig } = useAIConfig();
  
  const [provider, setProvider] = useState<AIProvider>('groq');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (config) {
      setProvider(config.provider);
      setApiKey(config.apiKey);
    }
  }, [config]);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setMessage({ type: 'error', text: 'Por favor, insira uma API key válida' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      saveConfig({
        provider,
        apiKey: apiKey.trim(),
      });
      setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao salvar configurações' });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    if (confirm('Tem certeza que deseja remover suas configurações de IA?')) {
      clearConfig();
      setApiKey('');
      setMessage({ type: 'success', text: 'Configurações removidas' });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <button
              onClick={() => router.push('/')}
              className="text-blue-400 hover:text-blue-300 mb-2 flex items-center gap-2"
            >
              ← Voltar
            </button>
            <h1 className="text-3xl font-bold">Configurações de IA</h1>
            <p className="text-gray-400 mt-2">
              Configure sua própria API key para usar os recursos de IA
            </p>
          </div>
        </div>

        {/* Status */}
        <div className={`p-4 rounded-lg mb-6 ${hasValidConfig ? 'bg-green-900/30 border border-green-700' : 'bg-yellow-900/30 border border-yellow-700'}`}>
          <p className="font-semibold">
            {hasValidConfig ? '✓ Configuração ativa' : '⚠ Nenhuma configuração encontrada'}
          </p>
          <p className="text-sm text-gray-300 mt-1">
            {hasValidConfig 
              ? 'Você está usando sua própria API key. Todos os recursos de IA estão disponíveis.'
              : 'Configure uma API key para usar os recursos de IA do app.'}
          </p>
        </div>

        {/* Mensagens */}
        {message && (
          <div className={`p-4 rounded-lg mb-6 ${message.type === 'success' ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'}`}>
            {message.text}
          </div>
        )}

        {/* Formulário */}
        <div className="bg-gray-800 rounded-lg p-6 space-y-6">
          {/* Provider */}
          <div>
            <label className="block text-sm font-semibold mb-2">Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as AIProvider)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 focus:outline-none focus:border-blue-500"
            >
              <option value="groq">Groq (Recomendado - Grátis)</option>
              <option value="openai">OpenAI (GPT-4)</option>
              <option value="claude">Anthropic (Claude)</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Groq oferece tier gratuito generoso e é o mais recomendado
            </p>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-semibold mb-2">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Insira sua API key aqui"
              className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 focus:outline-none focus:border-blue-500 font-mono text-sm"
            />
          </div>

          {/* Links para obter keys */}
          <div className="bg-gray-700/50 rounded p-4">
            <p className="text-sm font-semibold mb-2">Como obter sua API key:</p>
            <ul className="text-sm text-gray-300 space-y-2">
              {provider === 'groq' && (
                <>
                  <li>• Acesse: <a href="https://console.groq.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">console.groq.com</a></li>
                  <li>• Crie uma conta gratuita</li>
                  <li>• Vá em "API Keys" e crie uma nova key</li>
                  <li>• Tier gratuito: 14,400 requisições/dia</li>
                </>
              )}
              {provider === 'openai' && (
                <>
                  <li>• Acesse: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">platform.openai.com/api-keys</a></li>
                  <li>• Crie uma conta (necessita cartão de crédito)</li>
                  <li>• Crie uma nova API key</li>
                </>
              )}
              {provider === 'claude' && (
                <>
                  <li>• Acesse: <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">console.anthropic.com</a></li>
                  <li>• Crie uma conta</li>
                  <li>• Vá em "API Keys" e crie uma nova key</li>
                </>
              )}
            </ul>
          </div>

          {/* Botões */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
            {hasValidConfig && (
              <button
                onClick={handleClear}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
              >
                Remover
              </button>
            )}
          </div>
        </div>

        {/* Informações de Segurança */}
        <div className="mt-6 bg-blue-900/20 border border-blue-700 rounded-lg p-4">
          <p className="text-sm font-semibold mb-2">🔒 Segurança e Privacidade</p>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• Sua API key é armazenada apenas no seu navegador (localStorage)</li>
            <li>• A key nunca é enviada para nossos servidores ou compartilhada</li>
            <li>• Apenas você tem acesso à sua key</li>
            <li>• Se limpar o cache do navegador, precisará configurar novamente</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
