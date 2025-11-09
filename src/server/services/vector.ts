import { sql, and, eq, isNull, desc } from "drizzle-orm";
import { MistralAIEmbeddings } from "@langchain/mistralai";

import { db } from "@/server/db";
import {
  cards,
  characterMemories,
  characterRelationships,
  characterStats,
  CharacterMemory,
  CharacterRelationship,
  CharacterStat,
} from "@/server/db/schema";
import {
  BaseCard,
  stringifyCardForIndex,
  getCards,
} from "@/server/services/cards";

const apiKey = process.env.MISTRAL_API_KEY;

if (!apiKey) {
  throw new Error("MISTRAL_API_KEY is not set");
}

const embeddingsClient = new MistralAIEmbeddings({ apiKey });

function toVectorLiteral(vector: number[]) {
  return sql.raw(`'[${vector.join(",")}]'`);
}

async function embedText(text: string): Promise<number[]> {
  return embeddingsClient.embedQuery(text);
}

async function embedCard(card: BaseCard) {
  const doc = stringifyCardForIndex(card);
  return embedText(doc);
}

function normalizeTags(tags: unknown): string[] {
  if (Array.isArray(tags)) {
    return tags.filter((tag): tag is string => typeof tag === "string");
  }
  return [];
}

function toDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(value as string);
}

export function stringifyMemoryForIndex(memory: CharacterMemory): string {
  const pieces = [
    `summary: ${memory.summary}`,
    `source: ${memory.sourceType}`,
    `importance: ${memory.importance}`,
    memory.ownerCardId ? `owner_card: ${memory.ownerCardId}` : "",
    memory.subjectCardId ? `subject_card: ${memory.subjectCardId}` : "",
    normalizeTags(memory.tags).length
      ? `tags: ${normalizeTags(memory.tags).join(", ")}`
      : "",
    memory.context && Object.keys(memory.context).length > 0
      ? `context: ${JSON.stringify(memory.context)}`
      : "",
  ];
  return pieces.filter(Boolean).join("\n");
}

export function stringifyRelationshipForIndex(
  relationship: CharacterRelationship
): string {
  const pieces = [
    `source_card: ${relationship.sourceCardId}`,
    `target_card: ${relationship.targetCardId}`,
    relationship.summary ? `summary: ${relationship.summary}` : "",
    `importance: ${relationship.importance}`,
    relationship.metrics && Object.keys(relationship.metrics).length > 0
      ? `metrics: ${JSON.stringify(relationship.metrics)}`
      : "",
  ];
  return pieces.filter(Boolean).join("\n");
}

export function stringifyStatForIndex(stat: CharacterStat): string {
  const pieces = [
    `character_card: ${stat.characterCardId}`,
    `key: ${stat.key}`,
    `confidence: ${stat.confidence}`,
    `value: ${JSON.stringify(stat.value)}`,
  ];
  return pieces.join("\n");
}

async function embedMemory(memory: CharacterMemory) {
  const doc = stringifyMemoryForIndex(memory);
  return embedText(doc);
}

async function embedRelationship(relationship: CharacterRelationship) {
  const doc = stringifyRelationshipForIndex(relationship);
  return embedText(doc);
}

export async function ensureStoryCardEmbeddings(storyId: string) {
  const rows = await db
    .select({
      id: cards.id,
      type: cards.type,
      name: cards.name,
      description: cards.description,
      data: cards.data,
      updatedAt: cards.updatedAt,
      embedding: cards.embedding,
    })
    .from(cards)
    .where(eq(cards.storyId, storyId));

  const cardsNeedingEmbedding = rows.filter((row) => row.embedding === null);
  if (cardsNeedingEmbedding.length === 0) return;

  for (const row of cardsNeedingEmbedding) {
    const base: BaseCard = {
      id: row.id,
      storyId,
      type: row.type as BaseCard["type"],
      name: row.name,
      description: row.description ?? undefined,
      data: (row.data ?? {}) as Record<string, unknown>,
      updatedAt: row.updatedAt.toISOString(),
    };
    const embedding = await embedCard(base);
    await db.update(cards).set({ embedding }).where(eq(cards.id, row.id));
  }
}

export async function refreshCardEmbedding(storyId: string, cardId: string) {
  const row = await db.query.cards.findFirst({
    where: and(eq(cards.id, cardId), eq(cards.storyId, storyId)),
  });
  if (!row) return;
  const base: BaseCard = {
    id: row.id,
    storyId,
    type: row.type as BaseCard["type"],
    name: row.name,
    description: row.description ?? undefined,
    data: (row.data ?? {}) as Record<string, unknown>,
    updatedAt: row.updatedAt.toISOString(),
  };
  const embedding = await embedCard(base);
  await db.update(cards).set({ embedding }).where(eq(cards.id, cardId));
}

export async function ensureStoryMemoryEmbeddings(storyId: string) {
  const memories = await db.query.characterMemories.findMany({
    where: and(
      eq(characterMemories.storyId, storyId),
      isNull(characterMemories.embedding)
    ),
  });
  if (memories.length === 0) return;

  for (const memory of memories) {
    const embedding = await embedMemory(memory);
    await db
      .update(characterMemories)
      .set({ embedding })
      .where(eq(characterMemories.id, memory.id));
  }
}

export async function refreshMemoryEmbedding(
  storyId: string,
  memoryId: string
) {
  const memory = await db.query.characterMemories.findFirst({
    where: and(
      eq(characterMemories.id, memoryId),
      eq(characterMemories.storyId, storyId)
    ),
  });
  if (!memory) return;
  const embedding = await embedMemory(memory);
  await db
    .update(characterMemories)
    .set({ embedding })
    .where(eq(characterMemories.id, memoryId));
}

export async function ensureStoryRelationshipEmbeddings(storyId: string) {
  const relationships = await db.query.characterRelationships.findMany({
    where: and(
      eq(characterRelationships.storyId, storyId),
      isNull(characterRelationships.embedding)
    ),
  });
  if (relationships.length === 0) return;

  for (const relationship of relationships) {
    const embedding = await embedRelationship(relationship);
    await db
      .update(characterRelationships)
      .set({ embedding })
      .where(eq(characterRelationships.id, relationship.id));
  }
}

export async function refreshRelationshipEmbedding(
  storyId: string,
  relationshipId: string
) {
  const relationship = await db.query.characterRelationships.findFirst({
    where: and(
      eq(characterRelationships.id, relationshipId),
      eq(characterRelationships.storyId, storyId)
    ),
  });
  if (!relationship) return;
  const embedding = await embedRelationship(relationship);
  await db
    .update(characterRelationships)
    .set({ embedding })
    .where(eq(characterRelationships.id, relationshipId));
}

export async function retrieveRelevantCards(
  storyId: string,
  query: string,
  k = 6,
  precomputedEmbedding?: number[]
) {
  const queryEmbedding = precomputedEmbedding ?? (await embedText(query));
  await ensureStoryCardEmbeddings(storyId);

  const result = await db.execute(
    sql`
      SELECT id, type, name, description, data
      FROM cards
      WHERE story_id = ${storyId} AND embedding IS NOT NULL
      ORDER BY embedding <-> ${toVectorLiteral(queryEmbedding)}::vector
      LIMIT ${k}
    `
  );

  return result.rows.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    type: row.type as BaseCard["type"],
    name: row.name as string,
    description: (row.description as string | null) ?? undefined,
    data: (row.data as Record<string, unknown> | null) ?? {},
  }));
}

export async function retrieveRelevantMemories(
  storyId: string,
  query: string,
  k = 6,
  precomputedEmbedding?: number[]
) {
  const queryEmbedding = precomputedEmbedding ?? (await embedText(query));
  await ensureStoryMemoryEmbeddings(storyId);

  const result = await db.execute(
    sql`
      SELECT id,
             story_id,
             owner_card_id,
             subject_card_id,
             source_message_id,
             source_type,
             summary,
             context,
             tags,
             importance,
             decay_factor,
             created_at,
             updated_at,
             last_accessed_at
      FROM character_memories
      WHERE story_id = ${storyId} AND embedding IS NOT NULL
      ORDER BY embedding <-> ${toVectorLiteral(
        queryEmbedding
      )}::vector, importance DESC
      LIMIT ${k}
    `
  );

  return result.rows.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    storyId: row.story_id as string,
    ownerCardId: (row.owner_card_id as string | null) ?? null,
    subjectCardId: (row.subject_card_id as string | null) ?? null,
    sourceMessageId: (row.source_message_id as string | null) ?? null,
    sourceType: row.source_type as CharacterMemory["sourceType"],
    summary: row.summary as string,
    context: (row.context as Record<string, unknown> | null) ?? {},
    tags: normalizeTags(row.tags),
    importance: Number(row.importance ?? 1),
    decayFactor: Number(row.decay_factor ?? 1),
    embedding: null,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
    lastAccessedAt: row.last_accessed_at ? toDate(row.last_accessed_at) : null,
  }));
}

export async function retrieveRelevantRelationships(
  storyId: string,
  query: string,
  k = 4,
  precomputedEmbedding?: number[]
) {
  const queryEmbedding = precomputedEmbedding ?? (await embedText(query));
  await ensureStoryRelationshipEmbeddings(storyId);

  const result = await db.execute(
    sql`
      SELECT id,
             story_id,
             source_card_id,
             target_card_id,
             summary,
             metrics,
             importance,
             created_at,
             updated_at
      FROM character_relationships
      WHERE story_id = ${storyId} AND embedding IS NOT NULL
      ORDER BY embedding <-> ${toVectorLiteral(
        queryEmbedding
      )}::vector, importance DESC
      LIMIT ${k}
    `
  );

  return result.rows.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    storyId: row.story_id as string,
    sourceCardId: row.source_card_id as string,
    targetCardId: row.target_card_id as string,
    summary: (row.summary as string | null) ?? null,
    metrics: (row.metrics as Record<string, unknown> | null) ?? {},
    importance: Number(row.importance ?? 1),
    embedding: null,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  }));
}

export type StoryContextSnapshot = {
  cards: Array<{
    id: string;
    type: BaseCard["type"];
    name: string;
    description?: string;
    data: Record<string, unknown>;
  }>;
  memories: CharacterMemory[];
  relationships: CharacterRelationship[];
  stats: CharacterStat[];
};

type StoryContextOptions = {
  cardLimit?: number;
  memoryLimit?: number;
  relationshipLimit?: number;
  includeStats?: boolean;
};

export async function retrieveStoryContext(
  storyId: string,
  query: string,
  options: StoryContextOptions = {}
): Promise<StoryContextSnapshot> {
  const {
    cardLimit = 6,
    memoryLimit = 6,
    relationshipLimit = 4,
    includeStats = true,
  } = options;

  const queryEmbedding = await embedText(query);

  const [cardsResult, memoriesResult, relationshipsResult, statsResult] =
    await Promise.all([
      retrieveRelevantCards(storyId, query, cardLimit, queryEmbedding),
      retrieveRelevantMemories(storyId, query, memoryLimit, queryEmbedding),
      retrieveRelevantRelationships(
        storyId,
        query,
        relationshipLimit,
        queryEmbedding
      ),
      includeStats
        ? db.query.characterStats.findMany({
            where: eq(characterStats.storyId, storyId),
            orderBy: desc(characterStats.updatedAt),
          })
        : Promise.resolve([] as CharacterStat[]),
    ]);

  return {
    cards: cardsResult,
    memories: memoriesResult,
    relationships: relationshipsResult,
    stats: statsResult as CharacterStat[],
  };
}

export async function ensureVectorCache(storyId: string) {
  await Promise.all([
    ensureStoryCardEmbeddings(storyId),
    ensureStoryMemoryEmbeddings(storyId),
    ensureStoryRelationshipEmbeddings(storyId),
  ]);
}

export async function getCardsWithEmbeddings(storyId: string) {
  await ensureStoryCardEmbeddings(storyId);
  return getCards(storyId);
}

export async function invalidateStoryEmbeddings(storyId: string) {
  await Promise.all([
    db.update(cards).set({ embedding: null }).where(eq(cards.storyId, storyId)),
    db
      .update(characterMemories)
      .set({ embedding: null })
      .where(eq(characterMemories.storyId, storyId)),
    db
      .update(characterRelationships)
      .set({ embedding: null })
      .where(eq(characterRelationships.storyId, storyId)),
  ]);
}
