import { and, eq, ilike } from "drizzle-orm";

import { db } from "@/server/db";
import { cards } from "@/server/db/schema";

export type CardType =
  | "story"
  | "character"
  | "environment"
  | "item"
  | "faction"
  | "quest"
  | "world"
  | "beginning";

export interface BaseCard {
  id: string;
  storyId: string;
  type: CardType;
  name: string;
  description?: string;
  data?: Record<string, unknown>;
  updatedAt: string;
}

type UpsertCardInput = {
  storyId: string;
  type: CardType;
  name: string;
  description?: string;
  data?: Record<string, unknown>;
  id?: string;
};

function deepMerge(a: unknown, b: unknown): unknown {
  if (Array.isArray(a) && Array.isArray(b)) {
    return [...a, ...b];
  }
  if (
    a &&
    b &&
    typeof a === "object" &&
    typeof b === "object" &&
    Object.getPrototypeOf(a) === Object.prototype &&
    Object.getPrototypeOf(b) === Object.prototype
  ) {
    const out: Record<string, unknown> = { ...(a as Record<string, unknown>) };
    for (const [key, value] of Object.entries(b as Record<string, unknown>)) {
      out[key] = key in out ? deepMerge(out[key], value) : value;
    }
    return out;
  }
  return b ?? a;
}

function mapCard(row: typeof cards.$inferSelect): BaseCard {
  return {
    id: row.id,
    storyId: row.storyId,
    type: row.type as CardType,
    name: row.name,
    description: row.description ?? undefined,
    data: (row.data ?? {}) as Record<string, unknown>,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getCards(storyId: string): Promise<BaseCard[]> {
  const rows = await db.query.cards.findMany({
    where: eq(cards.storyId, storyId),
  });
  return rows.map(mapCard);
}

export async function getCardByName(
  storyId: string,
  type: CardType,
  name: string
): Promise<BaseCard | null> {
  const row = await db.query.cards.findFirst({
    where: and(
      eq(cards.storyId, storyId),
      eq(cards.type, type),
      eq(cards.name, name)
    ),
  });
  return row ? mapCard(row) : null;
}

export async function listCards(
  storyId: string,
  filter?: Partial<Pick<BaseCard, "type" | "name">>
): Promise<BaseCard[]> {
  const rows = await db.query.cards.findMany({
    where: (fields, operators) => {
      const conditions = [operators.eq(fields.storyId, storyId)];
      if (filter?.type) {
        conditions.push(operators.eq(fields.type, filter.type));
      }
      if (filter?.name) {
        conditions.push(ilike(fields.name, `%${filter.name}%`));
      }
      return operators.and(...conditions);
    },
  });
  return rows.map(mapCard);
}

export async function upsertCard(input: UpsertCardInput): Promise<BaseCard> {
  const now = new Date();
  const existing = await db.query.cards.findFirst({
    where: and(
      eq(cards.storyId, input.storyId),
      eq(cards.type, input.type),
      eq(cards.name, input.name)
    ),
  });

  if (existing) {
    const mergedData = input.data
      ? (existing.data
          ? (deepMerge(existing.data, input.data) as Record<string, unknown>)
          : input.data)
      : existing.data;

    const [updated] = await db
      .update(cards)
      .set({
        description: input.description ?? existing.description,
        data: mergedData ?? existing.data,
        updatedAt: now,
        embedding: null,
      })
      .where(eq(cards.id, existing.id))
      .returning();
    return mapCard(updated);
  }

  const [created] = await db
    .insert(cards)
    .values({
      id: input.id,
      storyId: input.storyId,
      type: input.type,
      name: input.name,
      description: input.description,
      data: input.data ?? {},
      updatedAt: now,
      embedding: null,
    })
    .returning();

  return mapCard(created);
}

export async function deleteCard(storyId: string, cardId: string) {
  await db
    .delete(cards)
    .where(and(eq(cards.id, cardId), eq(cards.storyId, storyId)));
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
