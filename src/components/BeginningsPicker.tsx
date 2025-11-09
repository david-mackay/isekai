"use client";
import { useEffect, useState } from "react";

type Beginning = { key: string; title: string; description: string };

export default function BeginningsPicker({
  onSeeded,
  isLoadingStory = false,
  playerCharacter,
  onSelectWithoutCharacter,
}: {
  onSeeded: (beginningKey: string, beginningTitle: string) => Promise<void> | void;
  isLoadingStory?: boolean;
  playerCharacter?: {
    name: string;
    gender: string;
    race: string;
  };
  onSelectWithoutCharacter?: (
    beginningKey: string,
    beginningTitle: string
  ) => void;
}) {
  const [list, setList] = useState<Beginning[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [isSeeded, setIsSeeded] = useState(false);

  useEffect(() => {
    console.log("🎲 Loading available beginnings...");
    fetch("/api/init")
      .then((r) => r.json())
      .then((d) => {
        console.log("✅ Beginnings loaded:", d.beginnings?.length || 0);
        setList(d.beginnings || []);
      })
      .catch((e) => {
        console.error("❌ Failed to load beginnings:", e.message);
        setError(e.message);
      });
  }, []);

  async function pick(key: string) {
    console.log("🎯 Beginning selected:", key);
    setSelectedKey(key);
    setLoading(true);
    setError(null);

    try {
      if (!playerCharacter) {
        const selectedBeginning = list.find((b) => b.key === key);
        const beginningTitle = selectedBeginning?.title || "Unknown Adventure";
        onSelectWithoutCharacter?.(key, beginningTitle);
        setSelectedKey(null);
        setLoading(false);
        return;
      }

      const selectedBeginning = list.find((b) => b.key === key);
      const beginningTitle = selectedBeginning?.title || "Unknown Adventure";
      await onSeeded(key, beginningTitle);
      setIsSeeded(true);
    } catch (e) {
      console.error("❌ Failed to seed beginning:", e);
      setError(e instanceof Error ? e.message : "Unknown error");
      setSelectedKey(null);
    } finally {
      setLoading(false);
    }
  }

  if (!list.length) return null;

  // Hide the picker after successful seeding
  if (isSeeded) {
    return (
      <div className="mb-4 p-3 bg-green-900/20 border border-green-500/30 rounded">
        <div className="flex items-center gap-2 text-green-400 text-sm">
          {isLoadingStory ? (
            <>
              <div className="w-4 h-4 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin"></div>
              <span>Generating your opening story...</span>
            </>
          ) : (
            <>
              <span>
                ✅ Beginning seeded successfully! Your adventure begins below.
              </span>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 border rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold">Choose a beginning</h2>
        {loading && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
            <span className="text-xs opacity-70">Seeding...</span>
          </div>
        )}
      </div>
      {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
      <div className="grid gap-2 sm:grid-cols-2">
        {list.map((b) => (
          <button
            key={b.key}
            className={`text-left border rounded p-3 transition-colors ${
              selectedKey === b.key
                ? "bg-blue-500/20 border-blue-500/50"
                : "hover:bg-white/5"
            }`}
            onClick={() => pick(b.key)}
            disabled={loading}
          >
            <div className="font-medium flex items-center gap-2">
              {selectedKey === b.key && loading && (
                <div className="w-3 h-3 border border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
              )}
              {b.title}
            </div>
            <div className="text-sm opacity-80">{b.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
