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

  const mcpConfigLocal = `{
  "mcpServers": {
    "gdd-manager": {
      "command": "npx",
      "args": ["-y", "@doublehitgames/gdd-mcp"],
      "env": {
        "GDD_API_KEY": "<cole sua chave aqui>"
      }
    }
  }
}`;

  const mcpConfigRemote = `{
  "mcpServers": {
    "gdd-manager": {
      "type": "streamableHttp",
      "url": "https://gdd-app.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer <cole sua chave aqui>"
      }
    }
  }
}`;

  const [mcpTab, setMcpTab] = useState<"remote" | "local">("remote");
  const mcpConfig = mcpTab === "remote" ? mcpConfigRemote : mcpConfigLocal;

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

        {/* How to use */}
        <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-5">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">
            Como usar com Claude
          </h2>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setMcpTab("remote")}
              className={`rounded-lg px-3 py-1 text-xs font-medium ${mcpTab === "remote" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
            >
              Remoto (recomendado)
            </button>
            <button
              onClick={() => setMcpTab("local")}
              className={`rounded-lg px-3 py-1 text-xs font-medium ${mcpTab === "local" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
            >
              Local (npx)
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            {mcpTab === "remote"
              ? "Adicione a configuração abaixo no Claude Desktop ou Claude Code — sem instalar nada:"
              : <>Adicione a configuração abaixo no arquivo{" "}
                <code className="bg-gray-900 px-1.5 py-0.5 rounded text-gray-300">.mcp.json</code>
                {" "}na raiz do seu projeto (requer Node.js):</>
            }
          </p>
          <div className="relative">
            <pre className="rounded-lg bg-gray-950 p-4 text-xs font-mono text-gray-300 overflow-x-auto">
              {mcpConfig}
            </pre>
            <button
              onClick={() => handleCopy(mcpConfig)}
              className="absolute top-2 right-2 rounded-lg border border-gray-600 bg-gray-800 px-2 py-1 text-[10px] text-gray-300 hover:bg-gray-700"
            >
              Copiar
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Substitua <code className="text-gray-400">&lt;cole sua chave aqui&gt;</code>{" "}
            pelo valor real da sua API key. Depois reinicie o Claude Code.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Para testar, rode no terminal:{" "}
            <code className="bg-gray-900 px-1.5 py-0.5 rounded text-gray-400">
              curl -H &quot;Authorization: Bearer SUA_KEY&quot; https://gdd-app.vercel.app/api/v1/me
            </code>
          </p>
        </div>
      </div>
    </div>
  );
}
