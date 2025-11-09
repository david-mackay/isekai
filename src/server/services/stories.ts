import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { cards, gmSettings, stories, storyMessages } from "@/server/db/schema";

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

export type StoryMessageDTO = {
  id: string;
  role: "dm" | "you";
  content: string;
  sequence: number;
  createdAt: string;
};

export type CreateStoryInput = {
  userId: string;
  title: string;
  beginningKey?: string | null;
  worldKey?: string | null;
  characterName?: string | null;
  characterGender?: string | null;
  characterRace?: string | null;
};

export async function listStories(userId: string): Promise<StorySummary[]> {
  const results = await db.query.stories.findMany({
    where: eq(stories.userId, userId),
    orderBy: desc(stories.lastPlayedAt),
  });

  return results.map((story) => ({
    id: story.id,
    title: story.title,
    beginningKey: story.beginningKey ?? null,
    worldKey: story.worldKey ?? null,
    characterName: story.characterName ?? null,
    characterGender: story.characterGender ?? null,
    characterRace: story.characterRace ?? null,
    messageCount: story.messageCount,
    createdAt: story.createdAt.toISOString(),
    updatedAt: story.updatedAt.toISOString(),
    lastPlayedAt: story.lastPlayedAt.toISOString(),
  }));
}

export async function createStory({
  userId,
  title,
  beginningKey = null,
  worldKey = null,
  characterName = null,
  characterGender = null,
  characterRace = null,
}: CreateStoryInput): Promise<StorySummary> {
  const [story] = await db
    .insert(stories)
    .values({
      userId,
      title,
      beginningKey,
      worldKey,
      characterName,
      characterGender,
      characterRace,
    })
    .returning();

  return {
    id: story.id,
    title: story.title,
    beginningKey: story.beginningKey ?? null,
    worldKey: story.worldKey ?? null,
    characterName: story.characterName ?? null,
    characterGender: story.characterGender ?? null,
    characterRace: story.characterRace ?? null,
    messageCount: story.messageCount,
    createdAt: story.createdAt.toISOString(),
    updatedAt: story.updatedAt.toISOString(),
    lastPlayedAt: story.lastPlayedAt.toISOString(),
  };
}

export async function deleteStory(userId: string, storyId: string) {
  await db
    .delete(stories)
    .where(and(eq(stories.id, storyId), eq(stories.userId, userId)));
}

export async function assertStoryOwnership(userId: string, storyId: string) {
  const story = await db.query.stories.findFirst({
    where: and(eq(stories.id, storyId), eq(stories.userId, userId)),
  });
  if (!story) {
    throw new Error("STORY_NOT_FOUND");
  }
  return story;
}

export async function updateStoryActivity(storyId: string, messageDelta = 1) {
  await db
    .update(stories)
    .set({
      messageCount: sql`${stories.messageCount} + ${messageDelta}`,
      lastPlayedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(stories.id, storyId));
}

export async function addStoryMessage(
  storyId: string,
  role: "dm" | "you",
  content: string
): Promise<StoryMessageDTO> {
  return db.transaction(async (tx) => {
    const [nextSeqRow] = await tx
      .select({
        next: sql<number>`coalesce(max(${storyMessages.sequence}), 0) + 1`,
      })
      .from(storyMessages)
      .where(eq(storyMessages.storyId, storyId));

    const sequence = nextSeqRow?.next ?? 1;

    const [message] = await tx
      .insert(storyMessages)
      .values({
        storyId,
        role,
        content,
        sequence,
      })
      .returning();

    await tx
      .update(stories)
      .set({
        messageCount: sql`${stories.messageCount} + 1`,
        lastPlayedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(stories.id, storyId));

    return {
      id: message.id,
      role: message.role,
      content: message.content,
      sequence: message.sequence,
      createdAt: message.createdAt.toISOString(),
    };
  });
}

export async function getStoryMessages(
  storyId: string
): Promise<StoryMessageDTO[]> {
  const rows = await db
    .select()
    .from(storyMessages)
    .where(eq(storyMessages.storyId, storyId))
    .orderBy(storyMessages.sequence);

  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    sequence: row.sequence,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getStoryTranscript(storyId: string) {
  const messages = await getStoryMessages(storyId);
  return messages
    .map((msg) => (msg.role === "dm" ? `DM: ${msg.content}` : msg.content))
    .join("\n");
}

export async function resetStory(userId: string, storyId: string) {
  await assertStoryOwnership(userId, storyId);
  await db.transaction(async (tx) => {
    await tx.delete(storyMessages).where(eq(storyMessages.storyId, storyId));
    await tx.delete(cards).where(eq(cards.storyId, storyId));
    await tx.delete(gmSettings).where(eq(gmSettings.storyId, storyId));
    await tx
      .update(stories)
      .set({
        messageCount: 0,
        lastPlayedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(stories.id, storyId));
  });
}
