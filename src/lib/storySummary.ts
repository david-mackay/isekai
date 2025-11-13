import { z } from "zod";

import {
  upsertCard,
  listCards,
  getCardByName,
  readCards,
  type BaseCard,
} from "./cards";
import { recordMemories, upsertRelationship } from "@/server/services/memories";

export const MEMORY_SOURCES = [
  "player",
  "dm",
  "npc",
  "system",
  "world",
] as const;

export const CARD_TYPES = [
  "story",
  "character",
  "environment",
  "item",
  "faction",
  "quest",
  "world",
] as const;

export type NormalizedCardType = (typeof CARD_TYPES)[number];

export function normalizeCardType(
  type?: string | null
): NormalizedCardType | undefined {
  if (!type) return undefined;
  const lower = type.toLowerCase();
  if (lower === "beginning") {
    return "story";
  }
  const found = CARD_TYPES.find(
    (candidate) => candidate.toLowerCase() === lower
  );
  return found;
}

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export async function resolveCardId(
  sessionId: string,
  options: {
    id?: string | null;
    name?: string | null;
    type?: string | null;
  },
  existingCards?: BaseCard[]
): Promise<string | null> {
  const localOptions = { ...options };
  if (localOptions.id && typeof localOptions.id === "string") {
    const trimmed = localOptions.id.trim();
    if (UUID_REGEX.test(trimmed)) {
      if (!existingCards || existingCards.some((card) => card.id === trimmed)) {
        return trimmed;
      }
      localOptions.id = undefined;
    }
    if (!localOptions.name) {
      localOptions.name = trimmed;
    }
    localOptions.id = undefined;
  }
  if (localOptions.name && typeof localOptions.name === "string") {
    const type = normalizeCardType(localOptions.type);
    if (!type) {
      const candidates = await listCards(
        {
          name: localOptions.name,
        },
        sessionId
      );
      const directMatch = candidates.find(
        (card) => card.name.toLowerCase() === localOptions.name!.toLowerCase()
      );
      if (directMatch) return directMatch.id;
    } else {
      const card = await getCardByName(type, localOptions.name, sessionId);
      if (card) return card.id;
    }
    const allCards = existingCards ?? (await readCards(sessionId));
    const nameLower = localOptions.name.toLowerCase();
    const match = allCards.find((card) => {
      if (type && card.type !== type) return false;
      const data = card.data as Record<string, unknown> | undefined;
      const candidateNames: string[] = [];
      if (typeof data?.name === "string") candidateNames.push(data.name);
      if (typeof data?.displayName === "string")
        candidateNames.push(data.displayName);
      if (Array.isArray(data?.aliases)) {
        for (const alias of data.aliases) {
          if (typeof alias === "string") candidateNames.push(alias);
        }
      }
      return candidateNames.some(
        (candidate) => candidate.toLowerCase() === nameLower
      );
    });
    return match?.id ?? null;
  }
  return null;
}

export const MemoryPayloadSchema = z.object({
  summary: z
    .string()
    .min(1)
    .describe("One-sentence memory to store alongside the summary."),
  sourceType: z.enum(MEMORY_SOURCES).optional().nullable(),
  ownerCardId: z.string().uuid().optional().nullable(),
  ownerCardName: z.string().optional().nullable(),
  ownerCardType: z.enum(CARD_TYPES).optional().nullable(),
  subjectCardId: z.string().uuid().optional().nullable(),
  subjectCardName: z.string().optional().nullable(),
  subjectCardType: z.enum(CARD_TYPES).optional().nullable(),
  importance: z.number().min(0).max(5).optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  context: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const CharacterUpdateSchema = z.object({
  characterId: z.string().uuid().optional().nullable(),
  characterName: z.string().optional().nullable(),
  characterType: z.enum(CARD_TYPES).optional().nullable(),
  description: z.string().optional().nullable(),
  dataPatch: z
    .record(z.string(), z.unknown())
    .optional()
    .nullable()
    .describe("Shallow merge into the character's data object."),
});

export const RelationshipUpdateSchema = z.object({
  sourceId: z.string().uuid().optional().nullable(),
  sourceName: z.string().optional().nullable(),
  sourceType: z.enum(CARD_TYPES).optional().nullable(),
  targetId: z.string().uuid().optional().nullable(),
  targetName: z.string().optional().nullable(),
  targetType: z.enum(CARD_TYPES).optional().nullable(),
  summary: z.string().optional().nullable(),
  metrics: z.record(z.string(), z.unknown()).optional().nullable(),
  importance: z.number().min(0).max(5).optional().nullable(),
});

export const StorySummaryPayloadSchema = z.object({
  summary: z
    .string()
    .min(1)
    .describe(
      "Concise recap of recent events. Focus on irreversible changes, promises, and emotional beats."
    ),
  summaryLabel: z
    .string()
    .max(120)
    .optional()
    .nullable()
    .describe(
      "Custom label for the summary card (defaults to Long-Term Summary)."
    ),
  memories: z.array(MemoryPayloadSchema).optional().nullable(),
  characterUpdates: z.array(CharacterUpdateSchema).optional().nullable(),
  relationshipUpdates: z.array(RelationshipUpdateSchema).optional().nullable(),
});

export type MemoryPayload = z.infer<typeof MemoryPayloadSchema>;
export type CharacterUpdatePayload = z.infer<typeof CharacterUpdateSchema>;
export type RelationshipUpdatePayload = z.infer<
  typeof RelationshipUpdateSchema
>;
export type StorySummaryPayload = z.infer<typeof StorySummaryPayloadSchema>;

export async function applyStorySummary(
  sessionId: string,
  payload: StorySummaryPayload
) {
  const summaryCardName =
    payload.summaryLabel?.trim() && payload.summaryLabel.trim().length > 0
      ? payload.summaryLabel.trim()
      : "Long-Term Summary";

  const existingSummaryCard = await getCardByName(
    "story",
    summaryCardName,
    sessionId
  );
  const existingData = (existingSummaryCard?.data ?? {}) as Record<
    string,
    unknown
  >;
  const previousSummaries = Array.isArray(existingData.summaries)
    ? (existingData.summaries as unknown[]).filter(
        (entry): entry is { summary: string; recordedAt?: string } =>
          typeof entry === "object" && entry !== null && "summary" in entry
      )
    : [];
  const summaryEntry = {
    summary: payload.summary,
    recordedAt: new Date().toISOString(),
  };

  const updatedSummaryCard = await upsertCard(
    {
      id: existingSummaryCard?.id,
      type: "story",
      name: summaryCardName,
      description:
        existingSummaryCard?.description ??
        "Condensed history of the ongoing adventure.",
      data: {
        ...existingData,
        summaries: [...previousSummaries, summaryEntry],
        lastUpdatedAt: summaryEntry.recordedAt,
      },
    },
    sessionId
  );

  let cachedCards: BaseCard[] | null = null;
  const ensureCards = async () => {
    if (!cachedCards) {
      cachedCards = await readCards(sessionId);
    }
    return cachedCards;
  };

  const recordedMemories: string[] = [];
  if (payload.memories && payload.memories.length > 0) {
    const memoryInputs = [];
    const cards = await ensureCards();
    for (const memory of payload.memories) {
      const ownerCardId = await resolveCardId(
        sessionId,
        {
          id: memory.ownerCardId,
          name: memory.ownerCardName,
          type: memory.ownerCardType ?? "character",
        },
        cards
      );
      const subjectCardId = await resolveCardId(
        sessionId,
        {
          id: memory.subjectCardId,
          name: memory.subjectCardName,
          type: memory.subjectCardType ?? "character",
        },
        cards
      );
      const sourceType =
        memory.sourceType && MEMORY_SOURCES.includes(memory.sourceType)
          ? memory.sourceType
          : "system";
      memoryInputs.push({
        storyId: sessionId,
        summary: memory.summary,
        sourceType,
        ownerCardId,
        subjectCardId,
        importance:
          typeof memory.importance === "number" ? memory.importance : 1,
        tags: memory.tags ?? [],
        context: memory.context ?? {},
      });
    }
    if (memoryInputs.length > 0) {
      const memories = await recordMemories(memoryInputs);
      recordedMemories.push(...memories.map((m) => m.id));
    }
  }

  const updatedCharacters: string[] = [];
  if (payload.characterUpdates && payload.characterUpdates.length > 0) {
    const cards = await ensureCards();
    for (const update of payload.characterUpdates) {
      const resolvedId = await resolveCardId(
        sessionId,
        {
          id: update.characterId,
          name: update.characterName,
          type: update.characterType ?? "character",
        },
        cards
      );
      let target = resolvedId
        ? cards.find((card) => card.id === resolvedId)
        : undefined;
      if (!target && update.characterName) {
        target = await upsertCard(
          {
            type: normalizeCardType(update.characterType) ?? "character",
            name: update.characterName,
            description: update.description ?? undefined,
            data: update.dataPatch ?? {},
          },
          sessionId
        );
        cards.push(target);
      } else if (!target) {
        throw new Error(
          `Unable to resolve character for update: ${
            update.characterName ?? update.characterId ?? "unknown"
          }`
        );
      } else {
        const nextData =
          update.dataPatch && typeof update.dataPatch === "object"
            ? { ...(target.data ?? {}), ...update.dataPatch }
            : target.data ?? {};
        target = await upsertCard(
          {
            id: target.id,
            type: target.type,
            name: target.name,
            description:
              update.description !== undefined
                ? update.description ?? undefined
                : target.description,
            data: nextData,
          },
          sessionId
        );
        const index = cards.findIndex((card) => card.id === target!.id);
        if (index >= 0) {
          cards[index] = target;
        } else {
          cards.push(target);
        }
      }
      updatedCharacters.push(target.id);
    }
  }

  const updatedRelationships: string[] = [];
  if (payload.relationshipUpdates && payload.relationshipUpdates.length > 0) {
    const cards = await ensureCards();
    for (const update of payload.relationshipUpdates) {
      const sourceCardId = await resolveCardId(
        sessionId,
        {
          id: update.sourceId,
          name: update.sourceName,
          type: update.sourceType ?? "character",
        },
        cards
      );
      if (!sourceCardId) {
        throw new Error(
          `Unable to resolve source character: ${
            update.sourceName ?? update.sourceId ?? "unknown"
          }`
        );
      }
      const targetCardId = await resolveCardId(
        sessionId,
        {
          id: update.targetId,
          name: update.targetName,
          type: update.targetType ?? "character",
        },
        cards
      );
      if (!targetCardId) {
        throw new Error(
          `Unable to resolve target character: ${
            update.targetName ?? update.targetId ?? "unknown"
          }`
        );
      }
      const relationship = await upsertRelationship({
        storyId: sessionId,
        sourceCardId,
        targetCardId,
        summary: update.summary ?? null,
        metrics: update.metrics ?? {},
        importance:
          typeof update.importance === "number" ? update.importance : 1,
      });
      updatedRelationships.push(relationship.id);
    }
  }

  return {
    summaryCardId: updatedSummaryCard.id,
    recordedMemoryIds: recordedMemories,
    updatedCharacterIds: updatedCharacters,
    updatedRelationshipIds: updatedRelationships,
  };
}

export function reconcileSummaryPayload(
  payload: StorySummaryPayload,
  cards: BaseCard[]
): StorySummaryPayload {
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const characterIds = new Set(
    cards.filter((card) => card.type === "character").map((card) => card.id)
  );

  const sanitizeMemory = (memory: MemoryPayload): MemoryPayload => {
    const next: MemoryPayload = { ...memory };

    if (next.ownerCardId) {
      const ownerCard = cardById.get(next.ownerCardId);
      if (!ownerCard) {
        next.ownerCardId = null;
      } else {
        next.ownerCardName ??= ownerCard.name;
        const ownerType = normalizeCardType(ownerCard.type);
        if (ownerType) {
          next.ownerCardType ??= ownerType;
        }
      }
    }

    if (next.subjectCardId) {
      const subjectCard = cardById.get(next.subjectCardId);
      if (!subjectCard) {
        next.subjectCardId = null;
      } else {
        next.subjectCardName ??= subjectCard.name;
        const subjectType = normalizeCardType(subjectCard.type);
        if (subjectType) {
          next.subjectCardType ??= subjectType;
        }
      }
    }

    return next;
  };

  const sanitizeCharacterUpdate = (
    update: CharacterUpdatePayload
  ): CharacterUpdatePayload => {
    const next: CharacterUpdatePayload = { ...update };
    if (next.characterId) {
      if (!characterIds.has(next.characterId)) {
        delete next.characterId;
      } else {
        const card = cardById.get(next.characterId);
        if (card) {
          next.characterName ??= card.name;
        }
      }
    }
    next.characterType = "character";
    return next;
  };

  const sanitizeRelationshipUpdate = (
    update: RelationshipUpdatePayload
  ): RelationshipUpdatePayload => {
    const next: RelationshipUpdatePayload = { ...update };
    if (next.sourceId) {
      if (!characterIds.has(next.sourceId)) {
        delete next.sourceId;
      } else {
        const card = cardById.get(next.sourceId);
        if (card) {
          next.sourceName ??= card.name;
        }
      }
    }
    if (next.targetId) {
      if (!characterIds.has(next.targetId)) {
        delete next.targetId;
      } else {
        const card = cardById.get(next.targetId);
        if (card) {
          next.targetName ??= card.name;
        }
      }
    }
    next.sourceType = "character";
    next.targetType = "character";
    return next;
  };

  return {
    ...payload,
    memories: Array.isArray(payload.memories)
      ? payload.memories.map(sanitizeMemory)
      : payload.memories === null
      ? null
      : undefined,
    characterUpdates: Array.isArray(payload.characterUpdates)
      ? payload.characterUpdates.map(sanitizeCharacterUpdate)
      : payload.characterUpdates === null
      ? null
      : undefined,
    relationshipUpdates: Array.isArray(payload.relationshipUpdates)
      ? payload.relationshipUpdates.map(sanitizeRelationshipUpdate)
      : payload.relationshipUpdates === null
      ? null
      : undefined,
  };
}
