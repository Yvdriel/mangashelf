"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  ANKI_DEFAULTS,
  mergeAnkiSettings,
  type AnkiSettings,
} from "@/lib/settings/anki";

export interface ReaderSettings {
  ocrEnabled: boolean;
  copyStripLinebreaks: boolean;
  textViewButton: boolean;
  anki: AnkiSettings;
}

const DEFAULTS: ReaderSettings = {
  ocrEnabled: false,
  copyStripLinebreaks: true,
  textViewButton: false,
  anki: { ...ANKI_DEFAULTS },
};

interface SettingsContextValue {
  settings: ReaderSettings;
  loaded: boolean;
  saving: boolean;
  error: string | null;
  save: (patch: Partial<SerializablePatch>) => Promise<void>;
}

interface SerializablePatch {
  ocrEnabled: boolean;
  copyStripLinebreaks: boolean;
  textViewButton: boolean;
  ankiSettings: AnkiSettings;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

interface PreferencesResponse {
  ocrEnabled?: unknown;
  copyStripLinebreaks?: unknown;
  textViewButton?: unknown;
  ankiSettings?: unknown;
}

function fromResponse(data: PreferencesResponse): ReaderSettings {
  return {
    ocrEnabled:
      typeof data.ocrEnabled === "boolean"
        ? data.ocrEnabled
        : DEFAULTS.ocrEnabled,
    copyStripLinebreaks:
      typeof data.copyStripLinebreaks === "boolean"
        ? data.copyStripLinebreaks
        : DEFAULTS.copyStripLinebreaks,
    textViewButton:
      typeof data.textViewButton === "boolean"
        ? data.textViewButton
        : DEFAULTS.textViewButton,
    anki: mergeAnkiSettings(data.ankiSettings),
  };
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/preferences")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PreferencesResponse | null) => {
        if (cancelled) return;
        if (data) setSettings(fromResponse(data));
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(
    async (patch: Partial<SerializablePatch>) => {
      setSaving(true);
      setError(null);
      const prev = settings;
      const optimistic: ReaderSettings = {
        ...prev,
        ...(patch.ocrEnabled !== undefined
          ? { ocrEnabled: patch.ocrEnabled }
          : {}),
        ...(patch.copyStripLinebreaks !== undefined
          ? { copyStripLinebreaks: patch.copyStripLinebreaks }
          : {}),
        ...(patch.textViewButton !== undefined
          ? { textViewButton: patch.textViewButton }
          : {}),
        ...(patch.ankiSettings !== undefined ? { anki: patch.ankiSettings } : {}),
      };
      setSettings(optimistic);

      const body: Record<string, unknown> = {};
      if (patch.ocrEnabled !== undefined) body.ocrEnabled = patch.ocrEnabled;
      if (patch.copyStripLinebreaks !== undefined)
        body.copyStripLinebreaks = patch.copyStripLinebreaks;
      if (patch.textViewButton !== undefined)
        body.textViewButton = patch.textViewButton;
      if (patch.ankiSettings !== undefined)
        body.ankiSettings = patch.ankiSettings;

      try {
        const res = await fetch("/api/user/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
        const data: PreferencesResponse = await res.json();
        setSettings(fromResponse(data));
      } catch (e) {
        setSettings(prev);
        setError(e instanceof Error ? e.message : "Failed to save");
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [settings],
  );

  return (
    <SettingsContext.Provider value={{ settings, loaded, saving, error, save }}>
      {children}
    </SettingsContext.Provider>
  );
}
