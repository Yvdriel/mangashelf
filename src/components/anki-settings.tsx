"use client";

import { useState } from "react";
import { useSettings } from "@/contexts/settings";
import {
  ANKI_DEFAULTS,
  type AnkiSettings as AnkiSettingsT,
} from "@/lib/settings/anki";
import {
  AnkiConnectError,
  type AnkiErrorKind,
  getVersion,
} from "@/lib/anki/client";
import { listTagVariables } from "@/lib/anki/tag-template";

interface ConnectionState {
  status: "idle" | "testing" | "ok" | "error";
  message?: string;
  kind?: AnkiErrorKind;
  version?: number;
}

export function AnkiSettings() {
  const { settings, loaded, saving, save } = useSettings();

  if (!loaded) {
    return (
      <section className="rounded-lg border border-surface-600 bg-surface-800 p-6">
        <h2 className="text-base font-semibold mb-4">AnkiConnect</h2>
        <p className="text-sm text-surface-300">Loading…</p>
      </section>
    );
  }

  return (
    <AnkiSettingsForm
      key={JSON.stringify(settings.anki)}
      initial={settings.anki}
      saving={saving}
      onSave={async (next) => save({ ankiSettings: next })}
    />
  );
}

function AnkiSettingsForm({
  initial,
  saving,
  onSave,
}: {
  initial: AnkiSettingsT;
  saving: boolean;
  onSave: (next: AnkiSettingsT) => Promise<void>;
}) {
  const [draft, setDraft] = useState<AnkiSettingsT>(initial);
  const [conn, setConn] = useState<ConnectionState>({ status: "idle" });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [origin] = useState<string>(() =>
    typeof window === "undefined" ? "" : window.location.origin,
  );

  function update<K extends keyof AnkiSettingsT>(
    key: K,
    value: AnkiSettingsT[K],
  ) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function updateField(key: keyof AnkiSettingsT["fields"], value: string) {
    setDraft((d) => ({ ...d, fields: { ...d.fields, [key]: value } }));
  }

  async function commit() {
    setSaveError(null);
    try {
      await onSave(draft);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save");
    }
  }

  function reset() {
    setDraft({ ...ANKI_DEFAULTS });
  }

  async function testConnection() {
    setConn({ status: "testing" });
    try {
      const v = await getVersion(draft.url);
      setConn({ status: "ok", version: v });
    } catch (err) {
      const ankiErr = err instanceof AnkiConnectError ? err : null;
      setConn({
        status: "error",
        kind: ankiErr?.kind ?? "unknown",
        message: ankiErr?.message ?? String(err),
      });
    }
  }

  const corsSnippet = `"webCorsOriginList": [\n    "http://localhost",\n    ${JSON.stringify(origin || "<your-mangashelf-origin>")}\n]`;

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  return (
    <section className="rounded-lg border border-surface-600 bg-surface-800 p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">AnkiConnect</h2>
          <p className="mt-1 text-xs text-surface-300">
            Send sentence + cropped panel image to Anki via{" "}
            <a
              href="https://foosoft.net/projects/anki-connect/"
              target="_blank"
              rel="noreferrer"
              className="text-accent-400 hover:underline"
            >
              AnkiConnect
            </a>
            . Requires Anki running locally with the AnkiConnect add-on
            installed and this origin allow-listed in its CORS config.
          </p>
        </div>
        <Switch
          checked={draft.enabled}
          disabled={saving}
          onChange={(next) => update("enabled", next)}
        />
      </header>

      <Field label="AnkiConnect URL">
        <input
          type="url"
          value={draft.url}
          onChange={(e) => update("url", e.target.value)}
          className={inputCls}
          placeholder={ANKI_DEFAULTS.url}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={testConnection}
          disabled={conn.status === "testing"}
          className="rounded-lg border border-surface-500 px-3 py-1.5 text-xs font-medium text-surface-100 hover:bg-surface-700 disabled:opacity-60 cursor-pointer"
        >
          {conn.status === "testing" ? "Testing…" : "Test connection"}
        </button>
        <ConnectionStatus state={conn} corsSnippet={corsSnippet} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Deck">
          <input
            type="text"
            value={draft.deck}
            onChange={(e) => update("deck", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Note type / model">
          <input
            type="text"
            value={draft.model}
            onChange={(e) => update("model", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Sentence field">
          <input
            type="text"
            value={draft.fields.sentence}
            onChange={(e) => updateField("sentence", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Image field">
          <input
            type="text"
            value={draft.fields.image}
            onChange={(e) => updateField("image", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Source field (optional)">
          <input
            type="text"
            value={draft.fields.source}
            onChange={(e) => updateField("source", e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>

      <Field
        label="Tags"
        help={
          <>
            Comma-separated. Variables:{" "}
            <code className="text-surface-100">
              {listTagVariables().join(" ")}
            </code>
            . Spaces in values become underscores.
          </>
        }
      >
        <input
          type="text"
          value={draft.tags.join(", ")}
          onChange={(e) =>
            update(
              "tags",
              e.target.value
                .split(",")
                .map((t) => t.trim())
                .filter((t) => t.length > 0),
            )
          }
          className={inputCls}
          placeholder="mangashelf, {series}, vol{volume}, p{page}"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Image format">
          <select
            value={draft.imageFormat}
            onChange={(e) =>
              update("imageFormat", e.target.value as "png" | "jpeg")
            }
            className={inputCls}
          >
            <option value="jpeg">JPEG</option>
            <option value="png">PNG</option>
          </select>
        </Field>
        <Field
          label={`JPEG quality (${draft.jpegQuality})`}
          help={
            draft.imageFormat === "png"
              ? "Ignored when format is PNG."
              : undefined
          }
        >
          <input
            type="range"
            min={1}
            max={100}
            step={1}
            value={draft.jpegQuality}
            onChange={(e) => update("jpegQuality", parseInt(e.target.value, 10))}
            disabled={draft.imageFormat === "png"}
            className="w-full"
          />
        </Field>
        <Field
          label="Crop padding (px)"
          help="Pixels added around the selected text-box on the source image."
        >
          <input
            type="number"
            min={0}
            value={draft.cropPadding}
            onChange={(e) =>
              update("cropPadding", Math.max(0, parseInt(e.target.value, 10) || 0))
            }
            className={inputCls}
          />
        </Field>
        <Field label="Capture mode">
          <select
            value={draft.mode}
            onChange={(e) =>
              update("mode", e.target.value as "create" | "update-last")
            }
            className={inputCls}
          >
            <option value="create">Create new card</option>
            <option value="update-last">Update last card in deck</option>
          </select>
        </Field>
      </div>

      {saveError && <p className="text-xs text-red-400">{saveError}</p>}

      <div className="flex items-center gap-3 border-t border-surface-700 pt-4">
        <button
          type="button"
          onClick={commit}
          disabled={saving || !dirty}
          className="rounded-lg bg-accent-400 px-4 py-2 text-sm font-medium text-surface-900 hover:bg-accent-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={reset}
          className="text-xs text-surface-300 hover:text-surface-100 transition-colors"
        >
          Reset to defaults
        </button>
      </div>
    </section>
  );
}

const inputCls =
  "w-full rounded-lg border border-surface-500 bg-surface-700 px-3 py-2 text-sm text-surface-50 focus:border-accent-400 focus:outline-none focus:ring-1 focus:ring-accent-400";

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm text-surface-200 mb-1">{label}</span>
      {children}
      {help && <p className="mt-1 text-xs text-surface-400">{help}</p>}
    </label>
  );
}

function Switch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
        checked ? "bg-accent-400" : "bg-surface-500"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function ConnectionStatus({
  state,
  corsSnippet,
}: {
  state: ConnectionState;
  corsSnippet: string;
}) {
  if (state.status === "idle" || state.status === "testing") {
    return null;
  }
  if (state.status === "ok") {
    return (
      <span className="text-xs text-green-400">
        Connected to AnkiConnect v{state.version}.
      </span>
    );
  }

  const help = renderErrorHelp(state.kind);
  return (
    <div className="w-full text-xs">
      <p className="text-red-400">
        {help.title}
        {state.message ? ` — ${state.message}` : ""}
      </p>
      <p className="mt-1 text-surface-300">{help.body}</p>
      {state.kind === "cors" && (
        <details className="mt-2">
          <summary className="cursor-pointer text-surface-100">
            Show config snippet
          </summary>
          <p className="mt-2 text-surface-300">
            Open Anki → Tools → Add-ons → AnkiConnect → Config and merge:
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-900 border border-surface-700 px-3 py-2 text-[11px] leading-snug text-surface-100">
            {corsSnippet}
          </pre>
          <p className="mt-1 text-surface-400">
            Restart Anki after saving so AnkiConnect picks up the new origin.
          </p>
        </details>
      )}
    </div>
  );
}

function renderErrorHelp(kind: AnkiErrorKind | undefined): {
  title: string;
  body: string;
} {
  switch (kind) {
    case "cors":
      return {
        title: "CORS or unreachable",
        body:
          "Anki refused this origin (or isn't running). Add the snippet below to AnkiConnect's webCorsOriginList and restart Anki.",
      };
    case "offline":
      return {
        title: "Anki is offline",
        body:
          "Could not reach the URL. Confirm Anki is running and that the AnkiConnect URL is correct.",
      };
    case "rejected":
      return {
        title: "AnkiConnect rejected the request",
        body:
          "AnkiConnect returned an error. Check your deck and note type names, then retry.",
      };
    default:
      return {
        title: "Unexpected response",
        body:
          "AnkiConnect returned an unexpected response. Check your URL and that AnkiConnect is up to date.",
      };
  }
}
