import {
  BaseCard,
  CardType,
  getCards as getCardsForStory,
  listCards as listCardsForStory,
  upsertCard as upsertCardForStory,
} from "@/server/services/cards";
import {
  enqueueCardEmbedding,
  enqueueStoryCardEmbedding,
} from "@/server/queue/embeddings";
import { upsertRelationship } from "@/server/services/memories";

export type { BaseCard, CardType };

export interface CharacterTraits {
  physical?: string[];
  personality?: string[];
  behavioral?: string[];
}

export interface CharacterRelationship {
  trust: number;
  familiarity: number;
  interactions: string[];
  summary?: string;
}

export interface CharacterData {
  profession?: string;
  attitude?: string;
  hp?: number;
  traits?: CharacterTraits;
  relationships?: {
    player?: CharacterRelationship;
    [characterName: string]: CharacterRelationship | undefined;
  };
  experiences?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
  fears?: Record<string, unknown>;
  goals?: string[];
  traumas?: Record<string, unknown>;
  kinks?: Record<string, unknown>;
  allergies?: string[];
  secrets?: string[];
  [key: string]: unknown;
}

function requireStoryId(sessionId?: string) {
  if (!sessionId || sessionId.trim().length === 0) {
    throw new Error("Story ID is required");
  }
  return sessionId;
}

export async function readCards(sessionId?: string): Promise<BaseCard[]> {
  const storyId = requireStoryId(sessionId);
  return getCardsForStory(storyId);
}

export async function upsertCard(
  partial: Omit<BaseCard, "id" | "updatedAt" | "storyId"> & { id?: string },
  sessionId?: string
): Promise<BaseCard> {
  const storyId = requireStoryId(sessionId);
  const card = await upsertCardForStory({
    storyId,
    type: partial.type,
    name: partial.name,
    description: partial.description,
    data: partial.data,
    id: partial.id,
  });
  enqueueStoryCardEmbedding(storyId);
  enqueueCardEmbedding(storyId, card.id);
  return card;
}

export async function getCardByName(
  type: CardType,
  name: string,
  sessionId?: string
): Promise<BaseCard | undefined> {
  const storyId = requireStoryId(sessionId);
  const cards = await listCardsForStory(storyId, { type, name });
  return cards.find((card) => card.name.toLowerCase() === name.toLowerCase());
}

export async function listCards(
  filter?: Partial<Pick<BaseCard, "type" | "name">>,
  sessionId?: string
): Promise<BaseCard[]> {
  const storyId = requireStoryId(sessionId);
  return listCardsForStory(storyId, filter);
}

export function stringifyCardForIndex(card: BaseCard): string {
  const lines: string[] = [
    `type: ${card.type}`,
    `name: ${card.name}`,
    card.description ? `description: ${card.description}` : "",
    card.data ? `data: ${JSON.stringify(card.data)}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

export async function createCharacterCard(
  name: string,
  description: string,
  characterData: CharacterData,
  sessionId?: string
): Promise<BaseCard> {
  return upsertCard(
    {
      type: "character",
      name,
      description,
      data: characterData,
    },
    sessionId
  );
}

export async function updateCharacterRelationship(
  characterName: string,
  targetCharacter: string,
  relationshipUpdate: Partial<CharacterRelationship>,
  sessionId?: string
): Promise<BaseCard | null> {
  const storyId = requireStoryId(sessionId);
  const character = await getCardByName("character", characterName, storyId);
  if (!character) return null;
  const target = await getCardByName("character", targetCharacter, storyId);

  const currentData = character.data as CharacterData;
  const relationships = currentData.relationships || {};
  const currentRelationship = relationships[targetCharacter] || {
    trust: 0,
    familiarity: 0,
    interactions: [],
    summary: undefined,
  };

  const updatedRelationship = {
    ...currentRelationship,
    ...relationshipUpdate,
    interactions: [
      ...currentRelationship.interactions,
      ...(relationshipUpdate.interactions || []),
    ],
  };

  const result = await upsertCard(
    {
      ...character,
      data: {
        ...currentData,
        relationships: {
          ...relationships,
          [targetCharacter]: updatedRelationship,
        },
      },
    },
    storyId
  );

  if (target) {
    await upsertRelationship({
      storyId,
      sourceCardId: character.id,
      targetCardId: target.id,
      summary: updatedRelationship.summary ?? null,
      metrics: {
        trust: updatedRelationship.trust,
        familiarity: updatedRelationship.familiarity,
        interactions: updatedRelationship.interactions,
      },
      importance: relationshipUpdate.trust ?? updatedRelationship.trust ?? 1,
    });
  }

  return result;
}
