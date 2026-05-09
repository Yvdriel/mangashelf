"use client";

import { useSettings } from "@/contexts/settings";

export function TextToolsSettings() {
  const { settings, loaded, saving, error, save } = useSettings();

  if (!loaded) {
    return (
      <section className="rounded-lg border border-surface-600 bg-surface-800 p-6">
        <h2 className="text-base font-semibold mb-4">Text tools</h2>
        <p className="text-sm text-surface-300">Loading…</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-surface-600 bg-surface-800 p-6 space-y-5">
      <h2 className="text-base font-semibold">Text tools</h2>

      <Toggle
        label="Strip linebreaks on copy"
        description={
          <>
            When you copy OCR text from a manga panel or text-only view,
            remove all line breaks from the clipboard. Bubbles often wrap
            mid-sentence — Yomitan and DeepL both fail on copies that
            contain <code className="text-surface-100">\n</code>. Other
            whitespace (regular and ideographic spaces) is preserved.
            Only applies inside <code className="text-surface-100">lang=&quot;ja&quot;</code>{" "}
            elements.
          </>
        }
        checked={settings.copyStripLinebreaks}
        saving={saving}
        onToggle={(next) =>
          save({ copyStripLinebreaks: next }).catch(() => {})
        }
      />

      <Toggle
        label="Show text-view button in reader"
        description={
          <>
            Adds a small &ldquo;Text&rdquo; link in the reader top bar that
            opens the current volume as a plain-HTML page suitable for
            Yomitan whole-volume scanning.
          </>
        }
        checked={settings.textViewButton}
        saving={saving}
        onToggle={(next) => save({ textViewButton: next }).catch(() => {})}
      />

      {error && <p className="text-xs text-red-400">{error}</p>}
    </section>
  );
}

function Toggle({
  label,
  description,
  checked,
  saving,
  onToggle,
}: {
  label: string;
  description: React.ReactNode;
  checked: boolean;
  saving: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <p className="mt-1 text-xs text-surface-300">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={saving}
        onClick={() => onToggle(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
          checked ? "bg-accent-400" : "bg-surface-500"
        } ${saving ? "opacity-60" : ""}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}
