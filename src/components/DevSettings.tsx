"use client";

import { useDevSettings } from "@/contexts/DevSettingsContext";
import { MODEL_OPTIONS } from "@/lib/modelOptions";

export default function DevSettings() {
  const { modelId, setModelId } = useDevSettings();

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
