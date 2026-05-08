"use client";

import { useEffect, useState } from "react";

export function ReaderSettings() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/preferences")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data) => {
        if (!cancelled) setEnabled(Boolean(data.ocrEnabled));
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(next: boolean) {
    setSaving(true);
    setError(null);
    const prev = enabled;
    setEnabled(next);
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ocrEnabled: next }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      setEnabled(prev);
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (enabled === null) {
    return (
      <section className="rounded-lg border border-surface-600 bg-surface-800 p-6">
        <h2 className="text-base font-semibold mb-4">Reader</h2>
        <p className="text-sm text-surface-300">Loading…</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-surface-600 bg-surface-800 p-6">
      <h2 className="text-base font-semibold mb-4">Reader</h2>

      <label className="flex items-start justify-between gap-4 cursor-pointer">
        <div className="min-w-0">
          <div className="text-sm font-medium">Japanese OCR overlays</div>
          <p className="mt-1 text-xs text-surface-300">
            Render selectable text on top of each page so dictionary popup
            extensions like{" "}
            <a
              href="https://yomitan.wiki/"
              target="_blank"
              rel="noreferrer"
              className="text-accent-400 hover:underline"
            >
              Yomitan
            </a>{" "}
            work over manga panels. Powered by{" "}
            <a
              href="https://github.com/kha-white/mokuro"
              target="_blank"
              rel="noreferrer"
              className="text-accent-400 hover:underline"
            >
              mokuro
            </a>
            . New volumes are OCR&rsquo;d automatically; use the &ldquo;OCR all
            volumes&rdquo; button on a manga page to backfill existing ones.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={saving}
          onClick={() => toggle(!enabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
            enabled ? "bg-accent-400" : "bg-surface-500"
          } ${saving ? "opacity-60" : ""}`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </label>

      {error && (
        <p className="mt-3 text-xs text-red-400">{error}</p>
      )}
    </section>
  );
}
