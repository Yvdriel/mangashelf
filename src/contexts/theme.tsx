"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Theme, ThemePreference } from "@/lib/theme";
import {
  isTheme,
  resolveSystemTheme,
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  THEME_META_COLORS,
} from "@/lib/theme";

interface ThemeContextValue {
  /** The resolved active theme (never "system") */
  theme: Theme;
  /** The user's raw preference (can be "system") */
  preference: ThemePreference;
  /** Update the theme preference */
  setTheme: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

// Subscribe to OS color scheme changes via useSyncExternalStore
function subscribeToColorScheme(callback: () => void) {
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getColorSchemeSnapshot(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getColorSchemeServerSnapshot(): boolean {
  return true; // assume dark on server
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);

  // Update meta theme-color
  const metaColor = THEME_META_COLORS[theme];
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", metaColor);
  }
}

function setCookie(preference: ThemePreference) {
  document.cookie = `${THEME_COOKIE}=${preference};path=/;max-age=${THEME_COOKIE_MAX_AGE};samesite=lax`;
}

interface ThemeProviderProps {
  initialPreference: ThemePreference;
  children: React.ReactNode;
}

export function ThemeProvider({
  initialPreference,
  children,
}: ThemeProviderProps) {
  const [preference, setPreference] =
    useState<ThemePreference>(initialPreference);
  const mounted = useRef(false);

  // Track OS color scheme reactively without setState in effects
  const prefersDark = useSyncExternalStore(
    subscribeToColorScheme,
    getColorSchemeSnapshot,
    getColorSchemeServerSnapshot,
  );

  // Derive the resolved theme from preference + OS setting
  const theme: Theme = isTheme(preference)
    ? preference
    : resolveSystemTheme(prefersDark);

  // Apply theme to DOM whenever it changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Remove no-transition attribute after first render
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      requestAnimationFrame(() => {
        document.documentElement.removeAttribute("data-no-transition");
      });
    }
  }, []);

  const handleSetTheme = useCallback((pref: ThemePreference) => {
    setPreference(pref);
    setCookie(pref);

    // Persist to DB in background (cookie provides immediate fallback)
    fetch("/api/user/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: pref }),
    }).catch(() => {});
  }, []);

  return (
    <ThemeContext.Provider
      value={{ theme, preference, setTheme: handleSetTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
