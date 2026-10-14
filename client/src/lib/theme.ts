import { createContext, useContext } from "react";

export type Theme = "light" | "dark" | "system";

export interface ThemeValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (t: Theme) => void;
}

/** Provided by <ThemeProvider>. */
export const ThemeContext = createContext<ThemeValue>({ theme: "system", resolvedTheme: "light", setTheme: () => {} });

export const useTheme = () => useContext(ThemeContext);
