"use client";

import { useSettings } from "@/contexts/settings";

export function ReaderSettings() {
  const { settings, loaded, saving, error, save } = useSettings();

  if (!loaded) {
    return (
      <section className="rounded-lg border border-surface-600 bg-surface-800 p-6">
        <h2 className="text-base font-semibold mb-4">Reader</h2>
        <p className="text-sm text-surface-300">Loading…</p>
      </section>
    );
  }

  const ocrEnabled = settings.ocrEnabled;

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
          aria-checked={ocrEnabled}
          disabled={saving}
          onClick={() => save({ ocrEnabled: !ocrEnabled }).catch(() => {})}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
            ocrEnabled ? "bg-accent-400" : "bg-surface-500"
          } ${saving ? "opacity-60" : ""}`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              ocrEnabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </label>

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </section>
  );
}
