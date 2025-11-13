export type StorySummary = {
  id: string;
  title: string;
  beginningKey: string | null;
  worldKey: string | null;
  characterName: string | null;
  characterGender: string | null;
  characterRace: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  lastPlayedAt: string;
};
