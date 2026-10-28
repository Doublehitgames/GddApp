"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useI18n } from "@/lib/i18n/provider";

type ApiKeyEntry = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

type OAuthConnection = {
  clientId: string;
  clientName: string | null;
  connectedAt: string;
  lastUsedAt: string | null;
};

export default function ApiKeysSettingsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { t, locale } = useI18n();

  // Traduz e interpola {{var}} — mesmo padrão de replace usado no resto do app.
  const tf = useCallback(
    (key: string, vars: Record<string, string | number>) => {
      let s = t(`apiKeysPage.${key}`);
      for (const [k, v] of Object.entries(vars)) s = s.replace(`{{${k}}}`, String(v));
      return s;
    },
    [t]
  );
  const tk = useCallback((key: string) => t(`apiKeysPage.${key}`), [t]);

  const [keys, setKeys] = useState<ApiKeyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const [connections, setConnections] = useState<OAuthConnection[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);

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

  const fetchConnections = useCallback(async () => {
    setLoadingConnections(true);
    try {
      const res = await fetch("/api/oauth/connections");
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections ?? []);
      }
    } finally {
      setLoadingConnections(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchKeys();
      fetchConnections();
    }
  }, [user, fetchKeys, fetchConnections]);

  const handleRevokeConnection = async (clientId: string, name: string) => {
    if (!confirm(tf("confirmDisconnect", { name }))) return;
    await fetch(`/api/oauth/connections?clientId=${encodeURIComponent(clientId)}`, { method: "DELETE" });
    await fetchConnections();
  };

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      setError(tk("errorNameRequired"));
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
        setError(tk("errorCreateFailed"));
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
    if (!confirm(tf("confirmRevokeKey", { name }))) return;
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

  const prompts = [tk("prompt1"), tk("prompt2"), tk("prompt3"), tk("prompt4")];

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push("/")}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-2 flex items-center gap-2"
          >
            &larr; {tk("back")}
          </button>
          <h1 className="text-3xl font-bold">{tk("title")}</h1>
          <p className="text-muted mt-2">{tk("subtitle")}</p>
        </div>

        {/* Create Key */}
        <div className="rounded-xl border border-line bg-surface/60 p-5 mb-6">
          <h2 className="text-sm font-semibold text-ink mb-3">
            {tk("createHeading")}
          </h2>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder={tk("namePlaceholder")}
              value={newKeyName}
              onChange={(e) => {
                setNewKeyName(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="flex-1 rounded-lg border border-line-strong bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-blue-500"
            />
            <button
              onClick={handleCreate}
              disabled={creating}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {creating ? tk("generating") : tk("generate")}
            </button>
          </div>
          {error && <p className="text-xs text-rose-600 dark:text-rose-400 mt-2">{error}</p>}
        </div>

        {/* Created Key (show once) */}
        {createdKey && (
          <div className="rounded-xl border border-emerald-300/60 dark:border-emerald-700/60 bg-emerald-100 dark:bg-emerald-900/20 p-5 mb-6">
            <h2 className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-2">
              {tk("createdHeading")}
            </h2>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mb-3">{tk("createdWarning")}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-canvas px-3 py-2 text-xs font-mono text-emerald-700 dark:text-emerald-300 break-all select-all">
                {createdKey}
              </code>
              <button
                onClick={() => handleCopy(createdKey)}
                className="rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-200 dark:bg-emerald-800/40 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200 hover:bg-emerald-200 dark:hover:bg-emerald-800/60 whitespace-nowrap"
              >
                {copied ? tk("copied") : tk("copy")}
              </button>
            </div>
            <button
              onClick={() => setCreatedKey(null)}
              className="text-xs text-subtle hover:text-ink-2 mt-3"
            >
              {tk("dismiss")}
            </button>
          </div>
        )}

        {/* Active Keys */}
        <div className="rounded-xl border border-line bg-surface/60 p-5 mb-6">
          <h2 className="text-sm font-semibold text-ink mb-3">
            {tf("activeHeading", { count: activeKeys.length })}
          </h2>
          {loading ? (
            <p className="text-xs text-subtle">{tk("loading")}</p>
          ) : activeKeys.length === 0 ? (
            <p className="text-xs text-subtle italic">{tk("noActiveKeys")}</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted border-b border-line">
                  <th className="text-left py-2 font-medium">{tk("colName")}</th>
                  <th className="text-left py-2 font-medium">{tk("colKey")}</th>
                  <th className="text-left py-2 font-medium">{tk("colCreated")}</th>
                  <th className="text-left py-2 font-medium">{tk("colLastUsed")}</th>
                  <th className="text-right py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {activeKeys.map((k) => (
                  <tr key={k.id} className="border-b border-line">
                    <td className="py-2 text-ink">{k.name}</td>
                    <td className="py-2 font-mono text-muted">
                      {k.key_prefix}
                    </td>
                    <td className="py-2 text-muted">
                      {new Date(k.created_at).toLocaleDateString(locale)}
                    </td>
                    <td className="py-2 text-muted">
                      {k.last_used_at
                        ? new Date(k.last_used_at).toLocaleDateString(locale)
                        : "—"}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => handleRevoke(k.id, k.name)}
                        className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300"
                      >
                        {tk("revoke")}
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
          <div className="rounded-xl border border-line/50 bg-surface/30 p-5 mb-6">
            <h2 className="text-sm font-semibold text-subtle mb-3">
              {tf("revokedHeading", { count: revokedKeys.length })}
            </h2>
            <table className="w-full text-xs">
              <tbody>
                {revokedKeys.map((k) => (
                  <tr key={k.id} className="border-b border-line/50">
                    <td className="py-2 text-subtle line-through">{k.name}</td>
                    <td className="py-2 font-mono text-subtle">
                      {k.key_prefix}
                    </td>
                    <td className="py-2 text-subtle">
                      {tf("revokedOn", { date: new Date(k.revoked_at!).toLocaleDateString(locale) })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Conectar no claude.ai / Claude Desktop (recomendado) */}
        <div className="rounded-xl border border-indigo-300/50 dark:border-indigo-700/50 bg-indigo-100 dark:bg-indigo-900/10 p-5 mb-6">
          <h2 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-1">
            {tk("recommendedHeading")}
          </h2>
          <p className="text-xs text-muted mb-4">{tk("recommendedIntro")}</p>

          <ol className="space-y-3 mb-4">
            <li className="flex items-start gap-2">
              <span className="rounded-full bg-indigo-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">1</span>
              <div className="flex-1">
                <p className="text-xs text-ink-2 mb-1.5">{tk("step1")}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg bg-canvas px-3 py-2 text-xs font-mono text-indigo-700 dark:text-indigo-300 break-all select-all">
                    {MCP_URL}
                  </code>
                  <button
                    onClick={() => handleCopy(MCP_URL)}
                    className="rounded-lg border border-indigo-300 dark:border-indigo-700 bg-indigo-200 dark:bg-indigo-800/40 px-3 py-2 text-xs text-indigo-800 dark:text-indigo-200 hover:bg-indigo-200 dark:hover:bg-indigo-800/60 whitespace-nowrap"
                  >
                    {copied ? tk("copied") : tk("copy")}
                  </button>
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="rounded-full bg-indigo-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">2</span>
              <p className="text-xs text-ink-2">{tk("step2")}</p>
            </li>
            <li className="flex items-start gap-2">
              <span className="rounded-full bg-indigo-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">3</span>
              <p className="text-xs text-ink-2">{tk("step3")}</p>
            </li>
          </ol>

          <p className="text-xs text-muted mb-2">{tk("tryHeading")}</p>
          <div className="space-y-2">
            {prompts.map((cmd) => (
              <div key={cmd} className="flex items-center gap-2 rounded-lg bg-canvas px-3 py-2">
                <span className="text-indigo-600 dark:text-indigo-400 text-xs">&#128172;</span>
                <span className="text-xs text-ink-2">{cmd}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Aplicativos conectados via OAuth */}
        <div className="rounded-xl border border-line bg-surface/60 p-5 mb-6">
          <h2 className="text-sm font-semibold text-ink mb-1">
            {tk("connectionsHeading")}
          </h2>
          <p className="text-xs text-muted mb-4">{tk("connectionsIntro")}</p>

          {loadingConnections ? (
            <p className="text-xs text-subtle">{tk("loading")}</p>
          ) : connections.length === 0 ? (
            <p className="text-xs text-subtle italic">{tk("noConnections")}</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted border-b border-line">
                  <th className="text-left py-2 font-medium">{tk("colApp")}</th>
                  <th className="text-left py-2 font-medium">{tk("colConnected")}</th>
                  <th className="text-left py-2 font-medium">{tk("colLastUsed")}</th>
                  <th className="text-right py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {connections.map((c) => {
                  const name = c.clientName || tk("defaultAppName");
                  return (
                    <tr key={c.clientId} className="border-b border-line">
                      <td className="py-2 text-ink">{name}</td>
                      <td className="py-2 text-muted">
                        {new Date(c.connectedAt).toLocaleDateString(locale)}
                      </td>
                      <td className="py-2 text-muted">
                        {c.lastUsedAt ? new Date(c.lastUsedAt).toLocaleDateString(locale) : "—"}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => handleRevokeConnection(c.clientId, name)}
                          className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300"
                        >
                          {tk("disconnect")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Uso avançado: Claude Code, scripts e integrações */}
        <div className="rounded-xl border border-line bg-surface/60 p-5">
          <h2 className="text-sm font-semibold text-ink mb-1">
            {tk("advancedHeading")}
          </h2>
          <p className="text-xs text-muted mb-4">{tk("advancedIntro")}</p>

          <p className="text-xs text-ink-2 mb-2">
            {createdKey ? tk("claudeCodeWithKey") : tk("claudeCodeWithoutKey")}
          </p>
          <div className="relative mb-4">
            <pre className="rounded-lg bg-canvas p-4 text-xs font-mono text-ink-2 overflow-x-auto">
              {claudeCodeCommand}
            </pre>
            <button
              onClick={() => handleCopy(claudeCodeCommand)}
              className="absolute top-2 right-2 rounded-lg border border-line-strong bg-surface px-2 py-1 text-[10px] text-ink-2 hover:bg-surface-2"
            >
              {copied ? tk("copied") : tk("copy")}
            </button>
          </div>

          <p className="text-xs text-ink-2 mb-2">{tk("restLabel")}</p>
          <div className="relative mb-4">
            <pre className="rounded-lg bg-canvas p-4 text-xs font-mono text-ink-2 overflow-x-auto">
              {curlExample}
            </pre>
            <button
              onClick={() => handleCopy(curlExample)}
              className="absolute top-2 right-2 rounded-lg border border-line-strong bg-surface px-2 py-1 text-[10px] text-ink-2 hover:bg-surface-2"
            >
              {copied ? tk("copied") : tk("copy")}
            </button>
          </div>

          <div className="rounded-lg bg-canvas/60 border border-line p-3">
            <p className="text-xs text-muted mb-1"><strong>{tk("troubleTitle")}</strong></p>
            <ul className="text-xs text-subtle space-y-1 list-disc ml-4">
              <li>{tk("trouble1")}</li>
              <li>{tk("trouble2")}</li>
              <li>
                {tk("trouble3")}{" "}
                <code className="text-muted">curl -H &quot;Authorization: Bearer SUA_KEY&quot; https://gdd-app.vercel.app/api/v1/me</code>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
