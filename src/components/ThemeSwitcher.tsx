"use client";
import { useState } from "react";
import { useTheme, themes, type Theme } from "@/contexts/ThemeContext";

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg transition-colors"
        style={{
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border)",
          color: "var(--color-text)",
        }}
        title="Change theme"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div
            className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg border z-20"
            style={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
            }}
          >
            <div className="p-2">
              <div
                className="px-3 py-2 text-sm font-medium border-b"
                style={{
                  color: "var(--color-text)",
                  borderColor: "var(--color-border)",
                }}
              >
                Choose Theme
              </div>
              <div className="space-y-1 mt-2">
                {Object.entries(themes).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setTheme(key as Theme);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center gap-3 ${
                      theme === key ? "font-medium" : ""
                    }`}
                    style={{
                      backgroundColor:
                        theme === key ? "var(--color-primary)" : "transparent",
                      color: theme === key ? "white" : "var(--color-text)",
                    }}
                    onMouseEnter={(e) => {
                      if (theme !== key) {
                        e.currentTarget.style.backgroundColor =
                          "var(--color-surface-hover)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (theme !== key) {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }
                    }}
                  >
                    {/* Theme preview dot */}
                    <div
                      className="w-4 h-4 rounded-full border-2"
                      style={{
                        backgroundColor: config.colors.primary,
                        borderColor: config.colors.accent,
                      }}
                    />
                    <span>{config.name}</span>
                    {theme === key && (
                      <svg
                        className="w-4 h-4 ml-auto"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
