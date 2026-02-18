"use client";

import { useTheme } from "@/contexts/theme";
import { PREFERENCES, THEME_LABELS } from "@/lib/theme";
import type { ThemePreference } from "@/lib/theme";

/**
 * Hardcoded swatch colors for each theme preview.
 * Uses raw OKLCH values (not CSS vars) so previews show the target theme
 * regardless of the currently active theme.
 */
const SWATCH_COLORS: Record<
  ThemePreference,
  { bg: string; card: string; accent: string; text: string }
> = {
  system: {
    bg: "linear-gradient(135deg, oklch(0.14 0.006 350) 50%, oklch(0.96 0.008 70) 50%)",
    card: "",
    accent: "",
    text: "",
  },
  dark: {
    bg: "oklch(0.14 0.006 350)",
    card: "oklch(0.2 0.01 350)",
    accent: "oklch(0.72 0.11 350)",
    text: "oklch(0.95 0.005 350)",
  },
  chalk: {
    bg: "oklch(0.96 0.008 70)",
    card: "oklch(0.99 0.004 70)",
    accent: "oklch(0.58 0.16 350)",
    text: "oklch(0.22 0.012 50)",
  },
  sakura: {
    bg: "oklch(0.97 0.014 350)",
    card: "oklch(0.99 0.006 350)",
    accent: "oklch(0.55 0.19 350)",
    text: "oklch(0.2 0.015 350)",
  },
  amoled: {
    bg: "oklch(0 0 0)",
    card: "oklch(0.12 0.005 350)",
    accent: "oklch(0.72 0.11 350)",
    text: "oklch(0.9 0.005 350)",
  },
};

function ThemeSwatch({ pref }: { pref: ThemePreference }) {
  const colors = SWATCH_COLORS[pref];

  if (pref === "system") {
    return (
      <div
        className="h-full w-full rounded"
        style={{ background: colors.bg }}
      />
    );
  }

  return (
    <div
      className="flex h-full w-full flex-col justify-between rounded p-1.5"
      style={{ background: colors.bg }}
    >
      <div className="flex items-center gap-1">
        <div
          className="h-1.5 w-6 rounded-full"
          style={{ background: colors.accent }}
        />
        <div
          className="h-1.5 w-3 rounded-full opacity-40"
          style={{ background: colors.text }}
        />
      </div>
      <div className="flex gap-1">
        <div
          className="h-4 flex-1 rounded-sm"
          style={{ background: colors.card }}
        />
        <div
          className="h-4 flex-1 rounded-sm"
          style={{ background: colors.card }}
        />
      </div>
    </div>
  );
}

export function ThemePicker() {
  const { preference, setTheme } = useTheme();

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
      {PREFERENCES.map((pref) => {
        const isSelected = preference === pref;
        return (
          <button
            key={pref}
            type="button"
            onClick={() => setTheme(pref)}
            className={`flex flex-col items-center gap-2 rounded-lg border p-2 transition-colors hover:cursor-pointer ${
              isSelected
                ? "border-accent-400 bg-accent-400/10"
                : "border-surface-600 hover:border-surface-400"
            }`}
          >
            <div className="aspect-[4/3] w-full overflow-hidden rounded border border-surface-600">
              <ThemeSwatch pref={pref} />
            </div>
            <span
              className={`text-xs font-medium ${
                isSelected ? "text-accent-300" : "text-surface-200"
              }`}
            >
              {THEME_LABELS[pref]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
