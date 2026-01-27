import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "matrix" | "cyberpunk" | "terminal";

export const themeOptions: { value: Theme; label: string; description: string }[] = [
  { value: "light", label: "Light", description: "Clean light mode" },
  { value: "dark", label: "Dark", description: "Easy on the eyes" },
  { value: "matrix", label: "Matrix", description: "Neon green hacker style" },
  { value: "cyberpunk", label: "Cyberpunk", description: "Cyan & magenta neon" },
  { value: "terminal", label: "Terminal", description: "Classic amber terminal" },
];

const darkThemes: Theme[] = ["dark", "matrix", "cyberpunk", "terminal"];

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("theme") as Theme;
      if (stored && themeOptions.some(t => t.value === stored)) return stored;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  });

  useEffect(() => {
    const root = document.documentElement;

    root.classList.remove("dark");
    themeOptions.forEach(t => {
      if (t.value !== "light" && t.value !== "dark") {
        root.classList.remove(t.value);
      }
    });

    if (darkThemes.includes(theme)) {
      root.classList.add("dark");
    }

    if (theme !== "light" && theme !== "dark") {
      root.classList.add(theme);
    }

    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    const currentIndex = themeOptions.findIndex(t => t.value === theme);
    const nextIndex = (currentIndex + 1) % themeOptions.length;
    setThemeState(themeOptions[nextIndex].value);
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
