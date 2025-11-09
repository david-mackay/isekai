import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/server/db";
import {
  characterMemories,
  characterRelationships,
  characterStats,
  CharacterMemory,
  CharacterRelationship,
  CharacterStat,
  memorySourceEnum,
} from "@/server/db/schema";
import {
  enqueueMemoryEmbedding,
  enqueueRelationshipEmbedding,
  enqueueStoryMemoryEmbeddings,
  enqueueStoryRelationshipEmbeddings,
} from "@/server/queue/embeddings";

export type MemorySource = (typeof memorySourceEnum.enumValues)[number];

export interface RecordMemoryInput {
  storyId: string;
  summary: string;
  sourceType?: MemorySource;
  ownerCardId?: string | null;
  subjectCardId?: string | null;
  sourceMessageId?: string | null;
  context?: Record<string, unknown>;
  tags?: string[];
  importance?: number;
  decayFactor?: number;
}

export async function recordMemory(
  input: RecordMemoryInput
): Promise<CharacterMemory> {
  const {
    storyId,
    summary,
    sourceType = "system",
    ownerCardId = null,
    subjectCardId = null,
    sourceMessageId = null,
    context = {},
    tags = [],
    importance = 1,
    decayFactor = 1,
  } = input;

  const [memory] = await db
    .insert(characterMemories)
    .values({
      storyId,
      summary,
      sourceType,
      ownerCardId,
      subjectCardId,
      sourceMessageId,
      context,
      tags,
      importance,
      decayFactor,
    })
    .returning();

  enqueueMemoryEmbedding(storyId, memory.id);
  return memory;
}

export async function recordMemories(
  inputs: RecordMemoryInput[]
): Promise<CharacterMemory[]> {
  if (inputs.length === 0) return [];
  const memories = await db
    .insert(characterMemories)
    .values(
      inputs.map((input) => ({
        storyId: input.storyId,
        summary: input.summary,
        sourceType: input.sourceType ?? "system",
        ownerCardId: input.ownerCardId ?? null,
        subjectCardId: input.subjectCardId ?? null,
        sourceMessageId: input.sourceMessageId ?? null,
        context: input.context ?? {},
        tags: input.tags ?? [],
        importance: input.importance ?? 1,
        decayFactor: input.decayFactor ?? 1,
      }))
    )
    .returning();

  const storyIds = new Set<string>();
  for (const memory of memories) {
    storyIds.add(memory.storyId);
    enqueueMemoryEmbedding(memory.storyId, memory.id);
  }
  for (const storyId of storyIds) {
    enqueueStoryMemoryEmbeddings(storyId);
  }
  return memories;
}

export async function listMemoriesForStory(
  storyId: string,
  limit = 20
): Promise<CharacterMemory[]> {
  return db.query.characterMemories.findMany({
    where: eq(characterMemories.storyId, storyId),
    orderBy: desc(characterMemories.createdAt),
    limit,
  });
}

export async function touchMemories(memoryIds: string[]) {
  if (!memoryIds.length) return;
  const now = new Date();
  await db
    .update(characterMemories)
    .set({ lastAccessedAt: now })
    .where(inArray(characterMemories.id, memoryIds));
}

export interface UpsertStatInput {
  storyId: string;
  characterCardId: string;
  key: string;
  value: Record<string, unknown> | string | number | boolean | null;
  confidence?: number;
}

export async function upsertCharacterStat({
  storyId,
  characterCardId,
  key,
  value,
  confidence = 1,
}: UpsertStatInput): Promise<CharacterStat> {
  const existing = await db.query.characterStats.findFirst({
    where: and(
      eq(characterStats.storyId, storyId),
      eq(characterStats.characterCardId, characterCardId),
      eq(characterStats.key, key)
    ),
  });

  if (existing) {
    const [updated] = await db
      .update(characterStats)
      .set({
        value:
          typeof value === "object" && value !== null
            ? (value as Record<string, unknown>)
            : { value },
        confidence,
        updatedAt: new Date(),
      })
      .where(eq(characterStats.id, existing.id))
      .returning();
    return updated;
  }

  const formattedValue =
    typeof value === "object" && value !== null ? value : { value };

  const [created] = await db
    .insert(characterStats)
    .values({
      storyId,
      characterCardId,
      key,
      value: formattedValue,
      confidence,
    })
    .returning();

  return created;
}

export async function listStatsForCharacter(
  storyId: string,
  characterCardId: string
): Promise<CharacterStat[]> {
  return db.query.characterStats.findMany({
    where: and(
      eq(characterStats.storyId, storyId),
      eq(characterStats.characterCardId, characterCardId)
    ),
    orderBy: desc(characterStats.updatedAt),
  });
}

export interface UpsertRelationshipInput {
  storyId: string;
  sourceCardId: string;
  targetCardId: string;
  summary?: string | null;
  metrics?: Record<string, unknown>;
  importance?: number;
}

export async function upsertRelationship({
  storyId,
  sourceCardId,
  targetCardId,
  summary = null,
  metrics = {},
  importance = 1,
}: UpsertRelationshipInput): Promise<CharacterRelationship> {
  const existing = await db.query.characterRelationships.findFirst({
    where: and(
      eq(characterRelationships.storyId, storyId),
      eq(characterRelationships.sourceCardId, sourceCardId),
      eq(characterRelationships.targetCardId, targetCardId)
    ),
  });

  if (existing) {
    const mergedMetrics = {
      ...(existing.metrics ?? {}),
      ...metrics,
    };
    const [updated] = await db
      .update(characterRelationships)
      .set({
        summary: summary ?? existing.summary,
        metrics: mergedMetrics,
        importance: Math.max(importance, existing.importance ?? 1),
        updatedAt: new Date(),
      })
      .where(eq(characterRelationships.id, existing.id))
      .returning();

    enqueueRelationshipEmbedding(storyId, updated.id);
    return updated;
  }

  const [created] = await db
    .insert(characterRelationships)
    .values({
      storyId,
      sourceCardId,
      targetCardId,
      summary,
      metrics,
      importance,
    })
    .returning();

  enqueueRelationshipEmbedding(storyId, created.id);
  return created;
}

export async function listRelationshipsForCharacter(
  storyId: string,
  characterCardId: string
): Promise<CharacterRelationship[]> {
  return db.query.characterRelationships.findMany({
    where: and(
      eq(characterRelationships.storyId, storyId),
      eq(characterRelationships.sourceCardId, characterCardId)
    ),
    orderBy: desc(characterRelationships.updatedAt),
  });
}

export async function listIncomingRelationshipsForCharacter(
  storyId: string,
  characterCardId: string
): Promise<CharacterRelationship[]> {
  return db.query.characterRelationships.findMany({
    where: and(
      eq(characterRelationships.storyId, storyId),
      eq(characterRelationships.targetCardId, characterCardId)
    ),
    orderBy: desc(characterRelationships.updatedAt),
  });
}

export async function refreshStoryMemories(storyId: string) {
  enqueueStoryMemoryEmbeddings(storyId);
}

export async function refreshStoryRelationships(storyId: string) {
  enqueueStoryRelationshipEmbeddings(storyId);
}
