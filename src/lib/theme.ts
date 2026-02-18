export const THEMES = ["dark", "chalk", "sakura", "amoled"] as const;
export const PREFERENCES = ["system", ...THEMES] as const;

export type Theme = (typeof THEMES)[number];
export type ThemePreference = (typeof PREFERENCES)[number];

export const THEME_LABELS: Record<ThemePreference, string> = {
  system: "System",
  dark: "Dark",
  chalk: "Chalk",
  sakura: "Sakura",
  amoled: "AMOLED",
};

export const THEME_META_COLORS: Record<Theme, string> = {
  dark: "#1a1a1e",
  chalk: "#f5f0eb",
  sakura: "#fdf2f4",
  amoled: "#000000",
};

export const THEME_COOKIE = "mangashelf-theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function isTheme(value: string): value is Theme {
  return (THEMES as readonly string[]).includes(value);
}

export function isThemePreference(value: string): value is ThemePreference {
  return (PREFERENCES as readonly string[]).includes(value);
}

export function resolveSystemTheme(prefersDark: boolean): Theme {
  return prefersDark ? "dark" : "chalk";
}
