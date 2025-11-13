"use client";

import { useEffect, useMemo, useState } from "react";
import {
  mergeStructuredValues,
  sanitizeStructuredObject,
} from "@/lib/utils/structuredMerge";

type CharacterSummary = {
  id: string;
  name: string;
  description: string;
  data: Record<string, unknown>;
};

type CharacterSheetProps = {
  sessionId?: string | null;
};

function formatScalar(value: unknown): string {
  if (value === null || value === undefined) {
    return "Unknown";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return JSON.stringify(value, null, 2);
}

function DataTree({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="opacity-70">Unknown</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="opacity-70">None</span>;
    }
    return (
      <ul className="space-y-1">
        {value.map((item, index) => (
          <li
            key={index}
            className="rounded border border-white/10 bg-white/5 px-3 py-2 text-sm"
          >
            <DataTree value={item} />
          </li>
        ))}
      </ul>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return <span className="opacity-70">No details recorded yet.</span>;
    }
    return (
      <dl className="space-y-3">
        {entries.map(([key, val]) => (
          <div key={key} className="space-y-1">
            <dt className="text-xs uppercase tracking-[0.12em] opacity-60">
              {key.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}
            </dt>
            <dd className="text-sm leading-relaxed">
              <DataTree value={val} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return <span>{formatScalar(value)}</span>;
}

function dedupeCharacterSummaries(
  characters: CharacterSummary[]
): CharacterSummary[] {
  const byName = new Map<string, CharacterSummary>();
  for (const character of characters) {
    const normalizedName = character.name.trim();
    const key = normalizedName.toLowerCase();
    const sanitizedData = sanitizeStructuredObject(character.data ?? {});
    if (!byName.has(key)) {
      byName.set(key, {
        ...character,
        name: normalizedName,
        data: sanitizedData,
      });
      continue;
    }
    const existing = byName.get(key)!;
    const mergedData = sanitizeStructuredObject(
      mergeStructuredValues(existing.data ?? {}, sanitizedData) as Record<
        string,
        unknown
      >
    );
    const existingDescriptionLength = existing.description?.length ?? 0;
    const incomingDescriptionLength = character.description?.length ?? 0;
    const merged: CharacterSummary = {
      ...existing,
      id: existing.id,
      description:
        incomingDescriptionLength > existingDescriptionLength
          ? character.description
          : existing.description,
      data: mergedData,
    };
    byName.set(key, merged);
  }
  return Array.from(byName.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

export default function CharacterSheet({ sessionId }: CharacterSheetProps) {
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setCharacters([]);
      setSelectedId(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/characters?sessionId=${sessionId}`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data.characters)) {
          const deduped = dedupeCharacterSummaries(data.characters);
          setCharacters(deduped);
          setSelectedId((prev) => {
            if (prev && deduped.some((c: CharacterSummary) => c.id === prev)) {
              return prev;
            }
            return deduped[0]?.id ?? null;
          });
        } else {
          setCharacters([]);
          setSelectedId(null);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load characters.";
        setError(message);
        setCharacters([]);
        setSelectedId(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const selectedCharacter = useMemo(
    () => characters.find((c) => c.id === selectedId) ?? null,
    [characters, selectedId]
  );

  return (
    <aside
      className="space-y-3 rounded border px-4 py-4"
      style={{
        borderColor: "var(--color-border)",
        backgroundColor: "var(--color-surface)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] opacity-70">
            Character Sheet
          </h2>
          <p className="text-xs opacity-60">
            View notes and traits discovered in play.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs uppercase tracking-[0.16em] opacity-60">
          Known Characters
        </label>
        <select
          className="w-full rounded border bg-transparent px-3 py-2 text-sm"
          style={{ borderColor: "var(--color-border)" }}
          value={selectedId ?? ""}
          onChange={(event) => setSelectedId(event.target.value || null)}
          disabled={!sessionId || characters.length === 0}
        >
          {!sessionId && (
            <option value="">Select a story to view characters</option>
          )}
          {sessionId && characters.length === 0 && (
            <option value="">No characters discovered yet</option>
          )}
          {characters.map((character) => (
            <option key={character.id} value={character.id}>
              {character.name}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="rounded border border-dashed px-3 py-2 text-xs opacity-60">
          Loading character details…
        </div>
      )}

      {error && (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      )}

      {selectedCharacter ? (
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="text-lg font-semibold">
              {selectedCharacter.name}
            </div>
            <p className="text-sm leading-relaxed opacity-80">
              {selectedCharacter.description || "No description recorded yet."}
            </p>
          </div>
          <div>
            <h3 className="mb-2 text-xs uppercase tracking-[0.16em] opacity-60">
              Known Details
            </h3>
            <div
              className="rounded border px-3 py-3 text-sm leading-relaxed"
              style={{ borderColor: "var(--color-border)" }}
            >
              <DataTree value={selectedCharacter.data} />
            </div>
          </div>
        </div>
      ) : (
        !loading &&
        !error && (
          <p className="text-sm opacity-70">
            {sessionId
              ? "Select a character to inspect their sheet."
              : "Pick or create a story to view character sheets."}
          </p>
        )
      )}
    </aside>
  );
}
