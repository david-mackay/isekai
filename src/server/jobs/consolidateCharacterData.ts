import { sql, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { cards } from "@/server/db/schema";
import { sanitizeStructuredObject } from "@/lib/utils/structuredMerge";

type ConsolidateOptions = {
  storyId?: string;
  dryRun?: boolean;
};

type ConsolidateResult = {
  storyId: string;
  processed: number;
  updated: number;
};

async function fetchStoryIds(): Promise<string[]> {
  const result = await db.execute(
    sql`SELECT DISTINCT story_id FROM cards WHERE type = 'character'`
  );
  return result.rows
    .map((row) => row.story_id as string)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

export async function consolidateCharacterData(
  options: ConsolidateOptions = {}
): Promise<ConsolidateResult[]> {
  const { storyId, dryRun = false } = options;
  const storyIds = storyId ? [storyId] : await fetchStoryIds();
  const results: ConsolidateResult[] = [];

  for (const id of storyIds) {
    const characters = await db.query.cards.findMany({
      where: (fields, operators) =>
        operators.and(
          eq(fields.storyId, id),
          eq(fields.type, "character" as const)
        ),
    });

    let updated = 0;
    for (const character of characters) {
      const currentData =
        (character.data as Record<string, unknown> | null) ?? {};
      const sanitized = sanitizeStructuredObject(currentData);
      const currentJSON = JSON.stringify(currentData);
      const sanitizedJSON = JSON.stringify(sanitized);
      if (currentJSON !== sanitizedJSON) {
        updated += 1;
        if (!dryRun) {
          await db
            .update(cards)
            .set({
              data: sanitized,
              updatedAt: new Date(),
              embedding: null,
            })
            .where(eq(cards.id, character.id));
        }
      }
    }

    results.push({
      storyId: id,
      processed: characters.length,
      updated,
    });
  }

  return results;
}
