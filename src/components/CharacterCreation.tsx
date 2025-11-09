"use client";
import { useState } from "react";

export interface CharacterData {
  name: string;
  gender: string;
  race: string;
}

interface CharacterCreationProps {
  onComplete: (character: CharacterData) => void;
}

const GENDERS = ["Male", "Female", "Non-binary", "Other"];

const RACES = [
  "Human",
  "Elf",
  "Dwarf",
  "Halfling",
  "Dragonborn",
  "Gnome",
  "Half-Elf",
  "Half-Orc",
  "Tiefling",
  "Other",
];

export default function CharacterCreation({
  onComplete,
}: CharacterCreationProps) {
  const [character, setCharacter] = useState<CharacterData>({
    name: "",
    gender: "",
    race: "",
  });

  const canProceed = () => {
    return character.name.trim() && character.gender && character.race;
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2">Create Your Character</h2>
        <p className="text-gray-400">
          Tell us the basics about your character. Your backstory will develop
          naturally through the adventure as characters ask about your past and
          you make choices that reveal who you are.
        </p>
      </div>

      <div className="space-y-6 mb-8">
        <div>
          <label className="block text-sm font-medium mb-2">
            Character Name *
          </label>
          <input
            type="text"
            value={character.name}
            onChange={(e) =>
              setCharacter((prev) => ({ ...prev, name: e.target.value }))
            }
            className="w-full p-3 bg-gray-800 border border-gray-600 rounded focus:border-blue-500 focus:outline-none"
            placeholder="Enter your character's name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Gender *</label>
          <select
            value={character.gender}
            onChange={(e) =>
              setCharacter((prev) => ({ ...prev, gender: e.target.value }))
            }
            className="w-full p-3 bg-gray-800 border border-gray-600 rounded focus:border-blue-500 focus:outline-none"
          >
            <option value="">Select gender</option>
            {GENDERS.map((gender) => (
              <option key={gender} value={gender}>
                {gender}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Race *</label>
          <select
            value={character.race}
            onChange={(e) =>
              setCharacter((prev) => ({ ...prev, race: e.target.value }))
            }
            className="w-full p-3 bg-gray-800 border border-gray-600 rounded focus:border-blue-500 focus:outline-none"
          >
            <option value="">Select race</option>
            {RACES.map((race) => (
              <option key={race} value={race}>
                {race}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => onComplete(character)}
          disabled={!canProceed()}
          className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded"
        >
          Create Character
        </button>
      </div>
    </div>
  );
}
