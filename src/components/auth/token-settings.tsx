"use client";

import { useCallback, useEffect, useState } from "react";

interface ApiTokenRow {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: number | null;
  createdAt: number | null;
  revokedAt: number | null;
}

function formatDate(seconds: number | null): string {
  if (!seconds) return "—";
  return new Date(seconds * 1000).toLocaleDateString();
}

export function TokenSettings() {
  const [tokens, setTokens] = useState<ApiTokenRow[]>([]);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadTokens = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/auth/tokens");
      if (res.ok) {
        const data = (await res.json()) as ApiTokenRow[];
        setTokens(data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNewToken(null);
    setCopied(false);
    if (!name.trim()) {
      setError("Please enter a name");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/v1/auth/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        setError("Failed to create token");
      } else {
        const data = (await res.json()) as { token: string };
        setNewToken(data.token);
        setName("");
        loadTokens();
      }
    } catch {
      setError("Failed to create token");
    }
    setCreating(false);
  }

  async function handleCopy() {
    if (!newToken) return;
    try {
      await navigator.clipboard.writeText(newToken);
      setCopied(true);
    } catch {
      // ignore
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm("Revoke this token? Devices using it will lose access.")) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/auth/tokens/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        loadTokens();
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <section className="rounded-lg border border-surface-600 bg-surface-800 p-6">
        <h2 className="text-base font-semibold mb-4">Create Token</h2>
        <p className="text-sm text-surface-200 mb-4">
          Generate a token to connect a native client (e.g. your reader device).
          The token is shown only once — copy it now.
        </p>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label
              htmlFor="tokenName"
              className="block text-sm text-surface-200 mb-1"
            >
              Token Name
            </label>
            <input
              id="tokenName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kompakt"
              className="w-full rounded-lg border border-surface-500 bg-surface-700 px-3 py-2 text-sm text-surface-50 focus:border-accent-400 focus:outline-none focus:ring-1 focus:ring-accent-400"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="rounded-lg bg-accent-400 px-4 py-2 text-sm font-medium text-surface-900 hover:bg-accent-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? "Creating..." : "Create Token"}
          </button>
        </form>

        {newToken && (
          <div className="mt-4 space-y-2 rounded-lg border border-accent-400/40 bg-surface-700 p-4">
            <p className="text-xs text-surface-300">
              Copy this token now — it will not be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded-lg bg-surface-900 px-3 py-2 text-xs font-mono text-surface-50">
                {newToken}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 rounded-lg border border-surface-500 px-3 py-2 text-xs font-medium text-surface-200 hover:bg-surface-700 transition-colors"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-surface-600 bg-surface-800 p-6">
        <h2 className="text-base font-semibold mb-4">Your Tokens</h2>
        {tokens.length === 0 ? (
          <p className="text-sm text-surface-300">No tokens yet.</p>
        ) : (
          <div className="space-y-2">
            {tokens.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-lg border border-surface-600 bg-surface-700 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-surface-50">
                    {t.name}
                    {t.revokedAt && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">
                        Revoked
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-surface-300">
                    <code className="font-mono">{t.prefix}…</code> · Created{" "}
                    {formatDate(t.createdAt)} · Last used{" "}
                    {formatDate(t.lastUsedAt)}
                  </p>
                </div>
                {!t.revokedAt && (
                  <button
                    onClick={() => handleRevoke(t.id)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
