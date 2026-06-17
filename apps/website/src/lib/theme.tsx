import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

// Theme types
export type Theme = "dark" | "tan";

// Page identifiers for theme defaults
export type PageType = "login" | "dashboard" | "docs" | "settings" | "default";

// Page-specific theme defaults - configure different defaults per page here
export const PAGE_THEME_DEFAULTS: Record<PageType, Theme> = {
  login: "dark", // Home/Login page defaults to tan
  dashboard: "tan", // Dashboard defaults to dark
  docs: "tan", // Docs page defaults to dark
  settings: "tan", // Settings page defaults to dark
  default: "dark", // Fallback default
};

// Helper to get default theme for a specific page
export function getPageDefaultTheme(page: PageType = "default"): Theme {
  return PAGE_THEME_DEFAULTS[page] ?? PAGE_THEME_DEFAULTS.default;
}

// Tan mode color palette
export const tanColors = {
  bgPrimary: "#faf8f5",
  bgSecondary: "#f5f3f0",
  bgHover: "#ebe9e6",
  textPrimary: "#1a1a1a",
  textSecondary: "#6b6b6b",
  border: "#e6e4e1",
  accent: "#8b7355",
  interactive: "#EB5601",
  interactiveHover: "#d14a01",
};

// Theme context
interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

// Storage key for persisting theme
const THEME_STORAGE_KEY = "opensync-dashboard-theme";

// Theme provider component
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Check localStorage on initial load
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "tan" || stored === "dark") {
        return stored;
      }
    }
    return PAGE_THEME_DEFAULTS.default; // Use configurable default from PAGE_THEME_DEFAULTS
  });

  // Persist theme changes
  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === "dark" ? "tan" : "dark"));
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook to use theme
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

// Hook to apply page-specific default theme on mount
// Only applies if user hasn't set a preference (no stored theme)
export function usePageTheme(page: PageType) {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    // Only apply page default if no user preference is stored
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (!stored) {
      const pageDefault = getPageDefaultTheme(page);
      if (theme !== pageDefault) {
        setTheme(pageDefault);
      }
    }
  }, [page]); // Only run on mount or page change

  return { theme, setTheme };
}

// Helper to get theme-aware class names
export function getThemeClasses(theme: Theme) {
  const isDark = theme === "dark";

  return {
    // Backgrounds
    bgPrimary: isDark ? "bg-[#0E0E0E]" : "bg-[#faf8f5]",
    bgSecondary: isDark ? "bg-zinc-900/30" : "bg-[#f5f3f0]",
    bgCard: isDark ? "bg-zinc-900/30" : "bg-[#f5f3f0]",
    bgHover: isDark ? "hover:bg-zinc-800/50" : "hover:bg-[#ebe9e6]",
    bgActive: isDark ? "bg-zinc-800/40" : "bg-[#ebe9e6]",
    bgInput: isDark ? "bg-zinc-900/50" : "bg-[#f5f3f0]",
    bgToggle: isDark ? "bg-zinc-900/50" : "bg-[#f5f3f0]",
    bgToggleActive: isDark ? "bg-zinc-800" : "bg-[#ebe9e6]",
    bgDropdown: isDark ? "bg-zinc-900" : "bg-[#faf8f5]",
    bgCode: isDark ? "bg-zinc-800/50" : "bg-[#ebe9e6]",
    bgUserBubble: isDark ? "bg-zinc-700" : "bg-[#ebe9e6]",
    bgAssistantBubble: isDark ? "bg-zinc-800/50" : "bg-[#f5f3f0]",

    // Text
    textPrimary: isDark ? "text-zinc-200" : "text-[#1a1a1a]",
    textSecondary: isDark ? "text-zinc-300" : "text-[#1a1a1a]",
    textMuted: isDark ? "text-zinc-400" : "text-[#6b6b6b]",
    textSubtle: isDark ? "text-zinc-500" : "text-[#6b6b6b]",
    textDim: isDark ? "text-zinc-600" : "text-[#8b7355]",
    textPlaceholder: isDark ? "placeholder:text-zinc-600" : "placeholder:text-[#8b7355]",

    // Borders
    border: isDark ? "border-zinc-800/50" : "border-[#e6e4e1]",
    borderLight: isDark ? "border-zinc-800/30" : "border-[#e6e4e1]",
    borderInput: isDark ? "border-zinc-800/50" : "border-[#e6e4e1]",
    borderFocus: isDark ? "focus:border-zinc-700" : "focus:border-[#8b7355]",

    // Dividers
    divide: isDark ? "divide-zinc-800/30" : "divide-[#e6e4e1]",

    // Interactive
    interactive: isDark ? "text-blue-500" : "text-[#EB5601]",
    interactiveHover: isDark ? "hover:text-blue-400" : "hover:text-[#d14a01]",

    // Icons
    iconMuted: isDark ? "text-zinc-600" : "text-[#8b7355]",
    iconSubtle: isDark ? "text-zinc-500" : "text-[#6b6b6b]",
  };
}
