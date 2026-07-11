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

  const keyPlaceholder = createdKey ?? "<cole sua chave aqui>";

  const MCP_URL = "https://gdd-app.vercel.app/api/mcp";

  const claudeCodeCommand = `claude mcp add --transport http gdd-manager ${MCP_URL} --header "Authorization: Bearer ${keyPlaceholder}"`;

  const curlExample = `curl -H "Authorization: Bearer ${keyPlaceholder}" https://gdd-app.vercel.app/api/v1/projects`;

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
          <h1 className="text-3xl font-bold">Conectar ao Claude & API Keys</h1>
          <p className="text-gray-400 mt-2">
            Conecte o Claude aos seus GDDs — no claude.ai não precisa de chave.
            As API keys ficam para Claude Code, scripts e integrações externas.
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

        {/* Conectar no claude.ai / Claude Desktop (recomendado) */}
        <div className="rounded-xl border border-indigo-700/50 bg-indigo-900/10 p-5 mb-6">
          <h2 className="text-sm font-semibold text-indigo-300 mb-1">
            Conectar no claude.ai ou Claude Desktop — Recomendado
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Não precisa de chave nem de instalar nada. A conexão usa a sua
            própria conta do GDD Manager: o Claude abre uma tela de autorização
            e você aprova com um clique.
          </p>

          <ol className="space-y-3 mb-4">
            <li className="flex items-start gap-2">
              <span className="rounded-full bg-indigo-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">1</span>
              <div className="flex-1">
                <p className="text-xs text-gray-300 mb-1.5">Copie a URL do conector:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg bg-gray-950 px-3 py-2 text-xs font-mono text-indigo-300 break-all select-all">
                    {MCP_URL}
                  </code>
                  <button
                    onClick={() => handleCopy(MCP_URL)}
                    className="rounded-lg border border-indigo-700 bg-indigo-800/40 px-3 py-2 text-xs text-indigo-200 hover:bg-indigo-800/60 whitespace-nowrap"
                  >
                    {copied ? "Copiado!" : "Copiar"}
                  </button>
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="rounded-full bg-indigo-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">2</span>
              <p className="text-xs text-gray-300">
                No claude.ai (ou Claude Desktop), abra{" "}
                <strong>Settings → Connectors → Add custom connector</strong> e
                cole a URL.
              </p>
            </li>
            <li className="flex items-start gap-2">
              <span className="rounded-full bg-indigo-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">3</span>
              <p className="text-xs text-gray-300">
                Clique em <strong>Connect</strong>: uma página do GDD Manager
                abre pedindo permissão. Clique em <strong>Autorizar</strong> e
                pronto — o Claude já enxerga seus projetos.
              </p>
            </li>
          </ol>

          <p className="text-xs text-gray-400 mb-2">Experimente num chat novo:</p>
          <div className="space-y-2">
            {[
              "Lista meus projetos do GDD",
              "Mostra as seções do projeto <nome>",
              "Cria uma seção de Economia no meu projeto",
              "Analisa meu GDD e sugere melhorias",
            ].map((cmd) => (
              <div key={cmd} className="flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2">
                <span className="text-indigo-400 text-xs">&#128172;</span>
                <span className="text-xs text-gray-300">{cmd}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Uso avançado: Claude Code, scripts e integrações */}
        <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-5">
          <h2 className="text-sm font-semibold text-gray-200 mb-1">
            Uso avançado — Claude Code, scripts e integrações
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Para esses casos você precisa de uma API key (gere no topo da
            página). A chave dá acesso aos mesmos projetos da sua conta.
          </p>

          <p className="text-xs text-gray-300 mb-2">
            <strong>Claude Code</strong> — rode no terminal
            {createdKey ? " (já com a sua chave)" : ", trocando pelo valor da sua chave"}:
          </p>
          <div className="relative mb-4">
            <pre className="rounded-lg bg-gray-950 p-4 text-xs font-mono text-gray-300 overflow-x-auto">
              {claudeCodeCommand}
            </pre>
            <button
              onClick={() => handleCopy(claudeCodeCommand)}
              className="absolute top-2 right-2 rounded-lg border border-gray-600 bg-gray-800 px-2 py-1 text-[10px] text-gray-300 hover:bg-gray-700"
            >
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>

          <p className="text-xs text-gray-300 mb-2">
            <strong>Scripts e integrações (API REST)</strong> — a mesma chave
            funciona nos endpoints <code className="text-gray-400">/api/v1/*</code>:
          </p>
          <div className="relative mb-4">
            <pre className="rounded-lg bg-gray-950 p-4 text-xs font-mono text-gray-300 overflow-x-auto">
              {curlExample}
            </pre>
            <button
              onClick={() => handleCopy(curlExample)}
              className="absolute top-2 right-2 rounded-lg border border-gray-600 bg-gray-800 px-2 py-1 text-[10px] text-gray-300 hover:bg-gray-700"
            >
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>

          <div className="rounded-lg bg-gray-900/60 border border-gray-700 p-3">
            <p className="text-xs text-gray-400 mb-1"><strong>Não funcionou?</strong></p>
            <ul className="text-xs text-gray-500 space-y-1 list-disc ml-4">
              <li>No claude.ai: confira se você autorizou o acesso na tela do GDD Manager (dá pra reconectar em Settings → Connectors)</li>
              <li>No Claude Code: confira se a chave foi colada inteira (começa com <code className="text-gray-400">gdd_sk_</code>)</li>
              <li>Teste a chave: <code className="text-gray-400">curl -H &quot;Authorization: Bearer SUA_KEY&quot; https://gdd-app.vercel.app/api/v1/me</code></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
