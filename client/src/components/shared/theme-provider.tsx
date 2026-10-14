import { useCallback, useEffect, useState } from "react";
import { ThemeContext, type Theme } from "@/lib/theme";

const STORAGE_KEY = "redlink-theme";

const systemPrefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

function readStored(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

/**
 * Light / dark / system theme (spec 11: support dark mode). Adds the "dark" class to <html>.
 * index.html sets the class before React loads, so there's no flash of the wrong theme.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStored);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      if (t === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // storage unavailable: the theme still applies for this visit
    }
  }, []);

  return <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>{children}</ThemeContext.Provider>;
}
