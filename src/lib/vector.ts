import { Document } from "@langchain/core/documents";

import type { BaseCard } from "./cards";
import {
  ensureVectorCache,
  invalidateStoryEmbeddings,
  retrieveStoryContext,
  stringifyMemoryForIndex,
  stringifyRelationshipForIndex,
  stringifyStatForIndex,
} from "@/server/services/vector";
import { stringifyCardForIndex } from "./cards";
import { touchMemories } from "@/server/services/memories";

function requireStoryId(sessionId?: string) {
  if (!sessionId || sessionId.trim().length === 0) {
    throw new Error("Story ID is required");
  }
  return sessionId;
}

export async function buildVectorStoreFromCards(
  _cards: BaseCard[],
  sessionId?: string
) {
  const storyId = requireStoryId(sessionId);
  await ensureVectorCache(storyId);
}

export async function ensureVectorStore(
  _cards: BaseCard[],
  sessionId?: string
) {
  const storyId = requireStoryId(sessionId);
  await ensureVectorCache(storyId);
}

export async function retrieveRelevant(
  _cards: BaseCard[],
  query: string,
  k = 6,
  sessionId?: string
) {
  const storyId = requireStoryId(sessionId);
  const context = await retrieveStoryContext(storyId, query, {
    cardLimit: k,
    memoryLimit: k,
    relationshipLimit: Math.max(2, Math.floor(k / 2)),
  });

  if (context.memories.length > 0) {
    await touchMemories(context.memories.map((memory) => memory.id));
  }

  const documents: Document[] = [];

  for (const card of context.cards) {
    const baseCard = {
      id: card.id,
      storyId,
      type: card.type,
      name: card.name,
      description: card.description,
      data: card.data,
      updatedAt: new Date().toISOString(),
    } as BaseCard;
    documents.push(
      new Document({
        pageContent: stringifyCardForIndex(baseCard),
        metadata: {
          kind: "card",
          id: card.id,
          type: card.type,
          name: card.name,
        },
      })
    );
  }

  for (const memory of context.memories) {
    documents.push(
      new Document({
        pageContent: stringifyMemoryForIndex(memory),
        metadata: {
          kind: "memory",
          id: memory.id,
          ownerCardId: memory.ownerCardId,
          subjectCardId: memory.subjectCardId,
          sourceType: memory.sourceType,
          importance: memory.importance,
        },
      })
    );
  }

  for (const relationship of context.relationships) {
    documents.push(
      new Document({
        pageContent: stringifyRelationshipForIndex(relationship),
        metadata: {
          kind: "relationship",
          id: relationship.id,
          sourceCardId: relationship.sourceCardId,
          targetCardId: relationship.targetCardId,
        },
      })
    );
  }

  for (const stat of context.stats) {
    documents.push(
      new Document({
        pageContent: stringifyStatForIndex(stat),
        metadata: {
          kind: "stat",
          characterCardId: stat.characterCardId,
          key: stat.key,
        },
      })
    );
  }

  return documents;
}

export async function invalidateVectorCache(sessionId?: string) {
  const storyId = requireStoryId(sessionId);
  await invalidateStoryEmbeddings(storyId);
}
