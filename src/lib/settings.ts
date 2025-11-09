import {
  GMSettings,
  getSettings as getSettingsForStory,
  updateSettings as updateSettingsForStory,
} from "@/server/services/settings";

function requireStoryId(sessionId?: string) {
  if (!sessionId || sessionId.trim().length === 0) {
    throw new Error("Story ID is required");
  }
  return sessionId;
}

export type { GMSettings };

export async function getSettings(sessionId?: string): Promise<GMSettings> {
  const storyId = requireStoryId(sessionId);
  return getSettingsForStory(storyId);
}

export async function updateSettings(
  update: Partial<GMSettings>,
  sessionId?: string
) {
  const storyId = requireStoryId(sessionId);
  return updateSettingsForStory(storyId, update);
}
