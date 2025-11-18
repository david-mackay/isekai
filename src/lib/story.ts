import {
  addStoryMessage,
  getStoryTranscript,
  getStoryMessages,
} from "@/server/services/stories";

function requireStoryId(sessionId?: string) {
  if (!sessionId || sessionId.trim().length === 0) {
    throw new Error("Story ID is required");
  }
  return sessionId;
}

export async function appendToStory(
  text: string,
  sessionId?: string,
  role: "dm" | "you" = "dm",
  imageUrl?: string | null
) {
  const storyId = requireStoryId(sessionId);
  return addStoryMessage(storyId, role, text, imageUrl);
}

export async function readStory(sessionId?: string): Promise<string> {
  const storyId = requireStoryId(sessionId);
  return getStoryTranscript(storyId);
}

export type StoryMessage = Awaited<ReturnType<typeof getStoryMessages>>[number];

export async function readRecentMessages(
  sessionId?: string,
  limit = 6
): Promise<StoryMessage[]> {
  const storyId = requireStoryId(sessionId);
  return getStoryMessages(storyId, { limit });
}
