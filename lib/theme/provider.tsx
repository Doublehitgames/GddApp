"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { readThemePreference, resolveTheme, THEME_STORAGE_KEY, type ResolvedTheme, type ThemePreference } from "./config";

type ThemeContextValue = {
  /** O que a pessoa escolheu: seguir o sistema, ou um tema fixo. */
  preference: ThemePreference;
  /** O tema que está valendo agora — é o que componentes como o BlockNote recebem. */
  theme: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [systemDark, setSystemDark] = useState(true);
  // Até ler o localStorage, quem manda é o script do <head>; aplicar antes
  // disso piscaria o tema padrão por um frame.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPreferenceState(readThemePreference());
    setSystemDark(systemPrefersDark());
    setReady(true);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const theme = resolveTheme(preference, systemDark);

  useEffect(() => {
    if (ready) document.documentElement.dataset.theme = theme;
  }, [ready, theme]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // modo privado: o tema vale só nesta aba
    }
  }, []);

  const value = useMemo(() => ({ preference, theme, setPreference }), [preference, theme, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fora do provider (testes, telas isoladas): escuro, que era o padrão histórico.
    return { preference: "system", theme: "dark", setPreference: () => {} };
  }
  return ctx;
}
