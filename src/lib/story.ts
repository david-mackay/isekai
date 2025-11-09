import { addStoryMessage, getStoryTranscript } from "@/server/services/stories";

function requireStoryId(sessionId?: string) {
  if (!sessionId || sessionId.trim().length === 0) {
    throw new Error("Story ID is required");
  }
  return sessionId;
}

export async function appendToStory(
  text: string,
  sessionId?: string,
  role: "dm" | "you" = "dm"
) {
  const storyId = requireStoryId(sessionId);
  return addStoryMessage(storyId, role, text);
}

export async function readStory(sessionId?: string): Promise<string> {
  const storyId = requireStoryId(sessionId);
  return getStoryTranscript(storyId);
}
