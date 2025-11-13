"use client";
import BeginningsPicker from "./BeginningsPicker";
import CharacterCreation, { CharacterData } from "./CharacterCreation";

export default function StartPanel({
  character,
  onCharacterRequest,
  onCharacterComplete,
  onSeeded,
  isLoadingStory,
  availableWorlds,
  worldKey,
  onWorldChange,
}: {
  character: CharacterData | null;
  onCharacterRequest: () => void;
  onCharacterComplete: (character: CharacterData) => void;
  onSeeded: (key: string, title: string) => Promise<void> | void;
  isLoadingStory: boolean;
  availableWorlds: { key: string; title: string }[];
  worldKey: string;
  onWorldChange: (k: string) => void;
}) {
  // Mobile-first single column layout
  return (
    <div className="w-full max-w-xl mx-auto p-4">
      {!character ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Create your character</h2>
          <CharacterCreation onComplete={onCharacterComplete} />
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Choose a beginning</h2>
          <div className="border border-gray-700 rounded px-3 py-2 text-sm bg-black/20">
            <div className="font-medium text-gray-200">
              {character.name} — {character.gender}, {character.race}
            </div>
            {character.backstory?.trim() ? (
              <p className="mt-2 text-gray-400 whitespace-pre-line">
                {character.backstory.trim()}
              </p>
            ) : (
              <p className="mt-2 text-gray-500">
                No backstory provided yet. You can flesh it out through play or
                update it later using the backstory tool.
              </p>
            )}
          </div>
          <div className="mb-2">
            <label className="block text-sm mb-1">World</label>
            <select
              className="w-full border rounded px-3 py-2 bg-transparent"
              value={worldKey}
              onChange={(e) => onWorldChange(e.target.value)}
            >
              {availableWorlds.map((w) => (
                <option key={w.key} value={w.key}>
                  {w.title}
                </option>
              ))}
            </select>
          </div>
          <BeginningsPicker
            playerCharacter={character}
            onSelectWithoutCharacter={() => onCharacterRequest()}
            onSeeded={onSeeded}
            isLoadingStory={isLoadingStory}
          />
        </div>
      )}
    </div>
  );
}
