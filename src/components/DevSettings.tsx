"use client";

import { useState, useEffect } from "react";
import { useDevSettings } from "@/contexts/DevSettingsContext";
import { MODEL_OPTIONS } from "@/lib/modelOptions";

const AUTH_STORAGE_KEY = "isekai:devAuth";

export default function DevSettings() {
  const { modelId, setModelId } = useDevSettings();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = window.sessionStorage.getItem(AUTH_STORAGE_KEY);
      if (stored === "true") {
        setIsAuthenticated(true);
      }
    }
  }, []);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/dev/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (res.ok && data.success) {
        setIsAuthenticated(true);
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(AUTH_STORAGE_KEY, "true");
        }
        setPassword("");
      } else {
        setError(data.error || "Invalid password");
      }
    } catch (err) {
      setError("Failed to verify password");
    }
  };

  if (!isAuthenticated) {
    return (
      <header
        className="sticky top-0 z-50 border-b px-4 py-3 backdrop-blur"
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--color-surface) 92%, transparent)",
          borderColor: "var(--color-border)",
          color: "var(--color-text)",
        }}
      >
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between text-sm">
          <span
            className="font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--color-text-muted)" }}
          >
            Dev Settings
          </span>
          <form onSubmit={handlePasswordSubmit} className="flex items-center gap-2">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Dev password"
              className="rounded border px-3 py-1.5 text-sm focus:outline-none"
              style={{
                backgroundColor: "var(--color-surface)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
            />
            <button
              type="submit"
              className="rounded border px-3 py-1.5 text-sm"
              style={{
                backgroundColor: "var(--color-surface)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
            >
              Unlock
            </button>
            {error && (
              <span className="text-xs text-red-400">{error}</span>
            )}
          </form>
        </div>
      </header>
    );
  }

  return (
    <header
      className="sticky top-0 z-50 border-b px-4 py-3 backdrop-blur"
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--color-surface) 92%, transparent)",
        borderColor: "var(--color-border)",
        color: "var(--color-text)",
      }}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 text-sm md:flex-row md:items-center md:justify-between">
        <div
          className="flex items-center gap-2 font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--color-text-muted)" }}
        >
          <span
            className="rounded border px-2 py-0.5 text-xs"
            style={{ borderColor: "var(--color-border)" }}
          >
            Dev Settings
          </span>
          <span className="text-xs">Control AI model & debug options</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs uppercase tracking-[0.08em]">Model</label>
          <select
            className="min-w-[200px] rounded border px-3 py-2 text-sm focus:outline-none"
            style={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
            }}
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
          >
            {MODEL_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
}
