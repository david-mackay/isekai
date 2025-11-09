import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { gmSettings } from "@/server/db/schema";

export type GMSettings = {
  tone?: "dark" | "heroic" | "whimsical";
  difficulty?: "easy" | "normal" | "hard";
  narrativeStyle?: "cinematic" | "gritty" | "mystical";
};

const defaultSettings: GMSettings = {
  tone: "heroic",
  difficulty: "normal",
  narrativeStyle: "cinematic",
};

export async function getSettings(storyId: string): Promise<GMSettings> {
  const row = await db.query.gmSettings.findFirst({
    where: eq(gmSettings.storyId, storyId),
  });
  if (!row) {
    await db.insert(gmSettings).values({ storyId, data: defaultSettings });
    return defaultSettings;
  }
  return { ...defaultSettings, ...(row.data as GMSettings) };
}

export async function updateSettings(
  storyId: string,
  update: Partial<GMSettings>
) {
  const current = await getSettings(storyId);
  const next = { ...current, ...update };
  await db
    .insert(gmSettings)
    .values({ storyId, data: next })
    .onConflictDoUpdate({
      target: gmSettings.storyId,
      set: { data: next, updatedAt: new Date() },
    });
  return next;
}
