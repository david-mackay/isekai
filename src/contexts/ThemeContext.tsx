"use client";
import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "light" | "green" | "pink" | "black" | "paper";

export interface ThemeConfig {
  name: string;
  colors: {
    background: string;
    surface: string;
    surfaceHover: string;
    border: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    primary: string;
    primaryHover: string;
    accent: string;
    success: string;
    error: string;
    warning: string;
  };
}

export const themes: Record<Theme, ThemeConfig> = {
  dark: {
    name: "Dark",
    colors: {
      background: "rgb(17 24 39)", // gray-900
      surface: "rgb(31 41 55)", // gray-800
      surfaceHover: "rgb(55 65 81)", // gray-700
      border: "rgb(75 85 99)", // gray-600
      text: "rgb(243 244 246)", // gray-100
      textSecondary: "rgb(209 213 219)", // gray-300
      textMuted: "rgb(156 163 175)", // gray-400
      primary: "rgb(59 130 246)", // blue-500
      primaryHover: "rgb(37 99 235)", // blue-600
      accent: "rgb(168 85 247)", // purple-500
      success: "rgb(34 197 94)", // green-500
      error: "rgb(239 68 68)", // red-500
      warning: "rgb(245 158 11)", // amber-500
    },
  },
  light: {
    name: "Light",
    colors: {
      background: "rgb(249 250 251)", // gray-50
      surface: "rgb(255 255 255)", // white
      surfaceHover: "rgb(243 244 246)", // gray-100
      border: "rgb(209 213 219)", // gray-300
      text: "rgb(17 24 39)", // gray-900
      textSecondary: "rgb(55 65 81)", // gray-700
      textMuted: "rgb(107 114 128)", // gray-500
      primary: "rgb(59 130 246)", // blue-500
      primaryHover: "rgb(37 99 235)", // blue-600
      accent: "rgb(168 85 247)", // purple-500
      success: "rgb(34 197 94)", // green-500
      error: "rgb(239 68 68)", // red-500
      warning: "rgb(245 158 11)", // amber-500
    },
  },
  green: {
    name: "Forest Night",
    colors: {
      background: "rgb(20 30 20)", // Very dark green
      surface: "rgb(30 45 30)", // Dark forest green
      surfaceHover: "rgb(40 60 40)", // Slightly lighter forest green
      border: "rgb(60 80 60)", // Muted forest green
      text: "rgb(220 255 220)", // Light mint green
      textSecondary: "rgb(180 220 180)", // Soft green
      textMuted: "rgb(140 180 140)", // Muted green
      primary: "rgb(34 197 94)", // Bright green
      primaryHover: "rgb(22 163 74)", // Darker green
      accent: "rgb(132 204 22)", // Lime green
      success: "rgb(74 222 128)", // Light green
      error: "rgb(248 113 113)", // Soft red
      warning: "rgb(251 191 36)", // Warm yellow
    },
  },
  pink: {
    name: "Sensual Rose",
    colors: {
      background: "rgb(30 20 25)", // Deep burgundy/black
      surface: "rgb(45 30 38)", // Rich wine
      surfaceHover: "rgb(60 40 50)", // Deeper rose
      border: "rgb(80 60 70)", // Muted rose
      text: "rgb(255 220 240)", // Soft pink white
      textSecondary: "rgb(240 180 210)", // Light rose
      textMuted: "rgb(200 140 170)", // Muted rose
      primary: "rgb(236 72 153)", // Hot pink
      primaryHover: "rgb(219 39 119)", // Deeper pink
      accent: "rgb(217 70 239)", // Magenta
      success: "rgb(134 239 172)", // Soft mint
      error: "rgb(248 113 113)", // Soft coral
      warning: "rgb(252 211 77)", // Warm gold
    },
  },
  black: {
    name: "True Black",
    colors: {
      background: "#000000",
      surface: "#0a0a0a",
      surfaceHover: "#141414",
      border: "#262626",
      text: "#f5f5f5",
      textSecondary: "#e5e5e5",
      textMuted: "#a3a3a3",
      primary: "#22c55e",
      primaryHover: "#16a34a",
      accent: "#60a5fa",
      success: "#22c55e",
      error: "#ef4444",
      warning: "#f59e0b",
    },
  },
  paper: {
    name: "Storybook",
    colors: {
      background: "#f5f0e6", // parchment
      surface: "#fffaf0",
      surfaceHover: "#f3ead8",
      border: "#d6c8ac",
      text: "#2b271f", // ink
      textSecondary: "#4a4336",
      textMuted: "#6b624f",
      primary: "#8b5e34", // leather brown
      primaryHover: "#6f4a29",
      accent: "#b08968",
      success: "#4caf50",
      error: "#c0392b",
      warning: "#e0a106",
    },
  },
};

interface ThemeContextType {
  theme: Theme;
  themeConfig: ThemeConfig;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    // Load theme from localStorage
    const stored = localStorage.getItem("isekai_theme");
    if (stored && stored in themes) {
      setThemeState(stored as Theme);
    }
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("isekai_theme", newTheme);

    // Apply CSS variables to document root
    const root = document.documentElement;
    const colors = themes[newTheme].colors;

    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(
        `--color-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`,
        value
      );
    });
  };

  useEffect(() => {
    // Apply initial theme
    setTheme(theme);
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeConfig: themes[theme],
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
