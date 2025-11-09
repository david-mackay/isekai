import PQueue from "p-queue";

import {
  ensureStoryCardEmbeddings,
  refreshCardEmbedding,
  ensureStoryMemoryEmbeddings,
  refreshMemoryEmbedding,
  ensureStoryRelationshipEmbeddings,
  refreshRelationshipEmbedding,
} from "@/server/services/vector";

type Task = () => Promise<void>;

const queue = new PQueue({ concurrency: 1 });
const pendingKeys = new Set<string>();

function enqueueUnique(key: string, task: Task) {
  if (pendingKeys.has(key)) {
    return;
  }
  pendingKeys.add(key);
  queue
    .add(async () => {
      try {
        await task();
      } catch (error) {
        console.error(`[EmbeddingsQueue] Task failed (${key})`, error);
      } finally {
        pendingKeys.delete(key);
      }
    })
    .catch((error) => {
      console.error(`[EmbeddingsQueue] Enqueue failed (${key})`, error);
      pendingKeys.delete(key);
    });
}

export function enqueueStoryCardEmbedding(storyId: string) {
  enqueueUnique(`cards:${storyId}`, () => ensureStoryCardEmbeddings(storyId));
}

export function enqueueCardEmbedding(storyId: string, cardId: string) {
  enqueueUnique(`card:${cardId}`, () => refreshCardEmbedding(storyId, cardId));
}

export function enqueueStoryMemoryEmbeddings(storyId: string) {
  enqueueUnique(`memories:${storyId}`, () =>
    ensureStoryMemoryEmbeddings(storyId)
  );
}

export function enqueueMemoryEmbedding(storyId: string, memoryId: string) {
  enqueueUnique(`memory:${memoryId}`, () =>
    refreshMemoryEmbedding(storyId, memoryId)
  );
}

export function enqueueStoryRelationshipEmbeddings(storyId: string) {
  enqueueUnique(`relationships:${storyId}`, () =>
    ensureStoryRelationshipEmbeddings(storyId)
  );
}

export function enqueueRelationshipEmbedding(
  storyId: string,
  relationshipId: string
) {
  enqueueUnique(`relationship:${relationshipId}`, () =>
    refreshRelationshipEmbedding(storyId, relationshipId)
  );
}

export async function waitForEmbeddingQueue() {
  await queue.onIdle();
}
