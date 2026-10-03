import { useEffect, useState } from "react";

type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "top25tracker:theme";

function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", choice);
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeChoice>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY) as ThemeChoice) || "system";
    } catch {
      return "system";
    }
  });

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore (private browsing etc.)
    }
  }, [theme]);

  return { theme, setTheme };
}
