"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAIConfig } from "@/hooks/useAIConfig";
import { AIProvider } from "@/types/ai";
import { useI18n } from "@/lib/i18n/provider";

export default function AISettingsPage() {
  const router = useRouter();
  const { t } = useI18n();
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
      setMessage({ type: 'error', text: t('settings.aiPage.errors.invalidKey') });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await saveConfig({
        provider,
        apiKey: apiKey.trim(),
      });
      setMessage({ type: 'success', text: t('settings.aiPage.messages.saved') });
    } catch (error) {
      setMessage({ type: 'error', text: t('settings.aiPage.errors.saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (confirm(t('settings.aiPage.confirm.clear'))) {
      await clearConfig();
      setApiKey('');
      setMessage({ type: 'success', text: t('settings.aiPage.messages.removed') });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p>{t('common.loading')}</p>
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
              ← {t('common.back')}
            </button>
            <h1 className="text-3xl font-bold">{t('settings.aiPage.title')}</h1>
            <p className="text-gray-400 mt-2">
              {t('settings.aiPage.subtitle')}
            </p>
          </div>
        </div>

        {/* Status */}
        <div className={`p-4 rounded-lg mb-6 ${hasValidConfig ? 'bg-green-900/30 border border-green-700' : 'bg-yellow-900/30 border border-yellow-700'}`}>
          <p className="font-semibold">
            {hasValidConfig ? t('settings.aiPage.status.activeTitle') : t('settings.aiPage.status.missingTitle')}
          </p>
          <p className="text-sm text-gray-300 mt-1">
            {hasValidConfig 
              ? t('settings.aiPage.status.activeDescription')
              : t('settings.aiPage.status.missingDescription')}
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
            <label className="block text-sm font-semibold mb-2">{t('settings.aiPage.form.providerLabel')}</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as AIProvider)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 focus:outline-none focus:border-blue-500"
            >
              <option value="groq">{t('settings.aiPage.providers.groq')}</option>
              <option value="openai">{t('settings.aiPage.providers.openai')}</option>
              <option value="claude">{t('settings.aiPage.providers.claude')}</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              {t('settings.aiPage.form.providerHint')}
            </p>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-semibold mb-2">{t('settings.aiPage.form.apiKeyLabel')}</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t('settings.aiPage.form.apiKeyPlaceholder')}
              className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 focus:outline-none focus:border-blue-500 font-mono text-sm"
            />
          </div>

          {/* Links para obter keys */}
          <div className="bg-gray-700/50 rounded p-4">
            <p className="text-sm font-semibold mb-2">{t('settings.aiPage.howTo.title')}</p>
            <ul className="text-sm text-gray-300 space-y-2">
              {provider === 'groq' && (
                <>
                  <li>• {t('settings.aiPage.howTo.groq.step1')} <a href="https://console.groq.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">console.groq.com</a></li>
                  <li>• {t('settings.aiPage.howTo.groq.step2')}</li>
                  <li>• {t('settings.aiPage.howTo.groq.step3')}</li>
                  <li>• {t('settings.aiPage.howTo.groq.step4')}</li>
                </>
              )}
              {provider === 'openai' && (
                <>
                  <li>• {t('settings.aiPage.howTo.openai.step1')} <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">platform.openai.com/api-keys</a></li>
                  <li>• {t('settings.aiPage.howTo.openai.step2')}</li>
                  <li>• {t('settings.aiPage.howTo.openai.step3')}</li>
                </>
              )}
              {provider === 'claude' && (
                <>
                  <li>• {t('settings.aiPage.howTo.claude.step1')} <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">console.anthropic.com</a></li>
                  <li>• {t('settings.aiPage.howTo.claude.step2')}</li>
                  <li>• {t('settings.aiPage.howTo.claude.step3')}</li>
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
              {saving ? t('settings.aiPage.actions.saving') : t('settings.aiPage.actions.save')}
            </button>
            {hasValidConfig && (
              <button
                onClick={handleClear}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
              >
                {t('settings.aiPage.actions.remove')}
              </button>
            )}
          </div>
        </div>

        {/* Informações de Segurança */}
        <div className="mt-6 bg-blue-900/20 border border-blue-700 rounded-lg p-4">
          <p className="text-sm font-semibold mb-2">🔒 {t('settings.aiPage.security.title')}</p>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• {t('settings.aiPage.security.item1')}</li>
            <li>• {t('settings.aiPage.security.item2')}</li>
            <li>• {t('settings.aiPage.security.item3')}</li>
            <li>• {t('settings.aiPage.security.item4')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
