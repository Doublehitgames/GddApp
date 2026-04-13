"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

type ApiKeyEntry = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export default function ApiKeysSettingsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [keys, setKeys] = useState<ApiKeyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/keys");
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchKeys();
  }, [user, fetchKeys]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      setError("Informe um nome para a chave.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      if (!res.ok) {
        setError("Erro ao criar chave.");
        return;
      }
      const data = await res.json();
      setCreatedKey(data.key);
      setNewKeyName("");
      await fetchKeys();
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string, name: string) => {
    if (!confirm(`Revogar a chave "${name}"? Ela não poderá mais ser usada.`)) return;
    await fetch(`/api/keys?id=${id}`, { method: "DELETE" });
    await fetchKeys();
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeKeys = keys.filter((k) => !k.revoked_at);
  const revokedKeys = keys.filter((k) => k.revoked_at);

  const [setupStep, setSetupStep] = useState(1);

  const keyPlaceholder = createdKey ?? "<cole sua chave aqui>";

  const mcpConfigLocal = `{
  "mcpServers": {
    "gdd-manager": {
      "command": "npx",
      "args": ["-y", "@doublehitgames/gdd-mcp"],
      "env": {
        "GDD_API_KEY": "${keyPlaceholder}"
      }
    }
  }
}`;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push("/")}
            className="text-blue-400 hover:text-blue-300 mb-2 flex items-center gap-2"
          >
            &larr; Voltar
          </button>
          <h1 className="text-3xl font-bold">API Keys</h1>
          <p className="text-gray-400 mt-2">
            Gere chaves para acessar seus projetos via Claude Code, scripts ou
            integrações externas.
          </p>
        </div>

        {/* Create Key */}
        <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">
            Gerar nova chave
          </h2>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Nome da chave (ex: Claude Code, Script CI)"
              value={newKeyName}
              onChange={(e) => {
                setNewKeyName(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="flex-1 rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            />
            <button
              onClick={handleCreate}
              disabled={creating}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {creating ? "Gerando..." : "Gerar"}
            </button>
          </div>
          {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
        </div>

        {/* Created Key (show once) */}
        {createdKey && (
          <div className="rounded-xl border border-emerald-700/60 bg-emerald-900/20 p-5 mb-6">
            <h2 className="text-sm font-semibold text-emerald-300 mb-2">
              Chave criada com sucesso
            </h2>
            <p className="text-xs text-emerald-400/80 mb-3">
              Copie esta chave agora. Ela <strong>não será exibida novamente</strong>.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-gray-950 px-3 py-2 text-xs font-mono text-emerald-300 break-all select-all">
                {createdKey}
              </code>
              <button
                onClick={() => handleCopy(createdKey)}
                className="rounded-lg border border-emerald-700 bg-emerald-800/40 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-800/60 whitespace-nowrap"
              >
                {copied ? "Copiado!" : "Copiar"}
              </button>
            </div>
            <button
              onClick={() => setCreatedKey(null)}
              className="text-xs text-gray-500 hover:text-gray-300 mt-3"
            >
              Fechar aviso
            </button>
          </div>
        )}

        {/* Active Keys */}
        <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">
            Chaves ativas ({activeKeys.length})
          </h2>
          {loading ? (
            <p className="text-xs text-gray-500">Carregando...</p>
          ) : activeKeys.length === 0 ? (
            <p className="text-xs text-gray-500 italic">Nenhuma chave ativa.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left py-2 font-medium">Nome</th>
                  <th className="text-left py-2 font-medium">Chave</th>
                  <th className="text-left py-2 font-medium">Criada</th>
                  <th className="text-left py-2 font-medium">Último uso</th>
                  <th className="text-right py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {activeKeys.map((k) => (
                  <tr key={k.id} className="border-b border-gray-800">
                    <td className="py-2 text-gray-200">{k.name}</td>
                    <td className="py-2 font-mono text-gray-400">
                      {k.key_prefix}
                    </td>
                    <td className="py-2 text-gray-400">
                      {new Date(k.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2 text-gray-400">
                      {k.last_used_at
                        ? new Date(k.last_used_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => handleRevoke(k.id, k.name)}
                        className="text-rose-400 hover:text-rose-300"
                      >
                        Revogar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Revoked Keys */}
        {revokedKeys.length > 0 && (
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-500 mb-3">
              Chaves revogadas ({revokedKeys.length})
            </h2>
            <table className="w-full text-xs">
              <tbody>
                {revokedKeys.map((k) => (
                  <tr key={k.id} className="border-b border-gray-800/50">
                    <td className="py-2 text-gray-500 line-through">{k.name}</td>
                    <td className="py-2 font-mono text-gray-600">
                      {k.key_prefix}
                    </td>
                    <td className="py-2 text-gray-600">
                      Revogada em{" "}
                      {new Date(k.revoked_at!).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Setup Guide */}
        <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-5">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">
            Conectar ao Claude — Passo a Passo
          </h2>

          {/* Steps indicator */}
          <div className="flex items-center gap-2 mb-5">
            {[1, 2, 3].map((s) => (
              <button
                key={s}
                onClick={() => setSetupStep(s)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  setupStep === s
                    ? "bg-blue-600 text-white"
                    : setupStep > s
                      ? "bg-emerald-800/40 text-emerald-300 border border-emerald-700/50"
                      : "bg-gray-700 text-gray-400"
                }`}
              >
                {setupStep > s ? "✓" : s}.{" "}
                {s === 1 ? "Gerar chave" : s === 2 ? "Configurar" : "Testar"}
              </button>
            ))}
          </div>

          {/* Step 1 */}
          {setupStep === 1 && (
            <div>
              <p className="text-xs text-gray-300 mb-3">
                {activeKeys.length > 0
                  ? <>Você já tem {activeKeys.length} chave(s) ativa(s). Se quiser usar uma existente, pule para o próximo passo.</>
                  : "Crie uma chave acima para começar. Dê um nome como \"Claude\" para identificar."
                }
              </p>
              {createdKey && (
                <div className="rounded-lg bg-emerald-900/20 border border-emerald-700/40 p-3 mb-3">
                  <p className="text-xs text-emerald-300 mb-1">Chave pronta! Copie e guarde — ela não será exibida novamente:</p>
                  <code className="text-xs font-mono text-emerald-200 break-all">{createdKey}</code>
                </div>
              )}
              <button
                onClick={() => setSetupStep(2)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500"
              >
                {activeKeys.length > 0 || createdKey ? "Próximo →" : "Gere uma chave acima primeiro"}
              </button>
            </div>
          )}

          {/* Step 2 */}
          {setupStep === 2 && (
            <div>
              <p className="text-xs text-gray-300 mb-2">
                Abra o arquivo de configuração do Claude no seu computador:
              </p>
              <div className="space-y-2 mb-4">
                <div className="flex items-start gap-2">
                  <span className="text-xs text-gray-500 mt-0.5">Windows:</span>
                  <code className="text-xs font-mono text-blue-300 bg-gray-900 px-2 py-1 rounded break-all">
                    %APPDATA%\Claude\claude_desktop_config.json
                  </code>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-xs text-gray-500 mt-0.5">Mac:</span>
                  <code className="text-xs font-mono text-blue-300 bg-gray-900 px-2 py-1 rounded break-all">
                    ~/Library/Application Support/Claude/claude_desktop_config.json
                  </code>
                </div>
              </div>

              <p className="text-xs text-gray-300 mb-2">
                {createdKey
                  ? "Copie a configuração abaixo (já com a sua chave):"
                  : <>Copie a configuração abaixo e substitua <code className="text-yellow-300">&lt;cole sua chave aqui&gt;</code> pela sua API key:</>
                }
              </p>

              <div className="relative">
                <pre className="rounded-lg bg-gray-950 p-4 text-xs font-mono text-gray-300 overflow-x-auto">
                  {mcpConfigLocal}
                </pre>
                <button
                  onClick={() => handleCopy(mcpConfigLocal)}
                  className="absolute top-2 right-2 rounded-lg border border-gray-600 bg-gray-800 px-2 py-1 text-[10px] text-gray-300 hover:bg-gray-700"
                >
                  {copied ? "Copiado!" : "Copiar config"}
                </button>
              </div>

              <div className="rounded-lg bg-yellow-900/20 border border-yellow-700/30 p-3 mt-3 mb-4">
                <p className="text-xs text-yellow-300/90">
                  <strong>Importante:</strong> Se o arquivo já existir, adicione apenas a parte {'"'}gdd-manager{'"'} dentro de {'"'}mcpServers{'"'}.
                  Não substitua o arquivo inteiro se já tiver outros servidores configurados.
                </p>
              </div>

              <p className="text-xs text-gray-400 mb-3">
                Requer <a href="https://nodejs.org" target="_blank" rel="noopener" className="text-blue-400 hover:underline">Node.js 18+</a> instalado.
              </p>

              <div className="flex gap-2">
                <button onClick={() => setSetupStep(1)} className="rounded-lg bg-gray-700 px-3 py-2 text-xs text-gray-300 hover:bg-gray-600">&larr; Voltar</button>
                <button onClick={() => setSetupStep(3)} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500">Próximo →</button>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {setupStep === 3 && (
            <div>
              <p className="text-xs text-gray-300 mb-3">
                <strong>Reinicie o Claude</strong> (feche e abra o app). Depois, em um novo chat, experimente:
              </p>
              <div className="space-y-2 mb-4">
                {[
                  "Lista meus projetos do GDD",
                  "Mostra as seções do projeto <nome>",
                  "Cria uma seção de Economia no meu projeto",
                  "Analisa meu GDD e sugere melhorias",
                ].map((cmd) => (
                  <div key={cmd} className="flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2">
                    <span className="text-blue-400 text-xs">&#128172;</span>
                    <span className="text-xs text-gray-300">{cmd}</span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-300 mb-3">
                Se funcionar, o Claude vai listar seus projetos ou criar conteúdo direto no GDD Manager.
              </p>

              <div className="rounded-lg bg-gray-900/60 border border-gray-700 p-3 mb-4">
                <p className="text-xs text-gray-400 mb-1"><strong>Não funcionou?</strong></p>
                <ul className="text-xs text-gray-500 space-y-1 list-disc ml-4">
                  <li>Verifique se o Node.js está instalado: <code className="text-gray-400">node --version</code></li>
                  <li>Confira se a chave está correta no arquivo de config</li>
                  <li>Verifique se reiniciou o Claude depois de salvar o arquivo</li>
                  <li>Teste a chave: <code className="text-gray-400">curl -H &quot;Authorization: Bearer SUA_KEY&quot; https://gdd-app.vercel.app/api/v1/me</code></li>
                </ul>
              </div>

              <button onClick={() => setSetupStep(2)} className="rounded-lg bg-gray-700 px-3 py-2 text-xs text-gray-300 hover:bg-gray-600">&larr; Voltar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
